import type { AnalysisProjectShards, EvidenceRecord, ImportReport } from "../model/project-types.js";
/** One immutable imported artifact, or one producer of evidence without an artifact identity. */
export interface AnalysisEvidenceSource {
    /** Stable catalog id grouping evidence by artifact or producer identity. */
    readonly id: string;
    /** Display name chosen from the newest linked import report. */
    readonly name: string;
    /** All display names observed for this source across imports. */
    readonly names: readonly string[];
    /** Evidence producer kinds contributed by this source. */
    readonly kinds: readonly EvidenceRecord["source"][];
    /** Artifact format string when the source represents imported bytes. */
    readonly format?: string;
    /** Content hash when the source represents imported bytes. */
    readonly sha256?: string;
    /** Latest successful import time in Unix milliseconds. Absent for legacy or non-capture sources. */
    readonly lastImportedAt?: number;
    /** Evidence record ids attributed to this catalog entry. */
    readonly evidenceIds: readonly string[];
    /** Import reports that introduced or updated this source. */
    readonly reports: readonly ImportReport[];
}
/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param shards Source metadata.
 * @param [importTimes] Durable capture receipt times by content hash.
 * @returns Newest imports first. Undated sources and ties use name/identity order.
 */
export declare const buildAnalysisSourceCatalog: (shards: Pick<AnalysisProjectShards, "imports" | "evidence">, importTimes?: ReadonlyMap<string, number>) => readonly AnalysisEvidenceSource[];
/** Compact, navigable contribution. Full trace records never need to cross into an editor UI. */
export interface AnalysisSourceEntry {
    /** Stable entry id within the source contribution catalog. */
    readonly id: string;
    /** Short label suitable for UI lists. */
    readonly label: string;
    /** One-line summary of the contribution. */
    readonly description: string;
    /** Longer detail text for inspection views. */
    readonly detail: string;
    /** Address space when the entry anchors to one instruction site. */
    readonly addressSpace?: string;
    /** Instruction address when the entry anchors to one site. */
    readonly address?: number;
    /** Architecture tag when the entry is target-specific. */
    readonly architecture?: string;
    /** Output-image offsets implicated by the entry. */
    readonly outputOffsets: readonly number[];
    /** Persisted record ids backing the entry. */
    readonly recordIds: readonly string[];
}
/** Direct source attribution only. Capture subtraction is intentionally absent. */
export type AnalysisSourceGroup = "instructions" | "memory" | "contributions";
/** Exact SQL counts. Memory counts refer to persisted observations, not inferred access sites. */
export interface AnalysisSourceSummary {
    /** Catalog source whose SQL totals are being summarized. */
    readonly source: AnalysisEvidenceSource;
    /** Count of instruction observations attributed to the source. */
    readonly instructionCount: number;
    /** Count of persisted memory observations attributed to the source. */
    readonly memoryCount: number;
    /** Count of compact contribution entries attributed to the source. */
    readonly contributionCount: number;
}
//# sourceMappingURL=analysis-sources.d.ts.map