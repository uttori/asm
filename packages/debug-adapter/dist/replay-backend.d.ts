import { type DebugAddress, type DebugArchitectureCapabilities, type DebugBackend, type DebugBackendCapabilities, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions } from "./contracts.js";
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
    readonly registers: Readonly<Partial<Record<number, readonly DebugRegister[]>>>;
    readonly memory: readonly ReplayMemoryRegion[];
    readonly instructions?: readonly DebugInstruction[];
}
/** Immutable script consumed by `ReplayDebugBackend`. */
export interface ReplayScript {
    readonly snapshots: readonly ReplaySnapshot[];
    /** Optional explicit declarations, including architectures with reduced live-debug support. */
    readonly architectures?: readonly DebugArchitectureCapabilities[];
}
/** Deterministic in-memory backend used to prove protocol behavior without an emulator. */
export declare class ReplayDebugBackend implements DebugBackend {
    #private;
    readonly protocolVersion: 1;
    readonly capabilities: DebugBackendCapabilities;
    /**
     * Creates a replay backend from at least one complete snapshot.
     * @param {ReplayScript} script Replay timeline.
     */
    constructor(script: ReplayScript);
    /** @returns {number} Current zero-based replay position, exposed for deterministic tests. */
    get position(): number;
    /**
     * Connects and optionally resets the replay cursor.
     * @param {DebugBackendConnectOptions} options Reset behavior.
     * @returns {Promise<void>} A resolved promise after the entry event is emitted.
     */
    connect(options?: DebugBackendConnectOptions): Promise<void>;
    /**
     * Disconnects while preserving cursor and breakpoints for an optional reconnect.
     * @param {{ readonly terminate?: boolean }} options Termination event behavior.
     * @returns {Promise<void>} A resolved promise after disconnection.
     */
    disconnect(options?: {
        readonly terminate?: boolean;
    }): Promise<void>;
    /**
     * Emits a pause event at the current cursor.
     * @param {number} threadId Thread to report as stopped.
     * @returns {Promise<void>} A resolved promise after the event.
     */
    pause(threadId?: number): Promise<void>;
    /**
     * Runs until the next configured breakpoint or terminates at the end of the script.
     * @param {number} threadId Thread to continue.
     * @returns {Promise<void>} A resolved promise after the next stop or termination.
     */
    continue(threadId?: number): Promise<void>;
    /**
     * Advances exactly one scripted state or terminates when no state remains.
     * @param {number} threadId Thread to step.
     * @param {DebugStepKind} _kind Requested step granularity.
     * @returns {Promise<void>} A resolved promise after the next stop or termination.
     */
    step(threadId: number, _kind: DebugStepKind): Promise<void>;
    /** @returns {Promise<readonly DebugThread[]>} Processors/threads in stable script order. */
    threads(): Promise<readonly DebugThread[]>;
    /**
     * Lists stack frames for one thread.
     * @param {number} threadId Thread to inspect.
     * @returns {Promise<readonly DebugStackFrame[]>} Stable frame copies.
     */
    stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
    /**
     * Lists registers associated with a frame.
     * @param {number} frameId Frame to inspect.
     * @returns {Promise<readonly DebugRegister[]>} Stable register copies.
     */
    registers(frameId: number): Promise<readonly DebugRegister[]>;
    /**
     * Reads available bytes from the current snapshot without crossing address spaces.
     * @param {DebugAddress} address First logical address.
     * @param {number} count Number of bytes.
     * @returns {Promise<DebugMemoryRead>} Bytes and an unreadable-byte count.
     */
    readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
    /**
     * Replaces all instruction breakpoints with stable ids sorted by qualified address.
     * @param {readonly DebugAddress[]} addresses New qualified addresses.
     * @returns {Promise<readonly DebugBreakpoint[]>} Breakpoint verification results.
     */
    setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
    /**
     * Returns scripted instructions starting at or after an address.
     * @param {DebugAddress} address First logical address.
     * @param {number} count Maximum instruction count.
     * @returns {Promise<readonly DebugInstruction[]>} Stable instruction copies.
     */
    disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]>;
    /** @inheritdoc */
    startTrace(options: DebugTraceStartOptions): Promise<void>;
    /** @inheritdoc */
    readTrace(maxEvents: number): Promise<DebugTraceBatch>;
    /** @inheritdoc */
    stopTrace(): Promise<void>;
    /**
     * Subscribes to synchronously ordered backend events.
     * @param {(event: DebugBackendEvent) => void} listener Event consumer.
     * @returns {DebugSubscription} Disposable subscription.
     */
    onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
//# sourceMappingURL=replay-backend.d.ts.map