import { createHash } from "node:crypto";

import { CRC32, Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import {
  canonicalJson,
  type AnalysisTargetOverrideRecord,
  type EvidenceRecord,
  type ImportReport,
  type IntervalAnnotation,
  type RomImage,
  type RuntimeControlTargetRecord,
  type RuntimeCoverageRecord,
  type RuntimeCpuStateRecord,
  type RuntimeEvidenceBatch,
  type RuntimeEvidenceRecord,
  type RuntimeExecutionRecord,
  type RuntimeMemoryAccessRecord,
  type RuntimeStateValue,
} from "@uttori/asm-disassembler";

import { Cpu65816Decoder, type Cpu65816DecodeState } from "../architectures/65816-decoder.js";
import {
  createSnesAddressContext,
  identifySnesCpuAddress,
  identifySnesFileOffset,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
} from "./address-identities.js";
import type { SnesMapper } from "./rom-header.js";

/** MesenCE revision whose CDL, label, and default trace formats this importer was checked against. */
export const MESEN_CE_EVIDENCE_REVISION = "af2342818ca81a93b346146802047760400fc7b1";

const CDL_HEADER = new TextEncoder().encode("CDLv2");
const CDL_HEADER_SIZE = 9;
const CDL_CODE = 0x01;
const CDL_DATA = 0x02;
const CDL_JUMP_TARGET = 0x04;
const CDL_SUB_ENTRY = 0x08;
const CDL_INDEX_8 = 0x10;
const CDL_MEMORY_8 = 0x20;
const CDL_GSU = 0x40;
const CDL_CX4 = 0x80;

/** ROM and mapper identity already accepted by the native project. */
export interface MesenEvidenceContext {
  readonly sourceName: string;
  readonly projectRomContentSha256: string;
  readonly projectMapper: SnesMapper;
}

/** Required capture metadata because a raw MesenCE trace file has no ROM header or fingerprint. */
export interface MesenTraceCaptureMetadata {
  readonly schemaVersion: 1;
  readonly architecture: "snes.65816";
  readonly romContentSha256: string;
  readonly mapper: SnesMapper;
  readonly mesenRevision?: string;
}

/** Normalized records and report created by one MesenCE evidence import. */
export interface MesenEvidenceImportResult {
  readonly batch: RuntimeEvidenceBatch;
  readonly report: ImportReport;
}

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const stableSuffix = (value: unknown): string => sha256(canonicalJson(value)).slice(0, 16);

const hex = (value: number, width: number): string =>
  value.toString(16).toUpperCase().padStart(width, "0");

const assertContext = (rom: RomImage, mapper: SnesMapper, context: MesenEvidenceContext): void => {
  if (context.projectRomContentSha256 !== rom.identity.contentSha256) {
    throw new Error(
      `ROM/project mismatch: project expects ${context.projectRomContentSha256}, loaded ROM is ${rom.identity.contentSha256}.`,
    );
  }
  if (context.projectMapper !== mapper) {
    throw new Error(
      `Mapper/project mismatch: project expects '${context.projectMapper}', importer received '${mapper}'.`,
    );
  }
};

const littleEndian32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)) >>>
  0;

const rangeRecords = (
  flags: Uint8Array,
  mask: number,
  coverage: RuntimeCoverageRecord["coverage"],
  evidenceId: string,
  sourceSha256: string,
): readonly RuntimeCoverageRecord[] => {
  const records: RuntimeCoverageRecord[] = [];
  let start = -1;
  for (let offset = 0; offset <= flags.length; offset++) {
    const matches = offset < flags.length && (flags[offset] & mask) !== 0;
    if (matches && start < 0) {
      start = offset;
    }
    if (!matches && start >= 0) {
      records.push({
        id: `runtime:mesence-cdl:${sourceSha256}:${coverage}:${hex(start, 6)}-${hex(offset, 6)}`,
        kind: "runtime-coverage",
        architecture: "snes.65816",
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start,
        end: offset,
        coverage,
        count: 1,
        evidence: [evidenceId],
      });
      start = -1;
    }
  }
  return records;
};

