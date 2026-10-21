import { createHash } from "node:crypto";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import {
  type AnalysisProjectShards,
  type RuntimeExecutionRecord,
  type ImportReport,
} from "../model/project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "../model/project-validation.js";
import type { ResearchSnapshot } from "../research-inputs/inputs.js";
import { createRuntimeCaptureSource } from "../runtime/capture-instruction-source.js";
import { mergeRuntimeEvidence, type RuntimeEvidenceBatch } from "../runtime/runtime-evidence.js";
import { type RuntimeTraceFileOptions } from "../runtime/runtime-trace-file.js";
import {
  createRuntimeInstructionTraceImporter,
  type RuntimeInstructionTraceImportContext,
  type RuntimeInstructionTraceImportResult,
  type RuntimeTraceSource,
  type RuntimeTraceImporterStorage,
} from "../runtime/runtime-trace.js";
import type {
  AnalysisStoragePolicy,
  AnalysisStorageSnapshot,
} from "../storage/sqlite-storage-policy.js";
import { SqliteTraceStage } from "../storage/sqlite-trace-stage.js";
import { openAnalysisProjectStore } from "./project-store.js";
import {
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  type AnalysisProjectRevision,
} from "./project-transaction.js";

/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
  /** Selected Git authoring snapshot, already indexed before asynchronous capture parsing. */
  readonly research?: ResearchSnapshot;
  /** Recheck branch/file selection under the publication lock; a throw publishes no capture facts. */
  readonly assertResearchCurrent?: () => void;
  /** Instruction imports save this before indexing. Bus imports save it with the final publication. */
  readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
  /** Synchronous status callback. A throw before commit aborts the import, after commit it is a warning. */
  readonly onStage?: (message: string) => void;
  /** Counts validated records merged so far. All remain provisional until publication commits. */
  readonly onMergeProgress?: RuntimeTraceImporterStorage["onMergeProgress"];
  /**
   * Optional complete-archive cache identity, including companion manifest and importer version.
   * verify must recheck that identity after parsing; cached reuse also rechecks present companions.
   * Prefix recovery is never cached. Counters are disposable and removed after successful publication.
   */
  readonly validatedIndex?: {
    /** Private disposable storage, normally under the source project's .uttori-local directory. */
    readonly directory: string;
    readonly identity: string;
    readonly verify: () => Promise<void>;
  };
}

/** Compact import result. Complete runtime records remain in the SQLite working store. */
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
  readonly warnings: readonly string[];
  readonly execution: readonly RuntimeExecutionRecord[];
  readonly changed: boolean;
  readonly added: { readonly runtime: number; readonly evidence: number };
}

/**
 * Stream capture chunks into connection-local counters, then publish final runtime facts,
 * provenance and revision in one write transaction. Failed parsing, cancellation, stale readers,
 * ROM mismatch and conflicting stable IDs leave previously published facts and revision unchanged.
 * An explicit storage policy is saved separately before import. The input file is never moved or deleted.
 * A pointer-file error can reject after SQLite has committed. Reopen the project before retrying.
 * @param {string} file Native instruction trace path.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Required ROM identity and requested indexing profile.
 * @param {RuntimeTraceProjectImportOptions} [options] Input budget, progress callbacks and cancellation signal.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed counts, execution seeds, and maintenance warnings.
 */
export const importRuntimeTraceIntoProject = async (
  file: string,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions = {},
): Promise<RuntimeTraceProjectImportResult> => {
  const source = await createRuntimeCaptureSource(file, options);
  return importRuntimeTraceSourceIntoProject(source, directory, context, options);
};

/** Same committed evidence and exact per-import counts, without scanning all historical storage rows. */
type CompactRuntimeTraceProjectImportResult = Omit<RuntimeTraceProjectImportResult, "storage">;

/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push. Distinct facts use the existing SQLite index and atomic publication path.
 * The caller owns the source and its cancellation behavior. This function closes its SQLite connection.
 * Cancellation is cooperative at read/merge boundaries, not preemptive during synchronous finalization.
 * Storage-policy changes and post-commit pointer failures follow importRuntimeTraceIntoProject.
 * storageStatistics:false omits global storage accounting; validation and exact per-import counts remain.
 * @param {RuntimeTraceSource} source Ordered reader that verifies completion or supplies explicit prefix recovery metadata.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Expected ROM, source name and index budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation and progress. Byte limits belong to the source.
 * @returns {Promise} Committed facts and requested storage accounting. Reader failures publish nothing.
 */
