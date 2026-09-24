import type { DatabaseSync } from "node:sqlite";
import type { RuntimeEvidenceRecord } from "./project-types.js";
/** Stream negative virtual rowids first, then positive observations, using the observation PK.
 * Sorting the expanded compatibility view can spill the entire history to temporary disk.
 * LEFT dictionary joins let decoders reject missing entries rather than silently omit records.
 */
export declare const RUNTIME_RECORD_STREAM_SQL: string[];
/** Shared facts own coordinates/payload. Observations own source identity and exact counts.
 * A trace instruction owns its paired CPU-state observation, exposed with a negative virtual rowid.
 * Identity suffixes are interned globally; paired states share the instruction's suffix by contract.
 * Standalone states and arbitrary text identities remain independent. Packed payloads retain full state.
 */
export declare const RUNTIME_STORAGE_SCHEMA: string;
/** Bounded prepared writer. Dictionary IDs are transaction-owned by the calling store. */
export declare class SqliteRuntimeWriter {
    #private;
    constructor(db: DatabaseSync);
    /** Append one validated logical record. Only exact trace pairs share a count/provenance link.
     * @param {RuntimeEvidenceRecord} record Validated source fact with a stable external ID.
     * @param {Function} intern Transaction-owned prefix/evidence dictionary allocator.
     */
    insert(record: RuntimeEvidenceRecord, intern: (table: string, value: string) => number): void;
}
//# sourceMappingURL=sqlite-runtime-storage.d.ts.map