const annotationForInstruction = (
  fileOffset: number,
  size: number,
  state: Cpu65816DecodeState,
  evidenceId: string,
  sourceSha256: string,
): readonly IntervalAnnotation[] => {
  const suffix = `${sourceSha256}:${hex(fileOffset, 6)}:${stableSuffix(state)}`;
  const normalizedState: NonNullable<IntervalAnnotation["state"]> = {
    ...(typeof state.e === "boolean" ? { e: state.e } : {}),
    ...(typeof state.m === "boolean" ? { m: state.m } : {}),
    ...(typeof state.x === "boolean" ? { x: state.x } : {}),
    ...(state.programBank === undefined ? {} : { programBank: state.programBank }),
    ...(state.dataBank === undefined ? {} : { dataBank: state.dataBank }),
    ...(state.directPage === undefined ? {} : { directPage: state.directPage }),
  };
  return [
    {
      id: `runtime:mesence:opcode:${suffix}`,
      addressSpace: SNES_FILE_ADDRESS_SPACE,
      start: fileOffset,
      end: fileOffset + 1,
      classification: "opcode",
      architecture: "snes.65816",
      state: normalizedState,
      points: ["in"],
      evidence: [evidenceId],
    },
    ...(size > 1
      ? [
          {
            id: `runtime:mesence:operand:${suffix}`,
            addressSpace: SNES_FILE_ADDRESS_SPACE,
            start: fileOffset + 1,
            end: fileOffset + size,
            classification: "operand" as const,
            architecture: "snes.65816",
            evidence: [evidenceId],
          },
        ]
      : []),
  ];
};

const evidenceRecord = (
  kind: "cdl" | "trace",
  sourceSha256: string,
  rom: RomImage,
  mapper: SnesMapper,
  detail: string,
): EvidenceRecord => ({
  id: `runtime:mesence-${kind}:${sourceSha256}`,
  source: "runtime",
  sourceId: `mesence:${MESEN_CE_EVIDENCE_REVISION}:${kind}`,
  confidence: "certain",
  detail,
  artifact: {
    format: kind === "cdl" ? "mesence-cdl" : "mesence-trace",
    formatVersion: kind === "cdl" ? "CDLv2" : "text-v1",
    sha256: sourceSha256,
    romContentSha256: rom.identity.contentSha256,
    mapper,
  },
});

const importReport = (
  kind: "cdl" | "trace",
  sourceName: string,
  sourceSha256: string,
  imported: Readonly<Record<string, number>>,
  unsupported: ImportReport["unsupported"],
  warnings: readonly string[],
): ImportReport => ({
  id: `import:mesence-${kind}:${sourceSha256}`,
  format: kind === "cdl" ? "mesence-cdl" : "mesence-trace",
  sourceName,
  sourceSha256,
  sourceVersion: `${kind === "cdl" ? "CDLv2" : "text-v1"}@${MESEN_CE_EVIDENCE_REVISION}`,
  imported,
  unsupported,
  warnings,
});

/**
 * Imports a stock SNES MesenCE `CDLv2` file. Headerless legacy CDL is deliberately refused:
 * without its CRC, the source ROM cannot be verified before evidence is applied.
 * @param {Uint8Array} bytes Complete CDL file bytes.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenEvidenceImportResult} Normalized evidence batch and import report.
 */
