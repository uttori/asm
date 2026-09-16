import type { AnalysisProjectShards, EvidenceRecord, ImportReport } from "./project-types.js";
/** One immutable imported artifact, or one producer of evidence without an artifact identity. */
export interface AnalysisEvidenceSource {
    readonly id: string;
    readonly name: string;
    readonly names: readonly string[];
    readonly kinds: readonly EvidenceRecord["source"][];
    readonly format?: string;
    readonly sha256?: string;
    /** Latest successful import time in Unix milliseconds; absent for legacy or non-capture sources. */
    readonly lastImportedAt?: number;
    readonly evidenceIds: readonly string[];
    readonly reports: readonly ImportReport[];
}
/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param {Pick<AnalysisProjectShards, "imports" | "evidence">} shards Source metadata.
 * @param {ReadonlyMap<string, number>} [importTimes] Durable capture receipt times by content hash.
 * @returns {readonly AnalysisEvidenceSource[]} Newest imports first; undated sources and ties use name/identity order.
 */
export declare const buildAnalysisSourceCatalog: (shards: Pick<AnalysisProjectShards, "imports" | "evidence">, importTimes?: ReadonlyMap<string, number>) => readonly AnalysisEvidenceSource[];
/** Compact, navigable contribution; full trace records never need to cross into an editor UI. */
export interface AnalysisSourceEntry {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly detail: string;
    readonly addressSpace?: string;
    readonly address?: number;
    readonly architecture?: string;
    readonly outputOffsets: readonly number[];
    readonly recordIds: readonly string[];
}
/** Direct source attribution only; capture subtraction is intentionally absent. */
export type AnalysisSourceGroup = "instructions" | "memory" | "contributions";
/** Exact SQL counts. Memory counts refer to persisted observations, not inferred access sites. */
export interface AnalysisSourceSummary {
    readonly source: AnalysisEvidenceSource;
    readonly instructionCount: number;
    readonly memoryCount: number;
    readonly contributionCount: number;
}
//# sourceMappingURL=analysis-sources.d.ts.map