import { createHash } from "node:crypto";
import { canonicalJson } from "./project-store.js";
import { project65816AnalysisState, RUNTIME_ANALYSIS_PROFILE } from "./runtime-trace-profile.js";
import { validateRuntimeInstructionDetails, } from "./trace-detail.js";
/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export const RUNTIME_INSTRUCTION_TRACE_FORMAT = "uttori-asm-instruction-trace";
/** Initial trace-artifact schema. The project is unreleased, so this remains version 1. */
export const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION = 1;
/** Compact-index default; full snapshots retain a larger compatibility budget. */
export const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 2_000_000;
const MAX_RUNTIME_TRACE_INDEX_RECORDS = 8_000_000;
// P/E control instruction widths; D/DB resolve direct-page and data-bank operands.
// Preserve PB/PC observations with them so projection does not invent state combinations.
const DISASSEMBLY_STATE_FIELDS = new Set(["p", "e", "d", "db", "pb", "pc"]);
const record = (value, context) => {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error(`${context} must be an object.`);
    return value;
};
const string = (value, context) => {
    if (typeof value !== "string" || value.length === 0)
        throw new Error(`${context} must be a non-empty string.`);
    return value;
};
const integer = (value, context, minimum = 0) => {
    if (!Number.isSafeInteger(value) || value < minimum)
        throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
    return value;
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256Identity = (value, context) => {
    const identity = string(value, context);
    if (!/^[\da-f]{64}$/.test(identity))
        throw new Error(`${context} must be a lowercase SHA-256 identity.`);
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
    if (artifact.format !== RUNTIME_INSTRUCTION_TRACE_FORMAT)
        throw new Error(`Unsupported instruction trace format '${String(artifact.format)}'.`);
    if (artifact.schemaVersion !== RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION)
        throw new Error(`Unsupported instruction trace schema version '${String(artifact.schemaVersion)}'.`);
    const producer = record(artifact.producer, "Instruction trace producer");
    return {
        format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
        schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
        architecture: string(artifact.architecture, "Instruction trace architecture"),
        addressSpace: string(artifact.addressSpace, "Instruction trace address space"),
        romContentSha256: sha256Identity(artifact.romContentSha256, "Instruction trace ROM content identity"),
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
        if (!Array.isArray(input.addresses))
            throw new Error(`Instruction trace chunk ${index} addresses must be an array.`);
        if (typeof input.active !== "boolean")
            throw new Error(`Instruction trace chunk ${index} active must be boolean.`);
        const chunk = {
            sequenceStart: integer(input.sequenceStart, `Instruction trace chunk ${index} sequenceStart`, 1),
            addresses: input.addresses.map((address, addressIndex) => integer(address, `Instruction trace chunk ${index} address ${addressIndex}`)),
            ...(input.details === undefined
                ? {}
                : { details: validateRuntimeInstructionDetails(input.details, input.addresses.length) }),
            ...(input.unattributedMemoryAccesses === undefined
                ? {}
                : {
                    unattributedMemoryAccesses: integer(input.unattributedMemoryAccesses, "Unattributed trace memory accesses"),
                }),
            droppedEvents: integer(input.droppedEvents, `Instruction trace chunk ${index} droppedEvents`),
            active: input.active,
        };
        if ((chunk.unattributedMemoryAccesses ?? previousUnattributed) < previousUnattributed)
            throw new Error("Unattributed trace memory count decreased.");
        previousUnattributed = chunk.unattributedMemoryAccesses ?? previousUnattributed;
        if (stopped && chunk.active)
            throw new Error(`Instruction trace chunk ${index} resumes after capture stopped.`);
        if (chunk.sequenceStart < expectedSequence)
            throw new Error(`Instruction trace chunk ${index} overlaps or reorders prior events.`);
        const sequenceGap = chunk.sequenceStart - expectedSequence;
        const lossDelta = chunk.droppedEvents - previousDropped;
        if (lossDelta < 0 || sequenceGap !== lossDelta)
            throw new Error(`Instruction trace chunk ${index} has inconsistent producer loss metadata.`);
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
    if (!Array.isArray(input.chunks))
        throw new Error("Instruction trace chunks must be an array.");
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
    if (!Array.isArray(artifact.chunks))
        throw new Error("Instruction trace chunks must be an array.");
    const importer = createRuntimeInstructionTraceImporter(validateRuntimeInstructionTraceMetadata(value), context);
    for (const chunk of artifact.chunks)
        importer.push(chunk);
    return importer.finish();
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
 * The default memory index grows with distinct facts; callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization; record budgets do not bound bytes.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @param {RuntimeTraceImporterStorage} [storage] Caller-owned counter index and optional bounded record sink.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer; finish only after the file validates.
 */
export const createRuntimeInstructionTraceImporter = (value, context, storage) => {
    const artifact = validateRuntimeInstructionTraceMetadata(value);
    const projectRomContentSha256 = sha256Identity(context.projectRomContentSha256, "Project ROM content identity");
    if (artifact.romContentSha256 !== projectRomContentSha256)
        throw new Error(`ROM/project mismatch: project expects ${projectRomContentSha256}, trace describes ${artifact.romContentSha256}.`);
    const sourceName = string(context.sourceName, "Instruction trace source name");
    const addressSpace = string(artifact.addressSpace, "Instruction trace project address space");
    const native65816 = artifact.architecture === "snes.65816" && addressSpace === "snes.cpu";
    const indexMode = context.indexMode ?? (native65816 ? "65816-analysis" : "full");
    let indexProfile;
    if (indexMode === "65816-disassembly")
        indexProfile = "65816-disassembly-v1";
    if (indexMode === "65816-analysis")
        indexProfile = RUNTIME_ANALYSIS_PROFILE;
    if (!["full", "65816-disassembly", "65816-analysis"].includes(indexMode))
        throw new Error("Unsupported runtime trace index mode.");
    // This projection follows the 65816 decoder's inputs; another CPU may need the omitted registers.
    if (indexMode !== "full" &&
        (artifact.architecture !== "snes.65816" || addressSpace !== "snes.cpu"))
        throw new Error("The 65816 disassembly index requires snes.65816 / snes.cpu capture data.");
    const maxIndexRecords = integer(context.maxIndexRecords ??
        (indexMode === "full"
            ? MAX_RUNTIME_TRACE_INDEX_RECORDS
            : DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS), "Trace index record limit", 1);
    if (maxIndexRecords > MAX_RUNTIME_TRACE_INDEX_RECORDS)
        throw new Error(`Trace index record limit must not exceed ${MAX_RUNTIME_TRACE_INDEX_RECORDS}.`);
    // Match canonicalJson({...metadata, chunks}) exactly without making one huge string.
    const envelope = canonicalJson({ ...artifact, chunks: [] });
    const split = envelope.indexOf('  "chunks": []') + '  "chunks": '.length;
    const hash = createHash("sha256").update(envelope.slice(0, split));
    const suffix = envelope.slice(split + 2);
    const validateChunk = createRuntimeTraceChunkValidator();
    const index = storage?.index ?? createMemoryFactIndex();
    let executionRecords = 0;
    let memoryRecords = 0;
    let indexRecords = 0;
    const reserve = (count) => {
        // Budget the eventual output before adding a new key, including paired code/state records.
        // Reject the whole import rather than letting callers mistake a truncated index for success.
        if (indexRecords + count > maxIndexRecords) {
            let hint = "The capture has too many distinct code/state/bus variants for this index budget. ";
            if (indexMode === "full")
                hint =
                    "Use the 65816 disassembly index (asm.trace.indexMode or --trace-index) for large instruction captures. ";
            throw new Error(`Trace index exceeds ${maxIndexRecords} records. ${hint}The original capture is unchanged; no partial import was committed.`);
        }
        indexRecords += count;
    };
    let observedEvents = 0;
    let droppedEvents = 0;
    let complete = false;
    let chunks = 0;
    let unattributed = 0;
    let finished = false;
    let failure;
    let detailedEvents = 0;
    let memoryLoss = 0;
    const pushChunk = (value) => {
        if (finished)
            throw new Error("Instruction trace import already finished.");
        const chunk = validateChunk(value);
        // Hash the original chunk before projecting its registers so both index modes identify the same capture.
        hash.update(chunks++ === 0 ? "[\n" : ",\n");
        // canonicalJson always has one trailing newline. Indent its text directly instead of
        // allocating one array entry and callback result for every line in a rich trace chunk.
        hash.update(`    ${canonicalJson(chunk).slice(0, -1).replaceAll("\n", "\n    ")}`);
        droppedEvents = chunk.droppedEvents;
        complete = !chunk.active;
        unattributed = chunk.unattributedMemoryAccesses ?? unattributed;
        for (const address of chunk.addresses) {
            if (index.add(`pc:${hex(address)}`, () => ({ kind: "execution", address }))) {
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
            let state = detail.state;
            if (indexMode === "65816-analysis")
                state = project65816AnalysisState(detail.state);
            else if (indexMode === "65816-disassembly")
                state = Object.fromEntries(Object.entries(detail.state).filter(([field]) => DISASSEMBLY_STATE_FIELDS.has(field.toLowerCase())));
            const content = canonicalJson({ address, bytes: detail.bytes, state });
            // Full snapshots may contain large or mostly unique register objects.
            // Keep their map keys fixed-size; compact states benefit from reusing the
            // content key without hashing every repetition of a hot instruction.
            const key = indexMode === "full" ? sha256(content) : content;
            if (index.add(`code:${key}`, () => ({
                kind: "instruction",
                identity: indexMode === "full" ? key : sha256(key),
                address,
                bytes: detail.bytes,
                state,
            })))
                reserve(2);
            for (const access of detail.memoryAccesses ?? []) {
                if (access.access === "fetch")
                    continue;
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
    const push = (value) => {
        if (failure)
            throw failure;
        try {
            pushChunk(value);
        }
        catch (error) {
            // A failure can occur partway through a chunk. Latch it and release the working set so
            // catching the error cannot turn a later finish() into a seemingly valid partial import.
            failure = error instanceof Error ? error : new Error(String(error));
            index.clear();
            throw failure;
        }
    };
    const finish = () => {
        if (failure)
            throw failure;
        if (finished)
            throw new Error("Instruction trace import already finished.");
        finished = true;
        const sourceSha256 = hash
            .update(chunks ? "\n  ]" : "[]")
            .update(suffix)
            .digest("hex");
        storage?.onSource?.(sourceSha256, indexProfile ?? "full");
        const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
        const evidenceIds = [evidenceId];
        const executions = [];
        const facts = [];
        let processedRecords = 0;
        let lastProgress = performance.now();
        storage?.onMergeProgress?.(0, indexRecords);
        const emit = (record) => {
            if (storage?.onRecord)
                storage.onRecord(record);
            else if (record.kind === "runtime-execution")
                executions.push(record);
            else
                facts.push(record);
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
                        id: `${evidenceId}:${hex(fact.address)}`,
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
                else
                    emit({
                        ...fact.record,
                        id: `${evidenceId}:${fact.record.id}`,
                        count,
                        evidence: evidenceIds,
                    });
            }
        }
        finally {
            index.clear();
        }
        const runtime = executions.sort((a, b) => {
            if (a.kind !== "runtime-execution" || b.kind !== "runtime-execution")
                return 0;
            return a.address - b.address;
        });
        for (const fact of facts.sort((a, b) => a.id.localeCompare(b.id)))
            runtime.push(fact);
        const evidence = {
            id: evidenceId,
            source: "runtime",
            sourceId: `${artifact.producer.id}:${artifact.producer.revision}`,
            confidence: droppedEvents === 0 && memoryLoss === 0 && unattributed === 0 && complete
                ? "certain"
                : "high",
            detail: `${observedEvents} instruction event(s) observed; ${droppedEvents} producer event(s) dropped.`,
            artifact: {
                format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
                formatVersion: String(RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION),
                sha256: sourceSha256,
                romContentSha256: artifact.romContentSha256,
            },
        };
        const report = {
            id: `import:instruction-trace:${sourceSha256}${indexProfile ? `:${indexProfile}` : ""}`,
            ...(indexProfile ? { indexProfile } : {}),
            format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
            sourceName,
            sourceSha256,
            sourceVersion: `v${RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION}@${artifact.producer.id}:${artifact.producer.revision}`,
            imported: {
                executionRecords,
                executionEvents: observedEvents,
                detailedEvents,
                memoryRecords,
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
                ...(indexMode === "full"
                    ? []
                    : [
                        indexMode === "65816-analysis"
                            ? "Analysis index retains joint PC/bytes/decoder-state variants, exact counts and bus observations. Full register history requires an available capture archive."
                            : "Disassembly index retains every PC/bytes/P/E/D/DB/PB/PC variant and exact execution counts. Other register snapshots require the original capture.",
                    ]),
                ...(!complete ? ["Trace artifact ended while capture was still active."] : []),
                ...(detailedEvents < observedEvents
                    ? [
                        `${observedEvents - detailedEvents} instruction observations have no captured bytes/state; RAM code cannot be recovered from PCs alone.`,
                    ]
                    : []),
                ...(memoryLoss
                    ? [`${memoryLoss} memory operations were omitted by the producer detail limit.`]
                    : []),
                ...(unattributed
                    ? [
                        `${unattributed} bus operations occurred outside captured CPU instructions (such as interrupt/wait periods); they have no saved address/value detail.`,
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
    return { push, finish };
};
//# sourceMappingURL=runtime-trace.js.map