export const importMesenSnesCdl = (
  bytes: Uint8Array,
  rom: RomImage,
  mapper: SnesMapper,
  context: MesenEvidenceContext,
): MesenEvidenceImportResult => {
  assertContext(rom, mapper, context);
  if (
    bytes.length < CDL_HEADER_SIZE ||
    !CDL_HEADER.every((value, index) => bytes[index] === value)
  ) {
    throw new Error("MesenCE CDL import requires a CDLv2 header. CRC-less legacy CDL is unsafe.");
  }
  if (bytes.length !== CDL_HEADER_SIZE + rom.length) {
    throw new Error(
      `MesenCE CDL payload mismatch: expected ${rom.length} bytes, received ${bytes.length - CDL_HEADER_SIZE}.`,
    );
  }
  const expectedCrc = littleEndian32(bytes, CDL_HEADER.length);
  const actualCrc = CRC32.compute(rom.bytes());
  if (expectedCrc !== actualCrc) {
    throw new Error(
      `MesenCE CDL ROM CRC mismatch: CDL expects $${hex(expectedCrc, 8)}, loaded ROM is $${hex(actualCrc, 8)}.`,
    );
  }

  const sourceSha256 = sha256(bytes);
  const evidenceId = `runtime:mesence-cdl:${sourceSha256}`;
  const flags = bytes.slice(CDL_HEADER_SIZE);
  const source = new Uint8ArrayDecoderSource(rom.bytes());
  const decoder = new Cpu65816Decoder();
  const addressContext = createSnesAddressContext(mapper);
  const runtime: RuntimeEvidenceRecord[] = [
    ...rangeRecords(flags, CDL_CODE, "executed", evidenceId, sourceSha256),
    ...rangeRecords(flags, CDL_DATA, "read", evidenceId, sourceSha256),
  ];
  const annotations: IntervalAnnotation[] = [];
  let decodedInstructions = 0;
  let undecodedCodeBytes = 0;
  let coprocessorCodeBytes = 0;

  for (let fileOffset = 0; fileOffset < flags.length;) {
    const byteFlags = flags[fileOffset];
    if ((byteFlags & CDL_CODE) === 0) {
      fileOffset++;
      continue;
    }
    if ((byteFlags & (CDL_GSU | CDL_CX4)) !== 0) {
      coprocessorCodeBytes++;
      fileOffset++;
      continue;
    }
    const identity = identifySnesFileOffset(fileOffset, addressContext, rom.length);
    if (!identity) {
      undecodedCodeBytes++;
      fileOffset++;
      continue;
    }
    const state: Cpu65816DecodeState = {
      m: (byteFlags & CDL_MEMORY_8) !== 0,
      x: (byteFlags & CDL_INDEX_8) !== 0,
      ...((byteFlags & (CDL_MEMORY_8 | CDL_INDEX_8)) !== (CDL_MEMORY_8 | CDL_INDEX_8)
        ? { e: false }
        : {}),
      programBank: identity.canonicalCpuAddress >>> 16,
    };
    const decoded = decoder.decode({
      source,
      offset: fileOffset,
      logicalAddress: identity.canonicalCpuAddress,
      state,
    });
    if (
      decoded.kind !== "instruction" ||
      decoded.instruction.size === 0 ||
      decoded.instruction.bytes.some(
        (_, index) =>
          (flags[fileOffset + index] & CDL_CODE) === 0 ||
          (flags[fileOffset + index] & (CDL_GSU | CDL_CX4)) !== 0,
      )
    ) {
      undecodedCodeBytes++;
      fileOffset++;
      continue;
    }
    const instruction = decoded.instruction;
    const recordSuffix = `${sourceSha256}:${hex(fileOffset, 6)}:${instruction.size}`;
    runtime.push({
      id: `runtime:mesence-cdl:execution:${recordSuffix}`,
      kind: "runtime-execution",
      architecture: "snes.65816",
      addressSpace: SNES_CPU_ADDRESS_SPACE,
      address: identity.canonicalCpuAddress,
      fileOffset,
      size: instruction.size,
      opcode: instruction.opcode,
      count: 1,
      evidence: [evidenceId],
    });
    runtime.push({
      id: `runtime:mesence-cdl:state:${recordSuffix}`,
      kind: "runtime-cpu-state",
      architecture: "snes.65816",
      addressSpace: SNES_CPU_ADDRESS_SPACE,
      address: identity.canonicalCpuAddress,
      state: {
        ...(state.e === undefined ? {} : { e: state.e }),
        m: state.m as boolean,
        x: state.x as boolean,
      },
      count: 1,
      evidence: [evidenceId],
    });
    annotations.push(
      ...annotationForInstruction(fileOffset, instruction.size, state, evidenceId, sourceSha256),
    );
    decodedInstructions++;
    fileOffset += instruction.size;
  }

  const executedRanges = runtime.filter(
    (record) => record.kind === "runtime-coverage" && record.coverage === "executed",
  ).length;
  const readRanges = runtime.filter(
    (record) => record.kind === "runtime-coverage" && record.coverage === "read",
  ).length;
  const report = importReport(
    "cdl",
    context.sourceName,
    sourceSha256,
    { decodedInstructions, executedRanges, readRanges, annotations: annotations.length },
    [
      ...(undecodedCodeBytes > 0
        ? [
            {
              field: "codeBytes",
              count: undecodedCodeBytes,
              reason: "Code byte could not be aligned to a complete 65816 instruction.",
            },
          ]
        : []),
      ...(coprocessorCodeBytes > 0
        ? [
            {
              field: "coprocessorCodeBytes",
              count: coprocessorCodeBytes,
              reason: "GSU/Cx4-marked code is retained as coverage but not decoded as 65816.",
            },
          ]
        : []),
    ],
    [
      "CDL stores byte coverage but not execution counts or write accesses.",
      ...(flags.some((value) => (value & (CDL_JUMP_TARGET | CDL_SUB_ENTRY)) !== 0)
        ? []
        : ["CDL contains no jump-target or sub-entry flags."]),
    ],
  );
  const evidence = evidenceRecord(
    "cdl",
    sourceSha256,
    rom,
    mapper,
    `MesenCE CDLv2 with verified ROM CRC $${hex(actualCrc, 8)}.`,
  );
  return {
    report,
    batch: { runtime, annotations, evidence: [evidence], imports: [report] },
  };
};

