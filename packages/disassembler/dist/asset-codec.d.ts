/** JSON-safe value used for codec options, decoded models, and inspection metadata. */
export type AssetValue = null | boolean | number | string | readonly AssetValue[] | {
    readonly [key: string]: AssetValue;
};
/** Bounds declared by a codec before it inspects an asset instance. */
export interface AssetSizeBounds {
    /** Smallest legal encoded asset size. */
    readonly minimum: number;
    /** Largest legal encoded asset size, when the format has a fixed upper bound. */
    readonly maximum?: number;
    /** Required source-offset alignment. */
    readonly alignment?: number;
}
/** Immutable byte source supplied to target-neutral codecs. */
export interface AssetByteSource {
    readonly length: number;
    /**
     * Reads a defensive copy of one half-open byte range.
     * @param {number} offset Source-relative byte offset.
     * @param {number} length Number of bytes to read.
     * @returns {Uint8Array | undefined} Copied bytes, or `undefined` outside the source.
     */
    read(offset: number, length: number): Uint8Array | undefined;
}
/** One logical reference discovered while inspecting an asset. */
export interface AssetReference {
    readonly id: string;
    readonly kind: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly width?: number;
    readonly targetAssetId?: string;
    readonly detail?: string;
}
/** File extracted from a decoded asset. Bytes remain runtime data, never project metadata. */
export interface AssetExtractedFile {
    /** Safe slash-separated path relative to the asset export directory. */
    readonly path: string;
    readonly mediaType: string;
    readonly bytes: Uint8Array;
}
/** Nested codec request relative to the containing asset's source range. */
export interface NestedAssetRequest {
    /** Stable local id. The planner qualifies it with the parent asset id. */
    readonly id: string;
    readonly codecId: string;
    readonly relativeOffset: number;
    /** Exact encoded size. Omit when the child codec discovers its own size. */
    readonly length?: number;
    readonly addressSpace?: string;
    readonly address?: number;
    readonly options?: AssetValue;
}
/** Result of a codec's bounded, non-destructive inspection pass. */
export interface AssetInspection {
    /** Exact encoded bytes owned by this asset instance. */
    readonly size: number;
    readonly references?: readonly AssetReference[];
    readonly children?: readonly NestedAssetRequest[];
    readonly metadata?: Readonly<Record<string, AssetValue>>;
}
/** Decoded editable model and any deterministic extracted files. */
export interface AssetDecodeResult {
    readonly value: AssetValue;
    readonly files?: readonly AssetExtractedFile[];
}
/** Address-qualified request for one root asset. */
export interface AssetRequest {
    readonly id: string;
    readonly codecId: string;
    readonly sourceOffset: number;
    readonly addressSpace: string;
    readonly address: number;
    /** Exact encoded size. Omit when the codec discovers its own size. */
    readonly length?: number;
    readonly options?: AssetValue;
}
/** Context shared by inspect, decode, and encode operations. */
export interface AssetCodecContext {
    readonly source: AssetByteSource;
    readonly request: AssetRequest;
    /** Direct codec dependencies resolved by stable id, independent of registration order. */
    readonly dependencies: ReadonlyMap<string, AssetCodec>;
}
/** Additional inputs available while decoding an inspected asset. */
export interface AssetDecodeContext extends AssetCodecContext {
    readonly inspection: AssetInspection;
}
/** Additional inputs available while re-encoding a decoded asset. */
export interface AssetEncodeContext extends AssetDecodeContext {
    readonly decoded: AssetDecodeResult;
}
/** Reversible, target-neutral asset implementation. */
export interface AssetCodec {
    /** Stable namespaced id persisted by later project annotations. */
    readonly id: string;
    /** Codec implementation version used for provenance and cache invalidation. */
    readonly version: string;
    readonly sizeBounds: AssetSizeBounds;
    /** Stable codec ids required by this implementation. */
    readonly dependencies?: readonly string[];
    inspect(context: AssetCodecContext): AssetInspection;
    decode(context: AssetDecodeContext): AssetDecodeResult;
    encode(context: AssetEncodeContext): Uint8Array;
}
/** One normalized asset instance in a deterministic plan. */
export interface PlannedAsset {
    readonly id: string;
    readonly parentId?: string;
    readonly depth: number;
    readonly request: AssetRequest;
    readonly codecVersion: string;
    readonly inspection: AssetInspection;
}
/** Explicit overlap retained by the planner instead of applying last-writer-wins. */
export interface AssetPlanConflict {
    readonly id: string;
    readonly kind: "overlap";
    readonly assets: readonly [string, string];
    readonly sourceOffset: number;
    readonly endOffset: number;
    readonly message: string;
}
/** Stable nested-asset plan and any non-ancestral ownership conflicts. */
export interface AssetPlan {
    readonly assets: readonly PlannedAsset[];
    readonly conflicts: readonly AssetPlanConflict[];
}
/** Hash and size of one deterministic extracted file. */
export interface AssetVerifiedFile {
    readonly path: string;
    readonly mediaType: string;
    readonly size: number;
    readonly sha256: string;
}
/** Successful inspect/decode/encode no-op verification for one planned asset. */
export interface AssetVerificationRecord {
    readonly id: string;
    readonly codecId: string;
    readonly codecVersion: string;
    readonly sourceOffset: number;
    readonly size: number;
    readonly sourceSha256: string;
    readonly encodedSha256: string;
    readonly files: readonly AssetVerifiedFile[];
    readonly references: readonly AssetReference[];
}
/** Deterministic verification output for a conflict-free plan. */
export interface AssetVerificationResult {
    readonly assets: readonly AssetVerificationRecord[];
}
/** Order-independent registry for codecs and their stable-id dependencies. */
export declare class AssetCodecRegistry {
    #private;
    /**
     * Registers one codec. Dependencies may be registered before or afterward.
     * @param {AssetCodec} codec Codec implementation to add.
     * @returns {this} This registry for fluent setup.
     */
    register(codec: AssetCodec): this;
    /**
     * Resolves a codec and validates its complete dependency graph.
     * @param {string} id Stable codec id.
     * @returns {AssetCodec} Registered codec.
     */
    resolve(id: string): AssetCodec;
    /**
     * Returns direct dependencies after validating the full dependency graph.
     * @param {string} id Stable codec id.
     * @returns {ReadonlyMap<string, AssetCodec>} Direct dependencies keyed by id.
     */
    dependenciesFor(id: string): ReadonlyMap<string, AssetCodec>;
    /**
     * Lists codecs in stable-id order, never registration order.
     * @returns {readonly AssetCodec[]} Registered codecs.
     */
    list(): readonly AssetCodec[];
}
/**
 * Inspects root and nested assets, validates deterministic inspection and bounds,
 * and retains non-ancestral overlaps as explicit conflicts.
 * @param {AssetCodecRegistry} registry Codec registry.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {readonly AssetRequest[]} requests Root asset requests.
 * @param {{ readonly maxDepth?: number }} [options] Nested-asset recursion cap.
 * @returns {AssetPlan} Stable asset plan and overlap conflicts.
 */
