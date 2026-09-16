import * as path from "node:path";
import { performance } from "node:perf_hooks";

import {
  importRuntimeTraceSourceIntoProject,
  importRuntimeBusTraceSourceIntoProject,
  type RuntimeBusProjectImportResult,
  validateSourceExportFiles,
  validateSourceExportInputs,
  openAnalysisProjectStore,
  analysisProjectRevision,
  type RuntimeTraceIndexMode,
  type AnalysisStoragePolicy,
  type RuntimeTraceProjectImportResult,
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

import type { AnnotationRefresh } from "./disassembly-annotation-data.js";
import {
  normalizedSeeds,
  type CoverageSnapshot,
  type DisassemblyEntrySeed,
  type ResolvedProjectSource,
  type ResolvedTarget,
} from "./disassembly-maintenance-data.js";
import type { MaintenanceStageTiming } from "./disassembly-timings.js";
import { createEditorRuntimeBusSource } from "./runtime-bus-source.js";
import { createEditorRuntimeTraceSource } from "./runtime-trace-source.js";

export interface TraceImportSummary {
  readonly storage?: RuntimeTraceProjectImportResult["storage"];
  readonly warnings?: readonly string[];
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
  /** A stale receipt returns undefined so the caller can run the full analysis workflow. */
  refresh: {
    input: { target: ResolvedTarget; receipt: AnnotationRefresh };
    output: ExportSnesProjectResult | undefined;
  };
  revision: { input: { projectDirectory: string }; output: string };
  verify: { input: ResolvedTarget; output: VerifySnesProjectRoundTripResult };
  import: {
    input: {
      target: ResolvedTarget;
      traceFile: string;
      maxBytes: number;
      architecture: string;
      addressSpace: string;
      indexMode?: RuntimeTraceIndexMode;
      storagePolicy?: Partial<AnalysisStoragePolicy>;
    };
    output: TraceImportSummary;
  };
  /** Bus indexing does not require generated source or a ROM file: project content identity is sufficient. */
  importBus: {
    input: {
      projectDirectory: string;
      romContentSha256: string;
      traceFile: string;
      maxBytes: number;
      storagePolicy?: Partial<AnalysisStoragePolicy>;
    };
    output: RuntimeBusProjectImportResult;
  };
}
export type MaintenanceJob = {
  [K in keyof MaintenanceJobs]: { operation: K; input: MaintenanceJobs[K]["input"] };
}[keyof MaintenanceJobs];
export interface MaintenanceProgress {
  readonly message?: string;
  readonly bytesRead?: number;
  readonly totalBytes?: number;
  /** Provisional runtime records merged inside the transaction, independent of file-read progress. */
  readonly processedRecords?: number;
  readonly totalRecords?: number;
  /** Finished worker stage; measured in the worker to exclude progress-message delivery delays. */
  readonly timing?: MaintenanceStageTiming;
}

/**
 * Read report counts from SQLite columns, without decoding the CFG or runtime payloads.
 * @param {ResolvedProjectSource} target Project and the source manifest whose coverage is reported.
 * @returns {object} Compact coverage and provenance needed to validate explicit seeds.
 */
const maintenanceSnapshot = (target: ResolvedProjectSource) => {
  const store = openAnalysisProjectStore(target.projectDirectory);
  try {
    return store.transaction(() => {
      const analysis = store.analysisCounts();
      const runtime = store.runtimeExecutionCounts();
      return {
        shards: { evidence: store.loadTable("evidence") },
        coverage: {
          storage: store.storageSnapshot(),
          manifestSha256: analysisProjectRevision(store.manifest()).manifestSha256,
          instructions: analysis["cfg-node"] ?? 0,
          runtimeRecords: runtime.records,
          runtimeEvents: runtime.events,
          traceImports: store
            .loadTable("imports")
            .filter((record) => record.format === "uttori-asm-instruction-trace").length,
          codeBytes: target.sourceManifest.spans.reduce(
            (total, span) => total + (span.role === "code" ? span.end - span.start : 0),
            0,
          ),
          contentBytes: target.sourceManifest.rom.contentSize,
        } satisfies CoverageSnapshot,
      };
    }, false);
  } finally {
    store.close();
  }
};

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
  let stage = "Load worker inputs";
  let started = performance.now();
  const finish = (status: MaintenanceStageTiming["status"]): void => {
    const ended = performance.now();
    progress({ timing: { step: stage, durationMs: ended - started, status } });
    started = ended;
  };
  let status: MaintenanceStageTiming["status"] = "completed";
  try {
    return await executeMaintenanceJob(job, signal, (value) => {
      // Byte-progress updates belong to the current stage. Only a new stage message closes it.
      if (value.message && value.message !== stage) {
        finish("completed");
        stage = value.message;
      }
      progress(value);
    });
  } catch (error) {
    status = error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed";
    throw error;
  } finally {
    finish(status);
  }
};