interface ParsedTraceLine {
  readonly line: number;
  readonly pc: number;
  readonly fileOffset: number;
  readonly state: Readonly<Record<string, RuntimeStateValue>>;
  readonly decodeState: Cpu65816DecodeState;
  readonly instruction: DecodedInstruction;
  readonly effectiveAddress?: number;
  readonly memoryValue?: number;
  readonly memoryWidth?: number;
}

const TAG_PATTERNS = {
  A: /(?:^|\s)A:([\dA-Fa-f]+)(?:\s|$)/,
  X: /(?:^|\s)X:([\dA-Fa-f]+)(?:\s|$)/,
  Y: /(?:^|\s)Y:([\dA-Fa-f]+)(?:\s|$)/,
  S: /(?:^|\s)S:([\dA-Fa-f]+)(?:\s|$)/,
  D: /(?:^|\s)D:([\dA-Fa-f]+)(?:\s|$)/,
  DB: /(?:^|\s)DB:([\dA-Fa-f]+)(?:\s|$)/,
} as const;

const taggedHex = (line: string, tag: keyof typeof TAG_PATTERNS): number | undefined => {
  const match = TAG_PATTERNS[tag].exec(line);
  return match ? Number.parseInt(match[1], 16) : undefined;
};

const parseStatus = (line: string): number | undefined => {
  const match = /(?:^|\s)P:([\dA-Fa-f]{2}|[CDIMNVXZcdimnvxz]{8})(?:\s|$)/.exec(line);
  if (!match) {
    return undefined;
  }
  if (/^[\dA-Fa-f]{2}$/.test(match[1])) {
    return Number.parseInt(match[1], 16);
  }
  return Array.from(match[1]).reduce(
    (value, character, index) =>
      character === character.toUpperCase() ? value | (1 << (7 - index)) : value,
    0,
  );
};

const accessFor = (instruction: DecodedInstruction): RuntimeMemoryAccessRecord["access"] => {
  if (["STA", "STX", "STY", "STZ"].includes(instruction.mnemonic)) {
    return "write";
  }
  if (["ASL", "DEC", "INC", "LSR", "ROL", "ROR", "TRB", "TSB"].includes(instruction.mnemonic)) {
    return "read-write";
  }
  return "read";
};

const memoryWidthFor = (instruction: DecodedInstruction, state: Cpu65816DecodeState): number => {
  if (["LDX", "LDY", "STX", "STY", "CPX", "CPY"].includes(instruction.mnemonic)) {
    return state.x ? 1 : 2;
  }
  return state.m ? 1 : 2;
};

const incrementRecord = <T extends RuntimeEvidenceRecord>(
  records: Map<string, T>,
  record: T,
): void => {
  const current = records.get(record.id);
  records.set(record.id, current ? { ...current, count: current.count + 1 } : record);
};

/**
 * Imports MesenCE's default 65816 text trace with explicit capture identity metadata.
 * @param {string} text Trace file text.
 * @param {MesenTraceCaptureMetadata} metadata Required ROM/mapper capture identity.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenEvidenceImportResult} Normalized evidence batch and import report.
 */
