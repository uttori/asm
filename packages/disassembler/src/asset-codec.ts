import { createHash } from "node:crypto";

/** JSON-safe value used for codec options, decoded models, and inspection metadata. */
export type AssetValue =
  | null
  | boolean
  | number
  | string
  | readonly AssetValue[]
  | { readonly [key: string]: AssetValue };

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
  /** Stable local id; the planner qualifies it with the parent asset id. */
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

const isAsciiAlphaNumeric = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
};

const isStableId = (id: string): boolean => {
  if (id.length === 0 || !isAsciiAlphaNumeric(id[0]) || !isAsciiAlphaNumeric(id.at(-1)!)) {
    return false;
  }
  for (let index = 0; index < id.length; index++) {
    const character = id[index];
    if (!isAsciiAlphaNumeric(character) && !"._:/-".includes(character)) {
      return false;
    }
  }
  return true;
};

const assertStableId = (id: string, what: string): void => {
  if (!isStableId(id)) {
    throw new Error(`${what} '${id}' is not a stable id.`);
  }
};

const assertNonNegativeInteger = (value: number, what: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${what} must be a non-negative safe integer.`);
  }
};

const canonicalizeAssetValue = (value: AssetValue, location: string): AssetValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${location} contains a non-finite number.`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return (value as readonly AssetValue[]).map((entry, index) =>
      canonicalizeAssetValue(entry, `${location}[${index}]`),
    );
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${location} must contain only plain JSON objects.`);
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeAssetValue(entry, `${location}.${key}`)]),
  );
};

const stableText = (value: AssetValue): string =>
  JSON.stringify(canonicalizeAssetValue(value, "asset"));
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const assertSafeExtractedPath = (relative: string): void => {
  if (
    relative === "" ||
    relative.includes("\\") ||
    relative.startsWith("/") ||
    /^[a-z]:/i.test(relative) ||
    relative.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe extracted asset path '${relative}'.`);
  }
};

