import type { SqliteAnalysisStore } from "./sqlite-store.js";
/** File identity captured before parsing, checked again before/after archiving to reject changed input.
 * @param {string} file Capture path to stat before parsing.
 * @returns {string} Inode, size and nanosecond change timestamps.
 */
export declare const captureFileIdentity: (file: string) => string;
/** Archive operations follow the committed import. Their failures are reported separately from durable evidence. */
export interface CaptureArchiveResult {
    readonly archived: boolean;
    readonly expired: readonly string[];
    readonly warnings: readonly string[];
}
/**
 * Copy and hash a validated source into an owned content-addressed archive. Source files are never
 * deleted or moved. Oversized unpinned files remain external references instead of exceeding budget.
 * Pinning and cleanup serialize with other project writers; a partially copied file is never cataloged.
 * @param {SqliteAnalysisStore} store Project containing the committed receipt.
 * @param {string} sha256 Semantic capture identity from the validated importer.
 * @param {string} file Original capture path, read only.
 * @param {string} expectedIdentity File identity saved before parsing.
 * @returns {Promise<CaptureArchiveResult>} Archive/expiry outcomes; failures never imply the import rolled back.
 */
export declare const archiveImportedCapture: (store: SqliteAnalysisStore, sha256: string, file: string, expectedIdentity: string) => Promise<CaptureArchiveResult>;
/** Expire oldest owned, unpinned archives by bytes, age and optional count. Facts and receipts survive.
 * A retained reference outside this directory is never an eligible deletion target.
 * @param {SqliteAnalysisStore} store Project whose writer lock serializes pinning and expiry.
 * @returns {object} Expired identities and any files preserved after an error.
 */
export declare const expireCaptureArchives: (store: SqliteAnalysisStore) => Omit<CaptureArchiveResult, "archived">;
//# sourceMappingURL=capture-archives.d.ts.map