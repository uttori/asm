/** Indexed source membership and paginated observations; runtime history stays in SQLite. */
import type { DatabaseSync } from "node:sqlite";
import type { AnalysisEvidenceSource, AnalysisSourceEntry, AnalysisSourceGroup, AnalysisSourceSummary } from "./analysis-sources.js";
/** Whether source membership indexes exist and have no changed metadata to process.
 * @param {DatabaseSync} db Project connection.
 * @returns {boolean} True when direct source queries can run immediately.
 */
export declare const sourceQueriesReady: (db: DatabaseSync) => boolean;
/**
 * Extract metadata evidence membership once, then process only changed rows under a writer transaction.
 * Runtime membership already lives in its evidence dictionary; the covering index avoids payload reads.
 * @param {DatabaseSync} db Connection owned by the caller's write transaction.
 */
export declare const prepareSourceQueries: (db: DatabaseSync) => void;
/**
 * Count direct observations in SQL without interpreting register or memory payloads.
 * @param {DatabaseSync} db Connection inside a consistent read transaction.
 * @param {AnalysisEvidenceSource} source Catalog identity and immutable evidence membership.
 * @returns {AnalysisSourceSummary} Exact source counts, without baseline subtraction.
 */
export declare const readSourceSummary: (db: DatabaseSync, source: AnalysisEvidenceSource) => AnalysisSourceSummary;
/**
 * Decode at most one page after SQL filtering, grouping, ordering and pagination.
 * @param {DatabaseSync} db Read snapshot with prepared source and annotation indexes.
 * @param {AnalysisEvidenceSource} source Validated catalog entry.
 * @param {AnalysisSourceGroup} group Direct observations or attributed metadata.
 * @param {number} offset Nonnegative row offset; pages contain at most 200 entries.
 * @returns {AnalysisSourceEntry[]} Compact navigable entries, never the complete trace history.
 */
export declare const readSourcePage: (db: DatabaseSync, source: AnalysisEvidenceSource, group: AnalysisSourceGroup, offset?: number) => AnalysisSourceEntry[];
//# sourceMappingURL=sqlite-source-query.d.ts.map