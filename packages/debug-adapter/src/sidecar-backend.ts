import {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  type DebugAddress,
  type DebugArchitectureCapabilities,
  type DebugBackend,
  type DebugBackendCapabilities,
  type DebugBackendConnectOptions,
  type DebugBackendEvent,
  type DebugBreakpoint,
  type DebugInstruction,
  type DebugMemoryRead,
  type DebugRegister,
  type DebugStackFrame,
  type DebugStepKind,
  type DebugSubscription,
  type DebugThread,
  type DebugTraceBatch,
  type DebugTraceStartOptions,
} from "./contracts.js";
import { DebugSidecarClient } from "./sidecar-client.js";
import { validateDebugTraceDetails } from "./trace-detail-validation.js";
import type { DebugSidecarEvent } from "./sidecar-protocol.js";

/** Construction settings for one typed sidecar-backed debugger. */
export interface SidecarDebugBackendOptions {
  readonly backend: string;
  readonly capabilities: DebugBackendCapabilities;
  readonly createClient: () => DebugSidecarClient | Promise<DebugSidecarClient>;
}

type UnknownRecord = Record<string, unknown>;

const stopReasons = new Set(["entry", "pause", "step", "breakpoint", "exception"]);
const stepKinds = new Set<DebugStepKind>(["instruction", "over", "in", "out"]);

const record = (value: unknown, context: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value as UnknownRecord;
};

const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value;
};

const string = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${context} must be a non-empty string.`);
  return value;
};

const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean.`);
  return value;
};

const integer = (value: unknown, context: string, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  return value as number;
};

const positiveInteger = (value: unknown, context: string): number => integer(value, context, 1);

const address = (value: unknown, context: string): DebugAddress => {
  const candidate = record(value, context);
  const outputOffset =
    candidate.outputOffset === undefined
      ? undefined
      : integer(candidate.outputOffset, `${context}.outputOffset`);
  return {
    architecture: string(candidate.architecture, `${context}.architecture`),
    addressSpace: string(candidate.addressSpace, `${context}.addressSpace`),
    address: integer(candidate.address, `${context}.address`),
    ...(outputOffset === undefined ? {} : { outputOffset }),
  };
};

const addressesEqual = (left: DebugAddress, right: DebugAddress): boolean =>
  left.architecture === right.architecture &&
  left.addressSpace === right.addressSpace &&
  left.address === right.address &&
  left.outputOffset === right.outputOffset;

