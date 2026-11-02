import { createHash } from "node:crypto";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { TraceCache } from "../internal/trace-cache.js";
import { validateRuntimeInstructionDetails, } from "../model/trace-detail.js";
import { snesAnalysisTraceState, SNES_ANALYSIS_TRACE_PROFILE } from "./runtime-analysis-profile.js";
import { TraceChunkFormatter } from "./trace-chunk-formatter.js";
/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export const RUNTIME_INSTRUCTION_TRACE_FORMAT = "uttori-asm-instruction-trace";
/** Supported trace-artifact schema. Readers reject other revisions. */
export const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION = 1;
/** Default and maximum distinct-fact budget when counters or output records remain on the heap. */
export const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 8_000_000;
const MAX_RUNTIME_TRACE_INDEX_RECORDS = DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS;
function isRowRecord(value) {
    return !Array.isArray(value);
}
const record = (value, context) => {
    if (typeof value !== "object" || value === null || !isRowRecord(value)) {
        throw new Error(`${context} must be an object.`);
    }
    return value;
};
const string = (value, context) => {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${context} must be a non-empty string.`);
    }
    return value;
};
const integer = (value, context, minimum = 0) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
    }
    return value;
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256Identity = (value, context) => {
    const identity = string(value, context);
    if (!/^[\da-f]{64}$/.test(identity)) {
        throw new Error(`${context} must be a lowercase SHA-256 identity.`);
    }
    return identity;
};
const hex = (value) => value.toString(16).toUpperCase().padStart(6, "0");
/**
 * Validate the small trace envelope independently of its event stream.
 * @param {unknown} value Untrusted metadata.
 * @returns {RuntimeInstructionTraceMetadata} Normalized identity.
 */
export const validateRuntimeInstructionTraceMetadata = (value) => {
    const artifact = record(value, "Instruction trace artifact");
    if (artifact.format !== RUNTIME_INSTRUCTION_TRACE_FORMAT) {
        throw new Error(`Unsupported instruction trace format '${String(artifact.format)}'.`);
    }
    if (artifact.schemaVersion !== RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION) {
        throw new Error(`Unsupported instruction trace schema version '${String(artifact.schemaVersion)}'.`);
    }
    const producer = record(artifact.producer, "Instruction trace producer");
    return {
        format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
        schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
        architecture: string(artifact.architecture, "Instruction trace architecture"),
        addressSpace: string(artifact.addressSpace, "Instruction trace address space"),
        romContentSha256: sha256Identity(artifact.romContentSha256, "Instruction trace ROM content identity"),
        ...(artifact.romFileSha256 === undefined
            ? {}
            : { romFileSha256: sha256Identity(artifact.romFileSha256, "Trace full-file identity") }),
        producer: {
            id: string(producer.id, "Instruction trace producer id"),
            revision: string(producer.revision, "Instruction trace producer revision"),
        },
    };
};
/**
 * Create validation state spanning chunk boundaries without retaining earlier events.
 * @returns {(value: unknown) => RuntimeInstructionTraceChunk} Next-chunk validator.
 */
export const createRuntimeTraceChunkValidator = () => {
    let index = 0;
    let expectedSequence = 1;
    let previousDropped = 0;
    let stopped = false;
    let previousUnattributed = 0;
    return (value) => {
        const input = record(value, `Instruction trace chunk ${index}`);
        if (!Array.isArray(input.addresses)) {
            throw new Error(`Instruction trace chunk ${index} addresses must be an array.`);
        }
        if (typeof input.active !== "boolean") {
            throw new Error(`Instruction trace chunk ${index} active must be boolean.`);
        }
        const chunk = {
            // The validator owns this tree and emits canonical property order. The import hash can
            // stringify it directly without recursively sorting and copying every register again.
            active: input.active,
            addresses: input.addresses.map((address, addressIndex) => integer(address, `Instruction trace chunk ${index} address ${addressIndex}`)),
            ...(input.details === undefined
                ? {}
                : { details: validateRuntimeInstructionDetails(input.details, input.addresses.length) }),
            droppedEvents: integer(input.droppedEvents, `Instruction trace chunk ${index} droppedEvents`),
            sequenceStart: integer(input.sequenceStart, `Instruction trace chunk ${index} sequenceStart`, 1),
            ...(input.unattributedMemoryAccesses === undefined
                ? {}
                : {
                    unattributedMemoryAccesses: integer(input.unattributedMemoryAccesses, "Unattributed trace memory accesses"),
                }),
        };
        if ((chunk.unattributedMemoryAccesses ?? previousUnattributed) < previousUnattributed) {
            throw new Error("Unattributed trace memory count decreased.");
        }
        previousUnattributed = chunk.unattributedMemoryAccesses ?? previousUnattributed;
        if (stopped && chunk.active) {
            throw new Error(`Instruction trace chunk ${index} resumes after capture stopped.`);
        }
        if (chunk.sequenceStart < expectedSequence) {
            throw new Error(`Instruction trace chunk ${index} overlaps or reorders prior events.`);
        }
        const sequenceGap = chunk.sequenceStart - expectedSequence;
        const lossDelta = chunk.droppedEvents - previousDropped;
        if (lossDelta < 0 || sequenceGap !== lossDelta) {
            throw new Error(`Instruction trace chunk ${index} has inconsistent producer loss metadata.`);
        }
        expectedSequence = chunk.sequenceStart + chunk.addresses.length;
        previousDropped = chunk.droppedEvents;
        stopped ||= !chunk.active;
        index++;
        return chunk;
    };
};
/**
 * Validates untrusted trace data without importing project facts.
 * @param {unknown} value Untrusted trace.
 * @returns {RuntimeInstructionTraceArtifact} Normalized trace.
 */
export const validateRuntimeInstructionTrace = (value) => {
    const metadata = validateRuntimeInstructionTraceMetadata(value);
    const input = record(value, "Instruction trace artifact");
    if (!Array.isArray(input.chunks)) {
        throw new Error("Instruction trace chunks must be an array.");
    }
    return { ...metadata, chunks: input.chunks.map(createRuntimeTraceChunkValidator()) };
};
/**
 * Converts one explicitly supplied native trace artifact into merge-ready runtime evidence.
 * This function is pure: callers must separately invoke `mergeRuntimeEvidence` and persist the project.
 * @param {RuntimeInstructionTraceArtifact} value Untrusted native trace artifact.
 * @param {RuntimeInstructionTraceImportContext} context Selected project and source identity.
 * @returns {RuntimeInstructionTraceImportResult} Deterministic batch and loss diagnostics.
 */
export const importRuntimeInstructionTrace = (value, context) => {
    const artifact = record(value, "Instruction trace artifact");
    if (!Array.isArray(artifact.chunks)) {
        throw new Error("Instruction trace chunks must be an array.");
    }
    const importer = createRuntimeInstructionTraceImporter(validateRuntimeInstructionTraceMetadata(value), context);
    for (const chunk of artifact.chunks) {
        importer.push(chunk);
    }
    return importer.finish();
};
/**
 * Resolve the instruction record budget before consuming any chunks. The memory ceiling still
 * applies if either counters or final records accumulate on the heap; a disk index alone is insufficient.
 * @param {string} mode Full snapshots or compact analysis state.
 * @param {number} requested Explicit caller budget, if any.
 * @param {RuntimeTraceImporterStorage} storage Optional counter storage and final record sink.
 * @returns {number} Positive safe integer limit, or throws for an invalid or unsafe memory budget.
 */
export const runtimeTraceIndexRecordLimit = (mode, requested, storage) => {
    if (mode !== "full" && mode !== "analysis") {
        throw new Error("Only full or analysis runtime trace indexing is supported.");
    }
    let defaultLimit = DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS;
    let maximum = MAX_RUNTIME_TRACE_INDEX_RECORDS;
    // Project imports keep both distinct counters and emitted facts in SQLite. Applying the old
    // Map guard here would reject valid captures late, even when their file/storage budgets allow them.
    if (storage?.index.diskBacked && storage.onRecord) {
        defaultLimit = Number.MAX_SAFE_INTEGER;
        maximum = Number.MAX_SAFE_INTEGER;
    }
    const limit = integer(requested ?? defaultLimit, "Trace index record limit", 1);
    if (limit > maximum) {
        throw new Error(`Trace index record limit must not exceed ${maximum}.`);
    }
    return limit;
};
/**
 * Default index for callers explicitly requesting an in-memory evidence batch.
 * @returns {RuntimeTraceFactIndex} Counter map released by importer completion or failure.
 */
const createMemoryFactIndex = () => {
    const records = new Map();
    return {
        add: (key, create) => {
            const prior = records.get(key);
            if (prior) {
                prior.count++;
                return false;
            }
            records.set(key, { fact: create(), count: 1 });
            return true;
        },
        values: () => records.values(),
        clear: () => records.clear(),
    };
};
/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * The default memory index grows with distinct facts. Callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization. Record budgets do not bound bytes.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @param {RuntimeTraceImporterStorage} [storage] Caller-owned counter index and optional bounded record sink.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer. Finish only after the file validates.
 */
export const createRuntimeInstructionTraceImporter = (value, context, storage) => {
    const artifact = validateRuntimeInstructionTraceMetadata(value);
    const projectRomContentSha256 = sha256Identity(context.projectRomContentSha256, "Project ROM content identity");
    if (artifact.romContentSha256 !== projectRomContentSha256) {
        throw new Error(`ROM/project mismatch: project expects ${projectRomContentSha256}, trace describes ${artifact.romContentSha256}.`);
    }
    const sourceName = string(context.sourceName, "Instruction trace source name");
    const addressSpace = string(artifact.addressSpace, "Instruction trace project address space");
    const indexMode = context.indexMode ?? "full";
    const maxIndexRecords = runtimeTraceIndexRecordLimit(indexMode, context.maxIndexRecords, storage);
    // Match canonicalJson({...metadata, chunks}) exactly without making one huge string.
    const envelope = canonicalJson({ ...artifact, chunks: [] });
    const split = envelope.indexOf('  "chunks": []') + '  "chunks": '.length;
    const hash = createHash("sha256").update(envelope.slice(0, split));
    const suffix = envelope.slice(split + 2);
    const validateChunk = createRuntimeTraceChunkValidator();
    const index = storage?.index ?? createMemoryFactIndex();
    const instructionIdentities = new TraceCache();
    const chunkFormatter = new TraceChunkFormatter();
    let sealed = storage?.checkpoint;
    let executionRecords = sealed?.executionRecords ?? 0;
    let memoryRecords = sealed?.memoryRecords ?? 0;
    let indexRecords = sealed?.indexRecords ?? 0;
    if (indexRecords > maxIndexRecords) {
        throw new Error(`Trace index exceeds ${maxIndexRecords} records.`);
    }
    const reserve = (count) => {
        // Budget the eventual output as each new key is discovered, including paired code/state records.
        // Subtract first so a pair cannot overflow the safe integer ceiling before comparison.
        // Reject the whole import rather than letting callers mistake a truncated index for success.
        if (count > maxIndexRecords - indexRecords) {
            throw new Error(`Trace index exceeds ${maxIndexRecords} records. The capture has too many distinct code/state/bus variants for this index budget. The original capture is unchanged. No partial import was committed.`);
        }
        indexRecords += count;
    };
    let observedEvents = sealed?.observedEvents ?? 0;
    let droppedEvents = sealed?.droppedEvents ?? 0;
    let complete = sealed?.complete ?? false;
    let chunks = 0;
    let unattributed = sealed?.unattributed ?? 0;
    let finished = false;
    let failure;
    let detailedEvents = sealed?.detailedEvents ?? 0;
    let memoryLoss = sealed?.memoryLoss ?? 0;
    const pushChunk = (input) => {
        if (finished || sealed) {
            throw new Error("Instruction trace import already finished.");
        }
        const chunk = validateChunk(input);
        // Hash every original chunk so identity covers all supplied bytes, registers and counts.
        hash.update(chunks++ === 0 ? "[\n" : ",\n");
        // Preserve historical envelope indentation while reusing validated snapshot text. The
        // formatter avoids another recursive normalization of every captured register object.
        hash.update(chunkFormatter.format(chunk));
        droppedEvents = chunk.droppedEvents;
        complete = !chunk.active;
        unattributed = chunk.unattributedMemoryAccesses ?? unattributed;
        for (const [eventIndex, address] of chunk.addresses.entries()) {
            const detail = chunk.details?.[eventIndex];
            const physical = detail?.state.prg0;
            let mapping;
            if (artifact.architecture === "65xx.2a03") {
                if (!detail || typeof physical !== "number") {
                    throw new Error("NES execution evidence requires captured bytes and physical mapper identity.");
                }
                // The fetch coordinate is authoritative; unknown/RAM code has no ROM offset.
                mapping = sha256(canonicalJson({
                    physical,
                    mapper: detail.state.mapper,
                    prgMode: detail.state.prgMode,
                    r6: detail.state.r6,
                    r7: detail.state.r7,
                }));
            }
            // The temporary key only needs equality. Format stable hexadecimal IDs once per distinct
            // address in finish(), rather than for every repeated execution in a long capture.
            if (index.add(`pc:${address}:${mapping ?? ""}`, () => ({
                kind: "execution",
                address,
                ...(mapping ? { identity: mapping } : {}),
            }))) {
                reserve(1);
                executionRecords++;
            }
            observedEvents++;
        }
        for (const [offset, detail] of (chunk.details ?? []).entries()) {
            detailedEvents++;
            memoryLoss += detail.droppedMemoryAccesses ?? 0;
            const address = chunk.addresses[offset];
            const base = { architecture: artifact.architecture, count: 1, evidence: [] };
            // Keep bytes and decoding state together: independent sets could pair self-modified code
            // with register values that were never observed when those bytes executed.
            const state = indexMode === "analysis" && artifact.architecture === "snes.65816"
                ? snesAnalysisTraceState(detail.state)
                : detail.state;
            const content = JSON.stringify({ address, bytes: detail.bytes, state });
            // Full snapshots may contain large or mostly unique register objects. Fixed-size keys
            // bound per-variant key allocations without dropping any captured register fields.
            // Arbitrary JSON register strings can be large. Cache only short identities, keeping the
            // 4,096-entry working set below eight MiB of UTF-16 key text even for hostile input shapes.
            const cacheable = content.length <= 1024;
            let key = cacheable ? instructionIdentities.get(content) : undefined;
            if (key === undefined) {
                key = sha256(`${JSON.stringify({ address, bytes: detail.bytes, state }, undefined, 2)}\n`);
                if (cacheable) {
                    instructionIdentities.insert(content, key);
                }
            }
            if (index.add(`code:${key}`, () => ({
                kind: "instruction",
                identity: key,
                address,
                bytes: detail.bytes,
                state,
            }))) {
                reserve(2);
            }
            for (const access of detail.memoryAccesses ?? []) {
                if (access.access === "fetch") {
                    continue;
                }
                const accessKind = access.access;
                const accessKey = canonicalJson({ instructionAddress: address, ...access });
                if (index.add(`memory:${sha256(accessKey)}`, () => ({
                    kind: "memory",
                    record: {
                        ...base,
                        id: `memory:${sha256(accessKey)}`,
                        kind: "runtime-memory-access",
                        instructionAddressSpace: addressSpace,
                        instructionAddress: address,
                        accessedAddressSpace: access.addressSpace,
                        accessedAddress: access.address,
                        access: accessKind,
                        width: access.width,
                        ...(access.value === undefined ? {} : { value: access.value }),
                        ...(access.actor === undefined ? {} : { actor: access.actor }),
                        ...(access.channel === undefined ? {} : { channel: access.channel }),
                    },
                }))) {
                    reserve(1);
                    memoryRecords++;
                }
            }
        }
    };
    const push = (input) => {
        if (failure) {
            throw failure;
        }
        try {
            pushChunk(input);
        }
        catch (error) {
            // A failure can occur partway through a chunk. Latch it and release the working set so
            // catching the error cannot turn a later finish() into a seemingly valid partial import.
            failure = error instanceof Error ? error : new Error(String(error));
            index.clear();
            throw failure;
        }
    };
    const checkpoint = (recovery) => {
        if (failure) {
            throw failure;
        }
        if (!sealed) {
            // Copy before digesting so sealing is independent of publication. A failed database merge
            // can reuse this exact identity and the committed counters without decoding the archive again.
            const finalHash = hash
                .copy()
                .update(chunks ? "\n  ]" : "[]")
                .update(suffix);
            if (recovery) {
                finalHash.update(canonicalJson({ recoveredCapturePrefix: recovery }));
            }
            sealed = {
                sourceSha256: finalHash.digest("hex"),
                executionRecords,
                memoryRecords,
                indexRecords,
                observedEvents,
                droppedEvents,
                complete,
                unattributed,
                detailedEvents,
                memoryLoss,
                ...(recovery ? { recovery } : {}),
            };
        }
        return sealed;
    };
    const finish = (recovery) => {
        if (failure) {
            throw failure;
        }
        if (finished) {
            throw new Error("Instruction trace import already finished.");
        }
        finished = true;
        const prepared = checkpoint(recovery);
        recovery = prepared.recovery;
        const sourceSha256 = prepared.sourceSha256;
        const profile = indexMode === "analysis" && artifact.architecture === "snes.65816"
            ? SNES_ANALYSIS_TRACE_PROFILE
            : "full";
        storage?.onSource?.(sourceSha256, profile);
        const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
        const evidenceIds = [evidenceId];
        const executions = [];
        const facts = [];
        let processedRecords = 0;
        let lastProgress = performance.now();
        storage?.onMergeProgress?.(0, indexRecords);
        const emit = (emitted) => {
            if (storage?.onRecord) {
                storage.onRecord(emitted);
            }
            else if (emitted.kind === "runtime-execution") {
                executions.push(emitted);
            }
            else {
                facts.push(emitted);
            }
            processedRecords++;
            // Synchronous SQLite publication cannot run timer callbacks. Report from the work loop,
            // checking the clock only periodically and always delivering the exact final count.
            if (storage?.onMergeProgress &&
                (processedRecords === indexRecords ||
                    (processedRecords % 128 === 0 && performance.now() - lastProgress >= 1000))) {
                storage.onMergeProgress(processedRecords, indexRecords);
                lastProgress = performance.now();
            }
        };
        // A disk sink receives one final record at a time, so finalization cannot allocate a second
        // full index while expanding byte/state pairs. Keep legacy ordering for in-memory callers.
        try {
            for (const { fact, count } of index.values()) {
                if (fact.kind === "execution") {
                    emit({
                        id: `${evidenceId}:${hex(fact.address)}${fact.identity ? `:mapping:${fact.identity}` : ""}`,
                        kind: "runtime-execution",
                        architecture: artifact.architecture,
                        addressSpace,
                        address: fact.address,
                        count,
                        evidence: evidenceIds,
                    });
                }
                else if (fact.kind === "instruction") {
                    const base = {
                        architecture: artifact.architecture,
                        addressSpace,
                        address: fact.address,
                        count,
                        evidence: evidenceIds,
                        state: fact.state,
                    };
                    emit({
                        ...base,
                        id: `${evidenceId}:code:${fact.identity}`,
                        kind: "runtime-instruction",
                        bytes: fact.bytes,
                    });
                    emit({ ...base, id: `${evidenceId}:state:${fact.identity}`, kind: "runtime-cpu-state" });
                }
                else {
                    emit({
                        ...fact.record,
                        id: `${evidenceId}:${fact.record.id}`,
                        count,
                        evidence: evidenceIds,
                    });
                }
            }
        }
        finally {
            index.clear();
        }
        const runtime = executions.toSorted((a, b) => {
            if (a.kind !== "runtime-execution" || b.kind !== "runtime-execution") {
                return 0;
            }
            return a.address - b.address;
        });
        for (const fact of facts.toSorted((a, b) => a.id.localeCompare(b.id))) {
            runtime.push(fact);
        }
        const evidence = {
            id: evidenceId,
            source: "runtime",
            sourceId: `${artifact.producer.id}:${artifact.producer.revision}`,
            confidence: droppedEvents === 0 && memoryLoss === 0 && unattributed === 0 && complete
                ? "certain"
                : "high",
            detail: `${observedEvents} instruction event(s) observed. ${droppedEvents} producer event(s) dropped.`,
            artifact: {
                format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
                formatVersion: String(RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION),
                sha256: sourceSha256,
                romContentSha256: artifact.romContentSha256,
            },
        };
        const report = {
            id: `import:instruction-trace:${sourceSha256}`,
            ...(profile === "full" ? {} : { indexProfile: profile }),
            format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
            sourceName,
            sourceSha256,
            sourceVersion: `v${RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION}@${artifact.producer.id}:${artifact.producer.revision}`,
            imported: {
                executionRecords,
                executionEvents: observedEvents,
                detailedEvents,
                memoryRecords,
                ...(recovery
                    ? {
                        recoveredChunks: Number(recovery.chunkThrough),
                        recoveredEvents: Number(recovery.eventThrough),
                    }
                    : {}),
            },
            unsupported: droppedEvents === 0
                ? []
                : [
                    {
                        field: "instruction-addresses",
                        count: droppedEvents,
                        reason: "Producer buffer overflow occurred before these events could be pulled.",
                    },
                ],
            warnings: [
                ...(recovery
                    ? [
                        `Recovered incomplete ACT2 prefix through checkpoint ${recovery.chunkThrough}, instruction ${recovery.eventThrough}: ${recovery.reason} The unrecorded tail and final companion boundary are unknown.`,
                    ]
                    : []),
                ...(!complete ? ["Trace artifact ended while capture was still active."] : []),
                ...(detailedEvents < observedEvents
                    ? [
                        `${observedEvents - detailedEvents} instruction observations have no captured bytes/state. RAM code cannot be recovered from PCs alone.`,
                    ]
                    : []),
                ...(memoryLoss
                    ? [`${memoryLoss} memory operations were omitted by the producer detail limit.`]
                    : []),
                ...(unattributed
                    ? [
                        `${unattributed} bus operations occurred outside captured CPU instructions (such as interrupt/wait periods). They have no saved address/value detail.`,
                    ]
                    : []),
            ],
        };
        return {
            batch: { ...(storage?.onRecord ? {} : { runtime }), evidence: [evidence], imports: [report] },
            report,
            sourceSha256,
            observedEvents,
            droppedEvents,
        };
    };
    return { push, checkpoint, finish };
};
//# sourceMappingURL=runtime-trace.js.map