export declare const planAssets: (registry: AssetCodecRegistry, source: AssetByteSource, requests: readonly AssetRequest[], options?: {
    readonly maxDepth?: number;
}) => AssetPlan;
/**
 * Decodes one planned asset and normalizes its JSON value and extracted files.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {PlannedAsset} asset Planned asset to decode.
 * @returns {AssetDecodeResult} Canonical editable value and deterministic files.
 */
export declare const decodePlannedAsset: (registry: AssetCodecRegistry, source: AssetByteSource, asset: PlannedAsset) => AssetDecodeResult;
/**
 * Encodes one editable decoded asset through the exact codec version used while planning.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {PlannedAsset} asset Planned asset to encode.
 * @param {AssetDecodeResult} decoded Edited JSON value and extracted files.
 * @returns {Uint8Array} Defensive copy of the encoded bytes.
 */
export declare const encodePlannedAsset: (registry: AssetCodecRegistry, source: AssetByteSource, asset: PlannedAsset, decoded: AssetDecodeResult) => Uint8Array;
/**
 * Repeats decode and encode, verifies deterministic results, and requires every
 * codec's no-op encoding to preserve its exact source range byte-for-byte.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {AssetPlan} plan Conflict-free inspected asset plan.
 * @returns {AssetVerificationResult} Stable hashes, files, and references.
 */
export declare const verifyAssetPlan: (registry: AssetCodecRegistry, source: AssetByteSource, plan: AssetPlan) => AssetVerificationResult;
//# sourceMappingURL=asset-codec.d.ts.map