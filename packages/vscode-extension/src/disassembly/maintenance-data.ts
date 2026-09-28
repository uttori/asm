import type {
  AnalysisProjectManifest,
  AnalysisStorageSnapshot,
  AnalysisProjectShards,
  SourceExportManifest,
} from "@uttori/asm-disassembler";
import type { AnalyzeSnesProjectResult, Snes65816EntryPoint } from "@uttori/asm-plugin-snes";

import type { AnnotationRefresh } from "./annotation-data.js";
import type { MaintenanceTimingSummary } from "./timings.js";
/**
 * Maximum distinct observed CPU addresses accepted as regeneration seeds, bounding analysis
 * setup for broad captures.
 */
const MAX_RUNTIME_ENTRY_SEEDS = 1_000_000;

/**
 * Observed 24-bit CPU address with optional native evidence IDs; normalization discards IDs
 * absent from the project.
 */
export interface DisassemblyEntrySeed {
  readonly address: number;
  readonly evidence?: readonly string[];
}

/**
 * Optional command hints for project/source selection and runtime seeds, plus a guarded receipt
 * for metadata-only source refresh.
 */
export interface DisassemblyMaintenanceTarget {
  readonly projectDirectory?: string;
  readonly sourceDirectory?: string;
  readonly entrySeeds?: readonly DisassemblyEntrySeed[];
  /** Set only by annotation saves. Stale receipts fall back to full analysis. */
  readonly annotationRefresh?: AnnotationRefresh;
}

/** Validated native project manifest and its absolute directory selected for maintenance. */
export interface ProjectChoice {
  readonly directory: string;
  readonly manifest: AnalysisProjectManifest;
}

/**
 * Selected analysis project paired with a matching generated-source directory and its loaded
 * export manifest.
 */
export interface ResolvedProjectSource {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly sourceManifest: SourceExportManifest;
}

/**
 * Maintenance selection with a local ROM file verified against both the project file hash and
 * headerless content hash.
 */
export interface ResolvedTarget extends ResolvedProjectSource {
  readonly romFile: string;
}

/**
 * Compact project/source measurements used for before/after reporting; byte totals and observed
 * event counts remain distinct from record counts.
 */
export interface CoverageSnapshot {
  /** SQL/file allocation measured alongside coverage. Absent only in older report fixtures. */
  readonly storage?: AnalysisStorageSnapshot;
  readonly manifestSha256: string;
  readonly instructions: number;
  readonly runtimeRecords: number;
  readonly runtimeEvents: number;
  readonly traceImports: number;
  readonly codeBytes: number;
  readonly contentBytes: number;
}

/**
 * Verified regeneration result combining coverage deltas, generated-file changes, ROM round-trip
 * hash, and processing timings.
 */
export interface DisassemblyRegenerationSummary {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly before: CoverageSnapshot;
  readonly after: CoverageSnapshot;
  readonly analysis?: AnalyzeSnesProjectResult;
  readonly entrySeeds: number;
  readonly ramVariables: number;
  readonly addedFiles: readonly string[];
  readonly changedFiles: readonly string[];
  readonly removedFiles: readonly string[];
  readonly roundTripSha256: string;
  /** Measured processing phases, including child-process overhead and contained stage details. */
  readonly timings: MaintenanceTimingSummary;
}

/**
 * Validate and deduplicate 24-bit observed PCs, keeping only project-owned evidence and
 * returning sorted observation entry points.
 * Missing seeds produce an empty list; invalid addresses or more than 100,000 distinct PCs
 * throw.
 * @param {readonly DisassemblyEntrySeed[] | undefined} value Observed CPU addresses and optional evidence IDs.
 * @param {object} snapshot Project evidence used to reject foreign provenance links.
 * @returns {readonly Snes65816EntryPoint[]} Sorted observation entry points with only known evidence IDs.
 */
export const normalizedSeeds = (
  value: readonly DisassemblyEntrySeed[] | undefined,
  snapshot: { readonly shards: Pick<AnalysisProjectShards, "evidence"> },
): readonly Snes65816EntryPoint[] => {
  if (!value?.length) {
    return [];
  }
  const evidence = new Set(snapshot.shards.evidence.map((record) => record.id));
  const unique = new Map<number, Set<string>>();
  for (const seed of value) {
    if (!Number.isSafeInteger(seed.address) || seed.address < 0 || seed.address > 0xffffff) {
      throw new Error("Runtime code seeds must be 24-bit integer CPU addresses.");
    }
    const accepted = (seed.evidence ?? []).filter((id) => evidence.has(id));
    const prior = unique.get(seed.address) ?? new Set<string>();
    for (const id of accepted) {
      prior.add(id);
    }
    unique.set(seed.address, prior);
  }
  if (unique.size > MAX_RUNTIME_ENTRY_SEEDS) {
    throw new Error(
      `Trace contains ${unique.size} unique PCs. Capture a narrower window (limit ${MAX_RUNTIME_ENTRY_SEEDS}).`,
    );
  }
  return [...unique]
    .sort(([left], [right]) => left - right)
    .map(([address, ids]) => ({
      id: `runtime-${address.toString(16).padStart(6, "0")}`,
      address,
      kind: "observation" as const,
      ...(ids.size ? { evidence: [...ids].sort() } : {}),
    }));
};

/**
 * Compare export manifests by path and SHA-256, returning sorted added, changed, and removed
 * paths without reading file contents.
 * @param {SourceExportManifest} before Previously published source-file hashes.
 * @param {SourceExportManifest} after Newly published source-file hashes.
 * @returns {Pick<DisassemblyRegenerationSummary, "addedFiles" | "changedFiles" | "removedFiles">} Sorted added, changed, and removed relative paths.
 */
export const fileChanges = (
  before: SourceExportManifest,
  after: SourceExportManifest,
): Pick<DisassemblyRegenerationSummary, "addedFiles" | "changedFiles" | "removedFiles"> => {
  const prior = new Map(before.files.map((file) => [file.path, file.sha256]));
  const next = new Map(after.files.map((file) => [file.path, file.sha256]));
  return {
    addedFiles: [...next.keys()].filter((file) => !prior.has(file)).sort(),
    changedFiles: [...next]
      .flatMap(([file, sha]) => (prior.has(file) && prior.get(file) !== sha ? [file] : []))
      .sort(),
    removedFiles: [...prior.keys()].filter((file) => !next.has(file)).sort(),
  };
};