const architectureCapabilities = (
  value: unknown,
  context: string,
): DebugArchitectureCapabilities => {
  const candidate = record(value, context);
  const addressSpaces = array(candidate.addressSpaces, `${context}.addressSpaces`).map(
    (entry, index) => string(entry, `${context}.addressSpaces[${index}]`),
  );
  if (new Set(addressSpaces).size !== addressSpaces.length)
    throw new Error(`${context}.addressSpaces must be unique.`);
  const memorySpaces = array(candidate.memorySpaces, `${context}.memorySpaces`)
    .map((entry, index) => {
      const memorySpace = record(entry, `${context}.memorySpaces[${index}]`);
      return {
        addressSpace: string(
          memorySpace.addressSpace,
          `${context}.memorySpaces[${index}].addressSpace`,
        ),
        sideEffectFree: boolean(
          memorySpace.sideEffectFree,
          `${context}.memorySpaces[${index}].sideEffectFree`,
        ),
      };
    })
    .sort((left, right) => left.addressSpace.localeCompare(right.addressSpace));
  if (new Set(memorySpaces.map(({ addressSpace }) => addressSpace)).size !== memorySpaces.length)
    throw new Error(`${context}.memorySpaces must use unique address spaces.`);
  if (memorySpaces.some(({ addressSpace }) => !addressSpaces.includes(addressSpace)))
    throw new Error(`${context}.memorySpaces must be declared in addressSpaces.`);
  const memory = boolean(candidate.memory, `${context}.memory`);
  const hasMemorySpaces = memorySpaces.length > 0;
  if (memory !== hasMemorySpaces)
    throw new Error(`${context}.memory must match whether memorySpaces is non-empty.`);
  const trace = (() => {
    if (candidate.trace === null) return null;
    const value = record(candidate.trace, `${context}.trace`);
    const traceAddressSpaces = array(value.addressSpaces, `${context}.trace.addressSpaces`)
      .map((entry, index) => string(entry, `${context}.trace.addressSpaces[${index}]`))
      .sort();
    if (traceAddressSpaces.length === 0)
      throw new Error(`${context}.trace.addressSpaces must not be empty.`);
    if (new Set(traceAddressSpaces).size !== traceAddressSpaces.length)
      throw new Error(`${context}.trace.addressSpaces must be unique.`);
    if (traceAddressSpaces.some((addressSpace) => !addressSpaces.includes(addressSpace)))
      throw new Error(`${context}.trace.addressSpaces must be declared in addressSpaces.`);
    const maxBufferedEvents = positiveInteger(
      value.maxBufferedEvents,
      `${context}.trace.maxBufferedEvents`,
    );
    const maxBatchEvents = positiveInteger(value.maxBatchEvents, `${context}.trace.maxBatchEvents`);
    if (maxBatchEvents > maxBufferedEvents)
      throw new Error(`${context}.trace.maxBatchEvents must not exceed maxBufferedEvents.`);
    return {
      addressSpaces: traceAddressSpaces,
      maxBufferedEvents,
      maxBatchEvents,
      ...(value.instructionDetails === undefined
        ? {}
        : { instructionDetails: boolean(value.instructionDetails, "Trace instructionDetails") }),
    };
  })();
  const stepKinds = (() => {
    if (candidate.stepKinds === undefined) return undefined;
    const values = array(candidate.stepKinds, `${context}.stepKinds`).map((entry, index) =>
      string(entry, `${context}.stepKinds[${index}]`),
    );
    const allowed = new Set(["instruction", "over", "in", "out"]);
    if (values.some((entry) => !allowed.has(entry)))
      throw new Error(`${context}.stepKinds contains an unsupported step kind.`);
    if (new Set(values).size !== values.length)
      throw new Error(`${context}.stepKinds must be unique.`);
    return values as DebugArchitectureCapabilities["stepKinds"];
  })();
  return {
    architecture: string(candidate.architecture, `${context}.architecture`),
    addressSpaces: [...addressSpaces].sort(),
    memorySpaces,
    trace,
    pause: boolean(candidate.pause, `${context}.pause`),
    step: boolean(candidate.step, `${context}.step`),
    ...(stepKinds === undefined ? {} : { stepKinds }),
    registers: boolean(candidate.registers, `${context}.registers`),
    memory,
    stackFrames: boolean(candidate.stackFrames, `${context}.stackFrames`),
    breakpoints: boolean(candidate.breakpoints, `${context}.breakpoints`),
    disassemble: boolean(candidate.disassemble, `${context}.disassemble`),
  };
};

const backendCapabilities = (value: unknown, context: string): DebugBackendCapabilities => {
  const candidate = record(value, context);
  const architectures = array(candidate.architectures, `${context}.architectures`)
    .map((entry, index) => architectureCapabilities(entry, `${context}.architectures[${index}]`))
    .sort((left, right) => left.architecture.localeCompare(right.architecture));
  if (new Set(architectures.map(({ architecture }) => architecture)).size !== architectures.length)
    throw new Error(`${context}.architectures must use unique architecture identifiers.`);
  const stepKinds = (() => {
    if (candidate.stepKinds === undefined) return undefined;
    const values = array(candidate.stepKinds, `${context}.stepKinds`).map((entry, index) =>
      string(entry, `${context}.stepKinds[${index}]`),
    );
    const allowed = new Set(["instruction", "over", "in", "out"]);
    if (values.some((entry) => !allowed.has(entry)))
      throw new Error(`${context}.stepKinds contains an unsupported step kind.`);
    if (new Set(values).size !== values.length)
      throw new Error(`${context}.stepKinds must be unique.`);
    return values as DebugBackendCapabilities["stepKinds"];
  })();
  return Object.freeze({
    pause: boolean(candidate.pause, `${context}.pause`),
    step: boolean(candidate.step, `${context}.step`),
    ...(stepKinds === undefined ? {} : { stepKinds: Object.freeze(stepKinds) }),
    registers: boolean(candidate.registers, `${context}.registers`),
    memory: boolean(candidate.memory, `${context}.memory`),
    stackFrames: boolean(candidate.stackFrames, `${context}.stackFrames`),
    breakpoints: boolean(candidate.breakpoints, `${context}.breakpoints`),
    disassemble: boolean(candidate.disassemble, `${context}.disassemble`),
    reconnect: boolean(candidate.reconnect, `${context}.reconnect`),
    architectures: Object.freeze(
      architectures.map((entry) =>
        Object.freeze({
          ...entry,
          ...(entry.stepKinds ? { stepKinds: Object.freeze(entry.stepKinds) } : {}),
          addressSpaces: Object.freeze(entry.addressSpaces),
          memorySpaces: Object.freeze(
            entry.memorySpaces.map((memorySpace) => Object.freeze(memorySpace)),
          ),
          trace: entry.trace
            ? Object.freeze({
                ...entry.trace,
                addressSpaces: Object.freeze(entry.trace.addressSpaces),
              })
            : null,
        }),
      ),
    ),
  });
};

