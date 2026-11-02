import type { AddressToLineMapping } from "@uttori/asm-core";
/** Conversion progress over the immutable original ROM, excluding any newly added capacity. */
export interface SourceBuildCoverage {
    readonly romSha256: string;
    readonly totalBytes: number;
    /** Unique original bytes still consumed through raw-block includes, even after relocation. */
    readonly remainingBytes: number;
    /** Bytes represented by instructions, structured data, or converted assets. */
    readonly convertedBytes: number;
}
/** Small selected-build projection; dependency hashes remain in that build's full receipt. */
export interface SourceBuildSummary {
    readonly version: 1;
    readonly inputSha256: string;
    /** Absent for builds without an original-ROM raw-block contract. */
    readonly coverage?: SourceBuildCoverage;
}
/** Validate persisted totals before presenting them as conversion progress. */
export declare function isSourceBuildCoverage(value: unknown): value is SourceBuildCoverage;
/**
 * Count original bytes still included from the declared raw-block directory. Ordinary binary
 * assets do not count as unconverted. Input slices, rather than output placement or file sizes,
 * keep repeated includes, relocation, unused blocks and expanded ROM capacity from skewing totals.
 * Missing slice metadata fails instead of reporting misleading complete conversion.
 */
export declare function sourceBuildCoverage(mapping: AddressToLineMapping, root: string, raw: {
    readonly directory: string;
    readonly original: Uint8Array;
    readonly blockSize: number;
}): SourceBuildCoverage;
//# sourceMappingURL=build-coverage.d.ts.map