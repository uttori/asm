import type { DatabaseSync } from "node:sqlite";
import type { RuntimeEvidenceRecord } from "./project-types.js";
/** Runtime reader for supported physical layouts. Migration holds the source snapshot throughout.
 * @param {number} version Supported physical SQLite layout.
 * @returns {string} Internal SELECT that reconstructs runtime dictionaries when needed.
 */
export declare const migrationRuntimeQuery: (version: number) => string;
/** Order-independent SHA-256 sum, with record count checked separately by migration.
 * Physical pairing changes cursor order. Hashing each canonical record preserves multiset verification
 * without sorting millions of expanded JSON records into a second temporary database.
 */
export declare class RuntimeDigest {
    #private;
    update(json: string): void;
    digest(_encoding: "hex"): string;
}
/**
 * Build a bounded-on-heap projection in a temporary SQLite table. Only native trace code and its
 * matching state are narrowed; standalone states, bus facts, other CPUs and execution totals survive.
 * The durable source is untouched, and the original database remains the forensic migration backup.
 * @param {DatabaseSync} db Exclusively held source snapshot; only connection-local temporary tables are written.
 * @param {number} version Source physical layout.
 * @param {object} options Cancellation and bounded progress callbacks.
 */
export declare const prepareRuntimeConversion: (db: DatabaseSync, version: number, options: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (records: number) => void;
    /** Validate original semantics before projection can merge counts or omit state fields. */
    readonly validateRecord: (record: RuntimeEvidenceRecord) => void;
}) => Promise<void>;
/** Read the finished projection once; no collection of full runtime history reaches the JS heap.
 * @param {DatabaseSync} db Connection containing the finished temporary projection.
 * @yields {RuntimeEvidenceRecord} One canonical variant with its exact aggregate count.
 */
export declare function convertedRuntimeRecords(db: DatabaseSync): IterableIterator<RuntimeEvidenceRecord>;
//# sourceMappingURL=sqlite-runtime-conversion.d.ts.map