const capabilityIdentity = (capabilities: DebugBackendCapabilities): string =>
  JSON.stringify(capabilities);

const thread = (value: unknown, context: string): DebugThread => {
  const candidate = record(value, context);
  return {
    id: positiveInteger(candidate.id, `${context}.id`),
    name: string(candidate.name, `${context}.name`),
    architecture: string(candidate.architecture, `${context}.architecture`),
  };
};

const stackFrame = (value: unknown, context: string): DebugStackFrame => {
  const candidate = record(value, context);
  const currentOnly =
    candidate.currentOnly === undefined
      ? undefined
      : boolean(candidate.currentOnly, `${context}.currentOnly`);
  return {
    id: positiveInteger(candidate.id, `${context}.id`),
    threadId: positiveInteger(candidate.threadId, `${context}.threadId`),
    name: string(candidate.name, `${context}.name`),
    pc: address(candidate.pc, `${context}.pc`),
    ...(currentOnly === undefined ? {} : { currentOnly }),
  };
};

const register = (value: unknown, context: string): DebugRegister => {
  const candidate = record(value, context);
  const group =
    candidate.group === undefined ? undefined : string(candidate.group, `${context}.group`);
  return {
    name: string(candidate.name, `${context}.name`),
    value: string(candidate.value, `${context}.value`),
    bits: positiveInteger(candidate.bits, `${context}.bits`),
    ...(group === undefined ? {} : { group }),
  };
};

const breakpoint = (value: unknown, context: string): DebugBreakpoint => {
  const candidate = record(value, context);
  const message =
    candidate.message === undefined ? undefined : string(candidate.message, `${context}.message`);
  return {
    id: positiveInteger(candidate.id, `${context}.id`),
    address: address(candidate.address, `${context}.address`),
    verified: boolean(candidate.verified, `${context}.verified`),
    ...(message === undefined ? {} : { message }),
  };
};

const byte = (value: unknown, context: string): number => {
  const result = integer(value, context);
  if (result > 0xff) throw new Error(`${context} must be an unsigned byte.`);
  return result;
};

const instruction = (value: unknown, context: string): DebugInstruction => {
  const candidate = record(value, context);
  const symbol =
    candidate.symbol === undefined ? undefined : string(candidate.symbol, `${context}.symbol`);
  return {
    address: address(candidate.address, `${context}.address`),
    bytes: array(candidate.bytes, `${context}.bytes`).map((entry, index) =>
      byte(entry, `${context}.bytes[${index}]`),
    ),
    text: string(candidate.text, `${context}.text`),
    ...(symbol === undefined ? {} : { symbol }),
  };
};

const traceBatch = (value: unknown, context: string): DebugTraceBatch => {
  const candidate = record(value, context);
  const addresses = array(candidate.addresses, `${context}.addresses`).map((entry, index) =>
    integer(entry, `${context}.addresses[${index}]`),
  );
  return {
    architecture: string(candidate.architecture, `${context}.architecture`),
    addressSpace: string(candidate.addressSpace, `${context}.addressSpace`),
    sequenceStart: positiveInteger(candidate.sequenceStart, `${context}.sequenceStart`),
    addresses,
    ...(candidate.details === undefined
      ? {}
      : { details: validateDebugTraceDetails(candidate.details, addresses.length) }),
    ...(candidate.unattributedMemoryAccesses === undefined
      ? {}
      : {
          unattributedMemoryAccesses: integer(
            candidate.unattributedMemoryAccesses,
            "Trace unattributed memory accesses",
          ),
        }),
    droppedEvents: integer(candidate.droppedEvents, `${context}.droppedEvents`),
    active: boolean(candidate.active, `${context}.active`),
  };
};

const base64Bytes = (value: unknown, context: string): Uint8Array => {
  if (typeof value !== "string") throw new Error(`${context} must be canonical base64.`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`${context} must be canonical base64.`);
  return new Uint8Array(bytes);
};

