import type { DatabaseSync } from "node:sqlite";
import type { InstructionExportRecord } from "./sqlite-annotation-query.js";
/**
 * Stream every authoritative projection in output order when no dependency-valid cache exists.
 * @yields {unknown} Decoded projection requiring address and provenance validation.
 */
export declare function uncachedSourceExportRecords(database: DatabaseSync): IterableIterator<unknown>;
/** Layout includes the complete incoming state; targets still check every variant against ROM. */
export declare const SOURCE_EXPORT_CACHE: {
    readonly key: "source_export";
    readonly signature: "1";
};
/**
 * Build connection-local rows while rendering the same stream, without a second CFG pass.
 * @yields {readonly InstructionExportRecord[]} One complete validated instruction group.
 */
export declare function stageSourceExportGroups(database: DatabaseSync, groups: Iterable<readonly InstructionExportRecord[]>, complete: () => void, signal?: AbortSignal): Generator<readonly InstructionExportRecord[], void, unknown>;
/** Publish only after the dependency token survives the read snapshot; rollback retains the old cache. */
export declare function publishSourceExportCache(database: DatabaseSync): void;
/** Release provisional rows even when validation, cancellation, or publication fails. */
export declare function clearSourceExportStage(database: DatabaseSync): void;
/** A missing marker means a dependency changed or maintenance evicted the disposable projection. */
export declare function sourceExportCacheReady(database: DatabaseSync): boolean;
/**
 * Stream detached values from the current read snapshot; callers validate address and provenance contracts.
 * @yields {unknown} Independent instruction record with its complete ordered provenance.
 */
export declare function sourceExportCacheRecords(database: DatabaseSync): IterableIterator<unknown>;
//# sourceMappingURL=sqlite-source-export.d.ts.map