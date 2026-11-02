import fs from "node:fs";

import type { AnalysisProjectShards } from "../model/project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "../model/project-validation.js";
import {
  createRuntimeBusTraceImporter,
  type RuntimeBusTraceSource,
  type RuntimeBusTraceImportContext,
  type RuntimeBusTraceImportResult,
} from "../runtime/runtime-bus-trace.js";
import { mergeRuntimeEvidence } from "../runtime/runtime-evidence.js";
import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision, assertAnalysisProjectRevision } from "./project-transaction.js";
import type {
  RuntimeTraceProjectImportOptions,
  RuntimeTraceProjectImportResult,
} from "./runtime-trace-project.js";

/**
 * Detect replacement or mutation between live source validation and publication.
 * @param file Completed native capture path.
 * @returns Stable file identity, size and nanosecond timestamps.
 */
const captureFileIdentity = (file: string): string => {
  const stat = fs.statSync(file, { bigint: true });
  if (!stat.isFile()) {
    throw new Error("Capture input must be a regular file.");
  }
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};

/** Compact bus import response. Distinct facts remain in the project store and raw history in the source capture. */
export interface RuntimeBusProjectImportResult extends Omit<RuntimeBusTraceImportResult, "batch"> {
  /** Global storage accounting before and after publication, plus the post-commit WAL checkpoint state. */
  readonly storage: RuntimeTraceProjectImportResult["storage"];
  /** Post-commit maintenance notices; none indicate a failed import. */
  readonly warnings: readonly string[];
  /** Whether runtime facts or provenance were published; false leaves the revision and pointer untouched. */
  readonly changed: boolean;
  /** Runtime records and evidence entries new to the project in this import. */
  readonly added: { readonly runtime: number; readonly evidence: number };
}

/**
 * Stage counters off heap and atomically publish only after the entire lossless stream validates.
 * Owns and closes its SQLite connection, but does not own or delete the caller's source archive.
 * Cancellation is checked between chunks and records. Facts and requested storage limits roll back
 * together before commit. A pointer-file failure can reject after commit, so reopen before retrying.
 * @param source Bounded reader that rejects incomplete or changed captures.
 * @param directory Destination SQLite project root.
 * @param context Expected ROM identity and distinct-fact budget.
 * @param options Cancellation, progress and storage limits.
 * @returns Committed counts and bounded channel/phase activity.
 */