const uniqueIds = <Value extends { readonly id: number }>(
  values: Value[],
  context: string,
): Value[] => {
  if (new Set(values.map(({ id }) => id)).size !== values.length)
    throw new Error(`${context} must use unique ids.`);
  return values;
};

const backendEvent = (message: DebugSidecarEvent): DebugBackendEvent => {
  const body = record(message.body, `Sidecar '${message.event}' event body`);
  if (message.event === "stopped") {
    const reason = string(body.reason, "Stopped event reason");
    if (!stopReasons.has(reason)) throw new Error(`Unsupported stop reason '${reason}'.`);
    return {
      type: "stopped",
      reason: reason as "entry" | "pause" | "step" | "breakpoint" | "exception",
      threadId: positiveInteger(body.threadId, "Stopped event threadId"),
    };
  }
  if (message.event === "continued")
    return {
      type: "continued",
      threadId: positiveInteger(body.threadId, "Continued event threadId"),
      allThreads: boolean(body.allThreads, "Continued event allThreads"),
    };
  if (message.event === "terminated")
    return { type: "terminated", restart: boolean(body.restart, "Terminated event restart") };
  if (message.event === "breakpoint")
    return { type: "breakpoint", breakpoint: breakpoint(body.breakpoint, "Breakpoint event") };
  return {
    type: "output",
    category: (() => {
      const category = string(body.category, "Output event category");
      if (!new Set(["console", "stdout", "stderr"]).has(category))
        throw new Error(`Unsupported output category '${category}'.`);
      return category as "console" | "stdout" | "stderr";
    })(),
    text: string(body.text, "Output event text"),
  };
};

/** Typed `DebugBackend` implementation over the authenticated sidecar client. */
export class SidecarDebugBackend implements DebugBackend {
  readonly protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  #capabilities: DebugBackendCapabilities;
  readonly #configuredCapabilities: DebugBackendCapabilities;
  get capabilities(): DebugBackendCapabilities {
    return this.#capabilities;
  }

  readonly #backend: string;
  readonly #createClient: () => DebugSidecarClient | Promise<DebugSidecarClient>;
  readonly #listeners = new Set<(event: DebugBackendEvent) => void>();
  readonly #expectedClose = new WeakSet<DebugSidecarClient>();
  #client: DebugSidecarClient | undefined;
  #clientSubscriptions: DebugSubscription[] = [];
  #initialized = false;
  #connected = false;

  /**
   * Creates a backend with capabilities declared before DAP initialization and verified on connect.
   * @param {SidecarDebugBackendOptions} options Sidecar identity, capability manifest, and factory.
   */
  constructor(options: SidecarDebugBackendOptions) {
    this.#backend = string(options.backend, "Sidecar backend name");
    this.#capabilities = backendCapabilities(options.capabilities, "Configured capabilities");
    this.#configuredCapabilities = this.#capabilities;
    this.#createClient = options.createClient;
  }

  /** @inheritdoc */
  async connect(options: DebugBackendConnectOptions = {}): Promise<void> {
    if (this.#connected) throw new Error("Debug backend is already connected.");
    const client = await this.#ensureClient();
    const response = record(
      await client.request("connect", { reset: options.reset ?? true }),
      "Sidecar connect response",
    );
    if (response.capabilities !== undefined)
      this.#capabilities = backendCapabilities(
        response.capabilities,
        "Connected runtime capabilities",
      );
    this.#connected = true;
  }

  /** @inheritdoc */
  async disconnect(options: { readonly terminate?: boolean } = {}): Promise<void> {
    const client = this.#requireConnected();
    const terminate = options.terminate ?? true;
    await client.request("disconnect", { terminate });
    this.#connected = false;
    if (!terminate) return;
    this.#expectedClose.add(client);
    let shutdownError: unknown;
    try {
      await client.request("shutdown");
    } catch (error) {
      shutdownError = error;
    }
    await client.close();
    this.#releaseClient(client);
    if (shutdownError)
      throw shutdownError instanceof Error
        ? shutdownError
        : new Error("Sidecar shutdown failed with a non-Error rejection.");
  }

