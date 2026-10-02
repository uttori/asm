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
 * Order compact references before fetching payloads. LIMIT prevents subquery flattening and CROSS
 * JOIN keeps its coroutine outermost, so the sorter never receives complete register/provenance rows.
 * Address/evidence/key order preserves decoder tie-breaking even when new keys get larger IDs.
 */
export declare const RUNTIME_SUMMARY_ROWS_SQL = "SELECT i.value AS id,f.kind,f.architecture,f.address_space,f.address,\n    grouped.total AS count,CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload,\n    p.value AS id_prefix,e.value AS evidence\n  FROM (SELECT s.sample,s.total FROM query_runtime_variant_sources s\n    JOIN query_runtime_variant_keys k ON k.id=s.variant\n    ORDER BY k.address,s.evidence,k.key LIMIT -1) grouped\n  CROSS JOIN runtime_observations o ON o.oid=grouped.sample\n  CROSS JOIN runtime_facts f ON f.fid=o.fact_id\n  LEFT JOIN runtime_identities i ON i.iid=o.identity_id\n  LEFT JOIN runtime_prefixes p ON p.id=o.prefix_id\n  LEFT JOIN runtime_evidence e ON e.id=o.evidence_id";
/** Stream compact keys, counts and representatives without a blocking sort or aggregate.
 * Pending IDs drive incremental joins so an append does not scan unrelated captures or shared facts.
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
 * Consume the returned cursor inside the caller's read transaction, after preparation completes.
 * @param {DatabaseSync} db Owned current-format project connection.
 * @param {Transaction} transaction Store transaction wrapper; write defaults to true.
 * @param {string} architecture Exact target processor ID.
 * @param {string} space Exact instruction address space.
 * @param {readonly string[]} fields Ordered decoder fields; other registers remain in full evidence.
 * @param {StateMasks} masks Grouping-only masks for valid numeric fields.
 * @param {Function} [onProgress] Cumulative observations staged in this build; throwing aborts it.
 * @returns {IterableIterator<RuntimeEvidenceRecord>} One representative per decoder key and evidence list.
 */
export declare const runtimeInstructionSummary: (db: DatabaseSync, transaction: Transaction, architecture: string, space: string, fields: readonly string[], masks: StateMasks, onProgress?: (observations: number) => void) => IterableIterator<RuntimeEvidenceRecord>;
export {};
//# sourceMappingURL=sqlite-runtime-summary.d.ts.map