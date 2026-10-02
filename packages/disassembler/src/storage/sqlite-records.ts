import { canonicalJson } from "@uttori/asm-core/canonical-json";

import type {
  AnalysisRecord,
  RuntimeEvidenceRecord,
  RuntimeStateValue,
} from "../model/project-types.js";
import { isFiniteNumber, isRecord, isStringArray } from "../model/record-shape.js";
import type { RuntimeBusContext } from "../model/runtime-bus-types.js";
import type { RuntimePPUEffect } from "../model/runtime-ppu-effect.js";
import { parseSqlitePayload, decodeSqliteRuntimeIdentity } from "./sqlite-payload.js";

/**
 * Stable ordering for explicit runtime arrays, independent of insertion order in the working store.
 * @param {RuntimeEvidenceRecord} left First semantic record.
 * @param {RuntimeEvidenceRecord} right Second semantic record.
 * @returns {number} Lexical ID comparison. Streaming consumers deliberately do not use this sort.
 */
export const compareRuntimeRecordIds = (
  left: RuntimeEvidenceRecord,
  right: RuntimeEvidenceRecord,
): number => {
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
};

/**
 * Store searchable coordinates as columns and variant-only fields as a bounded payload.
 * Unused coordinate columns stay null so one record kind cannot masquerade as another.
 * Canonicalize payloads here once: the writer reuses this exact text for hashing
 * and encoding, avoiding a JSON stringify/parse/canonicalize round trip per fact.
 * @param {RuntimeEvidenceRecord} record Validated semantic runtime fact.
 * @returns {object} Column bindings with canonical payload text. Absent variant fields remain omitted.
 */
export const runtimeColumns = (
  record: RuntimeEvidenceRecord,
): {
  addressSpace: string | null;
  address: number | null;
  start: number | null;
  end: number | null;
  fromAddressSpace: string | null;
  fromAddress: number | null;
  toAddressSpace: string | null;
  toAddress: number | null;
  instructionAddressSpace: string | null;
  instructionAddress: number | null;
  accessedAddressSpace: string | null;
  accessedAddress: number | null;
  coverage: string | null;
  payload: string | null;
} => {
  switch (record.kind) {
    case "runtime-execution":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({
          ...(record.fileOffset === undefined ? {} : { fileOffset: record.fileOffset }),
          ...(record.size === undefined ? {} : { size: record.size }),
          ...(record.opcode === undefined ? {} : { opcode: record.opcode }),
        }),
      };
    case "runtime-instruction":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ bytes: record.bytes, state: record.state }),
      };
    case "runtime-bus-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        // Unowned accesses must never become instruction observations through a coordinate query.
        instructionAddressSpace: record.context === "instruction" ? record.addressSpace : null,
        instructionAddress: record.context === "instruction" ? record.pc : null,
        accessedAddressSpace: record.addressSpace,
        accessedAddress: record.address,
        coverage: null,
        payload: canonicalJson({
          ...(record.ppu ? { ppu: record.ppu } : {}),
          pc: record.pc,
          value: record.value,
          direction: record.direction,
          actor: record.actor,
          channel: record.channel,
          phase: record.phase,
          context: record.context,
        }),
      };
    case "runtime-memory-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: record.instructionAddressSpace,
        instructionAddress: record.instructionAddress,
        accessedAddressSpace: record.accessedAddressSpace,
        accessedAddress: record.accessedAddress,
        coverage: null,
        payload: canonicalJson({
          access: record.access,
          width: record.width,
          ...(record.actor === undefined ? {} : { actor: record.actor }),
          ...(record.channel === undefined ? {} : { channel: record.channel }),
          ...(record.value === undefined ? {} : { value: record.value }),
        }),
      };
    case "runtime-cpu-state":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ state: record.state }),
      };
    case "runtime-coverage":
      return {
        addressSpace: record.addressSpace,
        address: null,
        start: record.start,
        end: record.end,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: record.coverage,
        payload: null,
      };
    case "runtime-control-target":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: record.fromAddressSpace,
        fromAddress: record.fromAddress,
        toAddressSpace: record.toAddressSpace,
        toAddress: record.toAddress,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ flowKind: record.flowKind, indirect: record.indirect }),
      };
  }
  throw new Error("Unsupported runtime evidence kind.");
};

