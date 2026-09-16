import path from "node:path";

import {
  archiveImportedCapture,
  captureFileIdentity,
  expireCaptureArchives,
  type CaptureArchiveResult,
} from "./capture-archives.js";
import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision, assertAnalysisProjectRevision } from "./project-transaction.js";
import type { AnalysisProjectShards } from "./project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "./project-validation.js";
import {
  createRuntimeBusTraceImporter,
  type RuntimeBusTraceSource,
  type RuntimeBusTraceImportContext,
  type RuntimeBusTraceImportResult,
} from "./runtime-bus-trace.js";
import { mergeRuntimeEvidence } from "./runtime-evidence.js";
import type {
  RuntimeTraceProjectImportOptions,
  RuntimeTraceProjectImportResult,
} from "./runtime-trace-project.js";

/** Compact bus import response; distinct facts and raw history remain in the project store/archive. */
export interface RuntimeBusProjectImportResult extends Omit<RuntimeBusTraceImportResult, "batch"> {
  readonly storage: RuntimeTraceProjectImportResult["storage"];
  readonly archive: CaptureArchiveResult;
  readonly warnings: readonly string[];
  readonly changed: boolean;
  readonly added: { readonly runtime: number; readonly evidence: number };
}

/** Stage counters off heap and atomically publish only after the entire lossless stream validates.
 * @param {RuntimeBusTraceSource} source Bounded reader that rejects incomplete or changed captures.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeBusTraceImportContext} context Expected ROM identity and distinct-fact budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation, progress and optional archive retention.
 * @returns {Promise<RuntimeBusProjectImportResult>} Committed counts and bounded channel/phase activity.
 */
export const importRuntimeBusTraceSourceIntoProject = async (
  source: RuntimeBusTraceSource,
  directory: string,
  context: RuntimeBusTraceImportContext,
  options: RuntimeTraceProjectImportOptions = {},
): Promise<RuntimeBusProjectImportResult> => {
  options.signal?.throwIfAborted();
  const archiveIdentity = options.archiveSourceFile
    ? captureFileIdentity(options.archiveSourceFile)
    : undefined;
  const store = openAnalysisProjectStore(directory);
  try {
    const before = store.storageSnapshot();
    const manifest = store.transaction(() => store.manifest(), false);
    const expected = analysisProjectRevision(manifest);
    if (manifest.rom.contentSha256 !== context.projectRomContentSha256)
      throw new Error("ROM/project mismatch: destination does not match the bus import context.");
    let addedRuntime = 0;
    let completedArchiveIdentity: string | undefined;
    let validate: ReturnType<typeof createRuntimeRecordValidator> | undefined;
    let insert: ReturnType<typeof store.runtimeBatchInserter> | undefined;
    options.onStage?.("Indexing CPU/DMA/HDMA bus facts in SQLite…");
    const importer = await store.indexTrace(async (index) => {
      const importer = createRuntimeBusTraceImporter(source.metadata, context, {
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
          if (insert!(record)) addedRuntime++;
        },
      });
      await source.read((chunk) => {
        options.signal?.throwIfAborted();
        importer.push(chunk);
      });
      if (source.completedArchiveFile)
        completedArchiveIdentity = captureFileIdentity(source.completedArchiveFile);
      return importer;
    }, context.cacheMetrics?.index);
    options.onStage?.("Publishing validated bus activity…");
    options.signal?.throwIfAborted();
    const result = store.transaction(() => {
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
      const merged = mergeRuntimeEvidence(base, { ...imported.batch, imports: [report] });
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
      }
      // Policy changes belong to the same transaction: a failed capture cannot alter retention.
      if (options.storagePolicy) store.setStoragePolicy(options.storagePolicy);
      store.recordCaptureReceipt(report);
      // A live source publishes this path only after END2 and inode validation.
      // Preserve managed copies on reimport; external originals are never owned
      // or removed by project archive retention.
      if (source.completedArchiveFile) {
        if (captureFileIdentity(source.completedArchiveFile) !== completedArchiveIdentity)
          throw new Error("Completed live capture changed before publication.");
        if (store.captureReceipt(imported.sourceSha256)?.availability !== "managed")
          store.updateCaptureArchive(imported.sourceSha256, {
            originalPath: path.resolve(source.completedArchiveFile),
            bytes: 0,
            availability: "external",
          });
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
    if (result.changed) store.writePointer(directory);
    let archive: CaptureArchiveResult = { archived: false, expired: [], warnings: [] };
    let checkpointBusy = false;
    const warnings: string[] = [];
    // Optional archive/cache failures happen after durable publication; report them without
    // pretending the facts rolled back or asking the caller to import them again.
    try {
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
      checkpointBusy = store.maintainStorage().checkpointBusy;
    } catch (error) {
      warnings.push(`Bus import committed; storage maintenance deferred: ${String(error)}`);
    }
    const after = store.storageSnapshot();
    const newFacts = after.facts - before.facts;
    return {
      ...result,
      archive,
      warnings: [...archive.warnings, ...warnings],
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
