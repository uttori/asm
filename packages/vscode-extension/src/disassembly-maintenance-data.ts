import type {
  AnalysisProjectManifest,
  AnalysisProjectShards,
  AnalysisProjectSnapshot,
  SourceExportManifest,
} from "@uttori/asm-disassembler";
import type { AnalyzeSnesProjectResult, Snes65816EntryPoint } from "@uttori/asm-plugin-snes";
const MAX_RUNTIME_ENTRY_SEEDS = 100_000;

export interface DisassemblyEntrySeed {
  readonly address: number;
  readonly evidence?: readonly string[];
}

export interface DisassemblyMaintenanceTarget {
  readonly projectDirectory?: string;
  readonly sourceDirectory?: string;
  readonly entrySeeds?: readonly DisassemblyEntrySeed[];
}

export interface ProjectChoice {
  readonly directory: string;
  readonly manifest: AnalysisProjectManifest;
}

export interface ResolvedProjectSource {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly sourceManifest: SourceExportManifest;
}

export interface ResolvedTarget extends ResolvedProjectSource {
  readonly romFile: string;
}

export interface CoverageSnapshot {
  readonly manifestSha256: string;
  readonly instructions: number;
  readonly functions: number;
  readonly runtimeRecords: number;
  readonly runtimeEvents: number;
  readonly traceImports: number;
  readonly behaviorComments: number;
  readonly codeBytes: number;
  readonly contentBytes: number;
}

export interface DisassemblyRegenerationSummary {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly before: CoverageSnapshot;
  readonly after: CoverageSnapshot;
  readonly analysis: AnalyzeSnesProjectResult;
  readonly entrySeeds: number;
  readonly ramVariables: number;
  readonly addedFiles: readonly string[];
  readonly changedFiles: readonly string[];
  readonly removedFiles: readonly string[];
  readonly roundTripSha256: string;
}

export const coverageFor = (
  shards: AnalysisProjectShards,
  manifestSha256: string,
  source: SourceExportManifest,
): CoverageSnapshot => ({
  manifestSha256,
  instructions: shards.analysis.filter((record) => record.kind === "cfg-node").length,
  functions: shards.analysis.filter((record) => record.kind === "function").length,
  runtimeRecords: shards.runtime.filter((record) => record.kind === "runtime-execution").length,
  runtimeEvents: shards.runtime
    .filter((record) => record.kind === "runtime-execution")
    .reduce((total, record) => total + record.count, 0),
  traceImports: shards.imports.filter((record) => record.format === "uttori-asm-instruction-trace")
    .length,
  behaviorComments: shards.comments.filter((record) => record.id.startsWith("behavior-comment:"))
    .length,
  codeBytes: source.spans
    .filter((span) => span.role === "code")
    .reduce((total, span) => total + span.end - span.start, 0),
  contentBytes: source.rom.contentSize,
});

export const normalizedSeeds = (
  value: readonly DisassemblyEntrySeed[] | undefined,
  snapshot: AnalysisProjectSnapshot,
): readonly Snes65816EntryPoint[] => {
  if (!value?.length) return [];
  const evidence = new Set(snapshot.shards.evidence.map((record) => record.id));
  const unique = new Map<number, Set<string>>();
  for (const seed of value) {
    if (!Number.isSafeInteger(seed.address) || seed.address < 0 || seed.address > 0xffffff)
      throw new Error("Runtime code seeds must be 24-bit integer CPU addresses.");
    const accepted = (seed.evidence ?? []).filter((id) => evidence.has(id));
    const prior = unique.get(seed.address) ?? new Set<string>();
    for (const id of accepted) prior.add(id);
    unique.set(seed.address, prior);
  }
  if (unique.size > MAX_RUNTIME_ENTRY_SEEDS)
    throw new Error(
      `Trace contains ${unique.size} unique PCs; capture a narrower window (limit ${MAX_RUNTIME_ENTRY_SEEDS}).`,
    );
  return [...unique]
    .sort(([left], [right]) => left - right)
    .map(([address, ids]) => ({
      id: `runtime-${address.toString(16).padStart(6, "0")}`,
      address,
      kind: "observation" as const,
      ...(ids.size ? { evidence: [...ids].sort() } : {}),
    }));
};

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
