import type { DatabaseSync } from "node:sqlite";
import type { RomCoverageMap } from "../analysis/coverage-map.js";
import type { AnalysisProjectManifest } from "../model/project-types.js";
/** Compact cache header. Segment/detail bodies stay paged in SQLite. */
export type SqliteCoverageSummary = Omit<RomCoverageMap, "segments" | "unprojected" | "diagnostics"> & {
    readonly segments: readonly never[];
    readonly unprojected: readonly never[];
    readonly diagnostics: readonly never[];
    readonly detailCount: number;
};
export declare const coverageSignature: (manifest: AnalysisProjectManifest) => string;
/** Read a current header without acquiring a writer lock.
 * @param {DatabaseSync} db Project connection.
 * @param {AnalysisProjectManifest} manifest Snapshot identity.
 * @returns {SqliteCoverageSummary | undefined} Header if all dependencies still match.
 */
export declare const cachedCoverage: (db: DatabaseSync, manifest: AnalysisProjectManifest) => SqliteCoverageSummary | undefined;
/** Build disk-backed events and sweep them with only the active interval identities in memory.
 * Explicit offsets are used. CPU bus addresses are never guessed to be ROM offsets.
 * @param {DatabaseSync} db Read transaction with prepared instruction/offset indexes. Writes stay in temporary tables.
 * @param {AnalysisProjectManifest} manifest Validated ROM identity and address spaces.
 * @returns {SqliteCoverageSummary} Exact totals. Records and diagnostics remain SQL-paged.
 */
export declare const prepareCoverage: (db: DatabaseSync, manifest: AnalysisProjectManifest) => SqliteCoverageSummary;
/** Publish complete segment/detail tables under a short writer lock.
 * @param {DatabaseSync} db Connection retaining the completed temporary projection.
 */
export declare const publishCoverage: (db: DatabaseSync) => void;
/** Select a bounded persisted page. Callers ensure the header is current first.
 * @param {DatabaseSync} db Connection in a read snapshot.
 * @param {"segments" | "details"} kind Page collection.
 * @param {number} offset Nonnegative row offset.
 * @returns {unknown[]} At most 200 rows.
 */
export declare const coveragePage: (db: DatabaseSync, kind: "segments" | "details", offset: number) => unknown[];
//# sourceMappingURL=sqlite-coverage-query.d.ts.map