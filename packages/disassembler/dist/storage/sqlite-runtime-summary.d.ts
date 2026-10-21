import type { DatabaseSync } from "node:sqlite";
import type { RuntimeEvidenceRecord } from "../model/project-types.js";
/** Masks affect grouping only. The representative keeps its original, unmasked register values. */
type StateMasks = Readonly<Partial<Record<string, {
    readonly max: number;
    readonly mask: number;
}>>>;
/** The store owns file-identity checks, rollback and connection-local transaction state. */
type Transaction = (action: () => void, write?: boolean) => void;
/**
 * Decode each shared representative fact once in storage order. GROUP BY receives only integer
 * references; LIMIT and CROSS JOIN keep history payloads outside the compact sort. The TEMP table
 * is keyed by ascending fact ID, avoiding random writes of large, provenance-expanded records.
 */
export declare const RUNTIME_SUMMARY_ROWS_SQL = "SELECT f.fid,\n    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload\n  FROM (SELECT o.fact_id\n    FROM query_runtime_variant_sources s\n    CROSS JOIN runtime_observations o ON o.oid=s.sample\n    GROUP BY o.fact_id ORDER BY o.fact_id LIMIT -1) grouped\n  CROSS JOIN runtime_facts f ON f.fid=grouped.fact_id";
/** Stream compact keys, counts and representatives without a blocking sort or aggregate.
 * Pending IDs drive incremental joins so an append does not scan unrelated observations. Sort only
 * their compact coordinates by fact ID before decoding, reusing shared compressed history blocks.
 * A full rebuild walks observation storage order to retain locality in compressed history blocks.
 * @param {boolean} incremental Whether to select pending observations instead of all history.
 * @returns {string} Input cursor SQL binding architecture and address space, in that order.
 */
export declare const runtimeSummaryInputSql: (incremental: boolean) => string;
/**
 * Prepare a single decoder configuration. A new configuration or mutation rebuilds from evidence;
 * ordinary appends aggregate only pending observations. Temporary grouping holds a read snapshot,
 * then a short write publishes only if no input or competing builder changed its ownership token.
 * Failure, cancellation by connection close, or process death leaves the base/pending work retryable.
 * The cursor reuses an existing read transaction or owns one until it closes.
 * @param {DatabaseSync} db Owned current-format project connection.
 * @param {Transaction} transaction Store transaction wrapper; write defaults to true.
 * @param {string} architecture Exact target processor ID.
 * @param {string} space Exact instruction address space.
 * @param {readonly string[]} fields Ordered decoder fields; other registers remain in full evidence.
 * @param {StateMasks} masks Grouping-only masks for valid numeric fields.
 * @param {Function} [onProgress] Cumulative and total observations in this build snapshot; throwing aborts it.
 * @param {Function} [onReadProgress] Representatives staged so far; throwing releases TEMP rows and aborts reading.
 * @param {Function} [resetSnapshot] Clear connection-owned codec/dictionary caches at owned snapshot boundaries.
 * @returns {IterableIterator<RuntimeEvidenceRecord>} One representative per decoder key and evidence list.
 */
export declare const runtimeInstructionSummary: (db: DatabaseSync, transaction: Transaction, architecture: string, space: string, fields: readonly string[], masks: StateMasks, onProgress?: (observations: number, totalObservations: number) => void, onReadProgress?: (representatives: number) => void, resetSnapshot?: () => void) => IterableIterator<RuntimeEvidenceRecord>;
export {};
//# sourceMappingURL=sqlite-runtime-summary.d.ts.map