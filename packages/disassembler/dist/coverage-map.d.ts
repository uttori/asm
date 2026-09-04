import type { AnalysisProjectManifest, AnalysisProjectShards } from "./project-types.js";
/** Stable display categories for ROM-content coverage. */
export type RomCoverageClassification = "opcode" | "operand" | "data" | "asset" | "unknown";
/** Whether a byte range is unclassified, singly classified, or contradictory. */
export type RomCoverageStatus = "unknown" | "classified" | "conflict";
/** Runtime coverage kinds projected onto ROM-content offsets. */
export type RomRuntimeCoverage = "executed" | "operand" | "read" | "written";
/** One maximally coalesced half-open ROM-content interval. */
export interface RomCoverageSegment {
    readonly start: number;
    readonly end: number;
    readonly status: RomCoverageStatus;
    readonly classifications: readonly RomCoverageClassification[];
    readonly runtime: readonly RomRuntimeCoverage[];
    readonly annotationIds: readonly string[];
    readonly analysisIds: readonly string[];
    readonly runtimeIds: readonly string[];
    readonly conflictIds: readonly string[];
    readonly regionIds: readonly string[];
}
/** A project record that cannot be conservatively projected into ROM file offsets. */
export interface UnprojectedRomCoverageRecord {
    readonly kind: "annotation" | "analysis" | "region" | "runtime";
    readonly id: string;
    readonly addressSpace?: string;
    readonly reason: "non-file-address-space" | "missing-file-offset" | "outside-rom" | "invalid-range";
}
/** Non-fatal normalization note produced while building a read-only map. */
export interface RomCoverageDiagnostic {
    readonly recordId: string;
    readonly message: string;
}
/** Aggregate byte totals for a coverage map. Classification totals may overlap on conflicts. */
export interface RomCoverageSummary {
    readonly totalBytes: number;
    readonly classifiedBytes: number;
    readonly unknownBytes: number;
    readonly conflictBytes: number;
    readonly segmentCount: number;
    readonly bytesByClassification: Readonly<Record<RomCoverageClassification, number>>;
    readonly bytesByRuntimeCoverage: Readonly<Record<RomRuntimeCoverage, number>>;
}
/** Target-neutral, read-only ROM map derived from one validated analysis project. */
export interface RomCoverageMap {
    readonly contentSize: number;
    readonly fileAddressSpaces: readonly string[];
    readonly segments: readonly RomCoverageSegment[];
    readonly summary: RomCoverageSummary;
    readonly unprojected: readonly UnprojectedRomCoverageRecord[];
    readonly diagnostics: readonly RomCoverageDiagnostic[];
}
/**
 * Builds a conservative ROM-content map without invoking mapper-specific address translation.
 * Records already expressed in a file address space and records carrying an explicit file offset
 * are projected. Everything else stays visible in `unprojected` instead of being guessed.
 * @param {Pick<AnalysisProjectManifest, "addressSpaces" | "rom">} manifest Validated project manifest.
 * @param {AnalysisProjectShards} shards Validated project shards.
 * @returns {RomCoverageMap} Coalesced map, summaries, and projection diagnostics.
 */
export declare const buildRomCoverageMap: (manifest: Pick<AnalysisProjectManifest, "addressSpaces" | "rom">, shards: AnalysisProjectShards) => RomCoverageMap;
//# sourceMappingURL=coverage-map.d.ts.map