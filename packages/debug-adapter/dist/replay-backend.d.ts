import { type DebugAddress, type DebugArchitectureCapabilities, type DebugBackend, type DebugBackendCapabilities, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions } from "./contracts.js";
/** Contiguous bytes visible in one replay snapshot. */
export interface ReplayMemoryRegion {
    /** Address space containing the snapshot bytes. */
    readonly addressSpace: string;
    /** First logical address represented by bytes. */
    readonly start: number;
    /** Contiguous byte values beginning at start. */
    readonly bytes: readonly number[];
}
/** Complete deterministic machine observation at one execution point. */
export interface ReplaySnapshot {
    /** Threads visible at this timeline index. */
    readonly threads: readonly DebugThread[];
    /** Stack frames for every thread at this index. */
    readonly frames: readonly DebugStackFrame[];
    /** Register sets keyed by frame id when provided. */
    readonly registers: Readonly<Partial<Record<number, readonly DebugRegister[]>>>;
    /** Memory regions readable while stopped at this index. */
    readonly memory: readonly ReplayMemoryRegion[];
    /** Optional disassembly rows referenced by stepping and breakpoint tests. */
    readonly instructions?: readonly DebugInstruction[];
}
/** Immutable script consumed by `ReplayDebugBackend`. */
export interface ReplayScript {
    /** Ordered machine observations consumed sequentially by the backend. */
    readonly snapshots: readonly ReplaySnapshot[];
    /** Optional explicit declarations, including architectures with reduced live-debug support. */
    readonly architectures?: readonly DebugArchitectureCapabilities[];
}
/** Deterministic in-memory backend used to prove protocol behavior without an emulator. */
export declare class ReplayDebugBackend implements DebugBackend {
    #private;
    /** Fixed replay protocol revision. */
    readonly protocolVersion: 1;
    /** Capabilities derived from script content or explicit architecture declarations. */
    readonly capabilities: DebugBackendCapabilities;
    /**
     * Creates a replay backend from at least one complete snapshot.
     * @param script Replay timeline.
     */
    constructor(script: ReplayScript);
    /**
     * Current zero-based replay position, exposed for deterministic tests.
     * @returns Index into the snapshot timeline.
     */
    get position(): number;
    /**
     * Connects and optionally resets the replay cursor.
     * @param options Reset behavior.
     * @returns A resolved promise after the entry event is emitted.
     */
    connect(options?: DebugBackendConnectOptions): Promise<void>;
    /**
     * Disconnects while preserving cursor and breakpoints for an optional reconnect.
     * @param options Termination event behavior.
     * @returns A resolved promise after disconnection.
     */
    disconnect(options?: {
        readonly terminate?: boolean;
    }): Promise<void>;
    /**
     * Emits a pause event at the current cursor.
     * @param threadId Thread to report as stopped.
     * @returns A resolved promise after the event.
     */
    pause(threadId?: number): Promise<void>;
    /**
     * Runs until the next configured breakpoint or terminates at the end of the script.
     * @param threadId Thread to continue.
     * @returns A resolved promise after the next stop or termination.
     */
    continue(threadId?: number): Promise<void>;
    /**
     * Advances exactly one scripted state or terminates when no state remains.
     * @param threadId Thread to step.
     * @param _kind Requested step granularity.
     * @returns A resolved promise after the next stop or termination.
     */
    step(threadId: number, _kind: DebugStepKind): Promise<void>;
    /**
     * Processors and threads in stable script order.
     * @returns Copied thread list from the active snapshot.
     */
    threads(): Promise<readonly DebugThread[]>;
    /**
     * Lists stack frames for one thread.
     * @param threadId Thread to inspect.
     * @returns Stable frame copies.
     */
    stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
    /**
     * Lists registers associated with a frame.
     * @param frameId Frame to inspect.
     * @returns Stable register copies.
     */
    registers(frameId: number): Promise<readonly DebugRegister[]>;
    /**
     * Reads available bytes from the current snapshot without crossing address spaces.
     * @param address First logical address.
     * @param count Number of bytes.
     * @returns Bytes and an unreadable-byte count.
     */
    readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
    /**
     * Replaces all instruction breakpoints with stable ids sorted by qualified address.
     * @param addresses New qualified addresses.
     * @returns Breakpoint verification results.
     */
    setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
    /**
     * Returns scripted instructions starting at or after an address.
     * @param address First logical address.
     * @param count Maximum instruction count.
     * @returns Stable instruction copies.
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
     * @param listener Event consumer.
     * @returns Disposable subscription.
     */
    onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
//# sourceMappingURL=replay-backend.d.ts.map