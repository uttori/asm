import { decodeAsepriteDocumentSync, encodeAsepriteDocument } from "./aseprite-document.js";
import { indexedAtlasDocument } from "./atlas-interchange.js";
import type { IndexedDocument } from "./indexed-document.js";
import { createIndexedPng } from "./png-edit.js";
import { pngImporter } from "./png.js";
import { rasterInterchangeAtlas, rasterInterchangeDocument } from "./raster-interchange.js";
import type { AssetImporter } from "./registry.js";

/**
 * Source representations are independent of game codecs and editor executables.
 * A future codec can choose its own normalized document type; assembly decoding must stay synchronous.
 * Decoders must be deterministic for the supplied bytes/reference and preserve borrowed inputs;
 * adapters can cache normalization for this registry's lifetime. Encoded outputs belong to the caller.
 */
export interface AssetSourceCodec<Document> {
  /** Stable codec id for bindings and registry lookup. */
  readonly id: string;
  /** Schema revision for encoded source bytes. */
  readonly version: number;
  /** Primary MIME type for generated sources. */
  readonly mediaType: string;
  /** First suffix is used for generated sources; remaining suffixes are input aliases. */
  readonly extensions: readonly string[];
  /** Whether encoded sources embed the binding asset identity. */
  readonly embeddedIdentity: boolean;
  /** Probe wire bytes without fully decoding. */
  matches(bytes: Uint8Array): boolean;
  /** Composed assets supply an authoritative reference; self-contained native rasters may omit it. */
  decode(bytes: Uint8Array, reference?: Document): Document;
  /** Serialize a normalized document to owned source bytes. */
  encode(document: Document): Uint8Array | Promise<Uint8Array>;
}

/** Each adapter/host chooses its normalized document contract and explicitly installs supported codecs. */
export class AssetSourceCodecRegistry<Document> {
  readonly #codecs = new Map<string, AssetSourceCodec<Document>>();
  #revision = 0;
  /** Changes invalidate adapter caches when newly registered probes alter content discovery. */
  get revision(): number {
    return this.#revision;
  }

  /** Register one codec; ambiguous extensions reject registration. */
  register(codec: AssetSourceCodec<Document>): this {
    if (
      !codec.id ||
      this.#codecs.has(codec.id) ||
      typeof codec.matches !== "function" ||
      typeof codec.decode !== "function" ||
      typeof codec.encode !== "function" ||
      typeof codec.embeddedIdentity !== "boolean" ||
      !Number.isSafeInteger(codec.version) ||
      codec.version < 1 ||
      !/^[\w+.-]+\/[\w+.-]+$/.test(codec.mediaType) ||
      !codec.extensions.length ||
      codec.extensions.some((extension) => !/^\.[\d.a-z-]+$/i.test(extension))
    ) {
      throw new Error(`Invalid or duplicate source codec '${codec.id}'.`);
    }
    const extensions = codec.extensions.map((extension) => extension.toLowerCase());
    if (new Set(extensions).size !== extensions.length) {
      throw new Error(`Duplicate source extension for '${codec.id}'.`);
    }
    for (const existing of this.#codecs.values()) {
      if (existing.extensions.some((extension) => extensions.includes(extension))) {
        throw new Error(`Ambiguous source extension for '${codec.id}'.`);
      }
    }
    // Capture the public contract explicitly: spreading a class instance loses prototype methods/getters.
    // Bound methods retain their original receiver while later descriptor replacement cannot alter registration.
    this.#codecs.set(
      codec.id,
      Object.freeze({
        id: codec.id,
        version: codec.version,
        mediaType: codec.mediaType,
        embeddedIdentity: codec.embeddedIdentity,
        extensions: Object.freeze(extensions),
        matches: codec.matches.bind(codec),
        decode: codec.decode.bind(codec),
        encode: codec.encode.bind(codec),
      }),
    );
    this.#revision++;
    return this;
  }

  /** Resolve a registered codec by id. */
  get(id: string): AssetSourceCodec<Document> {
    const codec = this.#codecs.get(id);
    if (!codec) {
      throw new Error(`Unsupported asset source representation '${id}'.`);
    }
    return codec;
  }

  /** Content establishes representation; the filename and declared media type must agree when supplied. */
  identify(
    bytes: Uint8Array,
    hints: { path?: string; mediaType?: string } = {},
  ): AssetSourceCodec<Document> {
    const candidates = [...this.#codecs.values()].filter((codec) => codec.matches(bytes));
    if (candidates.length !== 1) {
      throw new Error(`Unrecognized or ambiguous asset source content: ${hints.path ?? "input"}.`);
    }
    const codec = candidates[0];
    if (
      (hints.path &&
        !codec.extensions.some((extension) => hints.path!.toLowerCase().endsWith(extension))) ||
      (hints.mediaType && hints.mediaType !== codec.mediaType)
    ) {
      throw new Error(
        `Asset source extension/content mismatch: ${hints.path ?? hints.mediaType}; content is ${codec.id}.`,
      );
    }
    return codec;
  }

  /** Discovery feeds editor menus without hard-coding the set of representations into the host. */
  representations(): readonly { id: string; mediaType: string; extensions: readonly string[] }[] {
    return [...this.#codecs.values()].map(({ id, mediaType, extensions }) => ({
      id,
      mediaType,
      extensions,
    }));
  }
}

