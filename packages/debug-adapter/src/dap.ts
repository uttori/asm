import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

import {
  debugMapRangesForAddress,
  debugMapRangesForSource,
  validateDebugMap,
  type DebugMap,
  type DebugMapRange,
} from "@uttori/asm-core/debug-map";

import type {
  DebugAddress,
  DebugBackend,
  DebugBackendEvent,
  DebugBreakpoint,
  DebugInstruction,
  DebugArchitectureCapabilities,
  DebugRegister,
  DebugStackFrame,
  DebugThread,
} from "./contracts.js";
import { evaluateDebugExpression, formatDebugExpressionValue } from "./debug-expression.js";

/** Minimal DAP request shape accepted by the adapter. */
export interface DapRequest {
  readonly seq: number;
  readonly type: "request";
  readonly command: string;
  readonly arguments?: Record<string, unknown>;
}

/** Minimal DAP response shape emitted by the adapter. */
export interface DapResponse {
  readonly seq: number;
  readonly type: "response";
  readonly request_seq: number;
  readonly success: boolean;
  readonly command: string;
  readonly message?: string;
  readonly body?: unknown;
}

/** Minimal DAP event shape emitted by the adapter. */
export interface DapEvent {
  readonly seq: number;
  readonly type: "event";
  readonly event: string;
  readonly body?: unknown;
}

/** Protocol messages emitted by `DebugAdapterSession`. */
export type DapProtocolMessage = DapResponse | DapEvent;

/** Host-provided launch artifacts. File I/O stays outside the protocol adapter. */
export interface DebugAdapterSessionOptions {
  readonly backend: DebugBackend;
  readonly debugMap?: DebugMap;
  readonly output?: Uint8Array;
  readonly sourceRoot?: string;
  /** Optional presentation-only suffix for DAP and virtual-source disassembly rows. */
  readonly instructionAnnotation?: (address: DebugAddress) => string | undefined;
  readonly onMessage?: (message: DapProtocolMessage) => void;
  /** Live DAP hosts configure breakpoints after connection and before launch completes. */
  readonly configurationHandshake?: boolean;
}

const numeric = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;

const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object",
      )
    : [];

const VIRTUAL_DISASSEMBLY_HEADER = [
  "; Debugger disassembly (temporary, read-only view)",
  "; Shown because the current instruction has no matching source line in this project.",
  "; Instructions are decoded from the debug session; edit project source files to change code.",
  "; Columns: address, instruction bytes, assembly instruction.",
  "",
];

/**
 * Formats a qualified address for DAP memory/instruction references.
 * @param {DebugAddress} address Qualified logical address.
 * @returns {string} Stable transport string.
 */
export const formatDebugAddress = (address: DebugAddress): string =>
  `${address.architecture}|${address.addressSpace}|0x${address.address.toString(16)}${
    address.outputOffset === undefined ? "" : `|0x${address.outputOffset.toString(16)}`
  }`;

/**
 * Parses an address produced by `formatDebugAddress`.
 * @param {string} reference Qualified address string.
 * @returns {DebugAddress | undefined} Parsed address, or undefined for malformed input.
 */
export const parseDebugAddress = (reference: string): DebugAddress | undefined => {
  const [architecture, addressSpace, rawAddress, rawOutputOffset, extra] = reference.split("|");
  if (!architecture || !addressSpace || !rawAddress || extra !== undefined) return undefined;
  const address = Number(rawAddress);
  if (!Number.isSafeInteger(address) || address < 0) return undefined;
  const outputOffset = rawOutputOffset === undefined ? undefined : Number(rawOutputOffset);
  if (outputOffset !== undefined && (!Number.isSafeInteger(outputOffset) || outputOffset < 0))
    return undefined;
  return {
    architecture,
    addressSpace,
    address,
    ...(outputOffset === undefined ? {} : { outputOffset }),
  };
};

const backendEvent = (event: DebugBackendEvent): Omit<DapEvent, "seq"> => {
  switch (event.type) {
    case "stopped":
      return {
        type: "event",
        event: "stopped",
        body: { reason: event.reason, threadId: event.threadId, allThreadsStopped: true },
      };
    case "continued":
      return {
        type: "event",
        event: "continued",
        body: { threadId: event.threadId, allThreadsContinued: event.allThreads },
      };
    case "terminated":
      return { type: "event", event: "terminated", body: { restart: event.restart } };
    case "breakpoint":
      return {
        type: "event",
        event: "breakpoint",
        body: { reason: "changed", breakpoint: dapBreakpoint(event.breakpoint) },
      };
    case "output":
      return {
        type: "event",
        event: "output",
        body: { category: event.category, output: event.text },
      };
  }
  throw new Error("Unsupported backend event.");
};

const dapBreakpoint = (breakpoint: DebugBreakpoint): Record<string, unknown> => ({
  id: breakpoint.id,
  verified: breakpoint.verified,
  instructionReference: formatDebugAddress(breakpoint.address),
  ...(breakpoint.message ? { message: breakpoint.message } : {}),
});

const bytesText = (instruction: DebugInstruction): string =>
  instruction.bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ");

/**
 * Maximum time to wait for the asynchronous stopped event that acknowledges an
 * internal pause. A bound prevents an unresponsive emulator from hanging a DAP
 * `setBreakpoints` request indefinitely.
 */
const BREAKPOINT_UPDATE_STOP_TIMEOUT_MS = 5_000;

/** Last execution state reported by the backend, or `unknown` before/after a session. */
type ExecutionState = "unknown" | "running" | "stopped";

/**
 * Completion hooks for a pause requested solely to edit the emulator's breakpoint table.
 * The resolved boolean says whether the adapter should resume after the edit.
 */
