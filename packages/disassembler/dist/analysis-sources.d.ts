import type { AnalysisProjectManifest, AnalysisProjectShards, EvidenceRecord, ImportReport } from "./project-types.js";
/** One immutable imported artifact, or one producer of evidence without an artifact identity. */
export interface AnalysisEvidenceSource {
    readonly id: string;
    readonly name: string;
    readonly names: readonly string[];
    readonly kinds: readonly EvidenceRecord["source"][];
    readonly format?: string;
    readonly sha256?: string;
    readonly evidenceIds: readonly string[];
    readonly reports: readonly ImportReport[];
}
/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param {Pick<AnalysisProjectShards, "imports" | "evidence">} shards Source metadata.
 * @returns {readonly AnalysisEvidenceSource[]} Stable source catalog, including sources without runtime coverage.
 */
export declare const buildAnalysisSourceCatalog: (shards: Pick<AnalysisProjectShards, "imports" | "evidence">) => readonly AnalysisEvidenceSource[];
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
export type AnalysisSourceGroup = "uniqueInstructions" | "codeRanges" | "functions" | "sharedInstructions" | "memory" | "contributions";
export interface AnalysisSourceComparison {
    readonly source: AnalysisEvidenceSource;
    readonly baseline: readonly AnalysisEvidenceSource[];
    readonly instructionCount: number;
    readonly uniqueInstructionCount: number;
    readonly sharedInstructionCount: number;
    readonly knownCodeBytes: number;
    readonly unknownSizeInstructions: number;
    readonly functionCount: number;
    readonly unownedInstructions: number;
    readonly ambiguousInstructions: number;
    readonly uniqueMemoryCount: number;
    readonly contributionCount: number;
    readonly codeRangeCount: number;
    readonly notes: readonly string[];
}
/** Read-only index over direct runtime observations and attributed metadata. */
export declare class AnalysisSourceIndex {
    #private;
    readonly sources: readonly AnalysisEvidenceSource[];
    /** Build contribution indexes while streaming runtime rows; the input history is never retained. */
    constructor(manifest: AnalysisProjectManifest, shards: AnalysisProjectShards, runtime?: Iterable<AnalysisProjectShards["runtime"][number]>);
    /**
     * Sources with recorded runtime facts; static/imported classifications are not capture baselines.
     * @returns {readonly AnalysisEvidenceSource[]} Sources contributing direct runtime facts.
     */
    runtimeSources(): readonly AnalysisEvidenceSource[];
    /**
     * Compare direct observations against all other captures or an explicit baseline selection.
     * @param {string} sourceId Selected catalog identity.
     * @param {readonly string[]} [baselineIds] Explicit baseline identities; undefined means all other runtime sources.
     * @returns {AnalysisSourceComparison} Compact counts and interpretation notes.
     */
    compare(sourceId: string, baselineIds?: readonly string[]): AnalysisSourceComparison;
    /**
     * Materialize only a bounded page for an editor tree.
     * @param {string} sourceId Selected source identity.
     * @param {AnalysisSourceGroup} group Contribution group.
     * @param {number} offset Zero-based page start.
     * @param {readonly string[]} [baselineIds] Optional comparison captures.
     * @returns {readonly AnalysisSourceEntry[]} Up to 200 navigable entries.
     */
    page(sourceId: string, group: AnalysisSourceGroup, offset?: number, baselineIds?: readonly string[]): readonly AnalysisSourceEntry[];
}
//# sourceMappingURL=analysis-sources.d.ts.map