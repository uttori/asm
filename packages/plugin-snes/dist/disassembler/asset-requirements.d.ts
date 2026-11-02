import type { LoadedSnesStructMap } from "./struct-map.js";
/** Exact source codec required for every ROM binding of one project-defined layout. */
export interface SnesAssetRequirement {
    readonly structure: string;
    readonly format: string;
    /** Required literal string options, such as the room section. Other options remain unrestricted. */
    readonly options?: Readonly<Record<string, string>>;
}
/** Headerless ROM interval replaced by a single asset directive. */
export interface SnesAssetIncludeEntry {
    readonly start: number;
    readonly end: number;
    readonly directive: string;
}
/** Project rules remain optional; malformed rules must never silently disable admission checks. */
export declare function parseSnesAssetRequirements(value: unknown): readonly SnesAssetRequirement[];
/**
 * Require complete coverage by the declared codec before export emits any files.
 * Adjacent includes and larger shared owners are valid; gaps, wrong codecs and wrong
 * section options fail even when the resulting raw assembly would rebuild correctly.
 */
export declare function verifySnesAssetRequirements(requirements: readonly SnesAssetRequirement[], entries: readonly SnesAssetIncludeEntry[], catalog: LoadedSnesStructMap | undefined): void;
//# sourceMappingURL=asset-requirements.d.ts.map