/** PNG uses externally declared rectangles/identity; arbitrary palette transparency never determines native ownership. */
export const indexedPngSourceCodec: AssetSourceCodec<IndexedDocument> = {
  id: "indexed-png",
  version: 1,
  mediaType: "image/png",
  extensions: [".png"],
  embeddedIdentity: false,
  matches: (bytes) =>
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte),
  decode(bytes, reference) {
    const image = indexedAtlasDocument(
      pngImporter.import({ bytes, mediaType: "image/png" }).value,
      reference?.transparentIndex ?? 0,
    );
    return rasterInterchangeDocument({ ...image, exportId: reference?.exportId });
  },
  encode: (document) => createIndexedPng(rasterInterchangeAtlas(document)),
};

/** Raster and tilemap containers share the bounded structural parser; no flattening occurs on decode. */
export const asepriteSourceCodec: AssetSourceCodec<IndexedDocument> = {
  id: "aseprite",
  version: 1,
  mediaType: "image/x-aseprite",
  extensions: [".aseprite", ".ase"],
  embeddedIdentity: true,
  matches: (bytes) => bytes.length >= 128 && bytes[4] === 0xe0 && bytes[5] === 0xa5,
  decode: decodeAsepriteDocumentSync,
  encode: encodeAsepriteDocument,
};

/** Portable default codecs; adapters may install more representations on their own registry. */
export function indexedSourceCodecs(): AssetSourceCodecRegistry<IndexedDocument> {
  return new AssetSourceCodecRegistry<IndexedDocument>()
    .register(indexedPngSourceCodec)
    .register(asepriteSourceCodec);
}

/** Simple indexed rasters need no sidecar when native options already describe their complete storage mapping. */
export const asepriteRasterImporter: AssetImporter = {
  id: "uttori.import.aseprite-raster",
  version: "1.0.0",
  mediaTypes: ["image/x-aseprite"],
  import(input) {
    const codec = indexedSourceCodecs().identify(input.bytes, { mediaType: input.mediaType });
    const document = decodeAsepriteDocumentSync(input.bytes);
    if (codec.id !== "aseprite") {
      throw new Error("Invalid Aseprite raster source.");
    }
    const atlas = rasterInterchangeAtlas(document);
    const value = {
      kind: "indexed-image" as const,
      sourceBitDepth: 8 as const,
      width: atlas.width,
      height: atlas.height,
      indexes: atlas.indexes,
      palette: atlas.palette,
    };
    return { kind: value.kind, value };
  },
};
