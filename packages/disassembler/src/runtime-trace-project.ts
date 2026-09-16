import {
  archiveImportedCapture,
  captureFileIdentity,
  expireCaptureArchives,
  type CaptureArchiveResult,
} from "./capture-archives.js";
import { openAnalysisProjectStore } from "./project-store.js";
import {
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  type AnalysisProjectRevision,
} from "./project-transaction.js";
import {
  type AnalysisProjectShards,
  type RuntimeExecutionRecord,
  type ImportReport,
} from "./project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "./project-validation.js";
import { mergeRuntimeEvidence, type RuntimeEvidenceBatch } from "./runtime-evidence.js";
import {
  createRuntimeTraceFileSource,
  type RuntimeTraceFileOptions,
} from "./runtime-trace-file.js";
import {
  createRuntimeInstructionTraceImporter,
  type RuntimeInstructionTraceImportContext,
  type RuntimeInstructionTraceImportResult,
  type RuntimeTraceSource,
  type RuntimeTraceImporterStorage,
} from "./runtime-trace.js";
import type { AnalysisStoragePolicy, AnalysisStorageSnapshot } from "./sqlite-storage-policy.js";

/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
  /** Optional original file for a managed archive; decoded in-memory sources may omit it. */
  readonly archiveSourceFile?: string;
  readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
  readonly onStage?: (message: string) => void;
  /** Counts validated records merged so far; all remain provisional until publication commits. */
  readonly onMergeProgress?: RuntimeTraceImporterStorage["onMergeProgress"];
}

/** Compact import result; complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<
  RuntimeInstructionTraceImportResult,
  "batch"
> {
  readonly storage: {
    readonly before: AnalysisStorageSnapshot;
    readonly after: AnalysisStorageSnapshot;
    readonly newFacts: number;
    readonly reusedFacts: number;
    readonly checkpointBusy: boolean;
  };
  readonly archive: CaptureArchiveResult;
  readonly warnings: readonly string[];
  readonly execution: readonly RuntimeExecutionRecord[];
  readonly changed: boolean;
  readonly added: { readonly runtime: number; readonly evidence: number };
}

/**
 * Stream capture chunks into connection-local counters, then publish final runtime facts,
 * provenance and revision in one write transaction. Failed parsing, cancellation, stale readers,
 * ROM mismatch and conflicting stable IDs leave the entire project unchanged.
 * @param {string} file Native instruction trace path.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Required ROM identity and requested indexing profile.
 * @param {RuntimeTraceProjectImportOptions} [options] Input budget, progress callbacks and cancellation signal.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed counts and execution seeds; failures publish nothing.
 */
export const importRuntimeTraceIntoProject = async (
  file: string,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions = {},
): Promise<RuntimeTraceProjectImportResult> => {
  const source = await createRuntimeTraceFileSource(file, options);
  return importRuntimeTraceSourceIntoProject(source, directory, context, {
    ...options,
    archiveSourceFile: options.archiveSourceFile ?? file,
  });
};

/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push; distinct facts use the existing SQLite index and atomic publication path.
 * @param {RuntimeTraceSource} source Ordered reader that rejects any invalid or incomplete envelope.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Expected ROM, source name and index budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation and progress; byte limits belong to the source.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed facts; reader failures publish nothing.
 */
