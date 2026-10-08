import type { IndexedDocument } from "./indexed-document.js";
import type { AssetImporter } from "./registry.js";
/** Source representations are independent of game codecs and editor executables.
 * A future codec can choose its own normalized document type; assembly decoding must stay synchronous.
 * Decoders must be deterministic for the supplied bytes/reference and preserve borrowed inputs;
 * adapters can cache normalization for this registry's lifetime. Encoded outputs belong to the caller.
 */
export interface AssetSourceCodec<Document> {
    readonly id: string;
    readonly version: number;
    readonly mediaType: string;
    /** First suffix is used for generated sources; remaining suffixes are input aliases. */
    readonly extensions: readonly string[];
    readonly embeddedIdentity: boolean;
    matches(bytes: Uint8Array): boolean;
    /** Composed assets supply an authoritative reference; self-contained native rasters may omit it. */
    decode(bytes: Uint8Array, reference?: Document): Document;
    encode(document: Document): Uint8Array | Promise<Uint8Array>;
}
/** Each adapter/host chooses its normalized document contract and explicitly installs supported codecs. */
export declare class AssetSourceCodecRegistry<Document> {
    #private;
    /** Changes invalidate adapter caches when newly registered probes alter content discovery. */
    get revision(): number;
    register(codec: AssetSourceCodec<Document>): this;
    get(id: string): AssetSourceCodec<Document>;
    /** Content establishes representation; the filename and declared media type must agree when supplied. */
    identify(bytes: Uint8Array, hints?: {
        path?: string;
        mediaType?: string;
    }): AssetSourceCodec<Document>;
    /** Discovery feeds editor menus without hard-coding the set of representations into the host. */
    representations(): readonly {
        id: string;
        mediaType: string;
        extensions: readonly string[];
    }[];
}
/** PNG uses externally declared rectangles/identity; arbitrary palette transparency never determines native ownership. */
export declare const indexedPngSourceCodec: AssetSourceCodec<IndexedDocument>;
/** Raster and tilemap containers share the bounded structural parser; no flattening occurs on decode. */
export declare const asepriteSourceCodec: AssetSourceCodec<IndexedDocument>;
/** Portable default codecs; adapters may install more representations on their own registry. */
export declare function indexedSourceCodecs(): AssetSourceCodecRegistry<IndexedDocument>;
/** Simple indexed rasters need no sidecar when native options already describe their complete storage mapping. */
export declare const asepriteRasterImporter: AssetImporter;
//# sourceMappingURL=source-codecs.d.ts.map