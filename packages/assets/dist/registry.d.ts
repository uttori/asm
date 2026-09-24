/** Borrowed source bytes. Importers must not mutate them or retain them after a call. */
export interface AssetInput {
    readonly bytes: Uint8Array;
    readonly mediaType: string;
}
/** A normalized document retains enough information for an encoder to validate fidelity. */
export interface AssetDocument {
    readonly kind: string;
    readonly value: unknown;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** One owned output byte stream and its format-specific metadata. */
export interface AssetOutput {
    readonly bytes: Uint8Array;
    readonly mediaType: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** Exact native conversion and explicitly lossy audio conversion have distinct records. */
export type AssetFidelity = {
    readonly kind: "exact";
    readonly verification: string;
} | {
    readonly kind: "lossy-audio";
    readonly sampleRate: number;
    readonly sourceSamples: number;
    readonly paddedSamples: number;
    readonly paddingSamples: number;
    readonly decodedSamples: number;
    readonly peakError: number;
    readonly rmsError: number;
    readonly snrDb?: number;
    readonly loopPeakError?: number;
};
/** A modern-byte importer is synchronous and portable to a browser worker. */
export interface AssetImporter {
    readonly id: string;
    readonly version: string;
    readonly mediaTypes: readonly string[];
    import(input: AssetInput): AssetDocument;
}
/** Encoders declare their primary output and validate their own options/resources. */
export interface AssetEncoder {
    readonly id: string;
    readonly version: string;
    readonly inputKinds: readonly string[];
    readonly primaryOutput: string;
    encode(document: AssetDocument, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): {
        readonly outputs: Readonly<Record<string, AssetOutput>>;
        readonly fidelity: AssetFidelity;
        readonly normalizedOptions: Readonly<Record<string, unknown>>;
    };
}
/** One supplied-byte conversion; paths are resolved by a caller-owned adapter. */
export interface AssetRequest {
    readonly source: AssetInput;
    readonly format: string;
    readonly resources?: Readonly<Record<string, AssetInput>>;
    readonly options?: Readonly<Record<string, unknown>>;
}
/** Named, owned bytes plus enough provenance for deterministic cache identity. */
export interface AssetResult {
    readonly outputs: Readonly<Record<string, AssetOutput>>;
    readonly primaryOutput: string;
    readonly fidelity: AssetFidelity;
    readonly importer: Readonly<{
        id: string;
        version: string;
    }>;
    readonly encoder: Readonly<{
        id: string;
        version: string;
    }>;
    readonly options: Readonly<Record<string, unknown>>;
    readonly document: AssetDocument;
}
/** Host-independent registry; duplicate IDs and ambiguous media types fail at setup time. */
export declare class AssetRegistry {
    #private;
    registerImporter(importer: AssetImporter): this;
    registerEncoder(encoder: AssetEncoder): this;
    importerFor(mediaType: string): AssetImporter;
    encoderFor(id: string): AssetEncoder;
}
/** Convert supplied bytes without a ROM, assembler, file read, or output write.
 * @param {AssetRegistry} registry Registered importers and encoders.
 * @param {AssetRequest} request Borrowed bytes, resources and options.
 * @returns {AssetResult} Named owned bytes and provider provenance.
 */
export declare function convertAsset(registry: AssetRegistry, request: AssetRequest): AssetResult;
//# sourceMappingURL=registry.d.ts.map