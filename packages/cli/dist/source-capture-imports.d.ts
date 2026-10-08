/** Compact per-file outcome; instruction/execution records remain in the project's SQLite store. */
export interface SourceCaptureImportSummary {
    /** Absolute input path; archives remain untouched after importing. */
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
 */
export declare function importSourceCaptures(captures: readonly string[], run: (capture: string, onProgress: (message: string) => void) => Promise<unknown>, options?: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
}): Promise<SourceCaptureImportBatchResult>;
//# sourceMappingURL=source-capture-imports.d.ts.map