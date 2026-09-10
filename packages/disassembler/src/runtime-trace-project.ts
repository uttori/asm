import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision, assertAnalysisProjectRevision } from "./project-transaction.js";
import { type AnalysisProjectShards, type RuntimeExecutionRecord } from "./project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "./project-validation.js";
import { mergeRuntimeEvidence } from "./runtime-evidence.js";
import {
  readRuntimeTraceFileChunks,
  readRuntimeTraceFileMetadata,
  type RuntimeTraceFileOptions,
} from "./runtime-trace-file.js";
import {
  createRuntimeInstructionTraceImporter,
  type RuntimeInstructionTraceImportContext,
  type RuntimeInstructionTraceImportResult,
} from "./runtime-trace.js";

/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
  readonly onStage?: (message: string) => void;
}

/** Compact import result; complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<
  RuntimeInstructionTraceImportResult,
  "batch"
> {
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
  options.signal?.throwIfAborted();
  const store = openAnalysisProjectStore(directory);
  try {
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
    const metadata = await readRuntimeTraceFileMetadata(file, options);
    const importer = await store.indexTrace(async (index) => {
      const importer = createRuntimeInstructionTraceImporter(metadata, context, {
        index,
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
          if (store.insertRuntime(record)) addedRuntime++;
          if (record.kind === "runtime-execution") execution.push(record);
        },
      });
      for await (const chunk of readRuntimeTraceFileChunks(file, metadata, options))
        importer.push(chunk);
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
      const merged = mergeRuntimeEvidence(base, imported.batch);
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
      }
      options.signal?.throwIfAborted();
      return {
        report: imported.report,
        sourceSha256: imported.sourceSha256,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        execution: execution.sort((a, b) => a.address - b.address),
        changed,
        added: { runtime: addedRuntime, evidence: merged.added.evidence },
      };
    });
    if (result.changed) store.writePointer(directory);
    return result;
  } finally {
    store.close();
  }
};
