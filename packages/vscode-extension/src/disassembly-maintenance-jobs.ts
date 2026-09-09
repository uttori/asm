import * as path from "node:path";
import {
  commitAnalysisProjectTransaction,
  importRuntimeInstructionTraceFile,
  loadAnalysisProjectSnapshot,
  mergeRuntimeEvidence,
  summarizeExecutionWindowFile,
  validateSourceExportFiles,
  type ExecutionWindowSummary,
} from "@uttori/asm-disassembler";
import {
  analyzeSnesProject,
  exportSnesProject,
  verifySnesProjectRoundTrip,
  SNES_CPU_ADDRESS_SPACE,
  type AnalyzeSnesProjectResult,
  type ExportSnesProjectResult,
  type Snes65816EntryPoint,
  type VerifySnesProjectRoundTripResult,
} from "@uttori/asm-plugin-snes";
import {
  coverageFor,
  normalizedSeeds,
  type CoverageSnapshot,
  type DisassemblyEntrySeed,
  type ResolvedProjectSource,
  type ResolvedTarget,
} from "./disassembly-maintenance-data.js";

export interface TraceImportSummary {
  readonly seeds: readonly DisassemblyEntrySeed[];
  readonly observedEvents: number;
  readonly droppedEvents: number;
  readonly executionRecords: number;
  readonly changed: boolean;
  readonly added: { readonly runtime: number; readonly evidence: number };
}
export interface MaintenanceJobs {
  prepare: {
    input: { target: ResolvedTarget; seeds?: readonly DisassemblyEntrySeed[] };
    output: { before: CoverageSnapshot; entryPoints: readonly Snes65816EntryPoint[] };
  };
  coverage: { input: ResolvedProjectSource; output: CoverageSnapshot };
  analyze: {
    input: {
      target: ResolvedTarget;
      entryPoints: readonly Snes65816EntryPoint[];
      maxWorkItems: number;
    };
    output: AnalyzeSnesProjectResult;
  };
  export: { input: ResolvedTarget; output: ExportSnesProjectResult };
  verify: { input: ResolvedTarget; output: VerifySnesProjectRoundTripResult };
  import: {
    input: {
      target: ResolvedTarget;
      traceFile: string;
      maxBytes: number;
      architecture: string;
      addressSpace: string;
    };
    output: TraceImportSummary;
  };
  execution: {
    input: { projectDirectory: string; traceFile: string; maxBytes: number };
    output: ExecutionWindowSummary;
  };
}
export type MaintenanceJob = {
  [K in keyof MaintenanceJobs]: { operation: K; input: MaintenanceJobs[K]["input"] };
}[keyof MaintenanceJobs];
export interface MaintenanceProgress {
  readonly message?: string;
  readonly bytesRead?: number;
  readonly totalBytes?: number;
}

/**
 * Each job runs in a fresh child process. Only compact results cross back to the editor.
 * @param {MaintenanceJob} job Phase and file paths, never loaded project shards.
 * @param {AbortSignal} signal Cooperative cancellation between safe steps.
 * @param {(progress: MaintenanceProgress) => void} progress Phase/progress callback.
 * @returns {Promise<unknown>} Serializable phase result.
 */
export const runMaintenanceJob = async (
  job: MaintenanceJob,
  signal: AbortSignal,
  progress: (value: MaintenanceProgress) => void,
): Promise<unknown> => {
  signal.throwIfAborted();
  switch (job.operation) {
    case "prepare": {
      progress({ message: "Loading and validating analysis…" });
      const { target, seeds } = job.input;
      const snapshot = loadAnalysisProjectSnapshot(target.projectDirectory);
      validateSourceExportFiles(target.sourceDirectory, target.sourceManifest);
      return {
        before: coverageFor(
          snapshot.shards,
          snapshot.revision.manifestSha256,
          target.sourceManifest,
        ),
        entryPoints: normalizedSeeds(seeds, snapshot),
      };
    }
    case "coverage": {
      const snapshot = loadAnalysisProjectSnapshot(job.input.projectDirectory);
      return coverageFor(
        snapshot.shards,
        snapshot.revision.manifestSha256,
        job.input.sourceManifest,
      );
    }
    case "analyze":
      return analyzeSnesProject({
        ...job.input.target,
        entryPoints: job.input.entryPoints,
        maxWorkItems: job.input.maxWorkItems,
        signal,
        onProgress: ({ message }) => progress({ message }),
      });
    case "export":
      return exportSnesProject({ ...job.input, signal });
    case "verify":
      return verifySnesProjectRoundTrip({ ...job.input, signal });
    case "import": {
      const { target, traceFile, maxBytes, architecture, addressSpace } = job.input;
      const imported = await importRuntimeInstructionTraceFile(
        traceFile,
        {
          projectRomContentSha256: target.sourceManifest.rom.contentSha256,
          sourceName: path.basename(traceFile),
        },
        {
          maxBytes,
          signal,
          onProgress: (bytesRead, totalBytes) => progress({ bytesRead, totalBytes }),
        },
      );
      progress({ message: "Merging and saving trace evidence…" });
      const snapshot = loadAnalysisProjectSnapshot(target.projectDirectory);
      const merged = mergeRuntimeEvidence(snapshot.shards, imported.batch);
      signal.throwIfAborted();
      if (merged.changed)
        commitAnalysisProjectTransaction(target.projectDirectory, snapshot.revision, {
          manifest: snapshot.manifest,
          shards: merged.shards,
        });
      return {
        seeds:
          architecture === "snes.65816" && addressSpace === SNES_CPU_ADDRESS_SPACE
            ? (imported.batch.runtime?.flatMap((record) =>
                record.kind === "runtime-execution"
                  ? [{ address: record.address, evidence: record.evidence }]
                  : [],
              ) ?? [])
            : [],
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        executionRecords: imported.report.imported.executionRecords ?? 0,
        changed: merged.changed,
        added: { runtime: merged.added.runtime, evidence: merged.added.evidence },
      } satisfies TraceImportSummary;
    }
    case "execution": {
      const { projectDirectory, traceFile, maxBytes } = job.input;
      const snapshot = loadAnalysisProjectSnapshot(projectDirectory);
      return summarizeExecutionWindowFile(traceFile, snapshot.shards, {
        maxBytes,
        signal,
        onProgress: (bytesRead, totalBytes) => progress({ bytesRead, totalBytes }),
      });
    }
  }
  throw new Error("Unknown disassembly maintenance operation.");
};
