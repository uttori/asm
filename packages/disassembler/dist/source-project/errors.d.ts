/** Stable failure identities cross IPC; a committed outcome must never be relabeled as cancellation. */
export type SourceFailureCode = "unsupported" | "stale" | "conflict" | "cancelled" | "committed-with-warning" | "failed";
export declare class SourceOperationError extends Error {
    readonly code: SourceFailureCode;
    constructor(code: SourceFailureCode, message: string, options?: ErrorOptions);
}
//# sourceMappingURL=errors.d.ts.map