type MaintenancePause = {
  readonly resolve: (resume: boolean) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

type VariableContainer =
  | {
      readonly kind: "registers";
      readonly registers: readonly DebugRegister[];
      readonly group: string;
    }
  | { readonly kind: "flags"; readonly registers: readonly DebugRegister[] }
  | {
      readonly kind: "memory-spaces";
      readonly architecture: string;
      readonly spaces: readonly string[];
    }
  | { readonly kind: "stack"; readonly address: DebugAddress; readonly count: number };

const registerNumber = (register: DebugRegister | undefined): number | undefined => {
  if (!register) return undefined;
  const normalized = register.value.startsWith("0x") ? register.value.slice(2) : register.value;
  const value = Number.parseInt(normalized, 16);
  return Number.isSafeInteger(value) ? value : undefined;
};

const processorLabel = (architecture: string): string => {
  if (architecture === "snes.65816") return "65816";
  if (architecture === "snes.spc700") return "SPC700";
  if (architecture === "snes.superfx") return "Super FX";
  return architecture;
};

/**
 * Emulator-neutral DAP session. It translates protocol requests into the
 * `DebugBackend` contract and never exposes backend implementation details.
 */
export class DebugAdapterSession {
  readonly #backend: DebugBackend;
  readonly #map?: DebugMap;
  readonly #sourceRoot: string;
  readonly #instructionAnnotation?: (address: DebugAddress) => string | undefined;
  readonly #onMessage?: (message: DapProtocolMessage) => void;
  readonly #mapIssues: readonly string[];
  readonly #sourceBreakpoints = new Map<string, DebugAddress[]>();
  readonly #instructionBreakpoints = new Map<string, DebugAddress>();
  readonly #variableContainers = new Map<number, VariableContainer>();
  readonly #frames = new Map<number, DebugStackFrame>();
  readonly #threads = new Map<number, DebugThread>();
  readonly #virtualSources = new Map<number, DebugAddress>();
  readonly #virtualReferences = new Map<string, number>();
  readonly #subscription;
  #nextSequence = 1;
  #nextVariableReference = 1;
  #nextSourceReference = 1;
  /**
   * Keeps events emitted during overlapping DAP requests with the request that caused
   * them. A single shared pending-event array would mix events between concurrent calls.
   */
  readonly #eventContext = new AsyncLocalStorage<{
    active: boolean;
    pending: Array<Omit<DapEvent, "seq">>;
  }>();
  readonly #configurationHandshake: boolean;
  #configurationDone?: () => void;
  #cancelConfiguration?: () => void;
  /** Needed because ares and MesenCE accept breakpoint-table changes only while stopped. */
  #executionState: ExecutionState = "unknown";
  /** In-flight internal pause whose stopped event must not look like a user-visible stop. */
  #maintenancePause?: MaintenancePause;
  /** Thread whose internal resume event must likewise remain invisible to the IDE. */
  #maintenanceResumeThreadId?: number;
  /** Tail of serialized, whole-table breakpoint replacements. */
  #breakpointUpdateQueue: Promise<void> = Promise.resolve();

  /**
   * Creates a DAP session around one backend.
   * @param {DebugAdapterSessionOptions} options Backend, map, and host callbacks.
   */
  constructor(options: DebugAdapterSessionOptions) {
    this.#backend = options.backend;
    this.#map = options.debugMap;
    this.#sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
    this.#instructionAnnotation = options.instructionAnnotation;
    this.#onMessage = options.onMessage;
    this.#configurationHandshake = options.configurationHandshake ?? false;
    this.#mapIssues = options.debugMap ? validateDebugMap(options.debugMap, options.output) : [];
    this.#subscription = this.#backend.onEvent((event) => this.#emitBackendEvent(event));
  }

  /** Releases the backend event subscription. */
  dispose(): void {
    this.#cancelConfiguration?.();
    this.#cancelMaintenancePause(new Error("Debugger session disposed."));
    this.#subscription.dispose();
  }

  /**
   * Handles one request and returns all deterministically ordered response/events.
   * @param {DapRequest} request Incoming request.
   * @returns {Promise<readonly DapProtocolMessage[]>} Response followed by queued events.
   */
  async dispatch(request: DapRequest): Promise<readonly DapProtocolMessage[]> {
    const pending: Array<Omit<DapEvent, "seq">> = [];
    const context = { active: true, pending };
    return this.#eventContext.run(context, async () => {
      let response: DapResponse;
      try {
        const body = await this.#route(request.command, request.arguments ?? {});
        response = {
          seq: this.#nextSequence++,
          type: "response",
          request_seq: request.seq,
          success: true,
          command: request.command,
          ...(body === undefined ? {} : { body }),
        };
      } catch (error) {
        if (request.command === "launch" || request.command === "attach") {
          // A cancelled/failed launch must not make the client show a stopped session.
          // Compact in place so the active event context keeps its array and large output bursts
          // cannot overflow the argument stack while we are already handling a launch failure.
          let retained = 0;
          for (const event of pending) if (event.event === "output") pending[retained++] = event;
          pending.length = retained;
        }
        response = {
          seq: this.#nextSequence++,
          type: "response",
          request_seq: request.seq,
          success: false,
          command: request.command,
          message: error instanceof Error ? error.message : String(error),
        };
      } finally {
        context.active = false;
      }
      if (
        (request.command === "launch" || request.command === "attach") &&
        response.success &&
        !this.#configurationHandshake
      ) {
        pending.unshift({ type: "event", event: "initialized" });
      }
      const messages: DapProtocolMessage[] = [
        response,
        ...pending.map((event) => ({ ...event, seq: this.#nextSequence++ })),
      ];
      for (const message of messages) this.#onMessage?.(message);
      if (request.command === "configurationDone" && response.success) this.#configurationDone?.();
      return messages;
    });
  }

  /**
   * Runs the DAP configuration window after the live backend is connected.
   * VS Code sends its initial breakpoints between `initialized` and
   * `configurationDone`; connecting first leaves the emulator stopped and able to
   * accept those breakpoint-table writes before execution begins.
   * @returns {Promise<void>} Resolves after the client finishes breakpoint configuration.
   */
  async #configure(): Promise<void> {
    if (!this.#configurationHandshake) return;
    const configured = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#configurationDone = undefined;
        this.#cancelConfiguration = undefined;
        reject(new Error("Debugger configuration timed out after 30 seconds."));
      }, 30_000);
      this.#configurationDone = () => {
        clearTimeout(timer);
        this.#configurationDone = undefined;
        this.#cancelConfiguration = undefined;
        resolve();
      };
      this.#cancelConfiguration = () => {
        clearTimeout(timer);
        this.#configurationDone = undefined;
        this.#cancelConfiguration = undefined;
        reject(new Error("Debugger launch cancelled."));
      };
    });
    this.#onMessage?.({ type: "event", event: "initialized", seq: this.#nextSequence++ });
    await configured;
  }

  async #route(command: string, args: Record<string, unknown>): Promise<unknown> {
    switch (command) {
      case "initialize":
        return this.#capabilities();
      case "launch":
        if (this.#mapIssues.length > 0) throw new Error(this.#mapIssues.join(" "));
        await this.#backend.connect({ reset: true });
        await this.#configure();
        return {};
      case "attach":
        if (this.#mapIssues.length > 0) throw new Error(this.#mapIssues.join(" "));
        await this.#backend.connect({ reset: false });
        await this.#configure();
        return {};
      case "configurationDone":
        return {};
      case "threads":
        return this.#threadList();
      case "stackTrace":
        return this.#stackTrace(numeric(args.threadId));
      case "scopes":
        return this.#scopes(numeric(args.frameId));
      case "variables":
        return this.#variables(numeric(args.variablesReference));
      case "evaluate":
        return this.#evaluate(args);
      case "readMemory":
        return this.#readMemory(args);
      case "setBreakpoints":
        return this.#queueBreakpointUpdate(() => this.#setSourceBreakpoints(args));
      case "setInstructionBreakpoints":
        return this.#queueBreakpointUpdate(() => this.#setInstructionBreakpoints(args));
      case "breakpointLocations":
        return this.#breakpointLocations(args);
      case "pause":
        await this.#assertThreadCapability(numeric(args.threadId), "pause");
        await this.#backend.pause(numeric(args.threadId));
        return {};
      case "continue":
        await this.#assertThreadCapability(numeric(args.threadId), "pause");
        await this.#backend.continue(numeric(args.threadId));
        return { allThreadsContinued: true };
      case "next":
        await this.#assertStepCapability(
          numeric(args.threadId),
          args.granularity === "instruction" ? "instruction" : "over",
        );
        await this.#backend.step(
          numeric(args.threadId),
          args.granularity === "instruction" ? "instruction" : "over",
        );
        return {};
      case "stepIn":
        await this.#assertStepCapability(numeric(args.threadId), "in");
        await this.#backend.step(numeric(args.threadId), "in");
        return {};
      case "stepOut":
        await this.#assertStepCapability(numeric(args.threadId), "out");
        await this.#backend.step(numeric(args.threadId), "out");
        return {};
      case "disassemble":
        return this.#disassemble(args);
      case "source":
        return this.#source(numeric(args.sourceReference));
      case "uttori/traceCapabilities":
        return this.#traceCapabilities();
      case "uttori/capture": {
        const request = args as CaptureRequestV2;
        validateCaptureRequest(request);
        if (!this.#backend.capture) throw new Error("This backend does not support capture v2.");
        return this.#backend.capture(request);
      }
      case "uttori/startTrace":
        if (args.detail !== undefined && args.detail !== "pc" && args.detail !== "full")
          throw new Error("Unsupported trace detail mode.");
        await this.#backend.startTrace({
          ...(args.detail === undefined ? {} : { detail: args.detail }),
          architecture: typeof args.architecture === "string" ? args.architecture : "",
          addressSpace: typeof args.addressSpace === "string" ? args.addressSpace : "",
        });
        return {};
      case "uttori/readTrace":
        return this.#backend.readTrace(numeric(args.maxEvents));
      case "uttori/stopTrace":
        await this.#backend.stopTrace();
        return {};
      case "disconnect":
        this.#cancelConfiguration?.();
        await this.#backend.disconnect({ terminate: args.terminateDebuggee !== false });
        return {};
      default:
        throw new Error(`Unsupported DAP request '${command}'.`);
    }
  }

  #capabilities(): Record<string, boolean> {
    return {
      supportsConfigurationDoneRequest: true,
      supportsReadMemoryRequest: this.#backend.capabilities.memory,
      supportsDisassembleRequest: this.#backend.capabilities.disassemble,
      supportsInstructionBreakpoints: this.#backend.capabilities.breakpoints,
      supportsBreakpointLocationsRequest:
        Boolean(this.#map) && this.#backend.capabilities.breakpoints,
      supportsSteppingGranularity: this.#backend.capabilities.step,
      supportsTerminateDebuggee: true,
      supportsEvaluateForHovers: this.#backend.capabilities.registers,
      supportsValueFormattingOptions: true,
    };
  }

  #architectureCapabilities(architecture: string): DebugArchitectureCapabilities | undefined {
    return this.#backend.capabilities.architectures.find(
      (candidate) => candidate.architecture === architecture,
    );
  }

  async #threadList(): Promise<Record<string, unknown>> {
    const threads = await this.#backend.threads();
    this.#threads.clear();
    for (const thread of threads) this.#threads.set(thread.id, thread);
    return {
      threads: threads.map((thread) => {
        const capabilities = this.#architectureCapabilities(thread.architecture);
        const unavailable = capabilities
          ? [
              !capabilities.step ? "step" : undefined,
              !capabilities.registers ? "registers" : undefined,
              !capabilities.memory ? "memory" : undefined,
              !capabilities.breakpoints ? "breakpoints" : undefined,
              !capabilities.disassemble ? "disassembly" : undefined,
            ].filter((entry): entry is string => Boolean(entry))
          : ["all inspection"];
        const supportedSteps = capabilities?.stepKinds ?? ["instruction", "over", "in", "out"];
        if (capabilities?.step && !supportedSteps.includes("over")) unavailable.push("step over");
        if (capabilities?.step && !supportedSteps.includes("out")) unavailable.push("step out");
        return {
          ...thread,
          name:
            unavailable.length === 0
              ? thread.name
              : `${thread.name} (unavailable: ${unavailable.join(", ")})`,
        };
      }),
    };
  }

  async #assertThreadCapability(threadId: number, operation: "pause" | "step"): Promise<void> {
    if (!this.#threads.has(threadId)) await this.#threadList();
    const thread = this.#threads.get(threadId);
    if (!thread) throw new Error(`Unknown debugger thread ${threadId}.`);
    const capabilities = this.#architectureCapabilities(thread.architecture);
    if (!capabilities?.[operation])
      throw new Error(`${processorLabel(thread.architecture)} does not support ${operation}.`);
  }

  async #assertStepCapability(
    threadId: number,
    kind: "instruction" | "over" | "in" | "out",
  ): Promise<void> {
    await this.#assertThreadCapability(threadId, "step");
    const thread = this.#threads.get(threadId)!;
    const capabilities = this.#architectureCapabilities(thread.architecture)!;
    const supported = capabilities.stepKinds ?? ["instruction", "over", "in", "out"];
    if (!supported.includes(kind))
      throw new Error(`${processorLabel(thread.architecture)} does not support step ${kind}.`);
  }

  #traceCapabilities(): Record<string, unknown> {
    const traces: Array<Record<string, unknown>> = [];
    for (const architecture of this.#backend.capabilities.architectures) {
      const trace = architecture.trace;
      if (!trace) continue;
      for (const addressSpace of trace.addressSpaces)
        traces.push({
          architecture: architecture.architecture,
          addressSpace,
          maxBufferedEvents: trace.maxBufferedEvents,
          maxBatchEvents: trace.maxBatchEvents,
          ...(trace.instructionDetails === undefined
            ? {}
            : { instructionDetails: trace.instructionDetails }),
        });
    }
    return { traces };
  }

  async #stackTrace(threadId: number): Promise<Record<string, unknown>> {
    const frames = await this.#backend.stackFrames(threadId);
    for (const frame of frames) this.#frames.set(frame.id, frame);
    return {
      stackFrames: frames.map((frame) => {
        const range = this.#rangeForAddress(frame.pc);
        if (range && this.#map) {
          const source = this.#map.sources.find((candidate) => candidate.id === range.sourceId);
          if (source) {
            const sourcePath = path.isAbsolute(source.path)
              ? source.path
              : path.resolve(this.#sourceRoot, source.path);
            return {
              id: frame.id,
              name: frame.currentOnly ? `${frame.name} (current frame only)` : frame.name,
              line: range.line,
              column: 1,
              source: { name: path.basename(sourcePath), path: sourcePath },
              instructionPointerReference: formatDebugAddress(frame.pc),
            };
          }
        }
        const sourceReference = this.#virtualSourceReference(frame.pc);
        return {
          id: frame.id,
          name: frame.currentOnly ? `${frame.name} (current frame only)` : frame.name,
          line: VIRTUAL_DISASSEMBLY_HEADER.length + 1,
          column: 1,
          source: {
            name: `${frame.pc.architecture} disassembly`,
            // VS Code's debug-source URI helper requires a path even for reference-only sources.
            // This is a virtual identity, never a filesystem path to read or write.
            path: `/uttori-disassembly/${frame.pc.architecture}/${sourceReference}.asm`,
            sourceReference,
            presentationHint: "normal",
          },
          instructionPointerReference: formatDebugAddress(frame.pc),
        };
      }),
      totalFrames: frames.length,
    };
  }

  #addVariableContainer(container: VariableContainer): number {
    const reference = this.#nextVariableReference++;
    this.#variableContainers.set(reference, container);
    return reference;
  }

  async #scopes(frameId: number): Promise<Record<string, unknown>> {
    const frame = this.#frames.get(frameId);
    if (!frame) throw new Error("Unknown stack frame; refresh the call stack and try again.");
    const capabilities = this.#architectureCapabilities(frame.pc.architecture);
    if (!capabilities) return { scopes: [] };
    const scopes: Array<Record<string, unknown>> = [];
    const registers = capabilities.registers ? await this.#backend.registers(frameId) : [];
    const groups = [...new Set(registers.map((register) => register.group ?? "Registers"))];
    for (const group of groups) {
      scopes.push({
        name: `${processorLabel(frame.pc.architecture)} ${group}`,
        variablesReference: this.#addVariableContainer({ kind: "registers", registers, group }),
        expensive: false,
        presentationHint: "registers",
      });
    }
    if (
      frame.pc.architecture === "snes.65816" &&
      registers.some((register) => register.name.toUpperCase() === "P")
    ) {
      scopes.push({
        name: "65816 Flags",
        variablesReference: this.#addVariableContainer({ kind: "flags", registers }),
        expensive: false,
        presentationHint: "registers",
      });
    }
    const safeSpaces = capabilities.memorySpaces
      .filter((space) => space.sideEffectFree)
      .map((space) => space.addressSpace);
    if (safeSpaces.length > 0) {
      scopes.push({
        name: `${processorLabel(frame.pc.architecture)} Memory Spaces`,
        variablesReference: this.#addVariableContainer({
          kind: "memory-spaces",
          architecture: frame.pc.architecture,
          spaces: safeSpaces,
        }),
        expensive: false,
      });
    }
    const stack = this.#stackAddress(frame.pc.architecture, safeSpaces, registers);
    if (stack) {
      scopes.push({
        name: `${processorLabel(frame.pc.architecture)} Stack Bytes`,
        variablesReference: this.#addVariableContainer({
          kind: "stack",
          address: stack,
          count: 32,
        }),
        expensive: false,
      });
    }
    return { scopes };
  }

  #stackAddress(
    architecture: string,
    spaces: readonly string[],
    registers: readonly DebugRegister[],
  ): DebugAddress | undefined {
    const stackRegister = registers.find((register) =>
      ["S", "SP"].includes(register.name.toUpperCase()),
    );
    const stackPointer = registerNumber(stackRegister);
    if (stackPointer === undefined) return undefined;
    if (architecture === "snes.65816") {
      const addressSpace = spaces.find((space) => space === "snes.wram") ?? spaces[0];
      return addressSpace
        ? { architecture, addressSpace, address: Math.min(0x1ffff, stackPointer + 1) }
        : undefined;
    }
    if (architecture === "snes.spc700") {
      const addressSpace = spaces.find((space) => space === "spc.aram") ?? spaces[0];
      return addressSpace
        ? { architecture, addressSpace, address: 0x100 | ((stackPointer + 1) & 0xff) }
        : undefined;
    }
    return undefined;
  }

  #flagVariables(registers: readonly DebugRegister[]): Array<Record<string, unknown>> {
    const status = registerNumber(
      registers.find((register) => register.name.toUpperCase() === "P"),
    );
    const emulation = registerNumber(
      registers.find((register) => register.name.toUpperCase() === "E"),
    );
    if (status === undefined) return [];
    const flags = [
      ["N", 7],
      ["V", 6],
      ["M", 5],
      ["X", 4],
      ["D", 3],
      ["I", 2],
      ["Z", 1],
      ["C", 0],
    ] as const;
    return [
      ...flags.map(([name, bit]) => {
        const set = (status & (1 << bit)) !== 0;
        return {
          name,
          value: set ? "set (1)" : "clear (0)",
          type: "boolean",
          variablesReference: 0,
        };
      }),
      ...(emulation === undefined
        ? []
        : [
            {
              name: "E",
              value: emulation === 0 ? "clear (0)" : "set (1)",
              type: "boolean",
              variablesReference: 0,
            },
          ]),
    ];
  }

  async #variables(variablesReference: number): Promise<Record<string, unknown>> {
    const container = this.#variableContainers.get(variablesReference);
    if (!container) throw new Error("Unknown variables reference.");
    if (container.kind === "registers") {
      return {
        variables: container.registers
          .filter((register) => (register.group ?? "Registers") === container.group)
          .map((register) => ({
            name: register.name,
            value: `0x${register.value}`,
            type: `uint${register.bits}`,
            variablesReference: 0,
          })),
      };
    }
    if (container.kind === "flags") return { variables: this.#flagVariables(container.registers) };
    if (container.kind === "memory-spaces") {
      return {
        variables: container.spaces.map((addressSpace) => ({
          name: addressSpace,
          value: "side-effect-free memory",
          type: "memory",
          memoryReference: formatDebugAddress({
            architecture: container.architecture,
            addressSpace,
            address: 0,
          }),
          variablesReference: 0,
        })),
      };
    }
    const memory = await this.#backend.readMemory(container.address, container.count);
    const rows: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < memory.bytes.length; offset += 8) {
      const bytes = memory.bytes.subarray(offset, offset + 8);
      const address = { ...memory.address, address: memory.address.address + offset };
      rows.push({
        name: `0x${address.address.toString(16).padStart(4, "0")}`,
        value: [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(" "),
        type: "bytes",
        memoryReference: formatDebugAddress(address),
        variablesReference: 0,
      });
    }
    if (memory.unreadableBytes > 0)
      rows.push({
        name: "unreadable",
        value: `${memory.unreadableBytes} byte(s)`,
        variablesReference: 0,
      });
    return { variables: rows };
  }

  async #evaluate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.#backend.capabilities.registers)
      throw new Error("Debugger expression evaluation requires register support.");
    const expression = typeof args.expression === "string" ? args.expression : "";
    const frameId = numeric(args.frameId, -1);
    if (frameId < 1) throw new Error("Debugger expression evaluation requires a stack frame.");
    const result = evaluateDebugExpression(expression, await this.#backend.registers(frameId));
    return {
      result: formatDebugExpressionValue(result.value),
      type: result.bits === undefined ? "integer" : `uint${result.bits}`,
      variablesReference: 0,
    };
  }

  async #readMemory(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reference = typeof args.memoryReference === "string" ? args.memoryReference : "";
    const address = parseDebugAddress(reference);
    if (!address) throw new Error("Invalid memoryReference.");
    const capabilities = this.#architectureCapabilities(address.architecture);
    const memorySpace = capabilities?.memorySpaces.find(
      (candidate) => candidate.addressSpace === address.addressSpace,
    );
    if (!memorySpace?.sideEffectFree)
      throw new Error(
        `Memory space '${address.addressSpace}' is unavailable or not guaranteed side-effect-free.`,
      );
    const offset = numeric(args.offset);
    const count = numeric(args.count);
    const result = await this.#backend.readMemory(
      { ...address, address: address.address + offset },
      count,
    );
    return {
      address: formatDebugAddress(result.address),
      data: Buffer.from(result.bytes).toString("base64"),
      unreadableBytes: result.unreadableBytes,
    };
  }

  /**
   * Replaces the breakpoint set for one source and reports the executable line chosen
   * for each request. Directive/comment lines move forward to the next mapped instruction.
   * @param {Record<string, unknown>} args DAP `setBreakpoints` arguments.
   * @returns {Promise<Record<string, unknown>>} Verified or rejected breakpoint results.
   */
  async #setSourceBreakpoints(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.#map) throw new Error("Source breakpoints require a debug map.");
    const source = args.source as Record<string, unknown> | undefined;
    const sourcePath = typeof source?.path === "string" ? source.path : "";
    if (!sourcePath) throw new Error("Source breakpoint request requires source.path.");
    const requested = records(args.breakpoints);
    const addresses: DebugAddress[] = [];
    const resolved: Array<{ requestedLine: number; line: number; address?: DebugAddress }> = [];
    for (const breakpoint of requested) {
      const requestedLine = numeric(breakpoint.line);
      const range = this.#sourceBreakpointRange(sourcePath, requestedLine);
      const address = range ? this.#addressForRange(range) : undefined;
      if (address && this.#supportsBreakpoint(address)) addresses.push(address);
      resolved.push({ requestedLine, line: range?.line ?? requestedLine, address });
    }
    this.#sourceBreakpoints.set(sourcePath, addresses);
    const applied = await this.#applyBreakpoints();
    return {
      breakpoints: resolved.map(({ requestedLine, line, address }) => {
        const match = address ? applied.get(formatDebugAddress(address)) : undefined;
        return {
          ...(match
            ? dapBreakpoint(match)
            : {
                verified: false,
                message:
                  address && !this.#supportsBreakpoint(address)
                    ? `Breakpoints are unavailable for ${processorLabel(address.architecture)}.`
                    : `No executable range at or after line ${requestedLine}.`,
              }),
          line,
        };
      }),
    };
  }

  /**
   * Returns only mapped, backend-supported lines so the IDE can render valid gutter
   * locations before the user creates a breakpoint.
   * @param {Record<string, unknown>} args DAP source range to query.
   * @returns {Record<string, unknown>} Executable source locations in the requested range.
   */
  #breakpointLocations(args: Record<string, unknown>): Record<string, unknown> {
    if (!this.#map) throw new Error("Breakpoint locations require a debug map.");
    const source = args.source as Record<string, unknown> | undefined;
    const sourcePath = typeof source?.path === "string" ? source.path : "";
    if (!sourcePath) throw new Error("Breakpoint location request requires source.path.");
    const startLine = numeric(args.line);
    const endLine = Math.max(startLine, numeric(args.endLine, startLine));
    const lines = new Set(
      this.#sourceRanges(sourcePath)
        .filter(
          (range) =>
            range.line >= startLine &&
            range.line <= endLine &&
            this.#supportsBreakpoint(this.#addressForRange(range)),
        )
        .map((range) => range.line),
    );
    return {
      breakpoints: [...lines]
        .sort((left, right) => left - right)
        .map((line) => ({ line, column: 1 })),
    };
  }

  async #setInstructionBreakpoints(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.#instructionBreakpoints.clear();
    const requested = records(args.breakpoints);
    const parsed = requested.map((breakpoint) => {
      const reference =
        typeof breakpoint.instructionReference === "string" ? breakpoint.instructionReference : "";
      const address = parseDebugAddress(reference);
      if (address) {
        const offset = numeric(breakpoint.offset);
        const adjusted = { ...address, address: address.address + offset };
        if (this.#supportsBreakpoint(adjusted))
          this.#instructionBreakpoints.set(formatDebugAddress(adjusted), adjusted);
        return adjusted;
      }
      return undefined;
    });
    const applied = await this.#applyBreakpoints();
    return {
      breakpoints: parsed.map((address) => {
        const match = address ? applied.get(formatDebugAddress(address)) : undefined;
        return match
          ? dapBreakpoint(match)
          : {
              verified: false,
              message:
                address && !this.#supportsBreakpoint(address)
                  ? `Breakpoints are unavailable for ${processorLabel(address.architecture)}.`
                  : "Invalid address.",
            };
      }),
    };
  }

  #supportsBreakpoint(address: DebugAddress): boolean {
    return this.#architectureCapabilities(address.architecture)?.breakpoints === true;
  }

  /**
   * Applies the union of source and instruction breakpoints as one backend table.
   * Live emulators require a stopped CPU for this mutation, so a running session is
   * paused briefly and resumed after the replacement succeeds or fails.
   * @returns {Promise<Map<string, DebugBreakpoint>>} Applied breakpoints keyed by address.
   */
  async #applyBreakpoints(): Promise<Map<string, DebugBreakpoint>> {
    const source = [...this.#sourceBreakpoints.values()].flat();
    const instruction = [...this.#instructionBreakpoints.values()];
    const unique = new Map(
      [...source, ...instruction].map((address) => [formatDebugAddress(address), address]),
    );
    const addresses = [...unique.values()].filter((address) => this.#supportsBreakpoint(address));
    // The pause is protocol maintenance, not a debugging stop the user asked to observe.
    const paused = await this.#pauseForBreakpointUpdate(addresses);
    try {
      const breakpoints = await this.#backend.setBreakpoints(addresses);
      return new Map(
        breakpoints.map((breakpoint) => [formatDebugAddress(breakpoint.address), breakpoint]),
      );
    } finally {
      if (paused?.resume) await this.#resumeAfterBreakpointUpdate(paused.threadId);
    }
  }

  /**
   * Finds ranges for either a portable map path or its absolute workspace spelling.
   * @param {string} sourcePath Source path supplied by the DAP client.
   * @returns {readonly DebugMapRange[]} All mapped ranges belonging to the source.
   */
  #sourceRanges(sourcePath: string): readonly DebugMapRange[] {
    if (!this.#map) return [];
    const normalized = sourcePath.split(path.sep).join("/");
    const sourceIds = new Set(
      this.#map.sources
        .filter((source) => source.path === normalized || normalized.endsWith(`/${source.path}`))
        .map((source) => source.id),
    );
    return this.#map.ranges.filter((range) => sourceIds.has(range.sourceId));
  }

  /**
   * Resolves an exact line first, then the nearest later executable line in the same source.
   * @param {string} sourcePath Source path supplied by the DAP client.
   * @param {number} requestedLine One-based requested source line.
   * @returns {DebugMapRange | undefined} Executable range chosen for the breakpoint.
   */
  #sourceBreakpointRange(sourcePath: string, requestedLine: number): DebugMapRange | undefined {
    return (
      debugMapRangesForSource(this.#map!, sourcePath, requestedLine).find((range) =>
        this.#supportsBreakpoint(this.#addressForRange(range)),
      ) ??
      this.#sourceRanges(sourcePath)
        .filter(
          (range) =>
            range.line > requestedLine && this.#supportsBreakpoint(this.#addressForRange(range)),
        )
        .sort((left, right) => left.line - right.line || left.start - right.start)[0]
    );
  }

  /**
   * Serializes breakpoint requests because DAP may issue one per source concurrently,
   * while the emulator API replaces one global table. Overlapping replacements could
   * otherwise restore a stale union and silently lose a breakpoint.
   * @param {() => Promise<T>} update Deferred breakpoint-table replacement.
   * @returns {Promise<T>} Result of the replacement after earlier updates settle.
   */
  #queueBreakpointUpdate<T>(update: () => Promise<T>): Promise<T> {
    const result = this.#breakpointUpdateQueue.then(update, update);
    this.#breakpointUpdateQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * Stops a running emulator long enough to change its breakpoint table.
   *
   * The returned `resume` flag is false when a real breakpoint/exception wins the race
   * with our pause request. In that case the real stop remains visible and must not be
   * undone by an automatic continue.
   * @param {readonly DebugAddress[]} addresses Breakpoints about to replace the table.
   * @returns {Promise<{ readonly threadId: number; readonly resume: boolean } | undefined>}
   * Maintenance state, or undefined when the emulator was not running.
   */
  async #pauseForBreakpointUpdate(
    addresses: readonly DebugAddress[],
  ): Promise<{ readonly threadId: number; readonly resume: boolean } | undefined> {
    if (this.#executionState !== "running") return undefined;
    if (this.#threads.size === 0) await this.#threadList();
    const architectures = new Set(addresses.map(({ architecture }) => architecture));
    // Prefer the processor receiving a breakpoint. For an empty replacement (removal),
    // fall back to any processor whose debugger owns a breakpoint table.
    const thread =
      [...this.#threads.values()].find(({ architecture }) => architectures.has(architecture)) ??
      [...this.#threads.values()].find(({ architecture }) =>
        Boolean(this.#architectureCapabilities(architecture)?.breakpoints),
      );
    if (!thread) throw new Error("No breakpoint-capable debugger thread is available.");

    let resolvePause!: (resume: boolean) => void;
    let rejectPause!: (error: Error) => void;
    const stopped = new Promise<boolean>((resolve, reject) => {
      resolvePause = resolve;
      rejectPause = reject;
    });
    const timer = setTimeout(
      () => rejectPause(new Error("Timed out while pausing to update emulator breakpoints.")),
      BREAKPOINT_UPDATE_STOP_TIMEOUT_MS,
    );
    timer.unref();
    this.#maintenancePause = { resolve: resolvePause, reject: rejectPause, timer };
    try {
      await this.#backend.pause(thread.id);
      return { threadId: thread.id, resume: await stopped };
    } finally {
      if (this.#maintenancePause?.timer === timer) this.#maintenancePause = undefined;
      clearTimeout(timer);
    }
  }

  /**
   * Resumes after a confirmed maintenance pause and marks its continued event as internal.
   * @param {number} threadId Processor thread paused for the table replacement.
   * @returns {Promise<void>} Resolves when the backend accepts the continue request.
   */
  async #resumeAfterBreakpointUpdate(threadId: number): Promise<void> {
    this.#maintenanceResumeThreadId = threadId;
    try {
      await this.#backend.continue(threadId);
    } catch (error) {
      if (this.#maintenanceResumeThreadId === threadId) this.#maintenanceResumeThreadId = undefined;
      throw error;
    }
  }

  /**
   * Rejects an in-flight breakpoint update when the debug session ends underneath it.
   * @param {Error} error Termination error reported to the waiting DAP request.
   * @returns {void}
   */
  #cancelMaintenancePause(error: Error): void {
    const maintenance = this.#maintenancePause;
    if (!maintenance) return;
    this.#maintenancePause = undefined;
    clearTimeout(maintenance.timer);
    maintenance.reject(error);
  }

  async #disassemble(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reference = typeof args.memoryReference === "string" ? args.memoryReference : "";
    const address = parseDebugAddress(reference);
    if (!address) throw new Error("Invalid memoryReference.");
    const instructions = await this.#backend.disassemble(
      { ...address, address: address.address + numeric(args.instructionOffset) },
      numeric(args.instructionCount),
    );
    return {
      instructions: instructions.map((instruction) => ({
        address: formatDebugAddress(instruction.address),
        instructionBytes: bytesText(instruction),
        instruction: this.#annotatedInstructionText(instruction),
        ...(instruction.symbol ? { symbol: instruction.symbol } : {}),
      })),
    };
  }

  async #source(sourceReference: number): Promise<Record<string, unknown>> {
    const address = this.#virtualSources.get(sourceReference);
    if (!address) throw new Error("Unknown source reference.");
    const instructions = await this.#backend.disassemble(address, 32);
    const content = [
      ...VIRTUAL_DISASSEMBLY_HEADER,
      ...instructions.map(
        (instruction) =>
          `${formatDebugAddress(instruction.address)}  ${bytesText(instruction).padEnd(12)}  ${this.#annotatedInstructionText(instruction)}`,
      ),
    ].join("\n");
    return { content: `${content}\n`, mimeType: "text/x-uttori-asm" };
  }

  #rangeForAddress(address: DebugAddress): DebugMapRange | undefined {
    return this.#map
      ? debugMapRangesForAddress(this.#map, address.addressSpace, address.address, {
          architecture: address.architecture,
          outputOffset: address.outputOffset,
        })[0]
      : undefined;
  }

  #annotatedInstructionText(instruction: DebugInstruction): string {
    let annotation: string | undefined;
    try {
      annotation = this.#instructionAnnotation?.(instruction.address);
    } catch {
      // Presentation metadata must never break debugger control or disassembly.
    }
    return annotation ? `${instruction.text} ; ${annotation}` : instruction.text;
  }

  #addressForRange(range: DebugMapRange): DebugAddress {
    return {
      architecture: range.architecture,
      addressSpace: range.addressSpace,
      address: range.start,
      ...(range.outputStart === undefined ? {} : { outputOffset: range.outputStart }),
    };
  }

  #virtualSourceReference(address: DebugAddress): number {
    const key = formatDebugAddress(address);
    const existing = this.#virtualReferences.get(key);
    if (existing !== undefined) return existing;
    const reference = this.#nextSourceReference++;
    this.#virtualReferences.set(key, reference);
    this.#virtualSources.set(reference, address);
    return reference;
  }

  #emitBackendEvent(event: DebugBackendEvent): void {
    if (event.type === "stopped") {
      this.#executionState = "stopped";
      this.#frames.clear();
      this.#variableContainers.clear();
      this.#virtualSources.clear();
      this.#virtualReferences.clear();
      const maintenance = this.#maintenancePause;
      if (maintenance) {
        this.#maintenancePause = undefined;
        clearTimeout(maintenance.timer);
        // Only a `pause` stop acknowledges our request. If execution hit a breakpoint,
        // exception, or step first, preserve that event and leave the emulator stopped.
        const resume = event.reason === "pause";
        maintenance.resolve(resume);
        // Hiding the transient stop prevents UI flicker and prevents VS Code from issuing
        // stack/register reads while the adapter is immediately replacing breakpoints.
        if (resume) return;
      }
    } else if (event.type === "continued") {
      this.#executionState = "running";
      if (this.#maintenanceResumeThreadId === event.threadId) {
        this.#maintenanceResumeThreadId = undefined;
        // This is the counterpart to the hidden maintenance stop, not a user continue.
        return;
      }
    } else if (event.type === "terminated") {
      this.#executionState = "unknown";
      this.#maintenanceResumeThreadId = undefined;
      this.#cancelMaintenancePause(new Error("Debugger terminated while updating breakpoints."));
    }
    const translated = backendEvent(event);
    const context = this.#eventContext.getStore();
    if (context?.active) {
      context.pending.push(translated);
      return;
    }
    this.#onMessage?.({ ...translated, seq: this.#nextSequence++ });
  }
}

