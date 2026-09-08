import {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  type DebugAddress,
  type DebugArchitectureCapabilities,
  type DebugBackend,
  type DebugBackendCapabilities,
  type DebugBackendConnectOptions,
  type DebugBackendEvent,
  type DebugBreakpoint,
  type DebugExecutionCapabilities,
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
import { DebugTraceBuffer } from "./trace-buffer.js";

const REPLAY_TRACE_BUFFER_EVENTS = 65_536;
const REPLAY_TRACE_BATCH_EVENTS = 4_096;
const REPLAY_STEP_KINDS: readonly DebugStepKind[] = ["instruction", "over", "in", "out"];

/** Contiguous bytes visible in one replay snapshot. */
export interface ReplayMemoryRegion {
  readonly addressSpace: string;
  readonly start: number;
  readonly bytes: readonly number[];
}

/** Complete deterministic machine observation at one execution point. */
export interface ReplaySnapshot {
  readonly threads: readonly DebugThread[];
  readonly frames: readonly DebugStackFrame[];
  readonly registers: Readonly<Record<number, readonly DebugRegister[]>>;
  readonly memory: readonly ReplayMemoryRegion[];
  readonly instructions?: readonly DebugInstruction[];
}

/** Immutable script consumed by `ReplayDebugBackend`. */
export interface ReplayScript {
  readonly snapshots: readonly ReplaySnapshot[];
  /** Optional explicit declarations, including architectures with reduced live-debug support. */
  readonly architectures?: readonly DebugArchitectureCapabilities[];
}

const replayArchitectureCapabilities = (script: ReplayScript): DebugArchitectureCapabilities[] => {
  const architectureNames = new Set<string>();
  for (const snapshot of script.snapshots) {
    for (const thread of snapshot.threads) architectureNames.add(thread.architecture);
    for (const frame of snapshot.frames) architectureNames.add(frame.pc.architecture);
    for (const instruction of snapshot.instructions ?? [])
      architectureNames.add(instruction.address.architecture);
  }
  return [...architectureNames].sort().map((architecture): DebugArchitectureCapabilities => {
    const addressSpaces = new Set<string>();
    let registers = false;
    let disassemble = false;
    for (const snapshot of script.snapshots) {
      for (const frame of snapshot.frames) {
        if (frame.pc.architecture !== architecture) continue;
        addressSpaces.add(frame.pc.addressSpace);
        registers ||= (snapshot.registers[frame.id]?.length ?? 0) > 0;
      }
      for (const instruction of snapshot.instructions ?? []) {
        if (instruction.address.architecture !== architecture) continue;
        addressSpaces.add(instruction.address.addressSpace);
        disassemble = true;
      }
    }
    const memorySpaces = [...addressSpaces]
      .filter((addressSpace) =>
        script.snapshots.some((snapshot) =>
          snapshot.memory.some((region) => region.addressSpace === addressSpace),
        ),
      )
      .sort()
      .map((addressSpace) => ({ addressSpace, sideEffectFree: true }));
    return {
      architecture,
      addressSpaces: [...addressSpaces].sort(),
      memorySpaces,
      trace:
        addressSpaces.size === 0
          ? null
          : {
              addressSpaces: [...addressSpaces].sort(),
              maxBufferedEvents: REPLAY_TRACE_BUFFER_EVENTS,
              maxBatchEvents: REPLAY_TRACE_BATCH_EVENTS,
            },
      pause: true,
      step: true,
      stepKinds: REPLAY_STEP_KINDS,
      registers,
      memory: memorySpaces.length > 0,
      stackFrames: true,
      breakpoints: true,
      disassemble,
    };
  });
};

const addressKey = (address: DebugAddress): string =>
  `${address.architecture}\u0000${address.addressSpace}\u0000${
    address.outputOffset === undefined
      ? `logical:${address.address}`
      : `output:${address.outputOffset}`
  }`;

const addressesEqual = (left: DebugAddress, right: DebugAddress): boolean =>
  left.architecture === right.architecture &&
  left.addressSpace === right.addressSpace &&
  (left.address === right.address ||
    (left.outputOffset !== undefined && left.outputOffset === right.outputOffset));

const assertCount = (count: number): void => {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Count must be a non-negative integer.");
};

/** Deterministic in-memory backend used to prove protocol behavior without an emulator. */
export class ReplayDebugBackend implements DebugBackend {
  readonly protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  readonly capabilities: DebugBackendCapabilities;

  readonly #script: ReplayScript;
  readonly #listeners = new Set<(event: DebugBackendEvent) => void>();
  readonly #breakpoints = new Map<string, DebugBreakpoint>();
  #index = 0;
  #connected = false;
  #nextBreakpointId = 1;
  #trace: DebugTraceBuffer | undefined;

  /**
   * Creates a replay backend from at least one complete snapshot.
   * @param {ReplayScript} script Replay timeline.
   */
  constructor(script: ReplayScript) {
    if (script.snapshots.length === 0)
      throw new Error("Replay script requires at least one snapshot.");
    this.#script = script;
    const architectures = script.architectures
      ? script.architectures.map((capability) => ({
          ...capability,
          ...(capability.stepKinds ? { stepKinds: [...capability.stepKinds] } : {}),
          addressSpaces: [...capability.addressSpaces].sort(),
          memorySpaces: [...capability.memorySpaces]
            .sort((left, right) => left.addressSpace.localeCompare(right.addressSpace))
            .map((memorySpace) => Object.freeze({ ...memorySpace })),
          trace: capability.trace
            ? {
                ...capability.trace,
                addressSpaces: [...capability.trace.addressSpaces].sort(),
              }
            : null,
        }))
      : replayArchitectureCapabilities(script);
    const supports = (key: Exclude<keyof DebugExecutionCapabilities, "stepKinds">): boolean =>
      architectures.some((capability) => capability[key]);
    this.capabilities = Object.freeze({
      pause: supports("pause"),
      step: supports("step"),
      stepKinds: [
        ...new Set(
          architectures.flatMap((capability) => capability.stepKinds ?? REPLAY_STEP_KINDS),
        ),
      ],
      registers: supports("registers"),
      memory: supports("memory"),
      stackFrames: supports("stackFrames"),
      breakpoints: supports("breakpoints"),
      disassemble: supports("disassemble"),
      reconnect: true,
      architectures: Object.freeze(architectures.map((capability) => Object.freeze(capability))),
    });
  }

  /** @returns {number} Current zero-based replay position, exposed for deterministic tests. */
  get position(): number {
    return this.#index;
  }

  /**
   * Connects and optionally resets the replay cursor.
   * @param {DebugBackendConnectOptions} options Reset behavior.
   * @returns {Promise<void>} A resolved promise after the entry event is emitted.
   */
  connect(options: DebugBackendConnectOptions = {}): Promise<void> {
    if (options.reset ?? true) {
      this.#index = 0;
      this.#trace = undefined;
    }
    this.#connected = true;
    const threadId = this.#snapshot.threads[0]?.id ?? 0;
    this.#emit({ type: "stopped", reason: "entry", threadId });
    return Promise.resolve();
  }

  /**
   * Disconnects while preserving cursor and breakpoints for an optional reconnect.
   * @param {{ readonly terminate?: boolean }} options Termination event behavior.
   * @returns {Promise<void>} A resolved promise after disconnection.
   */
  disconnect(options: { readonly terminate?: boolean } = {}): Promise<void> {
    this.#requireConnected();
    this.#trace?.stop();
    this.#connected = false;
    if (options.terminate ?? true) this.#emit({ type: "terminated", restart: false });
    return Promise.resolve();
  }

  /**
   * Emits a pause event at the current cursor.
   * @param {number} threadId Thread to report as stopped.
   * @returns {Promise<void>} A resolved promise after the event.
   */
  pause(threadId = this.#snapshot.threads[0]?.id ?? 0): Promise<void> {
    this.#requireConnected();
    this.#emit({ type: "stopped", reason: "pause", threadId });
    return Promise.resolve();
  }

  /**
   * Runs until the next configured breakpoint or terminates at the end of the script.
   * @param {number} threadId Thread to continue.
   * @returns {Promise<void>} A resolved promise after the next stop or termination.
   */
  continue(threadId = this.#snapshot.threads[0]?.id ?? 0): Promise<void> {
    this.#requireConnected();
    this.#emit({ type: "continued", threadId, allThreads: true });
    while (this.#index + 1 < this.#script.snapshots.length) {
      this.#index++;
      this.#recordTraceAddress(threadId);
      const frame = this.#snapshot.frames.find((candidate) => candidate.threadId === threadId);
      if (
        frame &&
        [...this.#breakpoints.values()].some((breakpoint) =>
          addressesEqual(breakpoint.address, frame.pc),
        )
      ) {
        this.#emit({ type: "stopped", reason: "breakpoint", threadId });
        return Promise.resolve();
      }
    }
    this.#emit({ type: "terminated", restart: false });
    return Promise.resolve();
  }

  /**
   * Advances exactly one scripted state or terminates when no state remains.
   * @param {number} threadId Thread to step.
   * @param {DebugStepKind} _kind Requested step granularity.
   * @returns {Promise<void>} A resolved promise after the next stop or termination.
   */
  step(threadId: number, _kind: DebugStepKind): Promise<void> {
    this.#requireConnected();
    this.#emit({ type: "continued", threadId, allThreads: false });
    if (this.#index + 1 >= this.#script.snapshots.length) {
      this.#emit({ type: "terminated", restart: false });
      return Promise.resolve();
    }
    this.#index++;
    this.#recordTraceAddress(threadId);
    this.#emit({ type: "stopped", reason: "step", threadId });
    return Promise.resolve();
  }

  /** @returns {Promise<readonly DebugThread[]>} Processors/threads in stable script order. */
  threads(): Promise<readonly DebugThread[]> {
    this.#requireConnected();
    return Promise.resolve(this.#snapshot.threads.map((thread) => ({ ...thread })));
  }

  /**
   * Lists stack frames for one thread.
   * @param {number} threadId Thread to inspect.
   * @returns {Promise<readonly DebugStackFrame[]>} Stable frame copies.
   */
  stackFrames(threadId: number): Promise<readonly DebugStackFrame[]> {
    this.#requireConnected();
    return Promise.resolve(
      this.#snapshot.frames
        .filter((frame) => frame.threadId === threadId)
        .map((frame) => ({ ...frame, pc: { ...frame.pc } })),
    );
  }

  /**
   * Lists registers associated with a frame.
   * @param {number} frameId Frame to inspect.
   * @returns {Promise<readonly DebugRegister[]>} Stable register copies.
   */
  registers(frameId: number): Promise<readonly DebugRegister[]> {
    this.#requireConnected();
    return Promise.resolve(
      (this.#snapshot.registers[frameId] ?? []).map((register) => ({ ...register })),
    );
  }

  /**
   * Reads available bytes from the current snapshot without crossing address spaces.
   * @param {DebugAddress} address First logical address.
   * @param {number} count Number of bytes.
   * @returns {Promise<DebugMemoryRead>} Bytes and an unreadable-byte count.
   */
  readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead> {
    this.#requireConnected();
    assertCount(count);
    const spaceReadable = this.capabilities.architectures
      .find(({ architecture }) => architecture === address.architecture)
      ?.memorySpaces.some((memorySpace) => memorySpace.addressSpace === address.addressSpace);
    if (!spaceReadable)
      throw new Error(
        `Memory address space '${address.architecture}/${address.addressSpace}' is not readable.`,
      );
    const bytes = new Uint8Array(count);
    let readable = 0;
    for (let offset = 0; offset < count; offset++) {
      const current = address.address + offset;
      const region = this.#snapshot.memory.find(
        (candidate) =>
          candidate.addressSpace === address.addressSpace &&
          candidate.start <= current &&
          current < candidate.start + candidate.bytes.length,
      );
      if (!region) continue;
      bytes[offset] = region.bytes[current - region.start] ?? 0;
      readable++;
    }
    return Promise.resolve({ address: { ...address }, bytes, unreadableBytes: count - readable });
  }

  /**
   * Replaces all instruction breakpoints with stable ids sorted by qualified address.
   * @param {readonly DebugAddress[]} addresses New qualified addresses.
   * @returns {Promise<readonly DebugBreakpoint[]>} Breakpoint verification results.
   */
  setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]> {
    this.#requireConnected();
    this.#breakpoints.clear();
    const sorted = [...addresses].sort(
      (left, right) =>
        left.architecture.localeCompare(right.architecture) ||
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.address - right.address,
    );
    for (const address of sorted) {
      const key = addressKey(address);
      const breakpoint: DebugBreakpoint = {
        id: this.#nextBreakpointId++,
        address: { ...address },
        verified: this.#script.snapshots.some((snapshot) =>
          snapshot.frames.some((frame) => addressesEqual(frame.pc, address)),
        ),
      };
      this.#breakpoints.set(key, breakpoint);
      this.#emit({ type: "breakpoint", breakpoint });
    }
    return Promise.resolve([...this.#breakpoints.values()]);
  }

  /**
   * Returns scripted instructions starting at or after an address.
   * @param {DebugAddress} address First logical address.
   * @param {number} count Maximum instruction count.
   * @returns {Promise<readonly DebugInstruction[]>} Stable instruction copies.
   */
  disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]> {
    this.#requireConnected();
    assertCount(count);
    return Promise.resolve(
      (this.#snapshot.instructions ?? [])
        .filter(
          (instruction) =>
            instruction.address.architecture === address.architecture &&
            instruction.address.addressSpace === address.addressSpace &&
            instruction.address.address >= address.address,
        )
        .sort((left, right) => left.address.address - right.address.address)
        .slice(0, count)
        .map((instruction) => ({
          ...instruction,
          address: { ...instruction.address },
          bytes: [...instruction.bytes],
        })),
    );
  }

  /** @inheritdoc */
  startTrace(options: DebugTraceStartOptions): Promise<void> {
    this.#requireConnected();
    if (options.detail === "full") throw new Error("Replay supports PC-only instruction traces.");
    const architecture = this.capabilities.architectures.find(
      (candidate) => candidate.architecture === options.architecture,
    );
    if (!architecture?.trace?.addressSpaces.includes(options.addressSpace))
      throw new Error(
        `Instruction trace '${options.architecture}/${options.addressSpace}' is not supported.`,
      );
    const frame = this.#snapshot.frames.find(
      (candidate) =>
        candidate.pc.architecture === options.architecture &&
        candidate.pc.addressSpace === options.addressSpace,
    );
    if (!frame) throw new Error("Current replay snapshot has no matching trace frame.");
    this.#trace = new DebugTraceBuffer({
      architecture: options.architecture,
      addressSpace: options.addressSpace,
      capacity: architecture.trace.maxBufferedEvents,
    });
    this.#trace.start();
    this.#trace.append(frame.pc.address);
    return Promise.resolve();
  }

  /** @inheritdoc */
  readTrace(maxEvents: number): Promise<DebugTraceBatch> {
    this.#requireConnected();
    const trace = this.#trace;
    if (!trace) throw new Error("No replay instruction trace has been started.");
    const capabilities = this.capabilities.architectures.find(
      ({ architecture }) => architecture === trace.architecture,
    )?.trace;
    assertCount(maxEvents);
    if (maxEvents === 0 || !capabilities || maxEvents > capabilities.maxBatchEvents)
      throw new Error(
        `Trace batch size must be between 1 and ${capabilities?.maxBatchEvents ?? 0}.`,
      );
    return Promise.resolve(trace.read(maxEvents));
  }

  /** @inheritdoc */
  stopTrace(): Promise<void> {
    this.#requireConnected();
    if (!this.#trace) throw new Error("No replay instruction trace has been started.");
    this.#trace.stop();
    return Promise.resolve();
  }

  /**
   * Subscribes to synchronously ordered backend events.
   * @param {(event: DebugBackendEvent) => void} listener Event consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }

  get #snapshot(): ReplaySnapshot {
    return this.#script.snapshots[this.#index];
  }

  #requireConnected(): void {
    if (!this.#connected) throw new Error("Debug backend is not connected.");
  }

  #recordTraceAddress(threadId: number): void {
    const trace = this.#trace;
    if (!trace?.active) return;
    const frame = this.#snapshot.frames.find(
      (candidate) =>
        candidate.threadId === threadId &&
        candidate.pc.architecture === trace.architecture &&
        candidate.pc.addressSpace === trace.addressSpace,
    );
    if (frame) trace.append(frame.pc.address);
  }

  #emit(event: DebugBackendEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
