import type { DebugTraceBatch } from "./contracts.js";
/** Construction options for one architecture-qualified, fixed-capacity trace ring. */
export interface DebugTraceBufferOptions {
    /** Architecture whose PCs are stored in the ring. */
    readonly architecture: string;
    /** Address space shared by every appended PC. */
    readonly addressSpace: string;
    /** Maximum retained instruction addresses before oldest-first loss. */
    readonly capacity: number;
}
/**
 * Bounded oldest-first-loss ring used by deterministic backends and as the reference semantics
 * for native trace producers. Pulling removes events. Stopping never discards unread entries.
 */
export declare class DebugTraceBuffer {
    #private;
    /** Architecture recorded by every batch from this buffer. */
    readonly architecture: string;
    /** Address space of every retained PC. */
    readonly addressSpace: string;
    /** Fixed capacity before oldest-first loss. */
    readonly capacity: number;
    /**
     * Allocates an empty ring with the given identity and capacity.
     * @param options Trace identity and fixed producer capacity.
     */
    constructor(options: DebugTraceBufferOptions);
    /**
     * Whether new instruction addresses are currently accepted.
     * @returns True while recording is active.
     */
    get active(): boolean;
    /**
     * Current retained event count, which never exceeds capacity.
     * @returns Number of addresses waiting to be pulled.
     */
    get bufferedEvents(): number;
    /** Resets sequence/loss state and enables a new explicit recording. */
    start(): void;
    /** Stops accepting new events while retaining unread entries. */
    stop(): void;
    /**
     * Records one instruction address when active.
     * @param address Architecture-local logical instruction address.
     */
    append(address: number): void;
    /**
     * Destructively reads the oldest retained addresses.
     * @param maxEvents Positive consumer batch bound.
     * @returns Ordered addresses plus explicit cumulative loss state.
     */
    read(maxEvents: number): DebugTraceBatch;
}
//# sourceMappingURL=trace-buffer.d.ts.map