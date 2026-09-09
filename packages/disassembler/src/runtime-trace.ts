import { createHash } from "node:crypto";

import type { EvidenceRecord, ImportReport, RuntimeEvidenceRecord } from "./project-types.js";
import {
  validateRuntimeInstructionDetails,
  type RuntimeInstructionDetail,
} from "./trace-detail.js";
import { canonicalJson } from "./project-store.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";

/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export const RUNTIME_INSTRUCTION_TRACE_FORMAT = "uttori-asm-instruction-trace" as const;

/** Initial trace-artifact schema. The project is unreleased, so this remains version 1. */
export const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION = 1 as const;

/** One bounded producer pull stored in a native instruction-trace artifact. */
export interface RuntimeInstructionTraceChunk {
  readonly sequenceStart: number;
  readonly addresses: readonly number[];
  /** Optional execution-time detail; legacy PC-only chunks remain valid. */
  readonly details?: readonly RuntimeInstructionDetail[];
  /** Cumulative bus operations outside a captured CPU instruction (interrupt/wait periods). */
  readonly unattributedMemoryAccesses?: number;
  readonly droppedEvents: number;
  readonly active: boolean;
}

/**
 * Immutable recording artifact created only by an explicit recorder.
 * Chunks preserve observed order and producer loss; project facts are aggregated during import.
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
  readonly projectRomContentSha256: string;
  readonly sourceName: string;
}

/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
  readonly batch: RuntimeEvidenceBatch;
  readonly report: ImportReport;
  readonly sourceSha256: string;
  readonly observedEvents: number;
  readonly droppedEvents: number;
}

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown, context: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value as UnknownRecord;
};

const string = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${context} must be a non-empty string.`);
  return value;
};

const integer = (value: unknown, context: string, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  return value as number;
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const sha256Identity = (value: unknown, context: string): string => {
  const identity = string(value, context);
  if (!/^[\da-f]{64}$/.test(identity))
    throw new Error(`${context} must be a lowercase SHA-256 identity.`);
  return identity;
};

const hex = (value: number): string => value.toString(16).toUpperCase().padStart(6, "0");

/** Identity shared by all chunks of one trace. */
export type RuntimeInstructionTraceMetadata = Omit<RuntimeInstructionTraceArtifact, "chunks">;

/**
 * Validate the small trace envelope independently of its event stream.
 * @param {unknown} value Untrusted metadata.
 * @returns {RuntimeInstructionTraceMetadata} Normalized identity.
 */