export const importMesen65816Trace = (
  text: string,
  metadata: MesenTraceCaptureMetadata,
  rom: RomImage,
  mapper: SnesMapper,
  context: MesenEvidenceContext,
): MesenEvidenceImportResult => {
  assertContext(rom, mapper, context);
  if (metadata.schemaVersion !== 1 || metadata.architecture !== "snes.65816") {
    throw new Error("Unsupported MesenCE trace capture metadata.");
  }
  if (metadata.romContentSha256 !== rom.identity.contentSha256) {
    throw new Error(
      `Trace/ROM mismatch: trace expects ${metadata.romContentSha256}, loaded ROM is ${rom.identity.contentSha256}.`,
    );
  }
  if (metadata.mapper !== mapper) {
    throw new Error(
      `Trace mapper mismatch: trace expects '${metadata.mapper}', loaded project uses '${mapper}'.`,
    );
  }

  const sourceSha256 = sha256(text);
  const evidenceId = `runtime:mesence-trace:${sourceSha256}`;
  const decoder = new Cpu65816Decoder();
  const source = new Uint8ArrayDecoderSource(rom.bytes());
  const addressContext = createSnesAddressContext(mapper);
  const parsed: ParsedTraceLine[] = [];
  let malformedLines = 0;
  let unmappedLines = 0;
  let undecodableLines = 0;
  let linesWithUnparsedEffectiveAddress = 0;

  for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === "") {
      continue;
    }
    const pcMatch = /^([\dA-Fa-f]{6})\s{2}/.exec(line);
    const status = parseStatus(line);
    if (!pcMatch || status === undefined) {
      malformedLines++;
      continue;
    }
    const pc = Number.parseInt(pcMatch[1], 16);
    const identity = identifySnesCpuAddress(pc, addressContext, rom.length);
    if (!identity) {
      unmappedLines++;
      continue;
    }
    const decodeState: Cpu65816DecodeState = {
      m: (status & 0x20) !== 0,
      x: (status & 0x10) !== 0,
      ...((status & 0x30) !== 0x30 ? { e: false } : {}),
      programBank: pc >>> 16,
      ...(taggedHex(line, "DB") === undefined ? {} : { dataBank: taggedHex(line, "DB") }),
      ...(taggedHex(line, "D") === undefined ? {} : { directPage: taggedHex(line, "D") }),
    };
    const decoded = decoder.decode({
      source,
      offset: identity.fileOffset,
      logicalAddress: pc,
      state: decodeState,
    });
    if (decoded.kind !== "instruction") {
      undecodableLines++;
      continue;
    }
    const state: Record<string, RuntimeStateValue> = {
      status,
      m: (status & 0x20) !== 0,
      x: (status & 0x10) !== 0,
      ...((status & 0x30) !== 0x30 ? { e: false } : {}),
      programBank: pc >>> 16,
    };
    for (const [field, tag] of [
      ["a", "A"],
      ["xRegister", "X"],
      ["y", "Y"],
      ["stackPointer", "S"],
      ["directPage", "D"],
      ["dataBank", "DB"],
    ] as const) {
      const value = taggedHex(line, tag);
      if (value !== undefined) {
        state[field] = value;
      }
    }
    const effectiveMatches = [...line.matchAll(/\[\$([\dA-Fa-f]{4,6})]/g)];
    const effectiveMatch = effectiveMatches.at(-1);
    const memoryMatch = /=\s*\$([\dA-Fa-f]{2,4})(?:\s|$)/.exec(line);
    if (
      decoded.instruction.references.some((reference) => reference.kind === "data") &&
      !effectiveMatch
    ) {
      linesWithUnparsedEffectiveAddress++;
    }
    parsed.push({
      line: lineIndex + 1,
      pc,
      fileOffset: identity.fileOffset,
      state,
      decodeState,
      instruction: decoded.instruction,
      ...(effectiveMatch ? { effectiveAddress: Number.parseInt(effectiveMatch[1], 16) } : {}),
      ...(memoryMatch
        ? {
            memoryValue: Number.parseInt(memoryMatch[1], 16),
            memoryWidth: memoryMatch[1].length <= 2 ? 1 : 2,
          }
        : {}),
    });
  }

  const runtimeById = new Map<string, RuntimeEvidenceRecord>();
  const annotationById = new Map<string, IntervalAnnotation>();
  const targetOverrides = new Map<number, { targets: Set<number>; evidence: Set<string> }>();
  for (const [index, event] of parsed.entries()) {
    const executionKey = {
      pc: event.pc,
      fileOffset: event.fileOffset,
      size: event.instruction.size,
      opcode: event.instruction.opcode,
    };
    const execution: RuntimeExecutionRecord = {
      id: `runtime:mesence-trace:execution:${sourceSha256}:${stableSuffix(executionKey)}`,
      kind: "runtime-execution",
      architecture: "snes.65816",
      addressSpace: SNES_CPU_ADDRESS_SPACE,
      address: event.pc,
      fileOffset: event.fileOffset,
      size: event.instruction.size,
      opcode: event.instruction.opcode,
      count: 1,
      evidence: [evidenceId],
    };
    incrementRecord(runtimeById, execution);

    const stateKey = { pc: event.pc, state: event.state };
    const stateRecord: RuntimeCpuStateRecord = {
      id: `runtime:mesence-trace:state:${sourceSha256}:${stableSuffix(stateKey)}`,
      kind: "runtime-cpu-state",
      architecture: "snes.65816",
      addressSpace: SNES_CPU_ADDRESS_SPACE,
      address: event.pc,
      state: event.state,
      count: 1,
      evidence: [evidenceId],
    };
    incrementRecord(runtimeById, stateRecord);

    for (const coverage of [
      { start: event.fileOffset, end: event.fileOffset + 1, kind: "executed" as const },
      ...(event.instruction.size > 1
        ? [
            {
              start: event.fileOffset + 1,
              end: event.fileOffset + event.instruction.size,
              kind: "operand" as const,
            },
          ]
        : []),
    ]) {
      const record: RuntimeCoverageRecord = {
        id: `runtime:mesence-trace:coverage:${sourceSha256}:${coverage.kind}:${hex(coverage.start, 6)}-${hex(coverage.end, 6)}`,
        kind: "runtime-coverage",
        architecture: "snes.65816",
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start: coverage.start,
        end: coverage.end,
        coverage: coverage.kind,
        count: 1,
        evidence: [evidenceId],
      };
      incrementRecord(runtimeById, record);
    }
    for (const annotation of annotationForInstruction(
      event.fileOffset,
      event.instruction.size,
      event.decodeState,
      evidenceId,
      sourceSha256,
    )) {
      annotationById.set(annotation.id, annotation);
    }

    const hasDataReference = event.instruction.references.some(
      (reference) => reference.kind === "data" || reference.kind === "pointer",
    );
    if (event.effectiveAddress !== undefined && hasDataReference) {
      const access = accessFor(event.instruction);
      const width = event.memoryWidth ?? memoryWidthFor(event.instruction, event.decodeState);
      const accessKey = {
        pc: event.pc,
        address: event.effectiveAddress,
        access,
        width,
        value: event.memoryValue,
      };
      const memory: RuntimeMemoryAccessRecord = {
        id: `runtime:mesence-trace:memory:${sourceSha256}:${stableSuffix(accessKey)}`,
        kind: "runtime-memory-access",
        architecture: "snes.65816",
        instructionAddressSpace: SNES_CPU_ADDRESS_SPACE,
        instructionAddress: event.pc,
        accessedAddressSpace: SNES_CPU_ADDRESS_SPACE,
        accessedAddress: event.effectiveAddress,
        access,
        width,
        ...(event.memoryValue === undefined ? {} : { value: event.memoryValue }),
        count: 1,
        evidence: [evidenceId],
      };
      incrementRecord(runtimeById, memory);
      let coverageKinds: ReadonlyArray<"read" | "written"> = ["read"];
      if (access === "read-write") {
        coverageKinds = ["read", "written"];
      } else if (access === "write") {
        coverageKinds = ["written"];
      }
      for (const coverageKind of coverageKinds) {
        const mapped = identifySnesCpuAddress(event.effectiveAddress, addressContext, rom.length);
        if (!mapped) {
          continue;
        }
        const coverage: RuntimeCoverageRecord = {
          id: `runtime:mesence-trace:coverage:${sourceSha256}:${coverageKind}:${hex(mapped.fileOffset, 6)}-${hex(mapped.fileOffset + width, 6)}`,
          kind: "runtime-coverage",
          architecture: "snes.65816",
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: mapped.fileOffset,
          end: Math.min(rom.length, mapped.fileOffset + width),
          coverage: coverageKind,
          count: 1,
          evidence: [evidenceId],
        };
        incrementRecord(runtimeById, coverage);
      }
    }

    const next = parsed[index + 1];
    if (!next) {
      continue;
    }
    const fallthrough = (event.pc & 0xff0000) | ((event.pc + event.instruction.size) & 0xffff);
    const flow = event.instruction.flow;
    const followsControl =
      flow.kind !== "fallthrough" && flow.kind !== "stop" && flow.kind !== "wait";
    if (!followsControl || next.pc === fallthrough) {
      continue;
    }
    const targetKey = {
      from: event.pc,
      to: next.pc,
      flow: flow.kind,
      indirect: flow.indirect ?? false,
    };
    const target: RuntimeControlTargetRecord = {
      id: `runtime:mesence-trace:target:${sourceSha256}:${stableSuffix(targetKey)}`,
      kind: "runtime-control-target",
      architecture: "snes.65816",
      fromAddressSpace: SNES_CPU_ADDRESS_SPACE,
      fromAddress: event.pc,
      toAddressSpace: SNES_CPU_ADDRESS_SPACE,
      toAddress: next.pc,
      flowKind: flow.kind,
      indirect: flow.indirect ?? false,
      count: 1,
      evidence: [evidenceId],
    };
    incrementRecord(runtimeById, target);
    if (flow.indirect) {
      const override = targetOverrides.get(event.pc) ?? {
        targets: new Set<number>(),
        evidence: new Set<string>(),
      };
      override.targets.add(next.pc);
      override.evidence.add(evidenceId);
      targetOverrides.set(event.pc, override);
    }
  }

  const analysis: AnalysisTargetOverrideRecord[] = [...targetOverrides.entries()].map(
    ([address, observation]) => ({
      id: `runtime:target-override:snes.cpu:${hex(address, 6)}`,
      kind: "target-override",
      addressSpace: SNES_CPU_ADDRESS_SPACE,
      address,
      targets: [...observation.targets].sort((left, right) => left - right),
      evidence: [...observation.evidence].sort((left, right) => left.localeCompare(right)),
    }),
  );
  const runtime = [...runtimeById.values()];
  const annotations = [...annotationById.values()];
  const report = importReport(
    "trace",
    context.sourceName,
    sourceSha256,
    {
      traceLines: parsed.length,
      executions: runtime.filter((record) => record.kind === "runtime-execution").length,
      cpuStates: runtime.filter((record) => record.kind === "runtime-cpu-state").length,
      memoryAccesses: runtime.filter((record) => record.kind === "runtime-memory-access").length,
      controlTargets: runtime.filter((record) => record.kind === "runtime-control-target").length,
      targetOverrides: analysis.length,
      annotations: annotations.length,
    },
    [
      ...(malformedLines > 0
        ? [
            {
              field: "traceLines",
              count: malformedLines,
              reason: "Line did not contain a six-digit PC and parseable P status field.",
            },
          ]
        : []),
      ...(unmappedLines > 0
        ? [
            {
              field: "traceLines",
              count: unmappedLines,
              reason: "Execution PC did not map to the loaded ROM.",
            },
          ]
        : []),
      ...(undecodableLines > 0
        ? [
            {
              field: "traceLines",
              count: undecodableLines,
              reason:
                "Instruction could not be decoded from the verified ROM and observed P state.",
            },
          ]
        : []),
      ...(linesWithUnparsedEffectiveAddress > 0
        ? [
            {
              field: "effectiveAddress",
              count: linesWithUnparsedEffectiveAddress,
              reason: "Default trace effective address was absent or replaced by a label.",
            },
          ]
        : []),
    ],
    [
      "Raw trace text has no embedded ROM identity. Required capture metadata supplied the checked ROM and mapper.",
      ...(metadata.mesenRevision && metadata.mesenRevision !== MESEN_CE_EVIDENCE_REVISION
        ? [
            `Trace reports MesenCE revision ${metadata.mesenRevision}. Importer was checked against ${MESEN_CE_EVIDENCE_REVISION}.`,
          ]
        : []),
    ],
  );
  const evidence = evidenceRecord(
    "trace",
    sourceSha256,
    rom,
    mapper,
    `MesenCE trace with ${parsed.length} decoded 65816 line(s). Capture identity metadata schema 1.`,
  );
  return {
    report,
    batch: {
      analysis,
      annotations,
      runtime,
      evidence: [evidence],
      imports: [report],
    },
  };
};
