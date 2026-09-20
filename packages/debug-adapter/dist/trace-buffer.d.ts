import type { DebugTraceBatch } from "./contracts.js";
/** Construction options for one architecture-qualified, fixed-capacity trace ring. */
export interface DebugTraceBufferOptions {
    readonly architecture: string;
    readonly addressSpace: string;
    readonly capacity: number;
}
/**
 * Bounded oldest-first-loss ring used by deterministic backends and as the reference semantics
 * for native trace producers. Pulling removes events. Stopping never discards unread entries.
 */
export declare class DebugTraceBuffer {
    #private;
    readonly architecture: string;
    readonly addressSpace: string;
    readonly capacity: number;
    /** @param {DebugTraceBufferOptions} options Trace identity and fixed producer capacity. */
    constructor(options: DebugTraceBufferOptions);
    /** @returns {boolean} Whether new instruction addresses are currently accepted. */
    get active(): boolean;
    /** @returns {number} Current retained event count, which never exceeds `capacity`. */
    get bufferedEvents(): number;
    /** Resets sequence/loss state and enables a new explicit recording. */
    start(): void;
    /** Stops accepting new events while retaining unread entries. */
    stop(): void;
    /**
     * Records one instruction address when active.
     * @param {number} address Architecture-local logical instruction address.
     */
    append(address: number): void;
    /**
     * Destructively reads the oldest retained addresses.
     * @param {number} maxEvents Positive consumer batch bound.
     * @returns {DebugTraceBatch} Ordered addresses plus explicit cumulative loss state.
     */
    read(maxEvents: number): DebugTraceBatch;
}
//# sourceMappingURL=trace-buffer.d.ts.map