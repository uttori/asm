import { createHash } from "node:crypto";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { TraceCache } from "../internal/trace-cache.js";
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
import { snesAnalysisTraceState, SNES_ANALYSIS_TRACE_PROFILE } from "./runtime-analysis-profile.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { TraceChunkFormatter } from "./trace-chunk-formatter.js";

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
  /** Complete cartridge identity, including iNES mapper/header bytes. */
  readonly romFileSha256?: string;
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
  /** Full retains supplied registers. Analysis retains SNES decoder state and all memory facts. Defaults to full. */
  readonly indexMode?: string;
  /**
   * Maximum emitted runtime facts: one per PC, two per byte/state variant, one per bus variant.
   * In-memory imports default to 8M records, with an 8M ceiling.
   * Disk indexes with a record sink default to Number.MAX_SAFE_INTEGER and accept any positive
   * safe integer budget. Explicit budgets apply to both paths. Not a byte/heap limit.
   */
  readonly maxIndexRecords?: number;
}

/** Full preserves registers; analysis consolidates SNES snapshots by decoder state and opcode bytes. */
export type RuntimeTraceIndexMode = "full" | "analysis";
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

function isRowRecord(value: object): value is UnknownRecord {
  return !Array.isArray(value);
}

const record = (value: unknown, context: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || !isRowRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
};

const string = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
};

