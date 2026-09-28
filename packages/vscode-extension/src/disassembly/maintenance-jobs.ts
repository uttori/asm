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
  acquireFileLease,
  recoverSourceGeneration,
  readSourcePublication,
  type RuntimeTraceIndexMode,
  type AnalysisStoragePolicy,
  type RuntimeTraceProjectImportResult,
} from "@uttori/asm-disassembler";
import { NodePluginLoader } from "@uttori/asm-plugin-loader-node";
import snesPlugin, {
  analyzeSnesProject,
  verifySnesProjectRoundTrip,
  createRomModificationProject,
  buildModifiedRom,
  deriveModifiedRomProject,
  addRomReplacement,
  extractRomAsset,
  importRomAsset,
  applyRomPlacement,
  previewRomEditor,
  reviewMetadataMigration,
  reviewModificationRetention,
  pinModificationRetention,
  pruneModificationRetention,
  applyMetadataMigration,
  saveRomEditor,
  removeRomReplacement,
  retainRomModificationBaseline,
  reviewRomRebase,
  acceptRomRebase,
  refreshRomRebaseReview,
  detachRomSource,
  reviewSourceEdit,
  restoreReviewedSource,
  SNES_CPU_ADDRESS_SPACE,
  type AnalyzeSnesProjectResult,
  type ExportSnesProjectResult,
  type Snes65816EntryPoint,
  type VerifySnesProjectRoundTripResult,
} from "@uttori/asm-plugin-snes";

import { createEditorRuntimeBusSource } from "../runtime/bus-source.js";
import { createEditorRuntimeTraceSource } from "../runtime/trace-source.js";
import type { AnnotationRefresh } from "./annotation-data.js";
import { acquireEditLease } from "./edit-coordinator.js";
import {
  normalizedSeeds,
  type CoverageSnapshot,
  type DisassemblyEntrySeed,
  type ResolvedProjectSource,
  type ResolvedTarget,
} from "./maintenance-data.js";
import { importReviewedSource } from "./source-import.js";
import {
  canRefreshMetadata,
  publishVerifiedSource,
  type PublishedSource,
} from "./source-publisher.js";
import type { MaintenanceStageTiming } from "./timings.js";

/**
 * Compact committed instruction-import result, including regeneration seeds, retained/dropped
 * event counts, and newly added facts.
 */
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
/**
 * Operation-to-input/result contracts shared by maintenance client and child process; requests
 * carry paths and selectors instead of loaded shards.
 */