const normalizeReferences = (
  references: readonly AssetReference[] | undefined,
  owner: string,
): readonly AssetReference[] => {
  const ids = new Set<string>();
  return [...(references ?? [])]
    .map((reference) => {
      assertStableId(reference.id, `Reference on asset '${owner}'`);
      if (ids.has(reference.id)) {
        throw new Error(`Asset '${owner}' contains duplicate reference id '${reference.id}'.`);
      }
      ids.add(reference.id);
      if (reference.kind === "" || reference.addressSpace === "") {
        throw new Error(`Reference '${reference.id}' on asset '${owner}' is incomplete.`);
      }
      assertNonNegativeInteger(reference.address, `Reference '${reference.id}' address`);
      if (reference.width !== undefined) {
        if (!Number.isSafeInteger(reference.width) || reference.width <= 0) {
          throw new Error(`Reference '${reference.id}' width must be a positive safe integer.`);
        }
      }
      if (reference.targetAssetId) {
        assertStableId(reference.targetAssetId, "Target asset id");
      }
      return Object.freeze({ ...reference });
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const normalizeChildren = (
  children: readonly NestedAssetRequest[] | undefined,
  owner: string,
): readonly NestedAssetRequest[] => {
  const ids = new Set<string>();
  return [...(children ?? [])]
    .map((child) => {
      assertStableId(child.id, `Child on asset '${owner}'`);
      assertStableId(child.codecId, `Codec on child '${child.id}'`);
      if (ids.has(child.id)) {
        throw new Error(`Asset '${owner}' contains duplicate child id '${child.id}'.`);
      }
      ids.add(child.id);
      assertNonNegativeInteger(child.relativeOffset, `Child '${child.id}' relativeOffset`);
      if (child.length !== undefined) {
        assertNonNegativeInteger(child.length, `Child '${child.id}' length`);
      }
      if (child.address !== undefined) {
        assertNonNegativeInteger(child.address, `Child '${child.id}' address`);
      }
      if (child.addressSpace === "") {
        throw new Error(`Child '${child.id}' has an empty address space.`);
      }
      const options =
        child.options === undefined
          ? undefined
          : canonicalizeAssetValue(child.options, `Child '${child.id}' options`);
      return Object.freeze({ ...child, ...(options === undefined ? {} : { options }) });
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const normalizeInspection = (inspection: AssetInspection, owner: string): AssetInspection => {
  if (!Number.isSafeInteger(inspection.size) || inspection.size <= 0) {
    throw new Error(`Asset '${owner}' inspection size must be a positive safe integer.`);
  }
  const metadata =
    inspection.metadata === undefined
      ? undefined
      : (canonicalizeAssetValue(inspection.metadata, `Asset '${owner}' metadata`) as Readonly<
          Record<string, AssetValue>
        >);
  return Object.freeze({
    size: inspection.size,
    references: normalizeReferences(inspection.references, owner),
    children: normalizeChildren(inspection.children, owner),
    ...(metadata === undefined ? {} : { metadata }),
  });
};

const inspectionValue = (inspection: AssetInspection): AssetValue => ({
  size: inspection.size,
  references: inspection.references?.map((reference) => ({ ...reference })) ?? [],
  children: inspection.children?.map((child) => ({ ...child })) ?? [],
  metadata: inspection.metadata ?? {},
});

const normalizeFiles = (
  files: readonly AssetExtractedFile[] | undefined,
  owner: string,
): readonly AssetExtractedFile[] => {
  const paths = new Set<string>();
  return [...(files ?? [])]
    .map((file) => {
      assertSafeExtractedPath(file.path);
      if (paths.has(file.path)) {
        throw new Error(`Asset '${owner}' extracts duplicate path '${file.path}'.`);
      }
      paths.add(file.path);
      if (file.mediaType === "") {
        throw new Error(`Asset file '${file.path}' has no media type.`);
      }
      if (!(file.bytes instanceof Uint8Array)) {
        throw new Error(`Asset file '${file.path}' bytes must be a Uint8Array.`);
      }
      return Object.freeze({ ...file, bytes: Uint8Array.from(file.bytes) });
    })
    .sort((left, right) => left.path.localeCompare(right.path));
};

const normalizeDecoded = (decoded: AssetDecodeResult, owner: string): AssetDecodeResult =>
  Object.freeze({
    value: canonicalizeAssetValue(decoded.value, `Asset '${owner}' value`),
    files: normalizeFiles(decoded.files, owner),
  });

const decodedFingerprint = (decoded: AssetDecodeResult): string =>
  stableText({
    value: decoded.value,
    files:
      decoded.files?.map((file) => ({
        path: file.path,
        mediaType: file.mediaType,
        size: file.bytes.length,
        sha256: sha256(file.bytes),
      })) ?? [],
  });

/** Order-independent registry for codecs and their stable-id dependencies. */
export class AssetCodecRegistry {
  readonly #codecs = new Map<string, AssetCodec>();

  /**
   * Registers one codec. Dependencies may be registered before or afterward.
   * @param {AssetCodec} codec Codec implementation to add.
   * @returns {this} This registry for fluent setup.
   */
  register(codec: AssetCodec): this {
    assertStableId(codec.id, "Codec id");
    if (codec.version.trim() === "") {
      throw new Error(`Codec '${codec.id}' has no version.`);
    }
    if (this.#codecs.has(codec.id)) {
      throw new Error(`Duplicate asset codec id '${codec.id}'.`);
    }
    if (!Number.isSafeInteger(codec.sizeBounds.minimum) || codec.sizeBounds.minimum <= 0) {
      throw new Error(`Codec '${codec.id}' minimum size must be a positive safe integer.`);
    }
    if (
      codec.sizeBounds.maximum !== undefined &&
      (!Number.isSafeInteger(codec.sizeBounds.maximum) ||
        codec.sizeBounds.maximum < codec.sizeBounds.minimum)
    ) {
      throw new Error(`Codec '${codec.id}' maximum size is invalid.`);
    }
    if (
      codec.sizeBounds.alignment !== undefined &&
      (!Number.isSafeInteger(codec.sizeBounds.alignment) || codec.sizeBounds.alignment <= 0)
    ) {
      throw new Error(`Codec '${codec.id}' alignment must be a positive safe integer.`);
    }
    const dependencies = [...(codec.dependencies ?? [])];
    const seen = new Set<string>();
    for (const dependency of dependencies) {
      assertStableId(dependency, `Dependency on codec '${codec.id}'`);
      if (seen.has(dependency)) {
        throw new Error(`Codec '${codec.id}' repeats dependency '${dependency}'.`);
      }
      seen.add(dependency);
    }
    this.#codecs.set(
      codec.id,
      Object.freeze({
        id: codec.id,
        version: codec.version,
        sizeBounds: Object.freeze({ ...codec.sizeBounds }),
        dependencies: Object.freeze(dependencies.sort()),
        inspect: codec.inspect.bind(codec),
        decode: codec.decode.bind(codec),
        encode: codec.encode.bind(codec),
      }),
    );
    return this;
  }

  /**
   * Resolves a codec and validates its complete dependency graph.
   * @param {string} id Stable codec id.
   * @returns {AssetCodec} Registered codec.
   */
  resolve(id: string): AssetCodec {
    const visit = (current: string, path: readonly string[]): AssetCodec => {
      const codec = this.#codecs.get(current);
      if (!codec) {
        throw new Error(`Unknown asset codec '${current}'.`);
      }
      if (path.includes(current)) {
        throw new Error(`Asset codec dependency cycle: ${[...path, current].join(" -> ")}.`);
      }
      for (const dependency of codec.dependencies ?? []) {
        visit(dependency, [...path, current]);
      }
      return codec;
    };
    return visit(id, []);
  }

  /**
   * Returns direct dependencies after validating the full dependency graph.
   * @param {string} id Stable codec id.
   * @returns {ReadonlyMap<string, AssetCodec>} Direct dependencies keyed by id.
   */
  dependenciesFor(id: string): ReadonlyMap<string, AssetCodec> {
    const codec = this.resolve(id);
    return new Map(
      (codec.dependencies ?? []).map((dependency) => [dependency, this.resolve(dependency)]),
    );
  }

  /**
   * Lists codecs in stable-id order, never registration order.
   * @returns {readonly AssetCodec[]} Registered codecs.
   */
  list(): readonly AssetCodec[] {
    return [...this.#codecs.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

const validateRequest = (request: AssetRequest, source: AssetByteSource): AssetRequest => {
  assertStableId(request.id, "Asset id");
  assertStableId(request.codecId, `Codec on asset '${request.id}'`);
  assertNonNegativeInteger(request.sourceOffset, `Asset '${request.id}' sourceOffset`);
  assertNonNegativeInteger(request.address, `Asset '${request.id}' address`);
  if (request.addressSpace === "") {
    throw new Error(`Asset '${request.id}' has no address space.`);
  }
  if (request.length !== undefined) {
    if (!Number.isSafeInteger(request.length) || request.length <= 0) {
      throw new Error(`Asset '${request.id}' length must be a positive safe integer.`);
    }
  }
  if (!Number.isSafeInteger(source.length) || source.length < 0) {
    throw new Error("Asset byte source length must be a non-negative safe integer.");
  }
  const options =
    request.options === undefined
      ? undefined
      : canonicalizeAssetValue(request.options, `Asset '${request.id}' options`);
  return Object.freeze({ ...request, ...(options === undefined ? {} : { options }) });
};

const validateInspectedRange = (
  codec: AssetCodec,
  request: AssetRequest,
  inspection: AssetInspection,
  source: AssetByteSource,
): void => {
  const { minimum, maximum, alignment = 1 } = codec.sizeBounds;
  if (request.sourceOffset % alignment !== 0) {
    throw new Error(`Asset '${request.id}' is not aligned to ${alignment} bytes.`);
  }
  if (inspection.size < minimum || (maximum !== undefined && inspection.size > maximum)) {
    throw new Error(
      `Asset '${request.id}' size ${inspection.size} is outside codec bounds ${minimum}..${maximum ?? "unbounded"}.`,
    );
  }
  if (request.length !== undefined && request.length !== inspection.size) {
    throw new Error(
      `Asset '${request.id}' inspected ${inspection.size} bytes but declares exactly ${request.length}.`,
    );
  }
  const end = request.sourceOffset + inspection.size;
  if (!Number.isSafeInteger(end) || end > source.length) {
    throw new Error(`Asset '${request.id}' extends beyond its byte source.`);
  }
};

const isAncestor = (
  ancestor: string,
  descendant: PlannedAsset,
  byId: Map<string, PlannedAsset>,
): boolean => {
  let parent = descendant.parentId;
  while (parent !== undefined) {
    if (parent === ancestor) {
      return true;
    }
    parent = byId.get(parent)?.parentId;
  }
  return false;
};

/**
 * Inspects root and nested assets, validates deterministic inspection and bounds,
 * and retains non-ancestral overlaps as explicit conflicts.
 * @param {AssetCodecRegistry} registry Codec registry.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {readonly AssetRequest[]} requests Root asset requests.
 * @param {{ readonly maxDepth?: number }} [options] Nested-asset recursion cap.
 * @returns {AssetPlan} Stable asset plan and overlap conflicts.
 */
export const planAssets = (
  registry: AssetCodecRegistry,
  source: AssetByteSource,
  requests: readonly AssetRequest[],
  options: { readonly maxDepth?: number } = {},
): AssetPlan => {
  const maxDepth = options.maxDepth ?? 32;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new Error("Asset maxDepth must be a non-negative safe integer.");
  }
  const assets: PlannedAsset[] = [];
  const ids = new Set<string>();

  const inspect = (input: AssetRequest, parentId: string | undefined, depth: number): void => {
    if (depth > maxDepth) {
      throw new Error(`Asset '${input.id}' exceeds nested codec depth ${maxDepth}.`);
    }
    const request = validateRequest(input, source);
    if (ids.has(request.id)) {
      throw new Error(`Duplicate planned asset id '${request.id}'.`);
    }
    ids.add(request.id);
    const codec = registry.resolve(request.codecId);
    const context: AssetCodecContext = {
      source,
      request,
      dependencies: registry.dependenciesFor(codec.id),
    };
    const first = normalizeInspection(codec.inspect(context), request.id);
    const second = normalizeInspection(codec.inspect(context), request.id);
    if (stableText(inspectionValue(first)) !== stableText(inspectionValue(second))) {
      throw new Error(
        `Asset codec '${codec.id}' inspection is not deterministic for '${request.id}'.`,
      );
    }
    validateInspectedRange(codec, request, first, source);
    const asset: PlannedAsset = Object.freeze({
      id: request.id,
      ...(parentId === undefined ? {} : { parentId }),
      depth,
      request,
      codecVersion: codec.version,
      inspection: first,
    });
    assets.push(asset);
    for (const child of first.children ?? []) {
      if (child.relativeOffset + (child.length ?? 0) > first.size) {
        throw new Error(`Child '${child.id}' starts outside asset '${request.id}'.`);
      }
      if (
        child.addressSpace !== undefined &&
        child.addressSpace !== request.addressSpace &&
        child.address === undefined
      ) {
        throw new Error(
          `Child '${child.id}' changes address space without an explicit logical address.`,
        );
      }
      const childId = `${request.id}/${child.id}`;
      const childRequest: AssetRequest = {
        id: childId,
        codecId: child.codecId,
        sourceOffset: request.sourceOffset + child.relativeOffset,
        addressSpace: child.addressSpace ?? request.addressSpace,
        address: child.address ?? request.address + child.relativeOffset,
        ...(child.length === undefined ? {} : { length: child.length }),
        ...(child.options === undefined ? {} : { options: child.options }),
      };
      inspect(childRequest, request.id, depth + 1);
      const plannedChild = assets.find((entry) => entry.id === childId)!;
      if (
        plannedChild.request.sourceOffset < request.sourceOffset ||
        plannedChild.request.sourceOffset + plannedChild.inspection.size >
          request.sourceOffset + first.size
      ) {
        throw new Error(`Child '${childId}' is not contained by asset '${request.id}'.`);
      }
    }
  };

  for (const request of [...requests].sort(
    (left, right) => left.sourceOffset - right.sourceOffset || left.id.localeCompare(right.id),
  )) {
    inspect(request, undefined, 0);
  }

  const ordered = assets.sort(
    (left, right) =>
      left.request.sourceOffset - right.request.sourceOffset ||
      left.depth - right.depth ||
      left.id.localeCompare(right.id),
  );
  const byId = new Map(ordered.map((asset) => [asset.id, asset]));
  const conflicts: AssetPlanConflict[] = [];
  for (let leftIndex = 0; leftIndex < ordered.length; leftIndex++) {
    const left = ordered[leftIndex];
    const leftEnd = left.request.sourceOffset + left.inspection.size;
    for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex++) {
      const right = ordered[rightIndex];
      if (right.request.sourceOffset >= leftEnd) {
        break;
      }
      if (isAncestor(left.id, right, byId) || isAncestor(right.id, left, byId)) {
        continue;
      }
      const sourceOffset = Math.max(left.request.sourceOffset, right.request.sourceOffset);
      const endOffset = Math.min(leftEnd, right.request.sourceOffset + right.inspection.size);
      const assetIds = [left.id, right.id].sort() as [string, string];
      conflicts.push({
        id: `asset-conflict:${assetIds[0]}:${assetIds[1]}`,
        kind: "overlap",
        assets: assetIds,
        sourceOffset,
        endOffset,
        message: `Assets '${assetIds[0]}' and '${assetIds[1]}' overlap at ${sourceOffset}..${endOffset}.`,
      });
    }
  }
  return Object.freeze({ assets: ordered, conflicts });
};

const codecForAsset = (registry: AssetCodecRegistry, asset: PlannedAsset): AssetCodec => {
  const codec = registry.resolve(asset.request.codecId);
  if (codec.version !== asset.codecVersion) {
    throw new Error(`Asset codec '${codec.id}' changed version after planning '${asset.id}'.`);
  }
  return codec;
};

/**
 * Decodes one planned asset and normalizes its JSON value and extracted files.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {PlannedAsset} asset Planned asset to decode.
 * @returns {AssetDecodeResult} Canonical editable value and deterministic files.
 */
export const decodePlannedAsset = (
  registry: AssetCodecRegistry,
  source: AssetByteSource,
  asset: PlannedAsset,
): AssetDecodeResult => {
  const codec = codecForAsset(registry, asset);
  return normalizeDecoded(
    codec.decode({
      source,
      request: asset.request,
      inspection: asset.inspection,
      dependencies: registry.dependenciesFor(codec.id),
    }),
    asset.id,
  );
};

/**
 * Encodes one editable decoded asset through the exact codec version used while planning.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {PlannedAsset} asset Planned asset to encode.
 * @param {AssetDecodeResult} decoded Edited JSON value and extracted files.
 * @returns {Uint8Array} Defensive copy of the encoded bytes.
 */
export const encodePlannedAsset = (
  registry: AssetCodecRegistry,
  source: AssetByteSource,
  asset: PlannedAsset,
  decoded: AssetDecodeResult,
): Uint8Array => {
  const codec = codecForAsset(registry, asset);
  const normalized = normalizeDecoded(decoded, asset.id);
  const encoded = codec.encode({
    source,
    request: asset.request,
    inspection: asset.inspection,
    dependencies: registry.dependenciesFor(codec.id),
    decoded: normalized,
  });
  if (!(encoded instanceof Uint8Array)) {
    throw new Error(`Asset codec '${codec.id}' encode must return Uint8Array.`);
  }
  if (encoded.length !== asset.inspection.size) {
    throw new Error(
      `Asset '${asset.id}' re-encoded to ${encoded.length} bytes, expected exactly ${asset.inspection.size}.`,
    );
  }
  return Uint8Array.from(encoded);
};

/**
 * Repeats decode and encode, verifies deterministic results, and requires every
 * codec's no-op encoding to preserve its exact source range byte-for-byte.
 * @param {AssetCodecRegistry} registry Codec registry used to build the plan.
 * @param {AssetByteSource} source Immutable backing bytes.
 * @param {AssetPlan} plan Conflict-free inspected asset plan.
 * @returns {AssetVerificationResult} Stable hashes, files, and references.
 */
export const verifyAssetPlan = (
  registry: AssetCodecRegistry,
  source: AssetByteSource,
  plan: AssetPlan,
): AssetVerificationResult => {
  if (plan.conflicts.length > 0) {
    throw new Error(
      `Cannot verify an asset plan with ${plan.conflicts.length} overlap conflict(s).`,
    );
  }
  const records = plan.assets.map((asset): AssetVerificationRecord => {
    const codec = codecForAsset(registry, asset);
    const first = decodePlannedAsset(registry, source, asset);
    const second = decodePlannedAsset(registry, source, asset);
    if (decodedFingerprint(first) !== decodedFingerprint(second)) {
      throw new Error(`Asset codec '${codec.id}' decode is not deterministic for '${asset.id}'.`);
    }
    const firstEncoded = encodePlannedAsset(registry, source, asset, first);
    const secondEncoded = encodePlannedAsset(registry, source, asset, first);
    if (!sameBytes(firstEncoded, secondEncoded)) {
      throw new Error(`Asset codec '${codec.id}' encode is not deterministic for '${asset.id}'.`);
    }
    if (firstEncoded.length !== asset.inspection.size) {
      throw new Error(
        `Asset '${asset.id}' re-encoded to ${firstEncoded.length} bytes, expected exactly ${asset.inspection.size}.`,
      );
    }
    const original = source.read(asset.request.sourceOffset, asset.inspection.size);
    if (!original) {
      throw new Error(`Asset '${asset.id}' source range is no longer readable.`);
    }
    if (!sameBytes(original, firstEncoded)) {
      throw new Error(`Asset '${asset.id}' failed byte-identical no-op verification.`);
    }
    return Object.freeze({
      id: asset.id,
      codecId: codec.id,
      codecVersion: codec.version,
      sourceOffset: asset.request.sourceOffset,
      size: asset.inspection.size,
      sourceSha256: sha256(original),
      encodedSha256: sha256(firstEncoded),
      files: (first.files ?? []).map((file) => ({
        path: file.path,
        mediaType: file.mediaType,
        size: file.bytes.length,
        sha256: sha256(file.bytes),
      })),
      references: asset.inspection.references ?? [],
    });
  });
  return Object.freeze({ assets: records });
};
