import { createHash } from "node:crypto";

import type { EvidenceRecord, ImportReport, RuntimeExecutionRecord } from "./project-types.js";
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

const validateArtifact = (
  value: RuntimeInstructionTraceArtifact,
): RuntimeInstructionTraceArtifact => {
  const artifact = record(value, "Instruction trace artifact");
  if (artifact.format !== RUNTIME_INSTRUCTION_TRACE_FORMAT)
    throw new Error(`Unsupported instruction trace format '${String(artifact.format)}'.`);
  if (artifact.schemaVersion !== RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION)
    throw new Error(
      `Unsupported instruction trace schema version '${String(artifact.schemaVersion)}'.`,
    );
  const producer = record(artifact.producer, "Instruction trace producer");
  if (!Array.isArray(artifact.chunks))
    throw new Error("Instruction trace chunks must be an array.");
  const chunks = artifact.chunks.map((value, index): RuntimeInstructionTraceChunk => {
    const chunk = record(value, `Instruction trace chunk ${index}`);
    if (!Array.isArray(chunk.addresses))
      throw new Error(`Instruction trace chunk ${index} addresses must be an array.`);
    if (typeof chunk.active !== "boolean")
      throw new Error(`Instruction trace chunk ${index} active must be boolean.`);
    return {
      sequenceStart: integer(
        chunk.sequenceStart,
        `Instruction trace chunk ${index} sequenceStart`,
        1,
      ),
      addresses: chunk.addresses.map((address, addressIndex) =>
        integer(address, `Instruction trace chunk ${index} address ${addressIndex}`),
      ),
      droppedEvents: integer(chunk.droppedEvents, `Instruction trace chunk ${index} droppedEvents`),
      active: chunk.active,
    };
  });
  let expectedSequence = 1;
  let previousDropped = 0;
  let stopped = false;
  for (const [index, chunk] of chunks.entries()) {
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
  }
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
    chunks,
  };
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
  const artifact = validateArtifact(value);
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
  const sourceSha256 = sha256(canonicalJson(artifact));
  const evidenceId = `runtime:instruction-trace:${sourceSha256}`;
  const counts = new Map<number, number>();
  let observedEvents = 0;
  for (const chunk of artifact.chunks) {
    for (const address of chunk.addresses) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
      observedEvents++;
    }
  }
  const droppedEvents = artifact.chunks.at(-1)?.droppedEvents ?? 0;
  const complete = artifact.chunks.length > 0 && artifact.chunks.at(-1)?.active === false;
  const runtime: RuntimeExecutionRecord[] = [...counts]
    .sort(([left], [right]) => left - right)
    .map(([address, count]) => ({
      id: `runtime:instruction-trace:${sourceSha256}:${hex(address)}`,
      kind: "runtime-execution",
      architecture: artifact.architecture,
      addressSpace,
      address,
      count,
      evidence: [evidenceId],
    }));
  const evidence: EvidenceRecord = {
    id: evidenceId,
    source: "runtime",
    sourceId: `${artifact.producer.id}:${artifact.producer.revision}`,
    confidence: droppedEvents === 0 && complete ? "certain" : "high",
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
    imported: { executionRecords: runtime.length, executionEvents: observedEvents },
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
    warnings: complete ? [] : ["Trace artifact ended while capture was still active."],
  };
  return {
    batch: { runtime, evidence: [evidence], imports: [report] },
    report,
    sourceSha256,
    observedEvents,
    droppedEvents,
  };
};