export interface MaintenanceJobs {
  retentionReview: {
    input: Parameters<typeof reviewModificationRetention>[0];
    output: ReturnType<typeof reviewModificationRetention>;
  };
  retentionPin: { input: Parameters<typeof pinModificationRetention>[0]; output: void };
  retentionPrune: {
    input: Parameters<typeof pruneModificationRetention>[0];
    output: ReturnType<typeof pruneModificationRetention>;
  };
  metadataMigrationReview: {
    input: Parameters<typeof reviewMetadataMigration>[0];
    output: ReturnType<typeof reviewMetadataMigration>;
  };
  metadataMigrationApply: {
    input: Parameters<typeof applyMetadataMigration>[0];
    output: Awaited<ReturnType<typeof applyMetadataMigration>>;
  };
  editorPreview: {
    input: Parameters<typeof previewRomEditor>[0];
    output: Awaited<ReturnType<typeof previewRomEditor>>;
  };
  editorSave: { input: Parameters<typeof saveRomEditor>[0]; output: string };
  rebaseRefresh: { input: Parameters<typeof refreshRomRebaseReview>[0]; output: string };
  sourceRestore: {
    input: Parameters<typeof restoreReviewedSource>[0];
    output: Awaited<ReturnType<typeof restoreReviewedSource>>;
  };
  baselineRetain: { input: { manifestFile: string }; output: string };
  assetExtract: { input: Parameters<typeof extractRomAsset>[0]; output: string };
  assetImport: { input: Parameters<typeof importRomAsset>[0]; output: string };
  placementApply: { input: Parameters<typeof applyRomPlacement>[0]; output: string };
  replacementRemove: { input: Parameters<typeof removeRomReplacement>[0]; output: void };
  rebaseReview: { input: Parameters<typeof reviewRomRebase>[0]; output: string };
  rebaseAccept: {
    input: Parameters<typeof acceptRomRebase>[0];
    output: Awaited<ReturnType<typeof acceptRomRebase>>;
  };
  sourceDetach: { input: Parameters<typeof detachRomSource>[0]; output: string };
  sourceReview: { input: Parameters<typeof reviewSourceEdit>[0]; output: string };
  sourceImport: { input: Parameters<typeof importReviewedSource>[0]; output: string };
  modificationCreate: {
    input: { sourceDirectory: string; romFile: string; directory: string };
    output: string;
  };
  modificationBuild: {
    input: { manifestFile: string };
    output: Awaited<ReturnType<typeof buildModifiedRom>>;
  };
  modificationAdd: {
    input: Parameters<typeof addRomReplacement>[0];
    output: string;
  };
  modificationDerive: {
    input: { manifestFile: string; outputDirectory: string };
    output: Awaited<ReturnType<typeof deriveModifiedRomProject>>;
  };
  publish: { input: ResolvedTarget; output: PublishedSource };
  refreshEligible: { input: ResolvedTarget; output: boolean };
  publicationStatus: {
    input: { sourceDirectory: string };
    output: ReturnType<typeof readSourcePublication>;
  };
  recover: {
    input: { sourceDirectory: string; projectDirectory: string };
    output: ReturnType<typeof recoverSourceGeneration>;
  };
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
/** Discriminated IPC job that keeps each operation paired with its corresponding input contract. */
export type MaintenanceJob = {
  [K in keyof MaintenanceJobs]: { operation: K; input: MaintenanceJobs[K]["input"] };
}[keyof MaintenanceJobs];
/**
 * Worker progress message carrying a stage label, byte/record counters, or a finished-stage
 * timing; absent totals indicate unknown work size.
 */
export interface MaintenanceProgress {
  readonly message?: string;
  readonly bytesRead?: number;
  readonly totalBytes?: number;
  /** Provisional runtime records merged inside the transaction, independent of file-read progress. */
  readonly processedRecords?: number;
  readonly totalRecords?: number;
  /** Instruction observations staged for grouping; analysis publication is a later step. */
  readonly processedObservations?: number;
  /** Finished worker stage. Measured in the worker to exclude progress-message delivery delays. */
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
 * Execute one worker job. Progress messages mark the start of a new measured stage.
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
    case "retentionReview":
      return reviewModificationRetention(job.input);
    case "retentionPin":
      return pinModificationRetention(job.input);
    case "retentionPrune":
      return pruneModificationRetention(job.input);
    case "metadataMigrationReview":
      return reviewMetadataMigration(job.input);
    case "editorSave":
      return saveRomEditor(job.input);
    case "placementApply":
      return applyRomPlacement(job.input);
    case "replacementRemove":
      return removeRomReplacement(job.input);
    case "sourceReview":
      return reviewSourceEdit(job.input);
    case "modificationAdd":
      return addRomReplacement(job.input);
    case "metadataMigrationApply":
    case "editorPreview":
    case "baselineRetain":
    case "assetExtract":
    case "assetImport":
    case "rebaseReview":
    case "rebaseRefresh":
    case "rebaseAccept":
    case "sourceDetach":
    case "sourceRestore":
    case "sourceImport":
    case "modificationCreate":
    case "modificationBuild":
    case "modificationDerive": {
      const loader = new NodePluginLoader();
      const options = {
        signal,
        onProgress: (message: string) => progress({ message }),
        loadEnvironment: (configFile: string) =>
          loader.loadProjectEnvironment({
            cwd: path.dirname(configFile),
            configFile,
            bundledPlugins: new Map([["@uttori/asm-plugin-snes", snesPlugin]]),
          }),
      };
      try {
        if (job.operation === "metadataMigrationApply") {
          return await applyMetadataMigration({ ...job.input, ...options });
        }
        if (job.operation === "editorPreview") {
          return await previewRomEditor({ ...job.input, ...options });
        }
        if (job.operation === "baselineRetain") {
          return await retainRomModificationBaseline({ ...job.input, ...options });
        }
        if (job.operation === "assetExtract") {
          return await extractRomAsset({ ...job.input, ...options });
        }
        if (job.operation === "assetImport") {
          return await importRomAsset({ ...job.input, ...options });
        }
        if (job.operation === "rebaseReview") {
          return await reviewRomRebase({ ...job.input, ...options });
        }
        if (job.operation === "rebaseRefresh") {
          return await refreshRomRebaseReview({ ...job.input, ...options });
        }
        if (job.operation === "rebaseAccept") {
          return await acceptRomRebase({ ...job.input, ...options });
        }
        if (job.operation === "sourceDetach") {
          return await detachRomSource({ ...job.input, ...options });
        }
        if (job.operation === "sourceRestore") {
          return await restoreReviewedSource({ ...job.input, ...options });
        }
        if (job.operation === "sourceImport") {
          return await importReviewedSource({ ...job.input, ...options });
        }
        if (job.operation === "modificationCreate") {
          return await createRomModificationProject({ ...job.input, ...options });
        }
        if (job.operation === "modificationDerive") {
          return await deriveModifiedRomProject({ ...job.input, ...options });
        }
        return await buildModifiedRom({ ...job.input, ...options });
      } finally {
        await loader.dispose();
      }
    }
    case "publish":
      return publishVerifiedSource(job.input, signal, (message) => progress({ message }));
    case "refreshEligible":
      return canRefreshMetadata(job.input);
    case "publicationStatus":
      return readSourcePublication(job.input.sourceDirectory);
    case "recover": {
      const lease = acquireEditLease(job.input.projectDirectory);
      let sourceLease: ReturnType<typeof acquireFileLease> | undefined;
      try {
        sourceLease = acquireFileLease(
          path.join(job.input.sourceDirectory, ".uttori-publication.lock"),
        );
        return recoverSourceGeneration(job.input.sourceDirectory);
      } finally {
        sourceLease?.release();
        lease.release();
      }
    }
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
        onProgress: ({ message, processedObservations }) =>
          progress({ message, processedObservations }),
      });
    case "export":
      return (await publishVerifiedSource(job.input, signal, (message) => progress({ message })))
        .exported;
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
        if (revision !== receipt.after) {
          return undefined;
        }
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
      return (
        await publishVerifiedSource(
          target,
          signal,
          (message) => progress({ message }),
          receipt.after,
        )
      ).exported;
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
    case "verify": {
      const loader = new NodePluginLoader();
      try {
        return await verifySnesProjectRoundTrip({
          ...job.input,
          signal,
          onProgress: ({ message }) => progress({ message }),
          // Load only after the verifier validates the export and ROM. The bundled map
          // resolves SNES in packaged workers; custom modules remain relative to the
          // source configuration, matching CLI assembly rather than the worker's cwd.
          loadEnvironment: (configFile) =>
            loader.loadProjectEnvironment({
              cwd: path.resolve(job.input.sourceDirectory),
              configFile,
              bundledPlugins: new Map([["@uttori/asm-plugin-snes", snesPlugin]]),
            }),
        });
      } finally {
        // The verifier disposes its assembler session first, including on conversion failure.
        await loader.dispose();
      }
    }
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
          onStage: (message) => progress({ message }),
        },
      );
    }
  }
  throw new Error("Unknown disassembly maintenance operation.");
};
