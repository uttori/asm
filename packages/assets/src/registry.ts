import { isNamespacedId } from "./validation.js";

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
  readonly importer: Readonly<{ id: string; version: string }>;
  readonly encoder: Readonly<{ id: string; version: string }>;
  readonly options: Readonly<Record<string, unknown>>;
  readonly document: AssetDocument;
}

/** Host-independent registry; duplicate IDs and ambiguous media types fail at setup time. */
export class AssetRegistry {
  readonly #importers = new Map<string, AssetImporter>();
  readonly #encoders = new Map<string, AssetEncoder>();
  readonly #mediaTypes = new Map<string, AssetImporter>();

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

  importerFor(mediaType: string): AssetImporter {
    const importer = this.#mediaTypes.get(mediaType);
    if (!importer) {
      throw new Error(`No asset importer for '${mediaType}'.`);
    }
    return importer;
  }

  encoderFor(id: string): AssetEncoder {
    const encoder = this.#encoders.get(id);
    if (!encoder) {
      throw new Error(`No asset encoder '${id}'.`);
    }
    return encoder;
  }
}

/** Convert supplied bytes without a ROM, assembler, file read, or output write.
 * @param {AssetRegistry} registry Registered importers and encoders.
 * @param {AssetRequest} request Borrowed bytes, resources and options.
 * @returns {AssetResult} Named owned bytes and provider provenance.
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
