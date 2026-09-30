import { createHash } from "node:crypto";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import type {
  EvidenceRecord,
  ImportReport,
  RuntimeEvidenceRecord,
  RuntimeStateValue,
} from "../model/project-types.js";
import {
  validateRuntimeInstructionDetails,
  type RuntimeInstructionDetail,
} from "../model/trace-detail.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";

/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export const RUNTIME_INSTRUCTION_TRACE_FORMAT = "uttori-asm-instruction-trace" as const;

/** Supported trace-artifact schema. Readers reject other revisions. */
export const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION = 1 as const;

/** One bounded producer pull stored in a native instruction-trace artifact. */
export interface RuntimeInstructionTraceChunk {
  /** Nonnegative producer sequence of the first address, including positions lost before delivery. */
  readonly sequenceStart: number;
  readonly addresses: readonly number[];
  /** Optional execution-time detail. Legacy PC-only chunks remain valid. */
  readonly details?: readonly RuntimeInstructionDetail[];
  /** Cumulative bus operations outside a captured CPU instruction (interrupt/wait periods). */
  readonly unattributedMemoryAccesses?: number;
  /** Cumulative producer loss, not the loss in this chunk. Counts must never decrease. */
  readonly droppedEvents: number;
  readonly active: boolean;
}

/**
 * Immutable recording artifact created only by an explicit recorder.
 * Chunks preserve observed order and producer loss. Project facts are aggregated during import.
 */
export interface RuntimeInstructionTraceArtifact {
  readonly format: typeof RUNTIME_INSTRUCTION_TRACE_FORMAT;
  readonly schemaVersion: typeof RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly romContentSha256: string;
  readonly producer: {
    readonly id: string;
    readonly revision: string;
  };
  readonly chunks: readonly RuntimeInstructionTraceChunk[];
}

/** Project identity and user-visible source name required for an explicit trace import. */
export interface RuntimeInstructionTraceImportContext {
  /** Lowercase SHA-256 of headerless ROM content. A mismatch rejects the import. */
  readonly projectRomContentSha256: string;
  readonly sourceName: string;
  /** Full indexing retains every supplied register; other modes are rejected. */
  readonly indexMode?: RuntimeTraceIndexMode;
  /**
   * Maximum emitted runtime facts: one per PC, two per byte/state variant, one per bus variant.
   * In-memory imports default to 8M records, with an 8M ceiling.
   * Disk indexes with a record sink default to Number.MAX_SAFE_INTEGER and accept any positive
   * safe integer budget. Explicit budgets apply to both paths. Not a byte/heap limit.
   */
  readonly maxIndexRecords?: number;
}

/** Instruction imports retain all supplied registers, bytes, counts and bus observations. */
export type RuntimeTraceIndexMode = "full";
/** Default and maximum distinct-fact budget when counters or output records remain on the heap. */
export const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 8_000_000;
const MAX_RUNTIME_TRACE_INDEX_RECORDS = DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS;

/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
  readonly batch: RuntimeEvidenceBatch;
  readonly report: ImportReport;
  /** Canonical identity of all validated input, including every supplied register. */
  readonly sourceSha256: string;
  readonly observedEvents: number;
  readonly droppedEvents: number;
}

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown, context: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as UnknownRecord;
};

const string = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
};