export const importRuntimeBusTraceSourceIntoProject = async (
  source: RuntimeBusTraceSource,
  directory: string,
  context: RuntimeBusTraceImportContext,
  options: RuntimeTraceProjectImportOptions = {},
): Promise<RuntimeBusProjectImportResult> => {
  options.signal?.throwIfAborted();
  const store = openAnalysisProjectStore(directory);
  try {
    if (store.researchInputsIdentity() !== options.research?.hash) {
      throw new Error("Refresh the selected Git research index before importing evidence.");
    }
    const before = store.storageSnapshot();
    const manifest = store.transaction(() => store.manifest(), false);
    const expected = analysisProjectRevision(manifest);
    if (manifest.rom.contentSha256 !== context.projectRomContentSha256) {
      throw new Error("ROM/project mismatch: destination does not match the bus import context.");
    }
    let addedRuntime = 0;
    let completedFileIdentity: string | undefined;
    let validate: ReturnType<typeof createRuntimeRecordValidator> | undefined;
    let insert: ReturnType<typeof store.runtimeBatchInserter> | undefined;
    options.onStage?.("Indexing CPU/DMA/HDMA bus facts in SQLite…");
    const importer = await store.indexTrace(async (index) => {
      const traceImporter = createRuntimeBusTraceImporter(source.metadata, context, {
        index,
        // finish() calls onSource before onRecord inside the publication transaction,
        // after the entire source validates. This keeps the one-time namespace
        // lookup protected by the same writer lock as the inserts it authorizes.
        onSource: (sha256) => {
          insert = store.runtimeBatchInserter(`runtime:bus-trace:${sha256}:`);
        },
        onRecord: (record) => {
          options.signal?.throwIfAborted();
          validate ??= createRuntimeRecordValidator(
            manifest,
            record.evidence.map((id) => ({
              id,
              source: "runtime",
              sourceId: "bus-trace",
              confidence: "certain",
            })),
            false,
          );
          // The batch path removes redundant existence queries, not validation:
          // every emitted record still crosses the project's normal trust boundary.
          validate(record);
          if (insert!(record)) {
            addedRuntime++;
          }
        },
      });
      await source.read((chunk) => {
        options.signal?.throwIfAborted();
        traceImporter.push(chunk);
      });
      if (source.completedFile) {
        completedFileIdentity = captureFileIdentity(source.completedFile);
      }
      return traceImporter;
    }, context.cacheMetrics?.index);
    options.onStage?.("Publishing validated bus activity…");
    options.signal?.throwIfAborted();
    const result = store.transaction(() => {
      options.assertResearchCurrent?.();
      assertAnalysisProjectRevision(store, expected);
      let imported: RuntimeBusTraceImportResult;
      try {
        // Even a known source must emit its full index: receipts can outlive pruned
        // observations, and retained rows may have conflicting counts or evidence.
        imported = importer.finish();
      } finally {
        validate?.close();
      }
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
      // A renamed copy is the same capture. Preserve its first import name instead of conflicting
      // with stable provenance IDs or incrementing lifetime observations a second time.
      const retained = base.imports.find((item) => item.id === imported.report.id);
      const report = {
        ...imported.report,
        sourceName: retained?.sourceName ?? imported.report.sourceName,
      };
      let merged = mergeRuntimeEvidence(base, { ...imported.batch, imports: [report] });
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        if (options.research) {
          // Preserve imported observations beneath the authoring overlay; a duplicate capture
          // leaves both the projection and project revision unchanged.
          store.suspendResearchInputs();
          merged = mergeRuntimeEvidence(
            { ...base, evidence: store.loadTable("evidence") },
            { ...imported.batch, imports: [report] },
          );
          validateLoadedShards(merged.shards, manifest);
        }
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
        if (options.research) {
          store.synchronizeResearchInputs(options.research);
          store.invalidateAnalysis();
        }
      }
      // Policy changes belong to the same transaction: a failed capture cannot alter storage limits.
      if (options.storagePolicy) {
        store.setStoragePolicy(options.storagePolicy);
      }
      store.recordCaptureReceipt(report);
      // A live source publishes this path only after END2 and inode validation.
      if (source.completedFile) {
        if (captureFileIdentity(source.completedFile) !== completedFileIdentity) {
          throw new Error("Completed live capture changed before publication.");
        }
      }
      options.signal?.throwIfAborted();
      return {
        report,
        sourceSha256: imported.sourceSha256,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        summary: imported.summary,
        changed,
        added: { runtime: addedRuntime, evidence: merged.added.evidence },
      };
    });
    if (result.changed) {
      store.writePointer(directory);
    }
    let checkpointBusy = false;
    const warnings: string[] = [];
    // Optional cache failures happen after durable publication. Report them without
    // pretending the facts rolled back or asking the caller to import them again.
    try {
      options.onStage?.("Recycling SQLite caches and WAL…");
      checkpointBusy = store.maintainStorage().checkpointBusy;
    } catch (error) {
      warnings.push(`Bus import committed. Storage maintenance deferred: ${String(error)}`);
    }
    const after = store.storageSnapshot();
    const newFacts = after.facts - before.facts;
    return {
      ...result,
      warnings,
      storage: {
        before,
        after,
        newFacts,
        reusedFacts: Math.max(0, after.observations - before.observations - newFacts),
        checkpointBusy,
      },
    };
  } finally {
    store.close();
  }
};
