import { createHash } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_MANIFEST,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type ProjectShardDescriptor,
  type RuntimeEvidenceRecord,
} from "./project-types.js";
import type { RomImage } from "./rom-image.js";

const SHARD_PATHS: Readonly<Record<keyof AnalysisProjectShards, string>> = Object.freeze({
  analysis: "analysis/control-flow.json",
  annotations: "analysis/annotations.json",
  labels: "analysis/labels.json",
  comments: "analysis/comments.json",
  regions: "analysis/regions.json",
  runtime: "analysis/runtime.json",
  evidence: "analysis/evidence.json",
  imports: "analysis/imports.json",
});

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
// Performance invariant: bound the temporary canonical object graph while keeping batches large
// enough for native JSON.stringify throughput. Re-benchmark both time and boundary RSS if changed.
const CANONICAL_JSON_RECORD_BATCH = 64;

/**
 * Recursively copies a JSON-compatible value with lexicographically ordered object keys.
 * This deliberately creates a new object graph, so project-sized arrays must be passed in bounded
 * slices by `writeCanonicalJsonArrayFile()` rather than canonicalized all at once.
 * @param {unknown} value JSON-compatible value to canonicalize.
 * @returns {unknown} Canonical copy suitable for deterministic JSON serialization.
 */
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

/**
 * Streams one canonical top-level record array to disk while computing its SHA-256.
 *
 * Calling `canonicalJson(values)` for a large shard retains three large representations at once:
 * the source records, a recursively cloned canonical graph, and the complete JSON string. This
 * writer canonicalizes only 64 records at a time and preserves the exact two-space-indented bytes
 * produced by `canonicalJson()`. File bytes and hash bytes are fed from the same fragments so the
 * manifest can never describe a different serialization. This helper intentionally accepts only a
 * top-level array; manifests and other small values continue to use `canonicalJson()`.
 * @param {string} destination Shard file to create or replace.
 * @param {readonly unknown[]} values Records already sorted into canonical shard order.
 * @returns {string} Lowercase SHA-256 of the exact bytes written.
 */
