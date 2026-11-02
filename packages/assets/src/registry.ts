import { isNamespacedId } from "./validation.js";

/** Borrowed source bytes. Importers must not mutate them or retain them after a call. */
export interface AssetInput {
  /** Source file contents. */
  readonly bytes: Uint8Array;
  /** Media type that selects the importer, such as `image/png`. */
  readonly mediaType: string;
}

/** A normalized document retains enough information for an encoder to validate fidelity. */
export interface AssetDocument {
  /** Document kind an encoder must list in `inputKinds`, such as `pcm-audio`. */
  readonly kind: string;
  /** Kind-specific normalized payload. */
  readonly value: unknown;
  /** Importer-specific facts about the source; absent when there are none. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** One owned output byte stream and its format-specific metadata. */
export interface AssetOutput {
  /** Encoded bytes; the registry returns a copy the caller owns. */
  readonly bytes: Uint8Array;
  /** Media type of `bytes`. */
  readonly mediaType: string;
  /** Format-specific facts about the output; absent when there are none. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Exact native conversion and explicitly lossy audio conversion have distinct records. */
export type AssetFidelity =
  | { readonly kind: "exact"; readonly verification: string }
  | {
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
  /** Namespaced identifier, unique within a registry. */
  readonly id: string;
  /** Non-empty implementation version recorded in result provenance. */
  readonly version: string;
  /** Non-empty media types this importer claims; each may belong to one importer per registry. */
  readonly mediaTypes: readonly string[];
  /**
   * Normalize borrowed source bytes.
   * @param input Borrowed bytes; must not be mutated or retained.
   * @returns Normalized document.
   */
  import(input: AssetInput): AssetDocument;
}

/** Encoders declare their primary output and validate their own options/resources. */
export interface AssetEncoder {
  /** Namespaced identifier, unique within a registry; requested as `AssetRequest.format`. */
  readonly id: string;
  /** Non-empty implementation version recorded in result provenance. */
  readonly version: string;
  /** Non-empty document kinds this encoder accepts. */
  readonly inputKinds: readonly string[];
  /** Output name that every successful encode must include. */
  readonly primaryOutput: string;
  /**
   * Encode a normalized document.
   * @param document Imported document whose kind is in `inputKinds`.
   * @param options Caller options, validated by the encoder.
   * @param resources Copied auxiliary inputs keyed by request name.
   * @returns Named outputs, declared fidelity, and the options that determined the bytes.
   */
  encode(
    document: AssetDocument,
    options: Readonly<Record<string, unknown>>,
    resources: Readonly<Record<string, AssetInput>>,
  ): {
    readonly outputs: Readonly<Record<string, AssetOutput>>;
    readonly fidelity: AssetFidelity;
    readonly normalizedOptions: Readonly<Record<string, unknown>>;
  };
}

/** One supplied-byte conversion; paths are resolved by a caller-owned adapter. */
export interface AssetRequest {
  /** Borrowed source; its media type selects the importer. */
  readonly source: AssetInput;
  /** Encoder identifier. */
  readonly format: string;
  /** Borrowed auxiliary inputs keyed by the names encoder options refer to; defaults to none. */
  readonly resources?: Readonly<Record<string, AssetInput>>;
  /** Encoder options; defaults to an empty object. */
  readonly options?: Readonly<Record<string, unknown>>;
}

/** Named, owned bytes plus enough provenance for deterministic cache identity. */
export interface AssetResult {
  /** Copied encoder outputs keyed by name; always includes `primaryOutput`. */
  readonly outputs: Readonly<Record<string, AssetOutput>>;
  /** Name of the encoder's primary output. */
  readonly primaryOutput: string;
  /** Exact or lossy-audio fidelity declared by the encoder. */
  readonly fidelity: AssetFidelity;
  /** Importer identity and version that produced `document`. */
  readonly importer: Readonly<{ id: string; version: string }>;
  /** Encoder identity and version that produced `outputs`. */
  readonly encoder: Readonly<{ id: string; version: string }>;
  /** Encoder-normalized options that determined the output bytes. */
  readonly options: Readonly<Record<string, unknown>>;
  /** Imported document passed to the encoder. */
  readonly document: AssetDocument;
}

/** Host-independent registry; duplicate IDs and ambiguous media types fail at setup time. */
export class AssetRegistry {
  readonly #importers = new Map<string, AssetImporter>();
  readonly #encoders = new Map<string, AssetEncoder>();
  readonly #mediaTypes = new Map<string, AssetImporter>();

