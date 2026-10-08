/**
 * Report provisional SQLite merge counts at most every five seconds, plus start and completion.
 * Rates and remaining time are estimates for this phase, not a promise that publication has committed.
 * The monotonic clock is injectable so throttling and estimates can be verified without waiting.
 */
export declare function createSourceMergeProgress(report?: (message: string) => void, now?: () => number): (processed: number, total: number) => void;
//# sourceMappingURL=source-progress.d.ts.map