const writeCanonicalJsonArrayFile = (destination: string, values: readonly unknown[]): string => {
  const hash = createHash("sha256");
  const descriptor = fs.openSync(destination, "w");
  let pending = "";
  const append = (fragment: string): void => {
    pending += fragment;
    // Coalesce small punctuation/batch fragments to avoid a system call per record while still
    // bounding the pending string independently of total shard size.
    if (pending.length >= 64 * 1_024) flush();
  };
  const flush = (): void => {
    if (pending.length === 0) return;
    fs.writeSync(descriptor, pending);
    hash.update(pending);
    pending = "";
  };
  try {
    if (values.length === 0) {
      append("[]\n");
    } else {
      append("[\n");
      for (let start = 0; start < values.length; start += CANONICAL_JSON_RECORD_BATCH) {
        // Performance invariant: canonicalize only this bounded slice. Expanding the slice to the
        // entire shard recreates the multi-gigabyte transient working set this path replaced.
        const encoded = JSON.stringify(
          canonicalize(values.slice(start, start + CANONICAL_JSON_RECORD_BATCH)),
          undefined,
          2,
        );
        // A batch serializes as "[\n...\n]". Removing only that wrapper and inserting separators
        // reproduces canonicalJson(values) byte-for-byte, including indentation and final newline.
        const records = encoded.slice(2, -2);
        append(`${start === 0 ? "" : ",\n"}${records}`);
      }
      append("\n]\n");
    }
    flush();
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
};

/**
 * Deterministic JSON: sorted object keys, dropped `undefined`, trailing newline.
 * Use this for manifests and bounded values. Large shard arrays must go through the streaming
 * writer so canonicalization does not retain a second complete project-sized object graph.
 * @param {unknown} value Manifest or shard payload.
 * @returns {string} Canonical JSON text used for SHA-256 and on-disk writes.
 */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(canonicalize(value), undefined, 2)}\n`;

const assertSafeRelativePath = (relative: string): void => {
  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative.split(/[/\\]/).some((part) => part === "..")
  ) {
    throw new Error(`Unsafe project shard path '${relative}'.`);
  }
};

const sortById = <T extends { readonly id: string }>(records: readonly T[]): readonly T[] =>
  [...records].sort((left, right) => left.id.localeCompare(right.id));

const runtimeSortSpace = (record: RuntimeEvidenceRecord): string => {
  if ("addressSpace" in record) return record.addressSpace;
  if (record.kind === "runtime-memory-access") return record.instructionAddressSpace;
  return record.fromAddressSpace;
};

const runtimeSortAddress = (record: RuntimeEvidenceRecord): number => {
  if ("address" in record) return record.address;
  if (record.kind === "runtime-coverage") return record.start;
  if (record.kind === "runtime-memory-access") return record.instructionAddress;
  return record.fromAddress;
};

/**
 * Produces canonical record ordering without mutating caller-owned shard arrays.
 * Only the lightweight arrays are copied here; record objects remain shared until bounded
 * canonicalization during writing. Deep-cloning this complete structure recreates the prior
 * project-sized working-set regression.
 * @param {AnalysisProjectShards} shards Caller-owned validated shard records.
 * @returns {AnalysisProjectShards} New arrays in their canonical on-disk order.
 */
const normalizedShards = (shards: AnalysisProjectShards): AnalysisProjectShards => ({
  analysis: [...shards.analysis].sort(
    (left, right) =>
      ("address" in left ? left.address : Number.MAX_SAFE_INTEGER) -
        ("address" in right ? right.address : Number.MAX_SAFE_INTEGER) ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id),
  ),
  annotations: [...shards.annotations].sort(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.start - right.start ||
      left.end - right.end ||
      left.id.localeCompare(right.id),
  ),
  labels: [...shards.labels].sort(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.address - right.address ||
      left.id.localeCompare(right.id),
  ),
  comments: [...shards.comments].sort(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.address - right.address ||
      left.id.localeCompare(right.id),
  ),
  regions: [...shards.regions].sort(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.start - right.start ||
      left.end - right.end ||
      left.id.localeCompare(right.id),
  ),
  runtime: [...shards.runtime].sort((left, right) => {
    return (
      runtimeSortSpace(left).localeCompare(runtimeSortSpace(right)) ||
      runtimeSortAddress(left) - runtimeSortAddress(right) ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id)
    );
  }),
  evidence: sortById(shards.evidence),
  imports: sortById(shards.imports),
});

/**
 * Validates the current native manifest contract without reading its shard files.
 * @param {AnalysisProjectManifest} manifest Manifest to validate.
 * @returns {void}
 */
export const validateAnalysisProjectManifest = (manifest: AnalysisProjectManifest): void => {
  if (manifest.format !== ANALYSIS_PROJECT_FORMAT) {
    throw new Error(`Unsupported analysis project format '${String(manifest.format)}'.`);
  }
  if (manifest.schemaVersion !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported analysis project schema version ${String(manifest.schemaVersion)}.`,
    );
  }
  if (!/^[\da-f]{64}$/.test(manifest.rom.sha256)) throw new Error("Invalid ROM SHA-256.");
  if (!/^[\da-f]{64}$/.test(manifest.rom.contentSha256)) {
    throw new Error("Invalid ROM content SHA-256.");
  }
  const addressSpaceIds = new Set<string>();
  for (const addressSpace of manifest.addressSpaces) {
    if (addressSpace.id === "" || addressSpace.name === "") {
      throw new Error("Analysis address spaces require non-empty ids and names.");
    }
    if (addressSpaceIds.has(addressSpace.id)) {
      throw new Error(`Duplicate analysis address-space id '${addressSpace.id}'.`);
    }
    if (
      !Number.isSafeInteger(addressSpace.addressBits) ||
      addressSpace.addressBits <= 0 ||
      addressSpace.addressBits > 53
    ) {
      throw new Error(`Analysis address space '${addressSpace.id}' has invalid address bits.`);
    }
    addressSpaceIds.add(addressSpace.id);
  }
  const shardIds = new Set<string>();
  const shardPaths = new Set<string>();
  for (const shard of manifest.shards) {
    assertSafeRelativePath(shard.path);
    if (!(shard.kind in SHARD_PATHS))
      throw new Error(`Unknown analysis shard kind '${shard.kind}'.`);
    if (!/^[\da-f]{64}$/.test(shard.sha256)) {
      throw new Error(`Analysis shard '${shard.id}' has an invalid SHA-256.`);
    }
    if (!Number.isSafeInteger(shard.records) || shard.records < 0) {
      throw new Error(`Analysis shard '${shard.id}' has an invalid record count.`);
    }
    if (shardIds.has(shard.id)) throw new Error(`Duplicate analysis shard id '${shard.id}'.`);
    if (shardPaths.has(shard.path))
      throw new Error(`Duplicate analysis shard path '${shard.path}'.`);
    shardIds.add(shard.id);
    shardPaths.add(shard.path);
  }
};