export const validateRuntimeInstructionTraceMetadata = (
  value: unknown,
): RuntimeInstructionTraceMetadata => {
  const artifact = record(value, "Instruction trace artifact");
  if (artifact.format !== RUNTIME_INSTRUCTION_TRACE_FORMAT)
    throw new Error(`Unsupported instruction trace format '${String(artifact.format)}'.`);
  if (artifact.schemaVersion !== RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION)
    throw new Error(
      `Unsupported instruction trace schema version '${String(artifact.schemaVersion)}'.`,
    );
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
    if (!Array.isArray(input.addresses))
      throw new Error(`Instruction trace chunk ${index} addresses must be an array.`);
    if (typeof input.active !== "boolean")
      throw new Error(`Instruction trace chunk ${index} active must be boolean.`);
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
export const validateRuntimeInstructionTrace = (
  value: unknown,
): RuntimeInstructionTraceArtifact => {
  const metadata = validateRuntimeInstructionTraceMetadata(value);
  const input = record(value, "Instruction trace artifact");
  if (!Array.isArray(input.chunks)) throw new Error("Instruction trace chunks must be an array.");
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
  if (!Array.isArray(artifact.chunks))
    throw new Error("Instruction trace chunks must be an array.");
  const importer = createRuntimeInstructionTraceImporter(
    validateRuntimeInstructionTraceMetadata(value),
    context,
  );
  for (const chunk of artifact.chunks) importer.push(chunk);
  return importer.finish();
};

/** Incremental import state, retaining aggregated facts rather than the recording. */
export interface RuntimeInstructionTraceImporter {
  push(value: unknown): void;
  finish(): RuntimeInstructionTraceImportResult;
}

/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer; finish only after the file validates.
 */
export const createRuntimeInstructionTraceImporter = (
  value: RuntimeInstructionTraceMetadata,
  context: RuntimeInstructionTraceImportContext,
): RuntimeInstructionTraceImporter => {
  const artifact = validateRuntimeInstructionTraceMetadata(value);
  const projectRomContentSha256 = sha256Identity(
    context.projectRomContentSha256,
    "Project ROM content identity",
  );
  if (artifact.romContentSha256 !== projectRomContentSha256)
    throw new Error(
      `ROM/project mismatch: project expects ${projectRomContentSha256}, trace describes ${artifact.romContentSha256}.`,
    );
  const sourceName = string(context.sourceName, "Instruction trace source name");
  const addressSpace = string(artifact.addressSpace, "Instruction trace project address space");
  // Match canonicalJson({...metadata, chunks}) exactly without making one huge string.
  const envelope = canonicalJson({ ...artifact, chunks: [] });
  const split = envelope.indexOf('  "chunks": []') + '  "chunks": '.length;
  const hash = createHash("sha256").update(envelope.slice(0, split));
  const suffix = envelope.slice(split + 2);
  const validateChunk = createRuntimeTraceChunkValidator();
  const counts = new Map<number, number>();
  const observations = new Map<string, RuntimeEvidenceRecord>();
  let observedEvents = 0;
  let droppedEvents = 0;
  let complete = false;
  let chunks = 0;
  let unattributed = 0;
  let finished = false;
  let detailedEvents = 0;
  let memoryLoss = 0;
  const add = (record: RuntimeEvidenceRecord): void => {
    const previous = observations.get(record.id);
    observations.set(record.id, { ...record, count: (previous?.count ?? 0) + 1 });
  };
  const push = (value: unknown): void => {
    if (finished) throw new Error("Instruction trace import already finished.");
    const chunk = validateChunk(value);
    hash.update(chunks++ === 0 ? "[\n" : ",\n");
    hash.update(
      canonicalJson(chunk)
        .trimEnd()
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n"),
    );
    droppedEvents = chunk.droppedEvents;
    complete = !chunk.active;
    unattributed = chunk.unattributedMemoryAccesses ?? unattributed;
    for (const address of chunk.addresses) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
      observedEvents++;
    }
    for (const [index, detail] of (chunk.details ?? []).entries()) {
      detailedEvents++;
      memoryLoss += detail.droppedMemoryAccesses ?? 0;
      const address = chunk.addresses[index];
      const base = { architecture: artifact.architecture, count: 1, evidence: [] };
      const identity = sha256(canonicalJson({ address, bytes: detail.bytes, state: detail.state }));
      add({
        ...base,
        id: `code:${identity}`,
        kind: "runtime-instruction",
        addressSpace,
        address,
        bytes: detail.bytes,
        state: detail.state,
      });
      add({
        ...base,
        id: `state:${identity}`,
        kind: "runtime-cpu-state",
        addressSpace,
        address,
        state: detail.state,
      });
      for (const access of detail.memoryAccesses ?? []) {
        if (access.access === "fetch") continue;
        const accessIdentity = sha256(canonicalJson({ instructionAddress: address, ...access }));
        add({
          ...base,
          id: `memory:${accessIdentity}`,
          kind: "runtime-memory-access",
          instructionAddressSpace: addressSpace,
          instructionAddress: address,
          accessedAddressSpace: access.addressSpace,
          accessedAddress: access.address,
          access: access.access,
          width: access.width,
          ...(access.value === undefined ? {} : { value: access.value }),
          ...(access.actor === undefined ? {} : { actor: access.actor }),
          ...(access.channel === undefined ? {} : { channel: access.channel }),
        });
      }
    }
  };
  const finish = (): RuntimeInstructionTraceImportResult => {
    if (finished) throw new Error("Instruction trace import already finished.");
    finished = true;
    const sourceSha256 = hash
      .update(chunks ? "\n  ]" : "[]")
      .update(suffix)
      .digest("hex");
    const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
    const evidenceIds = [evidenceId];
    const runtime: RuntimeEvidenceRecord[] = [...counts]
      .sort(([left], [right]) => left - right)
      .map(([address, count]) => ({
        id: `${evidenceId}:${hex(address)}`,
        kind: "runtime-execution",
        architecture: artifact.architecture,
        addressSpace,
        address,
        count,
        evidence: evidenceIds,
      }));
    for (const observation of [...observations.values()].sort((a, b) => a.id.localeCompare(b.id)))
      runtime.push({
        ...observation,
        id: `${evidenceId}:${observation.id}`,
        evidence: evidenceIds,
      });
    observations.clear();
    const evidence: EvidenceRecord = {
      id: evidenceId,
      source: "runtime",
      sourceId: `${artifact.producer.id}:${artifact.producer.revision}`,
      confidence:
        droppedEvents === 0 && memoryLoss === 0 && unattributed === 0 && complete
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
    const report: ImportReport = {
      id: `import:instruction-trace:${sourceSha256}`,
      format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
      sourceName,
      sourceSha256,
      sourceVersion: `v${RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION}@${artifact.producer.id}:${artifact.producer.revision}`,
      imported: {
        executionRecords: counts.size,
        executionEvents: observedEvents,
        detailedEvents,
        memoryRecords: runtime.filter((entry) => entry.kind === "runtime-memory-access").length,
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
      batch: { runtime, evidence: [evidence], imports: [report] },
      report,
      sourceSha256,
      observedEvents,
      droppedEvents,
    };
  };
  return { push, finish };
};
