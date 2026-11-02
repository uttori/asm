import type { AddressToLineMapping, SerializableAddressRange, InstructionSourceInfo, AssetEmissionInfo, StructFieldEmissionInfo } from "./addressToLine.js";
export declare const DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
export declare const DEBUG_MAP_SCHEMA_VERSION = 1;
export interface DebugMapSource {
    readonly id: number;
    readonly path: string;
    readonly size: number;
    readonly crc32: number;
    readonly sha256: string;
    /** Binary/resource dependencies have no source lines of their own. */
    readonly kind?: "binary" | "resource";
}
export interface DebugMapRange extends Omit<SerializableAddressRange, "source"> {
    readonly sourceId: number;
}
/** Final encoder operand values attached to a fingerprinted source snapshot. */
export interface DebugMapInstruction extends Omit<InstructionSourceInfo, "fileIdx"> {
    readonly sourceId: number;
}
/** Source statement and binary input provenance for one emitted asset stream. */
export interface DebugMapAsset extends Omit<AssetEmissionInfo, "fileIdx" | "assetFileIdx"> {
    readonly sourceId: number;
    readonly assetSourceId: number;
}
/** Scalar record attribution resolved by the linker or absolute source writer. */
export interface DebugMapField extends Omit<StructFieldEmissionInfo, "fileIdx"> {
    readonly sourceId: number;
}
export interface DebugMap {
    readonly fields?: readonly DebugMapField[];
    readonly format: typeof DEBUG_MAP_FORMAT;
    readonly schemaVersion: typeof DEBUG_MAP_SCHEMA_VERSION;
    readonly fingerprint: {
        readonly algorithm: "sha256";
        readonly value: string;
    };
    readonly target: string;
    readonly output: {
        readonly size: number;
        readonly sha256: string;
    };
    readonly sources: readonly DebugMapSource[];
    readonly ranges: readonly DebugMapRange[];
    /** Optional additive editor metadata; older maps remain valid without it. */
    readonly instructions?: readonly DebugMapInstruction[];
    /** Optional asset metadata; binary inputs never receive assembly line mappings. */
    readonly assets?: readonly DebugMapAsset[];
}
export interface CreateDebugMapOptions {
    readonly target: string;
    readonly output: Uint8Array;
    readonly mapping: AddressToLineMapping;
    readonly dependencyKinds?: ReadonlyMap<string, "binary" | "resource">;
    /** Base directory used to make source paths portable. Defaults to the process cwd. */
    readonly sourceRoot?: string;
}
/**
 * Creates a deterministic debug map whose fingerprint covers every field except itself.
 * @param {CreateDebugMapOptions} options Output and mapping inputs.
 * @returns {DebugMap} Fingerprinted debug map.
 */
export declare const createDebugMap: (options: CreateDebugMapOptions) => DebugMap;
type UncheckedDebugMap = Omit<DebugMap, "format" | "schemaVersion" | "fingerprint"> & {
    readonly format: string;
    readonly schemaVersion: number;
    readonly fingerprint: {
        readonly algorithm: string;
        readonly value: string;
    };
};
/**
 * Recomputes the content fingerprint and output hash for stale-map detection.
 * @param {UncheckedDebugMap} map Debug map to validate. Format fields are checked here.
 * @param {Uint8Array} output Optional exact output bytes.
 * @returns {readonly string[]} Validation issues.
 */
export declare const validateDebugMap: (map: UncheckedDebugMap, output?: Uint8Array) => readonly string[];
/**
 * Resolves a logical runtime address, falling back to an output offset for mirrors.
 * @param {DebugMap} map Debug map.
 * @param {string} addressSpace Address-space id.
 * @param {number} address Logical address.
 * @param {{ readonly architecture?: string; readonly outputOffset?: number }} options Filters and mirror identity.
 * @returns {readonly DebugMapRange[]} Matching ranges.
 */
export declare const debugMapRangesForAddress: (map: DebugMap, addressSpace: string, address: number, options?: {
    readonly architecture?: string;
    readonly outputOffset?: number;
}) => readonly DebugMapRange[];
/**
 * Resolves one-based source lines to all matching logical ranges.
 * @param {DebugMap} map Debug map.
 * @param {string} sourcePath Source path.
 * @param {number} line One-based line.
 * @param {string} architecture Optional architecture filter.
 * @returns {readonly DebugMapRange[]} Matching logical ranges.
 */
export declare const debugMapRangesForSource: (map: DebugMap, sourcePath: string, line: number, architecture?: string) => readonly DebugMapRange[];
export {};
//# sourceMappingURL=debug-map.d.ts.map