function isRowRecord(value: object): value is Record<string, unknown> {
  return !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid runtime ${label}.`);
  }
  return value;
}

function requireFinite(value: unknown, label: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`Invalid runtime ${label}.`);
  }
  return value;
}

function optionalFinite(record: Record<string, unknown>, key: string): number | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  return requireFinite(record[key], key);
}

function requirePayload(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) {
    throw new Error("Invalid runtime payload.");
  }
  return value;
}

function requireBytes(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid runtime bytes.");
  }
  const bytes: number[] = [];
  for (const entry of value) {
    if (!isFiniteNumber(entry)) {
      throw new Error("Invalid runtime bytes.");
    }
    bytes.push(entry);
  }
  return bytes;
}

function isRuntimeState(value: unknown): value is Readonly<Record<string, RuntimeStateValue>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry),
    )
  );
}

function requireState(value: unknown): Readonly<Record<string, RuntimeStateValue>> {
  if (!isRuntimeState(value)) {
    throw new Error("Invalid runtime state.");
  }
  return value;
}

function requireCpuSpace(value: unknown): "snes.cpu" {
  if (value === "snes.cpu") {
    return value;
  }
  throw new Error("Invalid runtime address space.");
}

function requireDirection(value: unknown): "read" | "write" {
  if (value === "read" || value === "write") {
    return value;
  }
  throw new Error("Invalid runtime direction.");
}

function requireBusActor(value: unknown): "cpu" | "dma" | "hdma" {
  if (value === "cpu" || value === "dma" || value === "hdma") {
    return value;
  }
  throw new Error("Invalid runtime actor.");
}

function requirePhase(
  value: unknown,
): "cpu" | "dma" | "hdma-indirect" | "hdma-table" | "hdma-transfer" {
  if (
    value === "cpu" ||
    value === "dma" ||
    value === "hdma-indirect" ||
    value === "hdma-table" ||
    value === "hdma-transfer"
  ) {
    return value;
  }
  throw new Error("Invalid runtime phase.");
}

function requireContext(value: unknown): RuntimeBusContext {
  if (
    value === "unattributed" ||
    value === "instruction" ||
    value === "interrupt" ||
    value === "wait" ||
    value === "stop"
  ) {
    return value;
  }
  throw new Error("Invalid runtime context.");
}

function requireNullableFinite(value: unknown, label: string): number | null {
  if (value === null) {
    return null;
  }
  return requireFinite(value, label);
}

function requireMemoryAccess(value: unknown): "read" | "write" | "read-write" | "unknown" {
  if (value === "read" || value === "write" || value === "read-write" || value === "unknown") {
    return value;
  }
  throw new Error("Invalid runtime access.");
}

function requireCoverage(value: unknown): "executed" | "operand" | "read" | "written" {
  if (value === "executed" || value === "operand" || value === "read" || value === "written") {
    return value;
  }
  throw new Error("Invalid runtime coverage.");
}

function isPpuByte(value: unknown): value is { address: number; value: number } {
  return isRecord(value) && isFiniteNumber(value.address) && isFiniteNumber(value.value);
}

function requirePpu(value: unknown): RuntimePPUEffect {
  if (
    !isRecord(value) ||
    (value.target !== "vram" && value.target !== "cgram" && value.target !== "oam") ||
    (value.outcome !== "written" && value.outcome !== "blocked" && value.outcome !== "latched") ||
    typeof value.forcedBlank !== "boolean" ||
    typeof value.renderingRestricted !== "boolean" ||
    (value.implementation !== "accurate" && value.implementation !== "performance") ||
    (value.vramBytes !== null && value.vramBytes !== 65536 && value.vramBytes !== 131072) ||
    !Array.isArray(value.bytes)
  ) {
    throw new Error("Invalid runtime ppu effect.");
  }
  const bytes: { address: number; value: number }[] = [];
  for (const entry of value.bytes) {
    if (!isPpuByte(entry)) {
      throw new Error("Invalid runtime ppu effect.");
    }
    bytes.push({ address: entry.address, value: entry.value });
  }
  return {
    target: value.target,
    outcome: value.outcome,
    forcedBlank: value.forcedBlank,
    renderingRestricted: value.renderingRestricted,
    implementation: value.implementation,
    vramBytes: value.vramBytes,
    bytes,
  };
}

function readPayload(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) {
    return {};
  }
  const parsed = parseSqlitePayload(value);
  return isRecord(parsed) ? parsed : undefined;
}

/**
 * Reconstruct a semantic fact without inventing absent optional fields. Stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param {object} row SQLite runtime row selected with all columns.
 * @returns {RuntimeEvidenceRecord} Decoded fact in its original discriminated shape.
 */
export const runtimeFromRow = (row: object): RuntimeEvidenceRecord => {
  if (!isRowRecord(row)) {
    throw new Error("Invalid runtime row.");
  }
  const extra = readPayload(row.payload);
  // LEFT JOIN keeps a corrupt dictionary reference visible. Silently omitting the row would lose history.
  if (typeof row.evidence !== "string") {
    throw new Error("Missing SQLite runtime evidence dictionary entry.");
  }
  const parsedEvidence: unknown = JSON.parse(row.evidence);
  if (!isStringArray(parsedEvidence)) {
    throw new Error("Invalid runtime evidence list.");
  }
  const kind = row.kind;
  const count = Number(row.count);
  const id = decodeSqliteRuntimeIdentity(row.id_prefix, row.id);
  if (kind === "runtime-execution") {
    const body = requirePayload(extra);
    const fileOffset = optionalFinite(body, "fileOffset");
    const size = optionalFinite(body, "size");
    const opcode = optionalFinite(body, "opcode");
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      ...(fileOffset === undefined ? {} : { fileOffset }),
      ...(size === undefined ? {} : { size }),
      ...(opcode === undefined ? {} : { opcode }),
    };
  }
  if (kind === "runtime-instruction") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      bytes: requireBytes(body.bytes),
      state: requireState(body.state),
    };
  }
  if (kind === "runtime-bus-access") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      ...(body.ppu === undefined ? {} : { ppu: requirePpu(body.ppu) }),
      addressSpace: requireCpuSpace(row.accessed_address_space),
      address: Number(row.accessed_address),
      pc: requireFinite(body.pc, "pc"),
      value: requireFinite(body.value, "value"),
      direction: requireDirection(body.direction),
      actor: requireBusActor(body.actor),
      channel: requireNullableFinite(body.channel, "channel"),
      phase: requirePhase(body.phase),
      context: requireContext(body.context),
    };
  }
  if (kind === "runtime-memory-access") {
    const body = requirePayload(extra);
    const actor = optionalBusActor(body);
    const channel = optionalFinite(body, "channel");
    const value = optionalFinite(body, "value");
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      instructionAddressSpace: requireString(row.instruction_address_space, "address space"),
      instructionAddress: Number(row.instruction_address),
      accessedAddressSpace: requireString(row.accessed_address_space, "address space"),
      accessedAddress: Number(row.accessed_address),
      access: requireMemoryAccess(body.access),
      width: requireFinite(body.width, "width"),
      ...actor,
      ...(channel === undefined ? {} : { channel }),
      ...(value === undefined ? {} : { value }),
    };
  }
  if (kind === "runtime-cpu-state") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      state: requireState(body.state),
    };
  }
  if (kind === "runtime-coverage") {
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      start: Number(row.start),
      end: Number(row.end),
      coverage: requireCoverage(row.coverage),
    };
  }
  if (kind === "runtime-control-target") {
    const body = requirePayload(extra);
    return {
      id,
      kind: "runtime-control-target",
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      fromAddressSpace: requireString(row.from_address_space, "address space"),
      fromAddress: Number(row.from_address),
      toAddressSpace: requireString(row.to_address_space, "address space"),
      toAddress: Number(row.to_address),
      flowKind: requireString(body.flowKind, "flow kind"),
      indirect: Boolean(body.indirect),
    };
  }
  throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
};

function optionalBusActor(record: Record<string, unknown>): { actor?: "cpu" | "dma" | "hdma" } {
  if (!Object.hasOwn(record, "actor")) {
    return {};
  }
  return { actor: requireBusActor(record.actor) };
}

function allowsFinite(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

/** Flat semantic runtime fact, as stored inside an indexed trace payload. */
export function isRuntimeEvidenceRecord(value: unknown): value is RuntimeEvidenceRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.architecture !== "string" ||
    !isFiniteNumber(value.count) ||
    !isStringArray(value.evidence)
  ) {
    return false;
  }
  switch (value.kind) {
    case "runtime-execution":
      return (
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        allowsFinite(value.fileOffset) &&
        allowsFinite(value.size) &&
        allowsFinite(value.opcode)
      );
    case "runtime-instruction":
      return (
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        Array.isArray(value.bytes) &&
        value.bytes.every(isFiniteNumber) &&
        isRuntimeState(value.state)
      );
    case "runtime-cpu-state":
      return (
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        isRuntimeState(value.state)
      );
    case "runtime-coverage":
      return (
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.start) &&
        isFiniteNumber(value.end) &&
        (value.coverage === "executed" ||
          value.coverage === "operand" ||
          value.coverage === "read" ||
          value.coverage === "written")
      );
    case "runtime-control-target":
      return (
        typeof value.fromAddressSpace === "string" &&
        isFiniteNumber(value.fromAddress) &&
        typeof value.toAddressSpace === "string" &&
        isFiniteNumber(value.toAddress) &&
        typeof value.flowKind === "string" &&
        typeof value.indirect === "boolean"
      );
    case "runtime-memory-access":
      return (
        typeof value.instructionAddressSpace === "string" &&
        isFiniteNumber(value.instructionAddress) &&
        typeof value.accessedAddressSpace === "string" &&
        isFiniteNumber(value.accessedAddress) &&
        (value.access === "read" ||
          value.access === "write" ||
          value.access === "read-write" ||
          value.access === "unknown") &&
        isFiniteNumber(value.width) &&
        (value.actor === undefined ||
          value.actor === "cpu" ||
          value.actor === "dma" ||
          value.actor === "hdma") &&
        allowsFinite(value.channel) &&
        allowsFinite(value.value)
      );
    case "runtime-bus-access":
      return (
        (value.ppu === undefined || isBusPpu(value.ppu)) &&
        value.addressSpace === "snes.cpu" &&
        isFiniteNumber(value.address) &&
        isFiniteNumber(value.pc) &&
        isFiniteNumber(value.value) &&
        (value.direction === "read" || value.direction === "write") &&
        (value.actor === "cpu" || value.actor === "dma" || value.actor === "hdma") &&
        (value.channel === null || isFiniteNumber(value.channel)) &&
        (value.phase === "cpu" ||
          value.phase === "dma" ||
          value.phase === "hdma-indirect" ||
          value.phase === "hdma-table" ||
          value.phase === "hdma-transfer") &&
        (value.context === "unattributed" ||
          value.context === "instruction" ||
          value.context === "interrupt" ||
          value.context === "wait" ||
          value.context === "stop")
      );
    default:
      return false;
  }
}

function isBusPpu(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.target === "vram" || value.target === "cgram" || value.target === "oam") &&
    (value.outcome === "written" || value.outcome === "blocked" || value.outcome === "latched") &&
    typeof value.forcedBlank === "boolean" &&
    typeof value.renderingRestricted === "boolean" &&
    (value.implementation === "accurate" || value.implementation === "performance") &&
    (value.vramBytes === null || value.vramBytes === 65536 || value.vramBytes === 131072) &&
    Array.isArray(value.bytes) &&
    value.bytes.every(isPpuByte)
  );
}

/**
 * Extract a point coordinate for persisted analysis metadata. Interval-only records have none.
 * @param {AnalysisRecord} record Semantic analysis variant.
 * @returns {object} Point or source coordinate, with null columns when no point is represented.
 */
export const analysisAddress = (
  record: AnalysisRecord,
): { addressSpace: string | null; address: number | null } => {
  if ("addressSpace" in record && "address" in record) {
    return { addressSpace: record.addressSpace, address: record.address };
  }
  if ("addressSpace" in record && "fromAddress" in record) {
    return { addressSpace: record.addressSpace, address: record.fromAddress };
  }
  return { addressSpace: null, address: null };
};