export const importRuntimeTraceSourceIntoProject = async (
  source: RuntimeTraceSource,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions = {},
): Promise<RuntimeTraceProjectImportResult> => {
  options.signal?.throwIfAborted();
  const archiveIdentity = options.archiveSourceFile
    ? captureFileIdentity(options.archiveSourceFile)
    : undefined;
  const store = openAnalysisProjectStore(directory);
  try {
    if (options.storagePolicy)
      store.transaction(() => store.setStoragePolicy(options.storagePolicy!));
    const beforeStorage = store.storageSnapshot();
    let retainedReport: ImportReport | undefined;
    const manifest = store.transaction(() => store.manifest(), false);
    const expected = analysisProjectRevision(manifest);
    if (manifest.rom.contentSha256 !== context.projectRomContentSha256)
      throw new Error(
        "ROM/project mismatch: destination project does not match the trace import context.",
      );
    const execution: RuntimeExecutionRecord[] = [];
    let addedRuntime = 0;
    let validate: ReturnType<typeof createRuntimeRecordValidator> | undefined;
    options.onStage?.("Indexing trace facts in SQLite…");
    options.signal?.throwIfAborted();
    const importer = await store.indexTrace(async (index) => {
      const importer = createRuntimeInstructionTraceImporter(source.metadata, context, {
        index,
        onMergeProgress: options.onMergeProgress,
        onSource: (sha256, profile) => {
          const receipt = store.captureReceipt(sha256);
          // A converted/expired capture cannot restore old full rows or double-count lifetime evidence.
          // Same-profile imports still repair missing rows with ordinary stable-ID checks.
          if (receipt && receipt.profile !== profile) {
            retainedReport = store
              .loadTable("imports")
              .find((report) => report.sourceSha256 === sha256);
            if (!retainedReport)
              throw new Error("Capture receipt has no retained import provenance.");
          }
        },
        onRecord: (record) => {
          options.signal?.throwIfAborted();
          // finish() assigns one source identity to every emitted fact; its complete provenance
          // is validated below before commit. SQLite and the counter index guarantee unique IDs.
          validate ??= createRuntimeRecordValidator(
            manifest,
            record.evidence.map((id) => ({
              id,
              source: "runtime",
              sourceId: "instruction-trace",
              confidence: "certain",
            })),
            false,
          );
          validate(record);
          if (!retainedReport && store.insertRuntime(record)) addedRuntime++;
          if (record.kind === "runtime-execution") execution.push(record);
        },
      });
      await source.read((chunk) => {
        options.signal?.throwIfAborted();
        importer.push(chunk);
      });
      return importer;
    });
    options.onStage?.("Validating destination revision before publication…");
    options.signal?.throwIfAborted();
    const result = store.transaction(() => {
      assertAnalysisProjectRevision(store, expected);
      options.onStage?.("Finalizing and merging runtime facts into SQLite…");
      options.signal?.throwIfAborted();
      let imported: RuntimeInstructionTraceImportResult;
      try {
        imported = importer.finish();
      } finally {
        validate?.close();
      }
      options.onStage?.("Validating merged runtime provenance…");
      // Trace imports only change these two small metadata collections. Never materialize or
      // rewrite annotations and CFG records merely to append runtime provenance.
      const base: AnalysisProjectShards = {
        analysis: [],
        annotations: [],
        labels: [],
        comments: [],
        regions: [],
        runtime: [],
        evidence: store.loadTable("evidence"),
        imports: store.loadTable("imports"),
      };
      const merged = mergeRuntimeEvidence(base, retainedReport ? {} : imported.batch);
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        options.onStage?.("Publishing runtime provenance and project revision…");
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
      }
      store.recordCaptureReceipt(retainedReport ?? imported.report);
      options.signal?.throwIfAborted();
      options.onStage?.("Committing runtime import transaction…");
      return {
        report: retainedReport ?? imported.report,
        sourceSha256: imported.sourceSha256,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        execution: execution.sort((a, b) => a.address - b.address),
        changed,
        added: { runtime: addedRuntime, evidence: merged.added.evidence },
      };
    });
    if (result.changed) store.writePointer(directory);
    let archive: CaptureArchiveResult = { archived: false, expired: [], warnings: [] };
    let checkpointBusy = false;
    const maintenanceWarnings: string[] = [];
    // These actions follow COMMIT. A reader lock, disk error or cancellation callback must not
    // report a failed import after its durable counts and provenance have already been published.
    try {
      options.onStage?.("Runtime import committed; project pointer updated.");
      options.onStage?.("Maintaining optional capture archives…");
      archive =
        options.archiveSourceFile && archiveIdentity
          ? await archiveImportedCapture(
              store,
              result.sourceSha256,
              options.archiveSourceFile,
              archiveIdentity,
            )
          : { archived: false, ...expireCaptureArchives(store) };
      options.onStage?.("Recycling SQLite caches and WAL…");
      checkpointBusy = store.maintainStorage().checkpointBusy;
    } catch (error) {
      maintenanceWarnings.push(
        `Trace import committed; storage maintenance deferred: ${String(error)}`,
      );
    }
    const afterStorage = store.storageSnapshot();
    const newFacts = afterStorage.facts - beforeStorage.facts;
    return {
      ...result,
      archive,
      storage: {
        before: beforeStorage,
        after: afterStorage,
        newFacts,
        reusedFacts: Math.max(0, afterStorage.observations - beforeStorage.observations - newFacts),
        checkpointBusy,
      },
      warnings: [
        ...archive.warnings,
        ...maintenanceWarnings,
        ...(retainedReport
          ? [
              "This capture was already imported with a different profile; its retained facts and counts were reused.",
            ]
          : []),
      ],
    };
  } finally {
    store.close();
  }
};

/** Publish a combined offline batch without expanding the destination runtime history.
 * @param {string} directory Existing SQL project root.
 * @param {AnalysisProjectRevision} expected Revision used to verify the import ROM/mapper.
 * @param {RuntimeEvidenceBatch} batch Validated importer output; stable-ID conflicts roll back the entire batch.
 * @returns {object} Atomic import changes and counts.
 */
export const commitRuntimeEvidenceBatch = (
  directory: string,
  expected: AnalysisProjectRevision,
  batch: RuntimeEvidenceBatch,
) => {
  const store = openAnalysisProjectStore(directory);
  try {
    const result = store.transaction(() => {
      assertAnalysisProjectRevision(store, expected);
      const result = store.mergeEvidenceBatch(batch);
      if (result.changed) store.publishManifest(store.manifest());
      return result;
    });
    if (result.changed) store.writePointer(directory);
    return result;
  } finally {
    store.close();
  }
};