const FORBIDDEN_ROM_PAYLOAD_KEYS = new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);

const assertNoRomPayload = (value: unknown, location: string): void => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      assertNoRomPayload(value[index], `${location}[${index}]`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key)) {
      throw new Error(`ROM byte payload '${location}.${key}' is forbidden in analysis projects.`);
    }
    assertNoRomPayload(entry, `${location}.${key}`);
  }
};

const isStableId = (id: string): boolean => {
  const isAlphaNumeric = (character: string): boolean => {
    const code = character.charCodeAt(0);
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a)
    );
  };
  if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1)!)) return false;
  for (let index = 0; index < id.length; index++) {
    const character = id[index];
    if (!isAlphaNumeric(character) && !"._:/-".includes(character)) return false;
  }
  return true;
};

const assertCodecReference = (
  reference: {
    readonly codecId: string;
    readonly codecVersion: string;
    readonly provider?: { readonly pluginId: string; readonly pluginVersion: string };
    readonly options?: unknown;
  },
  location: string,
): void => {
  if (typeof reference.codecId !== "string" || !isStableId(reference.codecId)) {
    throw new Error(`${location} has an invalid codec id.`);
  }
  if (typeof reference.codecVersion !== "string" || reference.codecVersion.trim() === "") {
    throw new Error(`${location} has no codec version.`);
  }
  if (reference.provider) {
    if (
      typeof reference.provider.pluginId !== "string" ||
      !isStableId(reference.provider.pluginId)
    ) {
      throw new Error(`${location} has an invalid provider plugin id.`);
    }
    if (
      typeof reference.provider.pluginVersion !== "string" ||
      reference.provider.pluginVersion.trim() === ""
    ) {
      throw new Error(`${location} has no provider plugin version.`);
    }
  }
  const visitJson = (value: unknown, current: string): void => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitJson(entry, `${current}[${index}]`));
      return;
    }
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      Object.entries(value).forEach(([key, entry]) => visitJson(entry, `${current}.${key}`));
      return;
    }
    throw new Error(`${current} is not a JSON-safe codec option.`);
  };
  if (reference.options !== undefined) visitJson(reference.options, `${location} options`);
};

