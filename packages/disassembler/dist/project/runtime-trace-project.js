import { createRuntimeRecordValidator, validateLoadedShards } from "../model/project-validation.js";
import { createRuntimeCaptureSource } from "../runtime/capture-instruction-source.js";
import { mergeRuntimeEvidence } from "../runtime/runtime-evidence.js";
import { createRuntimeInstructionTraceImporter, } from "../runtime/runtime-trace.js";
import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision, assertAnalysisProjectRevision, } from "./project-transaction.js";
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
export const importRuntimeTraceIntoProject = async (file, directory, context, options = {}) => {
    const source = await createRuntimeCaptureSource(file, options);
    return importRuntimeTraceSourceIntoProject(source, directory, context, options);
};
/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push. Distinct facts use the existing SQLite index and atomic publication path.
 * The caller owns the source and its cancellation behavior. This function closes its SQLite connection.
 * Cancellation is cooperative at read/merge boundaries, not preemptive during synchronous finalization.
 * Storage-policy changes and post-commit pointer failures follow importRuntimeTraceIntoProject.
 * @param {RuntimeTraceSource} source Ordered reader that rejects any invalid or incomplete envelope.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Expected ROM, source name and index budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation and progress. Byte limits belong to the source.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed facts. Reader failures publish nothing.
 */
export const importRuntimeTraceSourceIntoProject = async (source, directory, context, options = {}) => {
    options.signal?.throwIfAborted();
    const store = openAnalysisProjectStore(directory);
    try {
        if (store.researchInputsIdentity() !== options.research?.hash) {
            throw new Error("Refresh the selected Git research index before importing evidence.");
        }
        if (options.storagePolicy) {
            store.transaction(() => store.setStoragePolicy(options.storagePolicy));
        }
        const beforeStorage = store.storageSnapshot();
        let retainedReport;
        const manifest = store.transaction(() => store.manifest(), false);
        const expected = analysisProjectRevision(manifest);
        // NES payload hashes omit the header that determines the mapper and trainer layout.
        if (manifest.target === "65xx.nes" && source.metadata.romFileSha256 !== manifest.rom.sha256) {
            throw new Error("NES capture full-file identity does not match the original cartridge header and payload.");
        }
        if (manifest.rom.contentSha256 !== context.projectRomContentSha256) {
            throw new Error("ROM/project mismatch: destination project does not match the trace import context.");
        }
        const execution = [];
        let addedRuntime = 0;
        let publication;
        let validate;
        options.onStage?.("Indexing trace facts in SQLite…");
        options.signal?.throwIfAborted();
        const importer = await store.indexTrace(async (index) => {
            const traceImporter = createRuntimeInstructionTraceImporter(source.metadata, context, {
                index,
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
                    validate ??= createRuntimeRecordValidator(manifest, record.evidence.map((id) => ({
                        id,
                        source: "runtime",
                        sourceId: "instruction-trace",
                        confidence: "certain",
                    })), false);
                    validate(record);
                    if (publication?.add(record)) {
                        addedRuntime++;
                    }
                    if (record.kind === "runtime-execution") {
                        execution.push(record);
                    }
                },
            });
            await source.read((chunk) => {
                options.signal?.throwIfAborted();
                traceImporter.push(chunk);
            });
            return traceImporter;
        });
        options.onStage?.("Validating destination revision before publication…");
        options.signal?.throwIfAborted();
        const result = store.transaction(() => {
            options.assertResearchCurrent?.();
            assertAnalysisProjectRevision(store, expected);
            options.onStage?.("Finalizing and merging runtime facts into SQLite…");
            options.signal?.throwIfAborted();
            let imported;
            try {
                imported = importer.finish();
                // Provisional records can still be buffered when finish returns. Flush them before
                // provenance/revision publication so a SQL failure rolls back the entire source.
                publication?.finish();
            }
            finally {
                validate?.close();
            }
            options.onStage?.("Validating merged runtime provenance…");
            // Trace imports only change these two small metadata collections. Never materialize or
            // rewrite annotations and CFG records merely to append runtime provenance.
            const base = {
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
                    merged = mergeRuntimeEvidence({ ...base, evidence: store.loadTable("evidence") }, retainedReport ? {} : imported.batch);
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
        const maintenanceWarnings = [];
        // These actions follow COMMIT. A reader lock, disk error or cancellation callback must not
        // report a failed import after its durable counts and provenance have already been published.
        try {
            options.onStage?.("Runtime import committed. Project pointer updated.");
            options.onStage?.("Recycling SQLite caches and WAL…");
            checkpointBusy = store.maintainStorage().checkpointBusy;
        }
        catch (error) {
            maintenanceWarnings.push(`Trace import committed. Storage maintenance deferred: ${String(error)}`);
        }
        const afterStorage = store.storageSnapshot();
        const newFacts = afterStorage.facts - beforeStorage.facts;
        return {
            ...result,
            storage: {
                before: beforeStorage,
                after: afterStorage,
                newFacts,
                reusedFacts: Math.max(0, afterStorage.observations - beforeStorage.observations - newFacts),
                checkpointBusy,
            },
            warnings: [
                ...maintenanceWarnings,
                ...(retainedReport
                    ? [
                        "This capture has historical reduced-index facts. Its existing facts and counts were preserved; reimport did not restore omitted registers.",
                    ]
                    : []),
            ],
        };
    }
    finally {
        store.close();
    }
};
/** Publish a combined offline batch without expanding the destination runtime history.
 * @param {string} directory Existing SQL project root.
 * @param {AnalysisProjectRevision} expected Revision used to verify the import ROM/mapper.
 * @param {RuntimeEvidenceBatch} batch Validated importer output. Stable-ID conflicts roll back the entire batch.
 * @returns {object} Atomic import changes and counts.
 */
export const commitRuntimeEvidenceBatch = (directory, expected, batch) => {
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
    }
    finally {
        store.close();
    }
};
//# sourceMappingURL=runtime-trace-project.js.map