const integer = (value: unknown, context: string, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value as number;
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const sha256Identity = (value: unknown, context: string): string => {
  const identity = string(value, context);
  if (!/^[\da-f]{64}$/.test(identity)) {
    throw new Error(`${context} must be a lowercase SHA-256 identity.`);
  }
  return identity;
};

const hex = (value: number): string => value.toString(16).toUpperCase().padStart(6, "0");

/** Identity shared by all chunks of one trace. */
export type RuntimeInstructionTraceMetadata = Omit<RuntimeInstructionTraceArtifact, "chunks">;

/**
 * Ordered chunks supplied directly by a producer or a bounded file reader. The reader must finish
 * each synchronous consumer call and reject on incomplete envelopes or integrity failures. Chunks are
 * provisional until read() resolves. Consumers validate chunk contents and must not retain them.
 */
export interface RuntimeTraceSource {
  readonly metadata: RuntimeInstructionTraceMetadata;
  readonly read: (accept: (chunk: unknown) => void) => Promise<void>;
}

/**
 * Validate the small trace envelope independently of its event stream.
 * @param {unknown} value Untrusted metadata.
 * @returns {RuntimeInstructionTraceMetadata} Normalized identity.
 */
export const validateRuntimeInstructionTraceMetadata = (
  value: unknown,
): RuntimeInstructionTraceMetadata => {
  const artifact = record(value, "Instruction trace artifact");
  if (artifact.format !== RUNTIME_INSTRUCTION_TRACE_FORMAT) {
    throw new Error(`Unsupported instruction trace format '${String(artifact.format)}'.`);
  }
  if (artifact.schemaVersion !== RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported instruction trace schema version '${String(artifact.schemaVersion)}'.`,
    );
  }
  const producer = record(artifact.producer, "Instruction trace producer");
  return {
    format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
    schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
    architecture: string(artifact.architecture, "Instruction trace architecture"),
    addressSpace: string(artifact.addressSpace, "Instruction trace address space"),
    romContentSha256: sha256Identity(
      artifact.romContentSha256,
      "Instruction trace ROM content identity",
    ),
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
export const createRuntimeTraceChunkValidator = (): ((
  value: unknown,
) => RuntimeInstructionTraceChunk) => {
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
    const chunk: RuntimeInstructionTraceChunk = {
      sequenceStart: integer(
        input.sequenceStart,
        `Instruction trace chunk ${index} sequenceStart`,
        1,
      ),
      addresses: input.addresses.map((address, addressIndex) =>
        integer(address, `Instruction trace chunk ${index} address ${addressIndex}`),
      ),
      ...(input.details === undefined
        ? {}
        : { details: validateRuntimeInstructionDetails(input.details, input.addresses.length) }),
      ...(input.unattributedMemoryAccesses === undefined
        ? {}
        : {
            unattributedMemoryAccesses: integer(
              input.unattributedMemoryAccesses,
              "Unattributed trace memory accesses",
            ),
          }),
      droppedEvents: integer(input.droppedEvents, `Instruction trace chunk ${index} droppedEvents`),
      active: input.active,
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
export const validateRuntimeInstructionTrace = (
  value: unknown,
): RuntimeInstructionTraceArtifact => {
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
export const importRuntimeInstructionTrace = (
  value: RuntimeInstructionTraceArtifact,
  context: RuntimeInstructionTraceImportContext,
): RuntimeInstructionTraceImportResult => {
  const artifact = record(value, "Instruction trace artifact");
  if (!Array.isArray(artifact.chunks)) {
    throw new Error("Instruction trace chunks must be an array.");
  }
  const importer = createRuntimeInstructionTraceImporter(
    validateRuntimeInstructionTraceMetadata(value),
    context,
  );
  for (const chunk of artifact.chunks) {
    importer.push(chunk);
  }
  return importer.finish();
};

/** One distinct indexed fact. Byte/state pairs expand into two persisted records at finalization. */
export type RuntimeTraceIndexedFact =
  | { readonly kind: "execution"; readonly address: number }
  | {
      readonly kind: "instruction";
      readonly identity: string;
      readonly address: number;
      readonly bytes: readonly number[];
      readonly state: Readonly<Record<string, RuntimeStateValue>>;
    }
  | { readonly kind: "memory"; readonly record: RuntimeEvidenceRecord };

/** Counter storage owned by the caller. Disk implementations keep distinct facts off the JS heap. */
export interface RuntimeTraceFactIndex {
  /** True when distinct fact payloads live on disk. Omitted means the index may grow on the JS heap. */
  readonly diskBacked?: boolean;
  /** Increment a fact, constructing its payload only on first insertion. Return whether it was new. */
  add(key: string, create: () => RuntimeTraceIndexedFact): boolean;
  /** Yield each distinct fact once, with its exact aggregate observation count. */
  values(): Iterable<{ readonly fact: RuntimeTraceIndexedFact; readonly count: number }>;
  /** Release indexed facts after completion or failure. */
  clear(): void;
}

/** Optional external storage and record sink. Sink output is provisional until finish returns. */
export interface RuntimeTraceImporterStorage {
  readonly index: RuntimeTraceFactIndex;
  /** Called after complete source validation, before emitting any provisional records. */
  readonly onSource?: (sha256: string, profile: string) => void;
  /**
   * Final records are emitted individually; batch.runtime is omitted. With diskBacked indexing,
   * the sink must bound its own memory because the importer's default record ceiling is lifted.
   */
  readonly onRecord?: (record: RuntimeEvidenceRecord) => void;
  /** Throttled provisional merge counts. Reaching the total does not mean the transaction committed. */
  readonly onMergeProgress?: (processedRecords: number, totalRecords: number) => void;
}

/**
 * Resolve the instruction record budget before consuming any chunks. The memory ceiling still
 * applies if either counters or final records accumulate on the heap; a disk index alone is insufficient.
 * @param {RuntimeTraceIndexMode} mode Validated retention profile.
 * @param {number} requested Explicit caller budget, if any.
 * @param {RuntimeTraceImporterStorage} storage Optional counter storage and final record sink.
 * @returns {number} Positive safe integer limit, or throws for an invalid or unsafe memory budget.
 */
export const runtimeTraceIndexRecordLimit = (
  mode: RuntimeTraceIndexMode,
  requested: number | undefined,
  storage?: RuntimeTraceImporterStorage,
): number => {
  if (mode !== "full") {
    throw new Error("Only full runtime trace indexing is supported.");
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
const createMemoryFactIndex = (): RuntimeTraceFactIndex => {
  const records = new Map<string, { fact: RuntimeTraceIndexedFact; count: number }>();
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

/** Incremental aggregation. Any failed push permanently invalidates the pending import. */
export interface RuntimeInstructionTraceImporter {
  /** Accept the next ordered chunk. Invalid data or an exceeded record budget prevents finalization. */
  push(this: void, value: unknown): void;
  /** Consume the importer once, only after the caller has validated the entire file and its tail. */
  finish(): RuntimeInstructionTraceImportResult;
}

/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * The default memory index grows with distinct facts. Callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization. Record budgets do not bound bytes.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @param {RuntimeTraceImporterStorage} [storage] Caller-owned counter index and optional bounded record sink.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer. Finish only after the file validates.
 */
export const createRuntimeInstructionTraceImporter = (
  value: RuntimeInstructionTraceMetadata,
  context: RuntimeInstructionTraceImportContext,
  storage?: RuntimeTraceImporterStorage,
): RuntimeInstructionTraceImporter => {
  const artifact = validateRuntimeInstructionTraceMetadata(value);
  const projectRomContentSha256 = sha256Identity(
    context.projectRomContentSha256,
    "Project ROM content identity",
  );
  if (artifact.romContentSha256 !== projectRomContentSha256) {
    throw new Error(
      `ROM/project mismatch: project expects ${projectRomContentSha256}, trace describes ${artifact.romContentSha256}.`,
    );
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
  let executionRecords = 0;
  let memoryRecords = 0;
  let indexRecords = 0;
  const reserve = (count: number): void => {
    // Budget the eventual output as each new key is discovered, including paired code/state records.
    // Subtract first so a pair cannot overflow the safe integer ceiling before comparison.
    // Reject the whole import rather than letting callers mistake a truncated index for success.
    if (count > maxIndexRecords - indexRecords) {
      throw new Error(
        `Trace index exceeds ${maxIndexRecords} records. The capture has too many distinct code/state/bus variants for this index budget. The original capture is unchanged. No partial import was committed.`,
      );
    }
    indexRecords += count;
  };
  let observedEvents = 0;
  let droppedEvents = 0;
  let complete = false;
  let chunks = 0;
  let unattributed = 0;
  let finished = false;
  let failure: Error | undefined;
  let detailedEvents = 0;
  let memoryLoss = 0;
  const pushChunk = (value: unknown): void => {
    if (finished) {
      throw new Error("Instruction trace import already finished.");
    }
    const chunk = validateChunk(value);
    // Hash every original chunk so identity covers all supplied bytes, registers and counts.
    hash.update(chunks++ === 0 ? "[\n" : ",\n");
    // canonicalJson always has one trailing newline. Indent its text directly instead of
    // allocating one array entry and callback result for every line in a rich trace chunk.
    hash.update(`    ${canonicalJson(chunk).slice(0, -1).replaceAll("\n", "\n    ")}`);
    droppedEvents = chunk.droppedEvents;
    complete = !chunk.active;
    unattributed = chunk.unattributedMemoryAccesses ?? unattributed;
    for (const address of chunk.addresses) {
      // The temporary key only needs equality. Format stable hexadecimal IDs once per distinct
      // address in finish(), rather than for every repeated execution in a long capture.
      if (index.add(`pc:${address}`, () => ({ kind: "execution", address }))) {
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
      const state = detail.state;
      const content = canonicalJson({ address, bytes: detail.bytes, state });
      // Full snapshots may contain large or mostly unique register objects. Fixed-size keys
      // bound per-variant key allocations without dropping any captured register fields.
      const key = sha256(content);
      if (
        index.add(`code:${key}`, () => ({
          kind: "instruction",
          identity: key,
          address,
          bytes: detail.bytes,
          state,
        }))
      ) {
        reserve(2);
      }
      for (const access of detail.memoryAccesses ?? []) {
        if (access.access === "fetch") {
          continue;
        }
        const accessKind = access.access;
        const accessKey = canonicalJson({ instructionAddress: address, ...access });
        if (
          index.add(`memory:${sha256(accessKey)}`, () => ({
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
          }))
        ) {
          reserve(1);
          memoryRecords++;
        }
      }
    }
  };
  const push = (value: unknown): void => {
    if (failure) {
      throw failure;
    }
    try {
      pushChunk(value);
    } catch (error) {
      // A failure can occur partway through a chunk. Latch it and release the working set so
      // catching the error cannot turn a later finish() into a seemingly valid partial import.
      failure = error instanceof Error ? error : new Error(String(error));
      index.clear();
      throw failure;
    }
  };
  const finish = (): RuntimeInstructionTraceImportResult => {
    if (failure) {
      throw failure;
    }
    if (finished) {
      throw new Error("Instruction trace import already finished.");
    }
    finished = true;
    const sourceSha256 = hash
      .update(chunks ? "\n  ]" : "[]")
      .update(suffix)
      .digest("hex");
    storage?.onSource?.(sourceSha256, "full");
    const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
    const evidenceIds = [evidenceId];
    const executions: RuntimeEvidenceRecord[] = [];
    const facts: RuntimeEvidenceRecord[] = [];
    let processedRecords = 0;
    let lastProgress = performance.now();
    storage?.onMergeProgress?.(0, indexRecords);
    const emit = (record: RuntimeEvidenceRecord): void => {
      if (storage?.onRecord) {
        storage.onRecord(record);
      } else if (record.kind === "runtime-execution") {
        executions.push(record);
      } else {
        facts.push(record);
      }
      processedRecords++;
      // Synchronous SQLite publication cannot run timer callbacks. Report from the work loop,
      // checking the clock only periodically and always delivering the exact final count.
      if (
        storage?.onMergeProgress &&
        (processedRecords === indexRecords ||
          (processedRecords % 128 === 0 && performance.now() - lastProgress >= 1000))
      ) {
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
        } else if (fact.kind === "instruction") {
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
        } else {
          emit({
            ...fact.record,
            id: `${evidenceId}:${fact.record.id}`,
            count,
            evidence: evidenceIds,
          });
        }
      }
    } finally {
      index.clear();
    }
    const runtime = executions.sort((a, b) => {
      if (a.kind !== "runtime-execution" || b.kind !== "runtime-execution") {
        return 0;
      }
      return a.address - b.address;
    });
    for (const fact of facts.sort((a, b) => a.id.localeCompare(b.id))) {
      runtime.push(fact);
    }
    const evidence: EvidenceRecord = {
      id: evidenceId,
      source: "runtime",
      sourceId: `${artifact.producer.id}:${artifact.producer.revision}`,
      confidence:
        droppedEvents === 0 && memoryLoss === 0 && unattributed === 0 && complete
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
    const report: ImportReport = {
      id: `import:instruction-trace:${sourceSha256}`,
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
      unsupported:
        droppedEvents === 0
          ? []
          : [
              {
                field: "instruction-addresses",
                count: droppedEvents,
                reason: "Producer buffer overflow occurred before these events could be pulled.",
              },
            ],
      warnings: [
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
  return { push, finish };
};