/**
 * Encodes one DAP message with a UTF-8 byte-counted Content-Length header.
 * @param {DapRequest | DapProtocolMessage} message Protocol message.
 * @returns {Uint8Array} Framed transport bytes.
 */
export const encodeDapMessage = (message: DapRequest | DapProtocolMessage): Uint8Array => {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
};

/** Incremental parser for stdio/socket DAP framing. */
export class DapMessageParser {
  #buffer = Buffer.alloc(0);

  /**
   * Adds a transport chunk and returns every complete request.
   * @param {Uint8Array} chunk Transport bytes.
   * @returns {readonly DapRequest[]} Complete parsed requests.
   */
  push(chunk: Uint8Array): readonly DapRequest[] {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const messages: DapRequest[] = [];
    while (true) {
      const separator = this.#buffer.indexOf("\r\n\r\n");
      if (separator < 0) break;
      const header = this.#buffer.subarray(0, separator).toString("ascii");
      const match = header.toLowerCase().match(/(?:^|\r\n)content-length: (\d+)(?:\r\n|$)/);
      if (!match) throw new Error("DAP frame is missing Content-Length.");
      const length = Number(match[1]);
      const start = separator + 4;
      if (this.#buffer.length < start + length) break;
      const body = this.#buffer.subarray(start, start + length).toString("utf8");
      this.#buffer = this.#buffer.subarray(start + length);
      messages.push(JSON.parse(body) as DapRequest);
    }
    return messages;
  }
}
import { validateCaptureRequest, type CaptureRequestV2 } from "./capture-v2.js";