const validateLoadedShards = (
  shards: AnalysisProjectShards,
  project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">,
): void => {
  const { addressSpaces } = project;
  const evidenceIds = new Set(shards.evidence.map((record) => record.id));
  for (const [kind, records] of Object.entries(shards) as Array<
    [
      keyof AnalysisProjectShards,
      ReadonlyArray<{ readonly id: string; readonly evidence?: readonly string[] }>,
    ]
  >) {
    const ids = new Set<string>();
    for (const record of records) {
      if (!record || typeof record.id !== "string" || record.id === "") {
        throw new Error(`Analysis shard '${kind}' contains a record without an id.`);
      }
      if (ids.has(record.id)) {
        throw new Error(`Analysis shard '${kind}' contains duplicate id '${record.id}'.`);
      }
      ids.add(record.id);
      for (const evidence of record.evidence ?? []) {
        if (!evidenceIds.has(evidence)) {
          throw new Error(
            `Analysis record '${record.id}' refers to missing evidence '${evidence}'.`,
          );
        }
      }
    }
  }
  for (const evidence of shards.evidence) {
    if (!evidence.artifact) continue;
    if (
      evidence.artifact.format === "" ||
      !/^[\da-f]{64}$/.test(evidence.artifact.sha256) ||
      !/^[\da-f]{64}$/.test(evidence.artifact.romContentSha256)
    ) {
      throw new Error(`Evidence '${evidence.id}' has an invalid artifact identity.`);
    }
    if (evidence.artifact.romContentSha256 !== project.rom.contentSha256) {
      throw new Error(`Evidence '${evidence.id}' belongs to a different ROM.`);
    }
    if (evidence.artifact.mapper && evidence.artifact.mapper !== project.mapping.mapper) {
      throw new Error(`Evidence '${evidence.id}' belongs to a different mapper.`);
    }
  }
  for (const interval of [...shards.annotations, ...shards.regions]) {
    if (
      !Number.isSafeInteger(interval.start) ||
      !Number.isSafeInteger(interval.end) ||
      interval.start < 0 ||
      interval.end <= interval.start
    ) {
      throw new Error(`Analysis interval '${interval.id}' has an invalid half-open range.`);
    }
  }
  for (const record of shards.runtime) {
    if (!Number.isSafeInteger(record.count) || record.count <= 0) {
      throw new Error(`Runtime record '${record.id}' has an invalid observation count.`);
    }
    if (record.kind === "runtime-coverage") {
      if (
        !Number.isSafeInteger(record.start) ||
        !Number.isSafeInteger(record.end) ||
        record.start < 0 ||
        record.end <= record.start
      ) {
        throw new Error(`Runtime coverage '${record.id}' has an invalid half-open range.`);
      }
    }
    if (record.kind === "runtime-memory-access") {
      if (!Number.isSafeInteger(record.width) || record.width <= 0) {
        throw new Error(`Runtime memory access '${record.id}' has an invalid width.`);
      }
      if (record.value !== undefined && (!Number.isSafeInteger(record.value) || record.value < 0)) {
        throw new Error(`Runtime memory access '${record.id}' has an invalid value.`);
      }
    }
    if (record.kind === "runtime-execution") {
      if (record.size !== undefined && (!Number.isSafeInteger(record.size) || record.size <= 0)) {
        throw new Error(`Runtime execution '${record.id}' has an invalid instruction size.`);
      }
      if (
        record.opcode !== undefined &&
        (!Number.isInteger(record.opcode) || record.opcode < 0 || record.opcode > 0xff)
      ) {
        throw new Error(`Runtime execution '${record.id}' has an invalid opcode.`);
      }
      if (
        record.fileOffset !== undefined &&
        (!Number.isSafeInteger(record.fileOffset) ||
          record.fileOffset < 0 ||
          record.fileOffset >= project.rom.contentSize)
      ) {
        throw new Error(`Runtime execution '${record.id}' has an invalid ROM file offset.`);
      }
    }
    if (record.kind === "runtime-cpu-state") {
      for (const [name, value] of Object.entries(record.state)) {
        if (
          name === "" ||
          !["string", "boolean", "number"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value))
        ) {
          throw new Error(`Runtime CPU state '${record.id}' has invalid field '${name}'.`);
        }
      }
    }
  }
  for (const annotation of shards.annotations) {
    if (!annotation.asset) continue;
    if (!["asset", "compressed", "graphics", "music", "text"].includes(annotation.classification)) {
      throw new Error(
        `Analysis annotation '${annotation.id}' cannot attach an asset codec to '${annotation.classification}'.`,
      );
    }
    assertCodecReference(annotation.asset, `Analysis annotation '${annotation.id}' asset codec`);
    const compression = annotation.asset.compression;
    if (!compression) continue;
    assertCodecReference(compression, `Analysis annotation '${annotation.id}' compression codec`);
    const rangeSize = annotation.end - annotation.start;
    const maximumSize = compression.maximumSize ?? rangeSize;
    if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0 || maximumSize > rangeSize) {
      throw new Error(
        `Analysis annotation '${annotation.id}' compression maximumSize must be within its range.`,
      );
    }
    const hasBankStart = compression.bankStart !== undefined;
    const hasBankEnd = compression.bankEnd !== undefined;
    if (hasBankStart !== hasBankEnd) {
      throw new Error(
        `Analysis annotation '${annotation.id}' compression bank bounds must be supplied together.`,
      );
    }
    const bankStart = compression.bankStart;
    const bankEnd = compression.bankEnd;
    if (
      hasBankStart &&
      (typeof bankStart !== "number" ||
        typeof bankEnd !== "number" ||
        !Number.isSafeInteger(bankStart) ||
        !Number.isSafeInteger(bankEnd) ||
        bankStart < 0 ||
        bankEnd <= bankStart ||
        annotation.start < bankStart ||
        annotation.end > bankEnd)
    ) {
      throw new Error(
        `Analysis annotation '${annotation.id}' has invalid compression bank bounds.`,
      );
    }
    if (
      compression.fillByte !== undefined &&
      (!Number.isInteger(compression.fillByte) ||
        compression.fillByte < 0 ||
        compression.fillByte > 0xff)
    ) {
      throw new Error(
        `Analysis annotation '${annotation.id}' has an invalid compression fillByte.`,
      );
    }
  }
  for (const conflict of shards.analysis) {
    if (conflict.kind !== "conflict" || conflict.end === undefined) continue;
    if (!Number.isSafeInteger(conflict.end) || conflict.end <= conflict.address) {
      throw new Error(`Analysis conflict '${conflict.id}' has an invalid half-open range.`);
    }
  }
  const regionsById = new Map(shards.regions.map((region) => [region.id, region]));
  for (const region of shards.regions) {
    if (!region.parentRegion) continue;
    const parent = regionsById.get(region.parentRegion);
    if (!parent) {
      throw new Error(
        `Analysis region '${region.id}' refers to missing parent region '${region.parentRegion}'.`,
      );
    }
    if (
      parent.addressSpace === region.addressSpace &&
      (region.start < parent.start || region.end > parent.end)
    ) {
      throw new Error(
        `Analysis region '${region.id}' is not contained by parent region '${parent.id}'.`,
      );
    }
    const visited = new Set([region.id]);
    let ancestor = parent;
    while (ancestor.parentRegion) {
      if (visited.has(ancestor.id)) {
        throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
      }
      visited.add(ancestor.id);
      const next = regionsById.get(ancestor.parentRegion);
      if (!next) break;
      ancestor = next;
    }
    if (visited.has(ancestor.id)) {
      throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
    }
  }
  for (const addressed of [...shards.labels, ...shards.comments]) {
    if (!Number.isSafeInteger(addressed.address) || addressed.address < 0) {
      throw new Error(`Analysis record '${addressed.id}' has an invalid address.`);
    }
  }
  const addressSpaceById = new Map(
    addressSpaces.map((addressSpace) => [addressSpace.id, addressSpace]),
  );
  const addressedRecords = [
    ...shards.annotations,
    ...shards.labels,
    ...shards.comments,
    ...shards.regions,
    ...shards.runtime.filter(
      (record): record is (typeof shards.runtime)[number] & { readonly addressSpace: string } =>
        "addressSpace" in record,
    ),
    ...shards.analysis.filter(
      (record): record is (typeof shards.analysis)[number] & { readonly addressSpace: string } =>
        "addressSpace" in record,
    ),
  ];
  for (const record of addressedRecords) {
    const addressSpace = addressSpaceById.get(record.addressSpace);
    if (!addressSpace) {
      throw new Error(
        `Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`,
      );
    }
    const maximum = 2 ** addressSpace.addressBits;
    const addresses: number[] = [];
    if ("start" in record) {
      addresses.push(record.start, record.end - 1);
    } else if ("address" in record) {
      addresses.push(record.address);
      if ("kind" in record && record.kind === "conflict" && record.end !== undefined) {
        addresses.push(record.end - 1);
      }
    } else {
      if ("fromAddress" in record) addresses.push(record.fromAddress);
      if ("toAddress" in record && record.toAddress !== undefined) addresses.push(record.toAddress);
      if ("targets" in record) addresses.push(...record.targets);
    }
    if (
      addresses.some(
        (address) => !Number.isSafeInteger(address) || address < 0 || address >= maximum,
      )
    ) {
      throw new Error(
        `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`,
      );
    }
  }
  for (const record of shards.runtime) {
    let addresses: ReadonlyArray<readonly [string, number]> = [];
    if (record.kind === "runtime-memory-access") {
      addresses = [
        [record.instructionAddressSpace, record.instructionAddress],
        [record.accessedAddressSpace, record.accessedAddress],
      ];
    } else if (record.kind === "runtime-control-target") {
      addresses = [
        [record.fromAddressSpace, record.fromAddress],
        [record.toAddressSpace, record.toAddress],
      ];
    }
    for (const [spaceId, address] of addresses) {
      const addressSpace = addressSpaceById.get(spaceId);
      if (!addressSpace) {
        throw new Error(
          `Runtime record '${record.id}' refers to unknown address space '${spaceId}'.`,
        );
      }
      if (
        !Number.isSafeInteger(address) ||
        address < 0 ||
        address >= 2 ** addressSpace.addressBits
      ) {
        throw new Error(`Runtime record '${record.id}' exceeds address space '${spaceId}'.`);
      }
    }
  }
  assertNoRomPayload(shards, "shards");
};