  /**
   * Register an importer and claim its media types.
   * @param importer Importer with a namespaced unused ID, a version, and unclaimed media types.
   * @returns This registry for chaining.
   */
  registerImporter(importer: AssetImporter): this {
    if (
      !isNamespacedId(importer.id) ||
      !importer.version ||
      importer.mediaTypes.length === 0 ||
      this.#importers.has(importer.id)
    ) {
      throw new Error(`Invalid or duplicate asset importer '${importer.id}'.`);
    }
    for (const mediaType of importer.mediaTypes) {
      if (this.#mediaTypes.has(mediaType)) {
        throw new Error(`Duplicate asset media type '${mediaType}'.`);
      }
    }
    this.#importers.set(importer.id, importer);
    importer.mediaTypes.forEach((type) => this.#mediaTypes.set(type, importer));
    return this;
  }

  /** Register one encoder; duplicate ids reject registration. */
  registerEncoder(encoder: AssetEncoder): this {
    if (
      !isNamespacedId(encoder.id) ||
      !encoder.version ||
      !encoder.primaryOutput ||
      encoder.inputKinds.length === 0 ||
      this.#encoders.has(encoder.id)
    ) {
      throw new Error(`Invalid or duplicate asset encoder '${encoder.id}'.`);
    }
    this.#encoders.set(encoder.id, encoder);
    return this;
  }

  /** Resolve the importer registered for a MIME type. */
  importerFor(mediaType: string): AssetImporter {
    const importer = this.#mediaTypes.get(mediaType);
    if (!importer) {
      throw new Error(`No asset importer for '${mediaType}'.`);
    }
    return importer;
  }

  /** Resolve a registered encoder by id. */
  encoderFor(id: string): AssetEncoder {
    const encoder = this.#encoders.get(id);
    if (!encoder) {
      throw new Error(`No asset encoder '${id}'.`);
    }
    return encoder;
  }
}

/**
 * Convert supplied bytes without a ROM, assembler, file read, or output write.
 * @param registry Registered importers and encoders.
 * @param request Borrowed bytes, resources and options.
 * @returns Named owned bytes and provider provenance.
 */
export function convertAsset(registry: AssetRegistry, request: AssetRequest): AssetResult {
  const importer = registry.importerFor(request.source.mediaType);
  const encoder = registry.encoderFor(request.format);
  // Snapshot caller bytes so a plugin cannot alter inputs held by another build stage.
  const source = { ...request.source, bytes: request.source.bytes.slice() };
  const resources = Object.fromEntries(
    Object.entries(request.resources ?? {}).map(([name, input]) => [
      name,
      { ...input, bytes: input.bytes.slice() },
    ]),
  );
  const document = importer.import(source);
  if (!encoder.inputKinds.includes(document.kind)) {
    throw new Error(`Encoder '${encoder.id}' cannot consume '${document.kind}'.`);
  }
  const encoded = encoder.encode(document, request.options ?? {}, resources);
  if (
    encoded.fidelity.kind === "lossy-audio" &&
    (encoder.id !== "snes.brr" || document.kind !== "pcm-audio")
  ) {
    throw new Error(
      `Encoder '${encoder.id}' cannot declare lossy fidelity for '${document.kind}'.`,
    );
  }
  if (!Object.hasOwn(encoded.outputs, encoder.primaryOutput)) {
    throw new Error(`Encoder '${encoder.id}' omitted primary output '${encoder.primaryOutput}'.`);
  }
  const outputs: Record<string, AssetOutput> = {};
  for (const [name, output] of Object.entries(encoded.outputs)) {
    if (!(output.bytes instanceof Uint8Array)) {
      throw new Error(`Output '${name}' is not bytes.`);
    }
    outputs[name] = { ...output, bytes: output.bytes.slice() };
  }
  return {
    outputs,
    primaryOutput: encoder.primaryOutput,
    fidelity: encoded.fidelity,
    importer: { id: importer.id, version: importer.version },
    encoder: { id: encoder.id, version: encoder.version },
    options: encoded.normalizedOptions,
    document,
  };
}
