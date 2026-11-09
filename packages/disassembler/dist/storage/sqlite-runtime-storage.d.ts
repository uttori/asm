import type { DatabaseSync } from "node:sqlite";
import type { RuntimeEvidenceRecord } from "../model/project-types.js";
import { runtimeColumns } from "./sqlite-records.js";
/**
 * Preserve the persisted canonical fingerprint across individual and batch publication.
 * Columns must come from runtimeColumns(record); payload is its canonical text, not encoded bytes.
 * Fixed key order, null fields, two-space indentation and the trailing newline are identity bytes;
 * changing their layout would duplicate retained facts. Keep this aligned with runtimeColumns.
 */
export declare const runtimeFactFingerprint: (record: RuntimeEvidenceRecord, columns: ReturnType<typeof runtimeColumns>) => Buffer;
/** Encode a new shared fact losslessly. Unusual register shapes retain the general codec. */
export declare const encodeRuntimeFactPayload: (record: RuntimeEvidenceRecord, payload: string | null) => string | Buffer | null;
/**
 * Stream negative virtual rowids first, then positive observations, using the observation PK.
 * Sorting the expanded compatibility view can spill the entire history to temporary disk.
 * LEFT dictionary joins let decoders reject missing entries rather than silently omit records.
 */
export declare const RUNTIME_RECORD_STREAM_SQL: string[];
/**
 * Shared facts own coordinates/payload. Observations own source identity and exact counts.
 * A trace instruction owns its paired CPU-state observation, exposed with a negative virtual rowid.
 * Identity suffixes are interned globally; paired states share the instruction's suffix by contract.
 * Standalone states and arbitrary text identities remain independent. Packed payloads retain full state.
 */
export declare const RUNTIME_STORAGE_SCHEMA: string;
/** Bounded prepared writer. Dictionary IDs are transaction-owned by the calling store. */
export declare class SqliteRuntimeWriter {
    #private;
    constructor(db: DatabaseSync);
    /**
     * Append one validated logical record. Only exact trace pairs share a count/provenance link.
     * @param record Validated source fact with a stable external ID.
     * @param intern Transaction-owned prefix/evidence dictionary allocator.
     */
    insert(record: RuntimeEvidenceRecord, intern: (table: string, value: string) => number): void;
}
//# sourceMappingURL=sqlite-runtime-storage.d.ts.map