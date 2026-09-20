import { canonicalJson } from "./canonical-json.js";
import type { AnalysisRecord, RuntimeEvidenceRecord, RuntimeStateValue } from "./project-types.js";
import type { RuntimeBusFact } from "./runtime-bus-types.js";
import { decodeSqlitePayload, decodeSqliteRuntimeIdentity } from "./sqlite-payload.js";

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

/**
 * Reconstruct a semantic fact without inventing absent optional fields. Stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param {object} row SQLite runtime row selected with all columns.
 * @returns {RuntimeEvidenceRecord} Decoded fact in its original discriminated shape.
 */
export const runtimeFromRow = (row: object): RuntimeEvidenceRecord => {
  const fields = row as Record<string, unknown>;
  const extra =
    fields.payload === null || fields.payload === undefined
      ? {}
      : (JSON.parse(decodeSqlitePayload(fields.payload)) as Record<string, unknown>);
  // LEFT JOIN keeps a corrupt dictionary reference visible. Silently omitting the row would lose history.
  if (typeof fields.evidence !== "string") {
    throw new Error("Missing SQLite runtime evidence dictionary entry.");
  }
  const evidence = JSON.parse(fields.evidence) as readonly string[];
  const kind = fields.kind as RuntimeEvidenceRecord["kind"];
  const architecture = fields.architecture as string;
  const count = Number(fields.count);
  // Legacy migration rows already have a complete text ID. Current rows join the prefix dictionary.
  const id =
    fields.id_prefix === undefined
      ? (fields.id as string)
      : decodeSqliteRuntimeIdentity(fields.id_prefix, fields.id);
  if (kind === "runtime-execution") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      ...(extra as {
        fileOffset?: number;
        size?: number;
        opcode?: number;
      }),
    };
  }
  if (kind === "runtime-instruction") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      bytes: extra.bytes as readonly number[],
      state: extra.state as Readonly<Record<string, RuntimeStateValue>>,
    };
  }
  if (kind === "runtime-bus-access") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.accessed_address_space as "snes.cpu",
      address: Number(fields.accessed_address),
      ...(extra.ppu === undefined ? {} : { ppu: extra.ppu as RuntimeBusFact["ppu"] }),
      pc: extra.pc as number,
      value: extra.value as number,
      direction: extra.direction as RuntimeBusFact["direction"],
      actor: extra.actor as RuntimeBusFact["actor"],
      channel: extra.channel as number | null,
      phase: extra.phase as RuntimeBusFact["phase"],
      context: extra.context as RuntimeBusFact["context"],
    };
  }
  if (kind === "runtime-memory-access") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      instructionAddressSpace: fields.instruction_address_space as string,
      instructionAddress: Number(fields.instruction_address),
      accessedAddressSpace: fields.accessed_address_space as string,
      accessedAddress: Number(fields.accessed_address),
      access: extra.access as "read" | "write" | "read-write" | "unknown",
      width: extra.width as number,
      ...(extra.actor === undefined ? {} : { actor: extra.actor as "cpu" | "dma" | "hdma" }),
      ...(extra.channel === undefined ? {} : { channel: extra.channel as number }),
      ...(extra.value === undefined ? {} : { value: extra.value as number }),
    };
  }
  if (kind === "runtime-cpu-state") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      state: extra.state as Readonly<Record<string, RuntimeStateValue>>,
    };
  }
  if (kind === "runtime-coverage") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      start: Number(fields.start),
      end: Number(fields.end),
      coverage: fields.coverage as "executed" | "operand" | "read" | "written",
    };
  }
  if (kind !== "runtime-control-target") {
    throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
  }
  return {
    id,
    kind: "runtime-control-target",
    architecture,
    count,
    evidence,
    fromAddressSpace: fields.from_address_space as string,
    fromAddress: Number(fields.from_address),
    toAddressSpace: fields.to_address_space as string,
    toAddress: Number(fields.to_address),
    flowKind: extra.flowKind as string,
    indirect: Boolean(extra.indirect),
  };
};

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
