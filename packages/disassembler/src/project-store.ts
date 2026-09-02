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
} from "./project-types.js";
import type { RomImage } from "./rom-image.js";

const SHARD_PATHS: Readonly<Record<keyof AnalysisProjectShards, string>> = Object.freeze({
  analysis: "analysis/control-flow.json",
  annotations: "analysis/annotations.json",
  labels: "analysis/labels.json",
  comments: "analysis/comments.json",
  regions: "analysis/regions.json",
  evidence: "analysis/evidence.json",
  imports: "analysis/imports.json",
});

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

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
 * Deterministic JSON: sorted object keys, dropped `undefined`, trailing newline.
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
  evidence: sortById(shards.evidence),
  imports: sortById(shards.imports),
});

const validateManifest = (manifest: AnalysisProjectManifest): void => {
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
  const shardIds = new Set<string>();
  const shardPaths = new Set<string>();
  for (const shard of manifest.shards) {
    assertSafeRelativePath(shard.path);
    if (!(shard.kind in SHARD_PATHS))
      throw new Error(`Unknown analysis shard kind '${shard.kind}'.`);
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

const validateLoadedShards = (shards: AnalysisProjectShards): void => {
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
 * v0 promotes `romHash`/`romSize` into `RomIdentity`; v1 only bumps `schemaVersion`.
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
    validateManifest(migrated);
    return migrated;
  }
  if (version === 1) {
    const migrated: AnalysisProjectManifest = {
      ...(input as LegacyManifestV1),
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    };
    validateManifest(migrated);
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
  validateManifest(manifest);
  return manifest;
};

/** Project as loaded from disk: current-schema manifest plus validated shards. */
export interface LoadedAnalysisProject {
  readonly manifest: AnalysisProjectManifest;
  readonly shards: AnalysisProjectShards;
}

/**
 * Writes canonical `analysis.json` and `analysis/*.json` shards.
 * Records are sorted, ROM byte payloads are forbidden, and shard SHA-256s are recorded.
 * @param {string} directory Destination project directory.
 * @param {AnalysisProject} project Manifest fields plus in-memory shards.
 * @returns {AnalysisProjectManifest} Written manifest including shard descriptors.
 */
export const writeAnalysisProject = (
  directory: string,
  project: AnalysisProject,
): AnalysisProjectManifest => {
  const shards = normalizedShards(project.shards);
  validateLoadedShards(shards);
  const descriptors: ProjectShardDescriptor[] = [];
  for (const [kind, relative] of Object.entries(SHARD_PATHS) as Array<
    [keyof AnalysisProjectShards, string]
  >) {
    assertSafeRelativePath(relative);
    const records = shards[kind];
    const text = canonicalJson(records);
    const destination = path.join(directory, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, text);
    descriptors.push({
      id: kind,
      kind,
      path: relative,
      sha256: sha256(text),
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
  validateManifest(manifest);
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
  validateLoadedShards(shards);
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