export function importRuntimeTraceSourceIntoProject(
  source: RuntimeTraceSource,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions & { readonly storageStatistics: false },
): Promise<CompactRuntimeTraceProjectImportResult>;
export function importRuntimeTraceSourceIntoProject(
  source: RuntimeTraceSource,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options?: RuntimeTraceProjectImportOptions & { readonly storageStatistics?: true },
): Promise<RuntimeTraceProjectImportResult>;
export function importRuntimeTraceSourceIntoProject(
  source: RuntimeTraceSource,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions & { readonly storageStatistics: boolean },
): Promise<RuntimeTraceProjectImportResult | CompactRuntimeTraceProjectImportResult>;
export async function importRuntimeTraceSourceIntoProject(
  source: RuntimeTraceSource,
  directory: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceProjectImportOptions & { readonly storageStatistics?: boolean } = {},
): Promise<RuntimeTraceProjectImportResult | CompactRuntimeTraceProjectImportResult> {
  options.signal?.throwIfAborted();
  const store = openAnalysisProjectStore(directory);
  let stage: SqliteTraceStage | undefined;
  try {
    if (store.researchInputsIdentity() !== options.research?.hash) {
      throw new Error("Refresh the selected Git research index before importing evidence.");
    }
    if (options.storagePolicy) {
      store.transaction(() => store.setStoragePolicy(options.storagePolicy!));
    }
    // Global deduplication/accounting sweeps are diagnostics, not import validation. Native
    // workflows need the exact committed per-source counts and can avoid two full-history scans.
    const beforeStorage = options.storageStatistics === false ? undefined : store.storageSnapshot();
    let retainedReport: ImportReport | undefined;
    const manifest = store.transaction(() => store.manifest(), false);
    const expected = analysisProjectRevision(manifest);
    // NES payload hashes omit the header that determines the mapper and trainer layout.
    if (manifest.target === "65xx.nes" && source.metadata.romFileSha256 !== manifest.rom.sha256) {
      throw new Error(
        "NES capture full-file identity does not match the original cartridge header and payload.",
      );
    }
    if (manifest.rom.contentSha256 !== context.projectRomContentSha256) {
      throw new Error(
        "ROM/project mismatch: destination project does not match the trace import context.",
      );
    }
    const execution: RuntimeExecutionRecord[] = [];
    let addedRuntime = 0;
    let publication: ReturnType<typeof store.runtimeTracePublicationSink> | undefined;
    let validate: ReturnType<typeof createRuntimeRecordValidator> | undefined;
    if (options.validatedIndex && !options.recoverPartial) {
      // This cache format binds both parser semantics and the full indexing context. A project
      // revision is deliberately excluded: a stale publication must reuse its validated source.
      const key = createHash("sha256")
        .update(
          canonicalJson({
            version: 1,
            identity: options.validatedIndex.identity,
            metadata: source.metadata,
            context,
          }),
        )
        .digest("hex");
      stage = new SqliteTraceStage(path.join(options.validatedIndex.directory, `${key}.sqlite`));
      if (stage.checkpoint) {
        await options.validatedIndex.verify();
        await source.verifyRetained?.();
        options.onStage?.("Reusing validated trace index; archive decoding and indexing skipped.");
      }
    }
    if (!stage?.checkpoint) {
      options.onStage?.("Decoding, validating and indexing trace facts in SQLite…");
    }
    options.signal?.throwIfAborted();
    const importer = await store.indexTrace(
      async (index) => {
        const traceImporter = createRuntimeInstructionTraceImporter(source.metadata, context, {
          index,
          checkpoint: stage?.checkpoint,
          onMergeProgress: options.onMergeProgress,
          onSource: (sha256, profile) => {
            const receipt = store.captureReceipt(sha256);
            // Older Secret of Mana projects retain receipts from reduced indexes. Preserve their
            // existing facts and provenance on reimport; mixing full variants would double-count them.
            // Current full imports still repair missing rows with ordinary stable-ID checks.
            if (receipt && receipt.profile !== profile) {
              retainedReport = store
                .loadTable("imports")
                .find((report) => report.sourceSha256 === sha256);
              if (!retainedReport) {
                throw new Error("Capture receipt has no retained import provenance.");
              }
            }
            if (!retainedReport) {
              // The source hash is final only after the complete stream validates. Prepare the
              // fresh-source fast path under the publication lock, keeping retries collision-safe.
              publication = store.runtimeTracePublicationSink(sha256);
            }
          },
          onRecord: (record) => {
            options.signal?.throwIfAborted();
            // finish() assigns one source identity to every emitted fact. Its complete provenance
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
            if (publication?.add(record)) {
              addedRuntime++;
            }
            if (record.kind === "runtime-execution") {
              execution.push(record);
            }
          },
        });
        if (!stage?.checkpoint) {
          await source.read((chunk) => {
            options.signal?.throwIfAborted();
            traceImporter.push(chunk);
          });
          if (stage && options.validatedIndex && !source.recovery) {
            await options.validatedIndex.verify();
            options.signal?.throwIfAborted();
            stage.seal(traceImporter.checkpoint(source.recovery));
          }
        }
        return traceImporter;
      },
      undefined,
      stage,
    );
    if (stage && !source.recovery) {
      options.onStage?.(
        "Validated trace index saved; retries can reuse it until publication succeeds.",
      );
    }
    options.onStage?.("Validating destination revision before publication…");
    options.signal?.throwIfAborted();
    const result = store.transaction(() => {
      options.assertResearchCurrent?.();
      assertAnalysisProjectRevision(store, expected);
      options.onStage?.("Finalizing and merging runtime facts into SQLite…");
      options.signal?.throwIfAborted();
      let imported: RuntimeInstructionTraceImportResult;
      try {
        imported = importer.finish(source.recovery);
        // Provisional records can still be buffered when finish returns. Flush them before
        // provenance/revision publication so a SQL failure rolls back the entire source.
        publication?.finish();
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
      let merged = mergeRuntimeEvidence(base, retainedReport ? {} : imported.batch);
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        if (options.research) {
          // Imported provenance belongs underneath Git decisions. Recompute against observations
          // after restoring the overlay, then reapply it in this same atomic transaction.
          store.suspendResearchInputs();
          merged = mergeRuntimeEvidence(
            { ...base, evidence: store.loadTable("evidence") },
            retainedReport ? {} : imported.batch,
          );
          validateLoadedShards(merged.shards, manifest);
        }
        options.onStage?.("Publishing runtime provenance and project revision…");
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
        if (options.research) {
          store.synchronizeResearchInputs(options.research);
          store.invalidateAnalysis();
        }
      }
      store.recordCaptureReceipt(retainedReport ?? imported.report);
      options.signal?.throwIfAborted();
      options.onStage?.("Committing runtime import transaction…");
      return {
        report: retainedReport ?? imported.report,
        sourceSha256: imported.sourceSha256,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        execution: execution.toSorted((a, b) => a.address - b.address),
        changed,
        added: { runtime: addedRuntime, evidence: merged.added.evidence },
      };
    });
    if (result.changed) {
      store.writePointer(directory);
    }
    let checkpointBusy = false;
    const maintenanceWarnings: string[] = [];
    if (stage) {
      const completedStage = stage;
      stage = undefined;
      try {
        completedStage.close(true);
      } catch (error) {
        maintenanceWarnings.push(
          `Trace import committed. Validated index cleanup deferred: ${String(error)}`,
        );
      }
    }
    // These actions follow COMMIT. A reader lock, disk error or cancellation callback must not
    // report a failed import after its durable counts and provenance have already been published.
    try {
      options.onStage?.("Runtime import committed. Project pointer updated.");
      options.onStage?.("Recycling SQLite caches and WAL…");
      checkpointBusy = store.maintainStorage().checkpointBusy;
    } catch (error) {
      maintenanceWarnings.push(
        `Trace import committed. Storage maintenance deferred: ${String(error)}`,
      );
    }
    const compact = {
      ...result,
      warnings: [
        ...maintenanceWarnings,
        ...(source.recovery ? result.report.warnings : []),
        ...(retainedReport
          ? [
              "This capture has historical reduced-index facts. Its existing facts and counts were preserved; reimport did not restore omitted registers.",
            ]
          : []),
      ],
    };
    if (!beforeStorage) {
      return compact;
    }
    const afterStorage = store.storageSnapshot();
    const newFacts = afterStorage.facts - beforeStorage.facts;
    return {
      ...compact,
      storage: {
        before: beforeStorage,
        after: afterStorage,
        newFacts,
        reusedFacts: Math.max(0, afterStorage.observations - beforeStorage.observations - newFacts),
        checkpointBusy,
      },
    };
  } finally {
    try {
      stage?.close();
    } finally {
      store.close();
    }
  }
}

/** Publish a combined offline batch without expanding the destination runtime history.
 * @param {string} directory Existing SQL project root.
 * @param {AnalysisProjectRevision} expected Revision used to verify the import ROM/mapper.
 * @param {RuntimeEvidenceBatch} batch Validated importer output. Stable-ID conflicts roll back the entire batch.
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
      const merged = store.mergeEvidenceBatch(batch);
      if (merged.changed) {
        store.publishManifest(store.manifest());
      }
      return merged;
    });
    if (result.changed) {
      store.writePointer(directory);
    }
    return result;
  } finally {
    store.close();
  }
};
