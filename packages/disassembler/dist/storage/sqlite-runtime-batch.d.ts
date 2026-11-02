import type { DatabaseSync } from "node:sqlite";
import type { RuntimeEvidenceRecord } from "../model/project-types.js";
/** A transaction-owned provisional sink. finish() must run before committing its buffered rows. */
export interface RuntimeTracePublicationSink {
    /** Accept one validated distinct logical record; true means provisionally added. */
    add(record: RuntimeEvidenceRecord): boolean;
    /** Flush all pending pairs and rows. A failure must roll back the enclosing transaction. */
    finish(): void;
}
/** Staging must drive these joins; rebuilding a full-history automatic index per batch is quadratic. */
export declare const RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL: string;
/**
 * Restrict a trace batch to the four namespaces emitted by the instruction importer.
 * A namespace check is still necessary on the existing-source fallback before comparing stable IDs.
 */
export declare function assertTraceRecordNamespace(record: RuntimeEvidenceRecord, sourceSha256: string): void;
/**
 * Publish a new capture through batches of at most 1024 physical observations, with one pending
 * instruction/state pair. The caller validates each logical record and owns the writer transaction.
 * SQL preserves shared fact/identity interning and observation triggers; no history stays on the heap.
 * Existing source namespaces must use ordinary collision/repair checks instead of this writer.
 */
export declare class SqliteRuntimeTraceBatch implements RuntimeTracePublicationSink {
    #private;
    /** An omitted source is reserved for a validated multi-capture retention rebuild. */
    constructor(db: DatabaseSync, source: string | undefined, intern: (table: string, value: string) => number);
    /** Accept only the importer's adjacent code/state pairs; validate equality before sharing storage. */
    add(record: RuntimeEvidenceRecord): boolean;
    finish(): void;
}
//# sourceMappingURL=sqlite-runtime-batch.d.ts.map