interface LegacyManifestV0 {
  readonly schemaVersion: 0;
  readonly target: string;
  readonly romHash: string;
  readonly romSize: number;
  readonly headerSize?: 0 | 512;
  readonly mapper: string;
}

interface LegacyManifestV1 extends Omit<AnalysisProjectManifest, "schemaVersion"> {
  readonly schemaVersion: 1;
}

/**
 * Applies explicit one-way manifest migrations. Newer schema versions are refused.
 * v0 promotes `romHash`/`romSize` into `RomIdentity`; v1 bumps `schemaVersion`.
 * Missing current-schema shards are materialized as empty arrays while loading.
 * @param {unknown} input Parsed `analysis.json`.
 * @returns {AnalysisProjectManifest} Current-schema manifest.
 */
export const migrateManifest = (input: unknown): AnalysisProjectManifest => {
  if (!input || typeof input !== "object") throw new Error("Invalid analysis project manifest.");
  const version = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (version === 0) {
    const legacy = input as LegacyManifestV0;
    const headerSize = legacy.headerSize ?? 0;
    const migrated: AnalysisProjectManifest = {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: legacy.target,
      rom: {
        sha256: legacy.romHash,
        contentSha256: legacy.romHash,
        fileSize: legacy.romSize + headerSize,
        contentSize: legacy.romSize,
        headerSize,
      },
      mapping: { mapper: legacy.mapper, source: "override", candidates: [] },
      addressSpaces: [],
      shards: [],
    };
    validateAnalysisProjectManifest(migrated);
    return migrated;
  }
  if (version === 1) {
    const migrated: AnalysisProjectManifest = {
      ...(input as LegacyManifestV1),
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    };
    validateAnalysisProjectManifest(migrated);
    return migrated;
  }
  if (typeof version !== "number") throw new Error("Manifest schemaVersion is required.");
  if (version > ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Analysis project schema ${version} is newer than supported schema ${ANALYSIS_PROJECT_SCHEMA_VERSION}; refusing to downgrade.`,
    );
  }
  if (version < 0 || version !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(`No migration exists for analysis project schema ${version}.`);
  }
  const manifest = input as AnalysisProjectManifest;
  validateAnalysisProjectManifest(manifest);
  return manifest;
};

/** Project as loaded from disk: current-schema manifest plus validated shards. */
export interface LoadedAnalysisProject {
  readonly manifest: AnalysisProjectManifest;
  readonly shards: AnalysisProjectShards;
}

/**
 * Writes canonical `analysis.json` and `analysis/*.json` shards.
 * Records are sorted, ROM byte payloads are forbidden, and shard SHA-256s are recorded. Shards use
 * bounded streaming canonicalization: this is an allocation invariant, not a format change, and
 * must remain byte-compatible with `canonicalJson()` for the same normalized record array.
 * @param {string} directory Destination project directory.
 * @param {AnalysisProject} project Manifest fields plus in-memory shards.
 * @returns {AnalysisProjectManifest} Written manifest including shard descriptors.
 */
export const writeAnalysisProject = (
  directory: string,
  project: AnalysisProject,
): AnalysisProjectManifest => {
  const shards = normalizedShards(project.shards);
  validateLoadedShards(shards, project.manifest);
  const descriptors: ProjectShardDescriptor[] = [];
  for (const [kind, relative] of Object.entries(SHARD_PATHS) as Array<
    [keyof AnalysisProjectShards, string]
  >) {
    assertSafeRelativePath(relative);
    const records = shards[kind];
    const destination = path.join(directory, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const shardHash = writeCanonicalJsonArrayFile(destination, records);
    descriptors.push({
      id: kind,
      kind,
      path: relative,
      sha256: shardHash,
      records: records.length,
    });
  }
  const manifest: AnalysisProjectManifest = {
    ...project.manifest,
    addressSpaces: [...project.manifest.addressSpaces].sort((a, b) => a.id.localeCompare(b.id)),
    mapping: {
      ...project.manifest.mapping,
      candidates: [...project.manifest.mapping.candidates].sort(
        (a, b) => b.score - a.score || a.mapper.localeCompare(b.mapper),
      ),
    },
    shards: descriptors.sort((a, b) => a.id.localeCompare(b.id)),
  };
  validateAnalysisProjectManifest(manifest);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), canonicalJson(manifest));
  return manifest;
};

/**
 * Loads a project, migrating the manifest and verifying each shard SHA-256 and record count.
 * @param {string} directory Project directory containing `analysis.json`.
 * @returns {LoadedAnalysisProject} Validated manifest and shards.
 */
export const loadAnalysisProject = (directory: string): LoadedAnalysisProject => {
  const manifestFile = path.join(directory, ANALYSIS_PROJECT_MANIFEST);
  const manifest = migrateManifest(JSON.parse(fs.readFileSync(manifestFile, "utf8")));
  const loaded = {} as Record<keyof AnalysisProjectShards, unknown>;
  for (const descriptor of manifest.shards) {
    assertSafeRelativePath(descriptor.path);
    const text = fs.readFileSync(path.join(directory, descriptor.path), "utf8");
    if (sha256(text) !== descriptor.sha256) {
      throw new Error(`Analysis shard '${descriptor.path}' does not match its SHA-256.`);
    }
    const records = JSON.parse(text) as unknown[];
    if (!Array.isArray(records) || records.length !== descriptor.records) {
      throw new Error(
        `Analysis shard '${descriptor.path}' record count does not match its manifest.`,
      );
    }
    if (loaded[descriptor.kind] !== undefined) {
      throw new Error(`Analysis project contains more than one '${descriptor.kind}' shard.`);
    }
    loaded[descriptor.kind] = records;
  }
  for (const kind of Object.keys(SHARD_PATHS) as Array<keyof AnalysisProjectShards>) {
    loaded[kind] ??= [];
  }
  const shards = loaded as unknown as AnalysisProjectShards;
  validateLoadedShards(shards, manifest);
  return { manifest, shards };
};

/**
 * Checks that a loaded ROM matches the project's stored identity.
 * @param {AnalysisProjectManifest} manifest Project manifest.
 * @param {RomImage} rom ROM that should be used with this project.
 * @returns {void}
 */
export const validateProjectRom = (manifest: AnalysisProjectManifest, rom: RomImage): void => {
  if (
    manifest.rom.sha256 !== rom.identity.sha256 ||
    manifest.rom.contentSha256 !== rom.identity.contentSha256 ||
    manifest.rom.headerSize !== rom.identity.headerSize
  ) {
    throw new Error(
      `ROM identity mismatch: project expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`,
    );
  }
};

/**
 * Loads and validates a project, optionally checking ROM identity in one step.
 * @param {string} directory Project directory containing `analysis.json`.
 * @param {RomImage} [rom] When provided, must match `manifest.rom`.
 * @returns {LoadedAnalysisProject} Validated project.
 */
export const validateAnalysisProject = (
  directory: string,
  rom?: RomImage,
): LoadedAnalysisProject => {
  const project = loadAnalysisProject(directory);
  if (rom) validateProjectRom(project.manifest, rom);
  return project;
};