const integer = (value: unknown, context: string, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value;
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
  /** Recheck external companions when a content-matched, previously validated index replaces read(). */
  readonly verifyRetained?: () => Promise<void>;
  /** Available after a successful opt-in prefix read; absent for terminally verified captures. */
  readonly recovery?: {
    readonly chunkThrough: string;
    readonly eventThrough: string;
    readonly reason: string;
  };
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
      // The validator owns this tree and emits canonical property order. The import hash can
      // stringify it directly without recursively sorting and copying every register again.
      active: input.active,
      addresses: input.addresses.map((address, addressIndex) =>
        integer(address, `Instruction trace chunk ${index} address ${addressIndex}`),
      ),
      ...(input.details === undefined
        ? {}
        : { details: validateRuntimeInstructionDetails(input.details, input.addresses.length) }),
      droppedEvents: integer(input.droppedEvents, `Instruction trace chunk ${index} droppedEvents`),
      sequenceStart: integer(
        input.sequenceStart,
        `Instruction trace chunk ${index} sequenceStart`,
        1,
      ),
      ...(input.unattributedMemoryAccesses === undefined
        ? {}
        : {
            unattributedMemoryAccesses: integer(
              input.unattributedMemoryAccesses,
              "Unattributed trace memory accesses",
            ),
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
  value: unknown,
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
  | { readonly kind: "execution"; readonly address: number; readonly identity?: string }
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
  /** Complete parser summary paired atomically with this index; never resume a partial parse. */
  readonly checkpoint?: RuntimeTraceCheckpoint;
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
 * @param {string} mode Full snapshots or compact analysis state.
 * @param {number} requested Explicit caller budget, if any.
 * @param {RuntimeTraceImporterStorage} storage Optional counter storage and final record sink.
 * @returns {number} Positive safe integer limit, or throws for an invalid or unsafe memory budget.
 */
export const runtimeTraceIndexRecordLimit = (
  mode: string,
  requested: number | undefined,
  storage?: RuntimeTraceImporterStorage,
): number => {
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
  /** Seal the validated stream for retry, retaining counters on disk until publication succeeds. */
  checkpoint(recovery?: RuntimeTraceSource["recovery"]): RuntimeTraceCheckpoint;
  /** Consume once after verifying a complete capture or an explicitly allowed checkpointed prefix. */
  finish(recovery?: RuntimeTraceSource["recovery"]): RuntimeInstructionTraceImportResult;
}

/** Small sealed parser state. The owning cache binds it to archive, ROM, importer and index identities. */
export interface RuntimeTraceCheckpoint {
  readonly sourceSha256: string;
  readonly executionRecords: number;
  readonly memoryRecords: number;
  readonly indexRecords: number;
  readonly observedEvents: number;
  readonly droppedEvents: number;
  readonly complete: boolean;
  readonly unattributed: number;
  readonly detailedEvents: number;
  readonly memoryLoss: number;
  readonly recovery?: RuntimeTraceSource["recovery"];
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
  const instructionIdentities = new TraceCache<string>();
  const chunkFormatter = new TraceChunkFormatter();
  let sealed = storage?.checkpoint;
  let executionRecords = sealed?.executionRecords ?? 0;
  let memoryRecords = sealed?.memoryRecords ?? 0;
  let indexRecords = sealed?.indexRecords ?? 0;
  if (indexRecords > maxIndexRecords) {
    throw new Error(`Trace index exceeds ${maxIndexRecords} records.`);
  }
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
  let observedEvents = sealed?.observedEvents ?? 0;
  let droppedEvents = sealed?.droppedEvents ?? 0;
  let complete = sealed?.complete ?? false;
  let chunks = 0;
  let unattributed = sealed?.unattributed ?? 0;
  let finished = false;
  let failure: Error | undefined;
  let detailedEvents = sealed?.detailedEvents ?? 0;
  let memoryLoss = sealed?.memoryLoss ?? 0;
  const pushChunk = (input: unknown): void => {
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
      let mapping: string | undefined;
      if (artifact.architecture === "65xx.2a03") {
        if (!detail || typeof physical !== "number") {
          throw new Error(
            "NES execution evidence requires captured bytes and physical mapper identity.",
          );
        }
        // The fetch coordinate is authoritative; unknown/RAM code has no ROM offset.
        mapping = sha256(
          canonicalJson({
            physical,
            mapper: detail.state.mapper,
            prgMode: detail.state.prgMode,
            r6: detail.state.r6,
            r7: detail.state.r7,
          }),
        );
      }
      // The temporary key only needs equality. Format stable hexadecimal IDs once per distinct
      // address in finish(), rather than for every repeated execution in a long capture.
      if (
        index.add(`pc:${address}:${mapping ?? ""}`, () => ({
          kind: "execution",
          address,
          ...(mapping ? { identity: mapping } : {}),
        }))
      ) {
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
      const state =
        indexMode === "analysis" && artifact.architecture === "snes.65816"
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
  const push = (input: unknown): void => {
    if (failure) {
      throw failure;
    }
    try {
      pushChunk(input);
    } catch (error) {
      // A failure can occur partway through a chunk. Latch it and release the working set so
      // catching the error cannot turn a later finish() into a seemingly valid partial import.
      failure = error instanceof Error ? error : new Error(String(error));
      index.clear();
      throw failure;
    }
  };
  const checkpoint = (recovery?: RuntimeTraceSource["recovery"]): RuntimeTraceCheckpoint => {
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
  const finish = (
    recovery?: RuntimeTraceSource["recovery"],
  ): RuntimeInstructionTraceImportResult => {
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
    const profile =
      indexMode === "analysis" && artifact.architecture === "snes.65816"
        ? SNES_ANALYSIS_TRACE_PROFILE
        : "full";
    storage?.onSource?.(sourceSha256, profile);
    const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
    const evidenceIds = [evidenceId];
    const executions: RuntimeEvidenceRecord[] = [];
    const facts: RuntimeEvidenceRecord[] = [];
    let processedRecords = 0;
    let lastProgress = performance.now();
    storage?.onMergeProgress?.(0, indexRecords);
    const emit = (emitted: RuntimeEvidenceRecord): void => {
      if (storage?.onRecord) {
        storage.onRecord(emitted);
      } else if (emitted.kind === "runtime-execution") {
        executions.push(emitted);
      } else {
        facts.push(emitted);
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
            id: `${evidenceId}:${hex(fact.address)}${fact.identity ? `:mapping:${fact.identity}` : ""}`,
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
    const runtime = executions.toSorted((a, b) => {
      if (a.kind !== "runtime-execution" || b.kind !== "runtime-execution") {
        return 0;
      }
      return a.address - b.address;
    });
    for (const fact of facts.toSorted((a, b) => a.id.localeCompare(b.id))) {
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