  /** @inheritdoc */
  async pause(threadId?: number): Promise<void> {
    await this.#requireConnected().request("pause", {
      ...(threadId === undefined ? {} : { threadId: positiveInteger(threadId, "Thread id") }),
    });
  }

  /** @inheritdoc */
  async continue(threadId?: number): Promise<void> {
    await this.#requireConnected().request("continue", {
      ...(threadId === undefined ? {} : { threadId: positiveInteger(threadId, "Thread id") }),
    });
  }

  /** @inheritdoc */
  async step(threadId: number, kind: DebugStepKind): Promise<void> {
    if (!stepKinds.has(kind)) throw new Error(`Unsupported step kind '${String(kind)}'.`);
    await this.#requireConnected().request("step", {
      threadId: positiveInteger(threadId, "Thread id"),
      kind,
    });
  }

  /** @inheritdoc */
  async threads(): Promise<readonly DebugThread[]> {
    const result = array(await this.#requireConnected().request("threads"), "Threads response");
    return uniqueIds(
      result.map((entry, index) => thread(entry, `Threads response[${index}]`)),
      "Threads response",
    );
  }

  /** @inheritdoc */
  async stackFrames(threadId: number): Promise<readonly DebugStackFrame[]> {
    const expectedThreadId = positiveInteger(threadId, "Thread id");
    const result = array(
      await this.#requireConnected().request("stackFrames", { threadId: expectedThreadId }),
      "Stack frames response",
    );
    const frames = uniqueIds(
      result.map((entry, index) => stackFrame(entry, `Stack frames response[${index}]`)),
      "Stack frames response",
    );
    if (frames.some((frame) => frame.threadId !== expectedThreadId))
      throw new Error("Stack frames response contains a frame for another thread.");
    return frames;
  }

  /** @inheritdoc */
  async registers(frameId: number): Promise<readonly DebugRegister[]> {
    const result = array(
      await this.#requireConnected().request("registers", {
        frameId: positiveInteger(frameId, "Frame id"),
      }),
      "Registers response",
    );
    return result.map((entry, index) => register(entry, `Registers response[${index}]`));
  }

  /** @inheritdoc */
  async readMemory(requestedAddress: DebugAddress, count: number): Promise<DebugMemoryRead> {
    const checkedAddress = address(requestedAddress, "Memory address");
    const checkedCount = integer(count, "Memory count");
    const readable = this.capabilities.architectures
      .find(({ architecture }) => architecture === checkedAddress.architecture)
      ?.memorySpaces.some(
        (memorySpace) => memorySpace.addressSpace === checkedAddress.addressSpace,
      );
    if (!readable)
      throw new Error(
        `Memory address space '${checkedAddress.architecture}/${checkedAddress.addressSpace}' is not readable.`,
      );
    const result = record(
      await this.#requireConnected().request("readMemory", {
        address: checkedAddress,
        count: checkedCount,
      }),
      "Memory response",
    );
    const returnedAddress = address(result.address, "Memory response.address");
    if (!addressesEqual(returnedAddress, checkedAddress))
      throw new Error("Memory response address does not match the request.");
    const bytes = base64Bytes(result.data, "Memory response.data");
    if (bytes.length !== checkedCount)
      throw new Error(
        `Memory response returned ${bytes.length} byte(s), expected ${checkedCount}.`,
      );
    const unreadableBytes = integer(result.unreadableBytes, "Memory response.unreadableBytes");
    if (unreadableBytes > checkedCount)
      throw new Error("Memory response unreadableBytes exceeds the requested count.");
    return { address: returnedAddress, bytes, unreadableBytes };
  }

  /** @inheritdoc */
  async setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]> {
    const checked = addresses.map((entry, index) => address(entry, `Breakpoints[${index}]`));
    const result = array(
      await this.#requireConnected().request("setBreakpoints", { breakpoints: checked }),
      "Breakpoints response",
    );
    const breakpoints = uniqueIds(
      result.map((entry, index) => breakpoint(entry, `Breakpoints response[${index}]`)),
      "Breakpoints response",
    );
    if (breakpoints.length !== checked.length)
      throw new Error("Breakpoints response count does not match the request.");
    return breakpoints;
  }

  /** @inheritdoc */
  async disassemble(
    requestedAddress: DebugAddress,
    count: number,
  ): Promise<readonly DebugInstruction[]> {
    const checkedAddress = address(requestedAddress, "Disassembly address");
    const checkedCount = integer(count, "Disassembly count");
    const result = array(
      await this.#requireConnected().request("disassemble", {
        address: checkedAddress,
        count: checkedCount,
      }),
      "Disassembly response",
    );
    if (result.length > checkedCount)
      throw new Error("Disassembly response exceeds the requested instruction count.");
    return result.map((entry, index) => instruction(entry, `Disassembly response[${index}]`));
  }

  /** @inheritdoc */
  async startTrace(options: DebugTraceStartOptions): Promise<void> {
    const architecture = string(options.architecture, "Trace architecture");
    const addressSpace = string(options.addressSpace, "Trace address space");
    const supported = this.capabilities.architectures
      .find((candidate) => candidate.architecture === architecture)
      ?.trace?.addressSpaces.includes(addressSpace);
    if (!supported)
      throw new Error(`Instruction trace '${architecture}/${addressSpace}' is not supported.`);
    if (options.detail !== undefined && !["pc", "full"].includes(options.detail))
      throw new Error("Invalid trace detail mode.");
    await this.#requireConnected().request("startTrace", {
      architecture,
      addressSpace,
      ...(options.detail === undefined ? {} : { detail: options.detail }),
    });
  }

  /** @inheritdoc */
  async readTrace(maxEvents: number): Promise<DebugTraceBatch> {
    const checkedMaxEvents = positiveInteger(maxEvents, "Trace batch size");
    const result = traceBatch(
      await this.#requireConnected().request("readTrace", { maxEvents: checkedMaxEvents }),
      "Trace response",
    );
    const capabilities = this.capabilities.architectures.find(
      ({ architecture }) => architecture === result.architecture,
    )?.trace;
    if (!capabilities?.addressSpaces.includes(result.addressSpace))
      throw new Error("Trace response uses an unsupported architecture/address space.");
    if (checkedMaxEvents > capabilities.maxBatchEvents)
      throw new Error(`Trace batch size exceeds backend maximum ${capabilities.maxBatchEvents}.`);
    if (result.addresses.length > checkedMaxEvents)
      throw new Error("Trace response exceeds the requested event count.");
    return result;
  }

  /** @inheritdoc */
  async stopTrace(): Promise<void> {
    await this.#requireConnected().request("stopTrace");
  }

  /** @inheritdoc */
  onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }

  async #ensureClient(): Promise<DebugSidecarClient> {
    if (this.#client && !this.#client.closed) {
      if (!this.#initialized) await this.#initialize(this.#client);
      return this.#client;
    }
    const client = await this.#createClient();
    if (client.closed) throw new Error("Sidecar client factory returned a closed client.");
    this.#client = client;
    this.#clientSubscriptions = [
      client.onEvent((event) => this.#emit(backendEvent(event))),
      client.onClose((error) => this.#clientClosed(client, error)),
    ];
    try {
      await this.#initialize(client);
    } catch (error) {
      this.#expectedClose.add(client);
      await client.close();
      this.#releaseClient(client);
      throw error;
    }
    return client;
  }

  async #initialize(client: DebugSidecarClient): Promise<void> {
    const result = record(
      await client.request("initialize", {
        backend: this.#backend,
        backendProtocolVersion: this.protocolVersion,
      }),
      "Sidecar initialize response",
    );
    if (string(result.backend, "Sidecar initialize backend") !== this.#backend)
      throw new Error("Sidecar initialize response named a different backend.");
    if (
      integer(result.backendProtocolVersion, "Sidecar backend protocol version", 1) !==
      this.protocolVersion
    )
      throw new Error(
        `Unsupported debug backend protocol '${String(result.backendProtocolVersion)}'.`,
      );
    const capabilities = backendCapabilities(
      result.capabilities,
      "Sidecar initialize capabilities",
    );
    if (capabilityIdentity(capabilities) !== capabilityIdentity(this.#configuredCapabilities))
      throw new Error("Sidecar capabilities do not match the configured revision manifest.");
    this.#initialized = true;
  }

  #requireConnected(): DebugSidecarClient {
    if (!this.#connected || !this.#client || this.#client.closed)
      throw new Error("Debug backend is not connected.");
    return this.#client;
  }

  #clientClosed(client: DebugSidecarClient, error: Error): void {
    if (this.#client !== client) return;
    const expected = this.#expectedClose.has(client);
    this.#connected = false;
    this.#releaseClient(client);
    if (!expected) this.#emit({ type: "terminated", restart: true });
    if (!expected) this.#emit({ type: "output", category: "stderr", text: `${error.message}\n` });
  }

  #releaseClient(client: DebugSidecarClient): void {
    if (this.#client !== client) return;
    for (const subscription of this.#clientSubscriptions) subscription.dispose();
    this.#clientSubscriptions = [];
    this.#client = undefined;
    this.#initialized = false;
  }

  #emit(event: DebugBackendEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