/**
 * Execute one worker job; progress messages mark the start of a new measured stage.
 * @param {MaintenanceJob} job File-based operation and validated caller options.
 * @param {AbortSignal} signal Cancellation at safe operation boundaries.
 * @param {Function} progress Stage transitions and byte-reading progress.
 * @returns {Promise<unknown>} Compact operation result for IPC.
 */
const executeMaintenanceJob = async (
  job: MaintenanceJob,
  signal: AbortSignal,
  progress: (value: MaintenanceProgress) => void,
): Promise<unknown> => {
  signal.throwIfAborted();
  switch (job.operation) {
    case "prepare": {
      progress({ message: "Reading analysis counts and validating generated source…" });
      const { target, seeds } = job.input;
      const snapshot = maintenanceSnapshot(target);
      validateSourceExportFiles(target.sourceDirectory, target.sourceManifest);
      return {
        before: snapshot.coverage,
        entryPoints: normalizedSeeds(seeds, snapshot),
      };
    }
    case "coverage": {
      return maintenanceSnapshot(job.input).coverage;
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
      return exportSnesProject({
        ...job.input,
        signal,
        onProgress: ({ message }) => progress({ message }),
      });
    case "refresh": {
      const { target, receipt } = job.input;
      const store = openAnalysisProjectStore(target.projectDirectory);
      try {
        const revision = store.transaction(
          () => analysisProjectRevision(store.manifest()).manifestSha256,
          false,
        );
        // Annotation refresh deliberately renders saved analysis, including earlier saved
        // annotations. Decoding pending traces remains the full Analyze command's job.
        // An intervening write cannot silently join the edit the user just asked to refresh.
        if (revision !== receipt.after) return undefined;
      } finally {
        store.close();
      }
      try {
        validateSourceExportInputs(target.sourceDirectory, target.sourceManifest);
      } catch {
        // Changed RAM/structure inputs can affect interpretation as well as printed names.
        return undefined;
      }
      progress({ message: "Refreshing annotation source using existing analysis…" });
      return exportSnesProject({ ...target, expectedRevision: receipt.after, signal });
    }
    case "revision": {
      const store = openAnalysisProjectStore(job.input.projectDirectory);
      try {
        return store.transaction(
          () => analysisProjectRevision(store.manifest()).manifestSha256,
          false,
        );
      } finally {
        store.close();
      }
    }
    case "verify":
      return verifySnesProjectRoundTrip({
        ...job.input,
        signal,
        onProgress: ({ message }) => progress({ message }),
      });
    case "import": {
      const { target, traceFile, maxBytes, architecture, addressSpace } = job.input;
      progress({ message: "Opening and validating trace metadata" });
      const source = await createEditorRuntimeTraceSource(traceFile, {
        maxBytes,
        signal,
        onProgress: (bytesRead, totalBytes) => progress({ bytesRead, totalBytes }),
      });
      const imported = await importRuntimeTraceSourceIntoProject(
        source,
        target.projectDirectory,
        {
          projectRomContentSha256: target.sourceManifest.rom.contentSha256,
          sourceName: path.basename(traceFile),
          indexMode: job.input.indexMode,
        },
        {
          maxBytes,
          signal,
          onProgress: (bytesRead, totalBytes) => progress({ bytesRead, totalBytes }),
          onStage: (message) => progress({ message }),
          onMergeProgress: (processedRecords, totalRecords) =>
            progress({ processedRecords, totalRecords }),
          archiveSourceFile: traceFile,
          storagePolicy: job.input.storagePolicy,
        },
      );
      return {
        seeds:
          architecture === "snes.65816" && addressSpace === SNES_CPU_ADDRESS_SPACE
            ? imported.execution.map((record) => ({
                address: record.address,
                evidence: record.evidence,
              }))
            : [],
        storage: imported.storage,
        warnings: imported.warnings,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        executionRecords: imported.report.imported.executionRecords ?? 0,
        changed: imported.changed,
        added: imported.added,
      } satisfies TraceImportSummary;
    }
    case "importBus": {
      const { projectDirectory, romContentSha256, traceFile, maxBytes, storagePolicy } = job.input;
      const source = await createEditorRuntimeBusSource(traceFile, {
        maxBytes,
        signal,
        onProgress: (bytesRead, totalBytes) => progress({ bytesRead, totalBytes }),
      });
      return importRuntimeBusTraceSourceIntoProject(
        source,
        projectDirectory,
        {
          projectRomContentSha256: romContentSha256,
          sourceName: path.basename(traceFile),
        },
        {
          signal,
          storagePolicy,
          archiveSourceFile: traceFile,
          onStage: (message) => progress({ message }),
        },
      );
    }
  }
  throw new Error("Unknown disassembly maintenance operation.");
};
