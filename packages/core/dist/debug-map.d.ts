import type { AddressToLineMapping, SerializableAddressRange, InstructionSourceInfo, AssetEmissionInfo, StructFieldEmissionInfo } from "./addressToLine.js";
/** Format discriminator written into every serialized debug map payload. */
export declare const DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
/** Schema version bumped when required debug-map fields change shape. */
export declare const DEBUG_MAP_SCHEMA_VERSION = 1;
/** Fingerprinted source file or binary dependency entry in a debug map catalog. */
export interface DebugMapSource {
    /** Stable source index referenced by ranges and optional metadata tables. */
    readonly id: number;
    /** Portable path relative to the configured source root when possible. */
    readonly path: string;
    /** Byte length of the source file at fingerprint time. */
    readonly size: number;
    /** CRC32 of source bytes for quick stale detection. */
    readonly crc32: number;
    /** SHA-256 of source bytes for exact identity checks. */
    readonly sha256: string;
    /** Binary/resource dependencies have no source lines of their own. */
    readonly kind?: "binary" | "resource";
}
/** Address range mapped to a cataloged source line within an architecture and address space. */
export interface DebugMapRange extends Omit<SerializableAddressRange, "source"> {
    /** Index into the debug map sources table for this range. */
    readonly sourceId: number;
}
/** Final encoder operand values attached to a fingerprinted source snapshot. */
export interface DebugMapInstruction extends Omit<InstructionSourceInfo, "fileIdx"> {
    /** Index into the debug map sources table for the instruction occurrence. */
    readonly sourceId: number;
}
/** Source statement and binary input provenance for one emitted asset stream. */
export interface DebugMapAsset extends Omit<AssetEmissionInfo, "fileIdx" | "assetFileIdx"> {
    /** Source index for the assembly statement that emitted the asset. */
    readonly sourceId: number;
    /** Source index for the binary asset file itself. */
    readonly assetSourceId: number;
}
/** Scalar record attribution resolved by the linker or absolute source writer. */
export interface DebugMapField extends Omit<StructFieldEmissionInfo, "fileIdx"> {
    /** Source index for the struct field emission statement. */
    readonly sourceId: number;
}
/** Serializable debug map binding output bytes to sources, ranges, and optional metadata. */
export interface DebugMap {
    /** Optional struct field emissions when the builder recorded them. */
    readonly fields?: readonly DebugMapField[];
    /** Format discriminator matching DEBUG_MAP_FORMAT. */
    readonly format: typeof DEBUG_MAP_FORMAT;
    /** Schema version matching DEBUG_MAP_SCHEMA_VERSION. */
    readonly schemaVersion: typeof DEBUG_MAP_SCHEMA_VERSION;
    /** Content hash covering every field except this fingerprint object. */
    readonly fingerprint: {
        readonly algorithm: "sha256";
        readonly value: string;
    };
    /** Target contribution identifier for the linked output. */
    readonly target: string;
    /** Linked output size and digest recorded at map creation time. */
    readonly output: {
        readonly size: number;
        readonly sha256: string;
    };
    /** Ordered source catalog referenced by ranges and metadata tables. */
    readonly sources: readonly DebugMapSource[];
    /** Address ranges mapped back to source lines. */
    readonly ranges: readonly DebugMapRange[];
    /** Optional additive editor metadata; older maps remain valid without it. */
    readonly instructions?: readonly DebugMapInstruction[];
    /** Optional asset metadata; binary inputs never receive assembly line mappings. */
    readonly assets?: readonly DebugMapAsset[];
}
/** Inputs required to build a deterministic debug map from an address mapping. */
export interface CreateDebugMapOptions {
    /** Target contribution identifier stored in the map. */
    readonly target: string;
    /** Final output bytes hashed into the map payload. */
    readonly output: Uint8Array;
    /** Address-to-line mapping collected during assembly or linking. */
    readonly mapping: AddressToLineMapping;
    /** Optional classification of non-source dependencies by absolute path. */
    readonly dependencyKinds?: ReadonlyMap<string, "binary" | "resource">;
    /** Base directory used to make source paths portable. Defaults to the process cwd. */
    readonly sourceRoot?: string;
}
/**
 * Creates a deterministic debug map whose fingerprint covers every field except itself.
 * @param options Output and mapping inputs.
 * @returns Fingerprinted debug map.
 */
export declare const createDebugMap: (options: CreateDebugMapOptions) => DebugMap;
/** Debug map payload accepted before strict format field narrowing during validation. */
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
 * @param map Debug map to validate. Format fields are checked here.
 * @param output Optional exact output bytes.
 * @returns Validation issues.
 */
export declare const validateDebugMap: (map: UncheckedDebugMap, output?: Uint8Array) => readonly string[];
/**
 * Resolves a logical runtime address, falling back to an output offset for mirrors.
 * @param map Debug map.
 * @param addressSpace Address-space id.
 * @param address Logical address.
 * @param options Filters and mirror identity.
 * @returns Matching ranges.
 */
export declare const debugMapRangesForAddress: (map: DebugMap, addressSpace: string, address: number, options?: {
    readonly architecture?: string;
    readonly outputOffset?: number;
}) => readonly DebugMapRange[];
/**
 * Resolves one-based source lines to all matching logical ranges.
 * @param map Debug map.
 * @param sourcePath Source path.
 * @param line One-based line.
 * @param architecture Optional architecture filter.
 * @returns Matching logical ranges.
 */
export declare const debugMapRangesForSource: (map: DebugMap, sourcePath: string, line: number, architecture?: string) => readonly DebugMapRange[];
export {};
//# sourceMappingURL=debug-map.d.ts.map