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
}

const numeric = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;

const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object",
      )
    : [];

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
  readonly #variableFrames = new Map<number, number>();
  readonly #virtualSources = new Map<number, DebugAddress>();
  readonly #virtualReferences = new Map<string, number>();
  readonly #subscription;
  #nextSequence = 1;
  #nextVariableReference = 1;
  #nextSourceReference = 1;
  #pendingEvents: Array<Omit<DapEvent, "seq">> | undefined;

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
    this.#mapIssues = options.debugMap ? validateDebugMap(options.debugMap, options.output) : [];
    this.#subscription = this.#backend.onEvent((event) => this.#emitBackendEvent(event));
  }

  /** Releases the backend event subscription. */
  dispose(): void {
    this.#subscription.dispose();
  }

  /**
   * Handles one request and returns all deterministically ordered response/events.
   * @param {DapRequest} request Incoming request.
   * @returns {Promise<readonly DapProtocolMessage[]>} Response followed by queued events.
   */
  async dispatch(request: DapRequest): Promise<readonly DapProtocolMessage[]> {
    const pending: Array<Omit<DapEvent, "seq">> = [];
    this.#pendingEvents = pending;
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
      response = {
        seq: this.#nextSequence++,
        type: "response",
        request_seq: request.seq,
        success: false,
        command: request.command,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.#pendingEvents = undefined;
    }
    if (request.command === "initialize" && response.success) {
      pending.unshift({ type: "event", event: "initialized" });
    }
    const messages: DapProtocolMessage[] = [
      response,
      ...pending.map((event) => ({ ...event, seq: this.#nextSequence++ })),
    ];
    for (const message of messages) this.#onMessage?.(message);
    return messages;
  }

  async #route(command: string, args: Record<string, unknown>): Promise<unknown> {
    switch (command) {
      case "initialize":
        return this.#capabilities();
      case "launch":
        if (this.#mapIssues.length > 0) throw new Error(this.#mapIssues.join(" "));
        await this.#backend.connect({ reset: true });
        return {};
      case "attach":
        if (this.#mapIssues.length > 0) throw new Error(this.#mapIssues.join(" "));
        await this.#backend.connect({ reset: false });
        return {};
      case "configurationDone":
        return {};
      case "threads":
        return { threads: await this.#backend.threads() };
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
        return this.#setSourceBreakpoints(args);
      case "setInstructionBreakpoints":
        return this.#setInstructionBreakpoints(args);
      case "pause":
        await this.#backend.pause(numeric(args.threadId));
        return {};
      case "continue":
        await this.#backend.continue(numeric(args.threadId));
        return { allThreadsContinued: true };
      case "next":
        await this.#backend.step(numeric(args.threadId), "over");
        return {};
      case "stepIn":
        await this.#backend.step(numeric(args.threadId), "in");
        return {};
      case "stepOut":
        await this.#backend.step(numeric(args.threadId), "out");
        return {};
      case "disassemble":
        return this.#disassemble(args);
      case "source":
        return this.#source(numeric(args.sourceReference));
      case "uttori/traceCapabilities":
        return this.#traceCapabilities();
      case "uttori/startTrace":
        await this.#backend.startTrace({
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
      supportsSteppingGranularity: this.#backend.capabilities.step,
      supportsTerminateDebuggee: true,
      supportsEvaluateForHovers: this.#backend.capabilities.registers,
    };
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
        });
    }
    return { traces };
  }

  async #stackTrace(threadId: number): Promise<Record<string, unknown>> {
    const frames = await this.#backend.stackFrames(threadId);
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
              name: frame.name,
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
          name: frame.name,
          line: 1,
          column: 1,
          source: {
            name: `${frame.pc.architecture} disassembly`,
            sourceReference,
            presentationHint: "deemphasize",
          },
          instructionPointerReference: formatDebugAddress(frame.pc),
        };
      }),
      totalFrames: frames.length,
    };
  }

  #scopes(frameId: number): Record<string, unknown> {
    const variablesReference = this.#nextVariableReference++;
    this.#variableFrames.set(variablesReference, frameId);
    return { scopes: [{ name: "Registers", variablesReference, expensive: false }] };
  }

  async #variables(variablesReference: number): Promise<Record<string, unknown>> {
    const frameId = this.#variableFrames.get(variablesReference);
    if (frameId === undefined) throw new Error("Unknown variables reference.");
    const registers = await this.#backend.registers(frameId);
    return {
      variables: registers.map((register) => ({
        name: register.name,
        value: `0x${register.value}`,
        type: `uint${register.bits}`,
        variablesReference: 0,
      })),
    };
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

  async #setSourceBreakpoints(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.#map) throw new Error("Source breakpoints require a debug map.");
    const source = args.source as Record<string, unknown> | undefined;
    const sourcePath = typeof source?.path === "string" ? source.path : "";
    if (!sourcePath) throw new Error("Source breakpoint request requires source.path.");
    const requested = records(args.breakpoints);
    const addresses: DebugAddress[] = [];
    const resolved: Array<{ line: number; address?: DebugAddress }> = [];
    for (const breakpoint of requested) {
      const line = numeric(breakpoint.line);
      const range = debugMapRangesForSource(this.#map, sourcePath, line)[0];
      const address = range ? this.#addressForRange(range) : undefined;
      if (address) addresses.push(address);
      resolved.push({ line, address });
    }
    this.#sourceBreakpoints.set(sourcePath, addresses);
    const applied = await this.#applyBreakpoints();
    return {
      breakpoints: resolved.map(({ line, address }) => {
        const match = address ? applied.get(formatDebugAddress(address)) : undefined;
        return {
          ...(match ? dapBreakpoint(match) : { verified: false, message: "No executable range." }),
          line,
        };
      }),
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
        this.#instructionBreakpoints.set(formatDebugAddress(adjusted), adjusted);
        return adjusted;
      }
      return undefined;
    });
    const applied = await this.#applyBreakpoints();
    return {
      breakpoints: parsed.map((address) => {
        const match = address ? applied.get(formatDebugAddress(address)) : undefined;
        return match ? dapBreakpoint(match) : { verified: false, message: "Invalid address." };
      }),
    };
  }

  async #applyBreakpoints(): Promise<Map<string, DebugBreakpoint>> {
    const source = [...this.#sourceBreakpoints.values()].flat();
    const instruction = [...this.#instructionBreakpoints.values()];
    const unique = new Map(
      [...source, ...instruction].map((address) => [formatDebugAddress(address), address]),
    );
    const breakpoints = await this.#backend.setBreakpoints([...unique.values()]);
    return new Map(
      breakpoints.map((breakpoint) => [formatDebugAddress(breakpoint.address), breakpoint]),
    );
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
    const content = instructions
      .map(
        (instruction) =>
          `${formatDebugAddress(instruction.address)}  ${bytesText(instruction).padEnd(12)}  ${this.#annotatedInstructionText(instruction)}`,
      )
      .join("\n");
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
    const translated = backendEvent(event);
    if (this.#pendingEvents) {
      this.#pendingEvents.push(translated);
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
