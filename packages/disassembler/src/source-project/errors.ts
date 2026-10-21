/** Stable failure identities cross IPC; a committed outcome must never be relabeled as cancellation. */
export type SourceFailureCode =
  | "unsupported"
  | "stale"
  | "conflict"
  | "cancelled"
  | "committed-with-warning"
  | "failed";
export class SourceOperationError extends Error {
  constructor(
    readonly code: SourceFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SourceOperationError";
  }
}
