/** Compact per-file outcome; instruction/execution records remain in the project's SQLite store. */
export interface SourceCaptureImportSummary {
    /** Historical absolute input path; callers must not rely on its existence after successful import. */
    readonly capture: string;
    readonly sourceSha256: string;
    readonly changed: boolean;
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
    readonly warnings: readonly string[];
}
/** A completed queue. Each file commits independently, so an interrupted queue can be retried. */
export interface SourceCaptureImportBatchResult {
    readonly imports: readonly SourceCaptureImportSummary[];
}
/**
 * Import unique absolute paths in selection order, reopening project state for each capture.
 * Stop on the first failure/cancellation; completed files remain committed and retries are idempotent.
 * The callback owns each file's transaction and catalog update. No captures run concurrently.
 * Input files remain user-owned; successful imports must not require them for later project work.
 */
export declare function importSourceCaptures(captures: readonly string[], run: (capture: string, onProgress: (message: string) => void) => Promise<unknown>, options?: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
}): Promise<SourceCaptureImportBatchResult>;
//# sourceMappingURL=source-capture-imports.d.ts.map