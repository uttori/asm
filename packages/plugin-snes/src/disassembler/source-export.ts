import * as fs from "node:fs";
import path from "node:path";

import { Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import {
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_MANIFEST,
  SOURCE_EXPORT_SCHEMA_VERSION,
  HalfOpenIntervalIndex,
  canonicalSourceExportJson,
  loadSourceExportManifest,
  sourceExportSha256,
  projectSourceLabelNames,
  validateSourceExportFiles,
  type InstructionExportRecord,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type IntervalAnnotation,
  type RomImage,
  type SourceExportFile,
  type SourceExportManifest,
  type SourceExportSpan,
  type SourceExportSpanRole,
} from "@uttori/asm-disassembler";

import {
  Cpu65816Decoder,
  formatCpu65816Instruction,
  type Cpu65816DecodeState,
} from "../architectures/65816-decoder.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import {
  createSnesAddressContext,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
} from "./address-identities.js";
import { lostCodeRanges } from "./code-preservation.js";
import {
  identifySnesHardwareRegister,
  renderSnesHardwareDefines,
  SNES_HARDWARE_DEFINES_SOURCE,
} from "./hardware-registers.js";
import {
  canonicalSnesWramAddress,
  indexSnesRamMap,
  loadSnesRamMap,
  renderSnesRamDefines,
  renderSnesRamMapSchema,
  SNES_RAM_DEFINES_SOURCE,
  SNES_RAM_MAP_SCHEMA_SOURCE,
  SNES_RAM_MAP_SOURCE,
  type SnesRamMapVariable,
} from "./ram-map.js";
import { parseSnesInternalRomHeader, type SnesMapper } from "./rom-header.js";
import {
  applySnesStructInstructionOperand,
  indexSnesStructInstructionUses,
  renderSnesStructUseComments,
  type SnesStructInstructionUse,
} from "./struct-instruction-uses.js";
import {
  indexSnesStructFields,
  loadSnesStructMap,
  planSnesStructRomFields,
  renderSnesStructData,
  renderSnesStructDefines,
  renderSnesStructInitializer,
  SNES_STRUCT_DEFINES_SOURCE,
  SNES_STRUCT_MAP_SOURCE,
  type SnesStructRomField,
  type SnesStructRomRecord,
} from "./struct-map.js";

/** Options for `exportSnes65816Source`. `sourceProjectSha256` is required provenance. */
export interface SnesSourceExportOptions {
  /**
   * Overwrite an existing export directory. Without this, a populated directory
   * that is not a previous export, or a previous export whose files drifted, is rejected.
   */
  readonly force?: boolean;
  /** Explicitly permit replacing previously emitted instructions with non-code spans. */
  readonly allowCodeRegression?: boolean;
  /** SHA-256 of the analysis project that produced this export (provenance). */
  readonly sourceProjectSha256: string;
  /** Complete variants grouped in ascending explicit file-offset order; consumed inside the caller's SQL read snapshot. */
  readonly instructionGroups?: Iterable<readonly InstructionExportRecord[]>;
}

interface PlannedInstruction {
  readonly start: number;
  readonly end: number;
  readonly source: string;
  readonly nodeIds: readonly string[];
  /** Curated capture alternatives and layout reasoning, emitted only at accepted instructions. */
  readonly structComments?: readonly string[];
}

interface PlannedSpan {
  readonly start: number;
  readonly end: number;
  readonly role: SourceExportSpanRole;
  readonly instruction?: PlannedInstruction;
  readonly structured?: StructuredRomField;
  readonly structField?: SnesStructRomField;
  readonly structRecord?: SnesStructRomRecord;
}

interface StructuredRomField {
  readonly start: number;
  readonly end: number;
  readonly role: "snes-header" | "vectors";
  readonly lines: readonly string[];
}

interface StructuredRomLayout {
  readonly start: number;
  readonly end: number;
  readonly headerOffset: number;
  readonly fields: readonly StructuredRomField[];
  readonly byStart: ReadonlyMap<number, StructuredRomField>;
}

interface NamedLine {
  readonly name?: string;
  readonly comment?: string;
  readonly inlineComment?: string;
  readonly instructionComment?: string;
}

const hex = (value: number, width = 6): string =>
  `$${value.toString(16).toUpperCase().padStart(width, "0")}`;

const byteList = (bytes: Uint8Array): string => [...bytes].map((byte) => hex(byte, 2)).join(", ");

const asciiString = (bytes: Uint8Array): string | undefined => {
  if (![...bytes].every((byte) => byte >= 0x20 && byte <= 0x7e)) return undefined;
  const value = String.fromCharCode(...bytes)
    .replaceAll("\\", "\\\\")
    .replaceAll("!", "\\!")
    .replaceAll('"', '\\"');
  return `"${value}"`;
};

const capacity = (bytes: number | undefined): string => {
  if (bytes === undefined) return "invalid size code";
  if (bytes === 0) return "none";
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MiB`;
  if (bytes >= 1024 && bytes % 1024 === 0) return `${bytes / 1024} KiB`;
  return `${bytes} bytes`;
};

const bytesField = (
  start: number,
  bytes: Uint8Array,
  symbol: string,
  comment: string,
  preferAscii = false,
): StructuredRomField => ({
  start,
  end: start + bytes.length,
  role: "snes-header",
  lines: [
    `${symbol}:`,
    `  db ${(preferAscii ? asciiString(bytes) : undefined) ?? byteList(bytes)} ; ${comment}`,
  ],
});

const byteField = (
  start: number,
  value: number,
  symbol: string,
  comment: string,
): StructuredRomField => bytesField(start, Uint8Array.of(value), symbol, comment);

const wordField = (
  start: number,
  value: number,
  symbol: string,
  comment: string,
  role: StructuredRomField["role"] = "snes-header",
): StructuredRomField => ({
  start,
  end: start + 2,
  role,
  lines: [`${symbol}:`, `  dw ${hex(value, 4)} ; ${comment}`],
});

const asciiComment = (value: string): string => `"${value.replaceAll('"', '\\"')}"`;

/**
 * Builds field-aligned source for the selected internal/expanded header and all vector words.
 * @param {RomImage} rom Immutable headerless ROM view.
 * @param {SnesMapper} mapper Selected cartridge mapping family.
 * @returns {StructuredRomLayout | undefined} Structured fields when a header is in range.
 */
const structuredRomLayout = (
  rom: RomImage,
  mapper: SnesMapper,
): StructuredRomLayout | undefined => {
  const header = parseSnesInternalRomHeader(rom, mapper);
  if (!header) return undefined;
  const base = header.offset;
  const rawHeader = rom.read(base, 0x20)!;
  const fields: StructuredRomField[] = [];
  if (header.expanded) {
    const expanded = header.expanded;
    const rawExpanded = rom.read(expanded.offset, 0x10)!;
    fields.push(
      bytesField(
        expanded.offset,
        rawExpanded.slice(0, 2),
        "SNES_EXPANDED_HEADER_MAKER_CODE",
        `Expanded header maker code ${asciiComment(expanded.makerCode)}.`,
        true,
      ),
      bytesField(
        expanded.offset + 2,
        rawExpanded.slice(2, 6),
        "SNES_EXPANDED_HEADER_GAME_CODE",
        `Expanded header game code ${asciiComment(expanded.gameCode)}.`,
        true,
      ),
      bytesField(
        expanded.offset + 6,
        rawExpanded.slice(6, 12),
        "SNES_EXPANDED_HEADER_RESERVED",
        "Expanded header reserved bytes.",
      ),
      byteField(
        expanded.offset + 0x0c,
        expanded.expansionFlashSizeCode,
        "SNES_EXPANDED_HEADER_FLASH_SIZE",
        "Expansion flash size code.",
      ),
      byteField(
        expanded.offset + 0x0d,
        expanded.expansionRamSizeCode,
        "SNES_EXPANDED_HEADER_RAM_SIZE",
        "Expansion RAM size code.",
      ),
      byteField(
        expanded.offset + 0x0e,
        expanded.specialVersion,
        "SNES_EXPANDED_HEADER_SPECIAL_VERSION",
        "Special version.",
      ),
      byteField(
        expanded.offset + 0x0f,
        expanded.chipsetSubtype,
        "SNES_EXPANDED_HEADER_CHIPSET_SUBTYPE",
        "Custom chipset subtype.",
      ),
    );
  }
  fields.push(
    bytesField(
      base,
      rawHeader.slice(0, 0x15),
      "SNES_HEADER_TITLE",
      `Cartridge title ${asciiComment(header.title)}.`,
      true,
    ),
    byteField(
      base + 0x15,
      header.mapMode,
      "SNES_HEADER_MAP_MODE",
      `${header.speed === "fast" ? "FastROM" : "SlowROM"}, ${header.mapModeName} map mode.`,
    ),
    byteField(base + 0x16, header.chipset, "SNES_HEADER_CHIPSET", header.chipsetDescription),
    byteField(
      base + 0x17,
      header.romSizeCode,
      "SNES_HEADER_ROM_SIZE",
      `Declared ROM size: ${capacity(header.romSizeBytes)}.`,
    ),
    byteField(
      base + 0x18,
      header.ramSizeCode,
      "SNES_HEADER_RAM_SIZE",
      `Declared cartridge RAM size: ${capacity(header.ramSizeBytes)}.`,
    ),
    byteField(
      base + 0x19,
      header.regionCode,
      "SNES_HEADER_REGION",
      `Destination/region: ${header.region}.`,
    ),
    byteField(
      base + 0x1a,
      header.developerId,
      "SNES_HEADER_DEVELOPER_ID",
      header.expanded ? "Developer ID uses the expanded-header marker." : "Legacy developer ID.",
    ),
    byteField(
      base + 0x1b,
      header.version,
      "SNES_HEADER_VERSION",
      `ROM revision ${header.version}.`,
    ),
    wordField(
      base + 0x1c,
      header.checksumComplement,
      "SNES_HEADER_CHECKSUM_COMPLEMENT",
      `Checksum complement${header.checksumValid ? " (valid pair)" : " (does not form a valid pair)"}.`,
    ),
    wordField(
      base + 0x1e,
      header.checksum,
      "SNES_HEADER_CHECKSUM",
      `ROM checksum${header.checksumValid ? " (valid pair)" : " (does not form a valid pair)"}.`,
    ),
  );
  for (const vector of header.vectors) {
    const mode = vector.mode === "native" ? "Native-mode" : "Emulation-mode";
    let comment = `${mode} reserved vector word.`;
    if (vector.state && vector.targetAddress === undefined) {
      comment = `${mode} ${vector.name} vector is unpopulated.`;
    } else if (vector.state) {
      comment = `${mode} ${vector.name} handler; target bank is forced to $00 -> ${hex(vector.targetAddress!, 6)}.`;
    }
    fields.push(wordField(vector.fileOffset, vector.value, vector.symbol, comment, "vectors"));
  }
  const sorted = fields.sort((left, right) => left.start - right.start);
  return {
    start: sorted[0].start,
    end: sorted.at(-1)!.end,
    headerOffset: header.offset,
    fields: sorted,
    byStart: new Map(sorted.map((field) => [field.start, field])),
  };
};

const known = (value: unknown): number | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as { readonly kind?: unknown; readonly value?: unknown };
  return entry.kind === "known" && typeof entry.value === "number" ? entry.value : undefined;
};

const decodeState = (record: Readonly<Record<string, unknown>>): Cpu65816DecodeState => ({
  ...(known(record.e) === undefined ? {} : { e: known(record.e) === 0 ? 0 : 1 }),
  ...(known(record.m) === undefined ? {} : { m: known(record.m) === 0 ? 0 : 1 }),
  ...(known(record.x) === undefined ? {} : { x: known(record.x) === 0 ? 0 : 1 }),
  ...(known(record.pbr) === undefined ? {} : { programBank: known(record.pbr)! & 0xff }),
  ...(known(record.dbr) === undefined ? {} : { dataBank: known(record.dbr)! & 0xff }),
  ...(known(record.d) === undefined ? {} : { directPage: known(record.d)! & 0xffff }),
});

/**
 * Formats one decoded instruction with explicit native operand-width qualification.
 * @param {DecodedInstruction} instruction Decoded 65816 instruction.
 * @param {ReadonlyMap<number, SnesRamMapVariable>} [ramVariables] Canonical WRAM and explicit SRAM CPU locations to name.
 * @param {number} [sourceAddress] Canonical address where generated source places the instruction.
 * @param {ReadonlyMap<number, string>} [sourceLabels] Explicit names at exact exported addresses.
 * @param {ReadonlyMap<number, string>} [structFields] Native struct expressions at known data addresses.
 * @param {ReadonlyMap<number, string>} [indexedStructFields] Struct expressions including explicitly biased array bases.
 * @returns {string} Native source with a `.b`, `.w`, or `.l` suffix where width is selectable.
 */
export const formatSnes65816SourceInstruction = (
  instruction: DecodedInstruction,
  ramVariables?: ReadonlyMap<number, SnesRamMapVariable>,
  sourceAddress?: number,
  sourceLabels?: ReadonlyMap<number, string>,
  structFields?: ReadonlyMap<number, string>,
  indexedStructFields?: ReadonlyMap<number, string>,
): string => {
  const decodedOperand = instruction.operands[0];
  const rebaseRelative =
    sourceAddress !== undefined &&
    (instruction.mode === "relative" ||
      (instruction.mode === "relativeLong" && instruction.mnemonic !== "PER")) &&
    decodedOperand?.value !== undefined;
  const formatted = formatCpu65816Instruction(
    rebaseRelative
      ? {
          ...instruction,
          operands: [
            {
              ...decodedOperand,
              targetAddress:
                (sourceAddress & 0xff0000) |
                ((sourceAddress + instruction.size + decodedOperand.value) & 0xffff),
            },
            ...instruction.operands.slice(1),
          ],
        }
      : instruction,
  );
  const space = formatted.indexOf(" ");
  const mnemonic = space < 0 ? formatted : formatted.slice(0, space);
  const operandText = space < 0 ? "" : formatted.slice(space);
  let suffix = "";
  if (instruction.mode === "immediate") {
    suffix = instruction.operands[0]?.width === 2 ? ".w" : ".b";
  } else if (
    instruction.mode === "direct" ||
    instruction.mode === "directIndexedX" ||
    instruction.mode === "directIndexedY"
  ) {
    suffix = ".b";
  } else if (
    instruction.mode === "absolute" ||
    instruction.mode === "absoluteIndexedX" ||
    instruction.mode === "absoluteIndexedY"
  ) {
    suffix = ".w";
  } else if (instruction.mode === "absoluteLong" || instruction.mode === "absoluteLongIndexedX") {
    suffix = ".l";
  }
  let renderedOperand = operandText;
  const rawValue = instruction.operands[0]?.value;
  const dataAddress = instruction.references.find(
    (reference) => reference.kind === "data" && reference.operandIndex === 0,
  )?.address;
  const canonicalRamAddress =
    dataAddress === undefined ? undefined : canonicalSnesWramAddress(dataAddress);
  const namedAddress = canonicalRamAddress ?? dataAddress;
  // WRAM has fixed bus mirrors; SRAM names only match the CPU window declared in the map.
  const ramVariable = namedAddress === undefined ? undefined : ramVariables?.get(namedAddress);
  const indexed = [
    "absoluteLongIndexedX",
    "absoluteIndexedX",
    "absoluteIndexedY",
    "directIndexedX",
    "directIndexedY",
  ].includes(instruction.mode);
  const structField =
    namedAddress === undefined
      ? undefined
      : (indexed ? (indexedStructFields ?? structFields) : structFields)?.get(namedAddress);
  if ((structField || ramVariable) && rawValue !== undefined) {
    const rawWidth = instruction.operands[0]?.width ?? 1;
    const encoded = `$${rawValue
      .toString(16)
      .toUpperCase()
      .padStart(rawWidth * 2, "0")}`;
    const variableOffset = ramVariable ? namedAddress! - ramVariable.address : 0;
    const variableExpression =
      structField ??
      (variableOffset === 0
        ? ramVariable!.name
        : `(${ramVariable!.name} + $${variableOffset.toString(16).toUpperCase().padStart(2, "0")})`);
    let symbolic = variableExpression;
    if (rawWidth === 3 && rawValue !== namedAddress) {
      // Naming a WRAM mirror must preserve the bank encoded in the instruction.
      // Canonical $7E variables can also be reached through $00-$3F/$80-$BF.
      symbolic = `(${variableExpression} & $FFFF)`;
      const encodedBank = rawValue & 0xff0000;
      if (encodedBank !== 0) symbolic += ` | ${hex(encodedBank, 6)}`;
    } else if (rawWidth !== 3) {
      symbolic = `${variableExpression} & ${rawWidth === 1 ? "$FF" : "$FFFF"}`;
    }
    renderedOperand = operandText.replace(encoded, symbolic);
  } else if (
    instruction.mode === "absolute" ||
    instruction.mode === "absoluteIndexedX" ||
    instruction.mode === "absoluteIndexedY"
  ) {
    const value = instruction.operands[0]?.value;
    const register =
      dataAddress === undefined ? undefined : identifySnesHardwareRegister(dataAddress);
    if (register && value !== undefined)
      renderedOperand = operandText.replace(
        `$${value.toString(16).toUpperCase().padStart(4, "0")}`,
        register.symbol,
      );
  } else if (
    (instruction.mode === "absoluteLong" || instruction.mode === "absoluteLongIndexedX") &&
    (instruction.operands[0]?.value ?? -1) <= 0xffff
  ) {
    const value = instruction.operands[0]?.value;
    const register =
      dataAddress === undefined ? undefined : identifySnesHardwareRegister(dataAddress);
    if (register && value !== undefined)
      renderedOperand = operandText.replace(
        `$${value.toString(16).toUpperCase().padStart(6, "0")}`,
        register.symbol,
      );
  }
  const flow = instruction.references.find(
    (reference) =>
      ["call", "jump", "branch"].includes(reference.kind) &&
      !reference.indirect &&
      reference.operandIndex === 0,
  );
  if (flow && sourceLabels && rawValue !== undefined) {
    let target = flow.address;
    if (rebaseRelative && sourceAddress !== undefined)
      target =
        (sourceAddress & 0xff0000) | ((sourceAddress + instruction.size + rawValue) & 0xffff);
    else if (instruction.mode === "absolute" && sourceAddress !== undefined)
      target = (sourceAddress & 0xff0000) | rawValue;
    const name = target === undefined ? undefined : sourceLabels.get(target);
    if (name) renderedOperand = instruction.mode === "absolute" ? ` (${name} & $FFFF)` : ` ${name}`;
  }
  return `${mnemonic}${suffix}${renderedOperand}`;
};

const mapperDirective = (mapper: SnesMapper): string =>
  mapper === "bigsa1rom" ? "fullsa1rom" : mapper;

/**
 * Classifies one already-cut export span without rescanning every project annotation.
 * @param {number} start Inclusive ROM file offset.
 * @param {number} end Exclusive ROM file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations File-space annotation index shared by the export.
 * @returns {SourceExportSpanRole} Stable source-emission role for the complete span.
 */
const roleAt = (
  start: number,
  end: number,
  annotations: HalfOpenIntervalIndex<IntervalAnnotation>,
): SourceExportSpanRole => {
  // planSpans cuts at annotation boundaries, so an indexed point lookup plus containment check is
  // sufficient here. A full-array scan at every span made large imported projects quadratic.
  if (
    annotations
      .at(start)
      .some((entry) => entry.classification === "empty" && entry.start <= start && end <= entry.end)
  ) {
    return "padding";
  }
  return "raw";
};

const toFileOffset = (
  addressSpace: string,
  address: number,
  mapper: SnesMapper,
  romSize: number,
): number | undefined => {
  if (addressSpace === SNES_FILE_ADDRESS_SPACE) return address < romSize ? address : undefined;
  if (addressSpace !== SNES_CPU_ADDRESS_SPACE) return undefined;
  const offset = snesRomAddressSpace.toOutputOffset(address, createSnesAddressContext(mapper));
  return offset >= 0 && offset < romSize ? offset : undefined;
};

/**
 * Validate annotation names against generated functions, hardware definitions, and RAM names.
 * @param {AnalysisProjectShards} shards Validated native project metadata.
 * @param {SnesMapper} mapper Selected ROM mapping.
 * @param {number} romSize Headerless ROM size.
 * @param {readonly string[]} ramNames Symbols in the editable RAM map.
 * @returns {ReadonlyMap<string, string>} Unique assembly names keyed by native label id.
 */
export const snesSourceLabelNames = (
  shards: AnalysisProjectShards,
  mapper: SnesMapper,
  romSize: number,
  ramNames: readonly string[] = [],
): ReadonlyMap<string, string> => {
  const offsets = new Set(
    shards.labels.map((label) => toFileOffset(label.addressSpace, label.address, mapper, romSize)),
  );
  const reserved = [...renderSnesHardwareDefines().matchAll(/^([A-Z_a-z]\w*)\s*=/gm)].map(
    (match) => match[1],
  );
  // User RAM maps can reserve arbitrarily many names; none should be lost to a call-argument limit.
  for (const name of ramNames) reserved.push(name);
  for (const fn of shards.analysis) {
    if (fn.kind !== "function") continue;
    const offset = toFileOffset(fn.addressSpace, fn.address, mapper, romSize);
    if (offset !== undefined && !offsets.has(offset))
      reserved.push(`Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`);
  }
  for (const label of shards.labels) {
    if (label.sourceName && /^snes_/i.test(label.sourceName))
      throw new Error(`Source label '${label.sourceName}' uses the reserved SNES_ namespace.`);
  }
  return projectSourceLabelNames(shards.labels, reserved);
};

const metadataLines = (
  shards: AnalysisProjectShards,
  mapper: SnesMapper,
  romSize: number,
  names: ReadonlyMap<string, string>,
): ReadonlyMap<number, readonly NamedLine[]> => {
  const values = new Map<number, NamedLine[]>();
  const append = (offset: number | undefined, line: NamedLine): void => {
    if (offset === undefined) return;
    values.set(offset, [...(values.get(offset) ?? []), line]);
  };
  for (const label of [...shards.labels].sort((a, b) => a.id.localeCompare(b.id))) {
    append(toFileOffset(label.addressSpace, label.address, mapper, romSize), {
      name: names.get(label.id),
      ...(label.comment ? { comment: label.comment } : {}),
      ...(label.inlineComment ? { inlineComment: label.inlineComment } : {}),
    });
  }
  for (const fn of shards.analysis.filter((record) => record.kind === "function")) {
    const offset = toFileOffset(fn.addressSpace, fn.address, mapper, romSize);
    if (offset === undefined || values.get(offset)?.some((line) => line.name)) continue;
    append(offset, { name: `Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}` });
  }
  for (const region of [...shards.regions].sort((a, b) => a.id.localeCompare(b.id))) {
    append(toFileOffset(region.addressSpace, region.start, mapper, romSize), {
      comment: `Region: ${region.name}${region.context ? ` (${region.context})` : ""}`,
    });
  }
  for (const comment of [...shards.comments].sort((a, b) => a.id.localeCompare(b.id))) {
    append(toFileOffset(comment.addressSpace, comment.address, mapper, romSize), {
      ...(comment.placement === "inline-instruction"
        ? { instructionComment: comment.text }
        : { comment: comment.text }),
    });
  }
  return values;
};

const renderedMetadata = (
  lines: readonly NamedLine[] | undefined,
  hasInstruction = false,
): string[] => {
  if (!lines) return [];
  const output: string[] = [];
  for (const line of lines) {
    if (line.comment) {
      for (const text of line.comment.split(/\r\n|[\n\r\u2028\u2029]/)) output.push(`; ${text}`);
    }
    if (line.name)
      output.push(`${line.name}:${line.inlineComment ? ` ; ${line.inlineComment}` : ""}`);
    if (line.instructionComment && !hasInstruction)
      output.push(`; [Instruction comment; instruction unavailable] ${line.instructionComment}`);
  }
  return output;
};

/**
 * Reports whether project evidence requires one CFG instruction to remain raw bytes.
 * @param {InstructionExportRecord} node Candidate instruction and its ROM extent.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations File-space annotation index shared by the export.
 * @returns {boolean} `true` when any non-code classification overlaps the instruction.
 */
const rejectedByAnnotation = (
  node: InstructionExportRecord,
  annotations: HalfOpenIntervalIndex<IntervalAnnotation>,
): boolean => {
  const rawClassifications = new Set([
    "unreached",
    "data8",
    "data16",
    "data24",
    "data32",
    "pointer16",
    "pointer24",
    "pointer32",
    "graphics",
    "music",
    "empty",
    "text",
  ]);
  return (
    node.fileOffset === undefined ||
    annotations
      // Performance invariant: use one range query; do not scan every annotation for every CFG node.
      .overlapping(node.fileOffset, node.fileOffset + node.size)
      .some((entry) => rawClassifications.has(entry.classification))
  );
};

/**
 * Selects deterministic, conflict-free CFG nodes that can be emitted as native 65816 source.
 *
 * Annotation and metadata indexes are constructed by the caller and reused for every candidate.
 * The function still re-decodes and checks each instruction against its recorded specification so
 * an optimization cannot turn uncertain/conflicting bytes into source text.
 * Identical encodings use numeric operands when processor-state variants disagree on symbol names.
 * @param {RomImage} rom Immutable headerless ROM content.
 * @param {SnesMapper} mapper Selected mapper used for continuity checks.
 * @param {AnalysisProjectShards} shards Validated project evidence.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Metadata keyed by ROM file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations Reusable file-space annotation index.
 * @param {ReadonlyMap<number, SnesRamMapVariable>} ramVariables Canonical WRAM and explicit SRAM CPU locations to name.
 * @param {StructuredRomLayout | undefined} structure Header/vector interval excluded from code.
 * @param {ReadonlyMap<number, string>} [sourceLabels] Friendly names at exact exported addresses.
 * @param {ReadonlyMap<number, string>} [structFields] Addressed struct fields for RAM and ROM data.
 * @param {ReadonlyMap<number, string>} [indexedStructFields] Addressed fields including biased array bases.
 * @param {Iterable} [instructionGroups] Complete SQL-ordered groups, avoiding a full CFG array.
 * @param {ReadonlyMap<number, SnesStructInstructionUse>} [instructionUses] Byte-checked explicit uses by ROM offset.
 * @returns {ReadonlyMap<number, PlannedInstruction>} Safe instructions keyed by start offset.
 */
const planInstructions = (
  rom: RomImage,
  mapper: SnesMapper,
  shards: AnalysisProjectShards,
  metadata: ReadonlyMap<number, readonly NamedLine[]>,
  annotations: HalfOpenIntervalIndex<IntervalAnnotation>,
  ramVariables: ReadonlyMap<number, SnesRamMapVariable>,
  structure: StructuredRomLayout | undefined,
  sourceLabels?: ReadonlyMap<number, string>,
  structFields?: ReadonlyMap<number, string>,
  indexedStructFields?: ReadonlyMap<number, string>,
  instructionGroups?: Iterable<readonly InstructionExportRecord[]>,
  instructionUses?: ReadonlyMap<number, SnesStructInstructionUse>,
): ReadonlyMap<number, PlannedInstruction> => {
  const decoder = new Cpu65816Decoder();
  const source = new Uint8ArrayDecoderSource(rom.bytes());
  const conflictNodes = new Set(
    shards.analysis
      .filter((record) => record.kind === "conflict")
      .flatMap((record) => record.nodes),
  );
  const metadataOffsets = [...metadata.keys()].sort((left, right) => left - right);
  const hasInteriorMetadata = (start: number, end: number): boolean => {
    // Binary search the first metadata offset after start; a linear scan here would multiply label,
    // comment, and region counts by every CFG candidate.
    let low = 0;
    let high = metadataOffsets.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (metadataOffsets[middle] <= start) low = middle + 1;
      else high = middle;
    }
    return low < metadataOffsets.length && metadataOffsets[low] < end;
  };
  const fallbackGroups = (): Iterable<readonly InstructionExportRecord[]> => {
    const grouped = new Map<number, InstructionExportRecord[]>();
    for (const record of shards.analysis) {
      if (record.kind !== "cfg-node" || record.fileOffset === undefined || record.fileOffset < 0)
        continue;
      const group = grouped.get(record.fileOffset) ?? [];
      group.push(record);
      grouped.set(record.fileOffset, group);
    }
    return [...grouped].sort(([a], [b]) => a - b).map(([, records]) => records);
  };
  const candidates = new Map<number, PlannedInstruction>();
  const context = createSnesAddressContext(mapper);
  let previousOffset = -1;
  // SQL callers hold only the current offset's variants; in-memory callers retain the same semantic path.
  for (const group of instructionGroups ?? fallbackGroups()) {
    if (!group.length) continue;
    const offset = group[0].fileOffset;
    if (
      offset === undefined ||
      offset <= previousOffset ||
      group.some((record) => record.fileOffset !== offset)
    )
      throw new Error("Export instruction groups must have distinct, ascending file offsets.");
    previousOffset = offset;
    const records = group.filter(
      (record) =>
        record.fileOffset !== undefined &&
        record.fileOffset >= 0 &&
        record.fileOffset + record.size <= rom.length &&
        !(
          structure !== undefined &&
          record.fileOffset < structure.end &&
          structure.start < record.fileOffset + record.size
        ) &&
        !conflictNodes.has(record.id) &&
        !rejectedByAnnotation(record, annotations) &&
        !hasInteriorMetadata(record.fileOffset, record.fileOffset + record.size),
    );
    if (!records.length) continue;
    const sourceAddress = snesRomAddressSpace.fromOutputOffset(offset, context);
    if (sourceAddress < 0) continue;
    const variants = records
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((record) => {
        const state = decodeState(record.incomingState);
        const result = decoder.decode({ source, offset, logicalAddress: record.address, state });
        if (
          result.kind !== "instruction" ||
          result.instruction.size !== record.size ||
          result.instruction.opcode !== record.opcode ||
          result.instruction.specificationId !== record.specificationId
        ) {
          return undefined;
        }
        return {
          record,
          instruction: result.instruction,
          source: formatSnes65816SourceInstruction(
            result.instruction,
            ramVariables,
            sourceAddress,
            sourceLabels,
            structFields,
            indexedStructFields,
          ),
        };
      });
    if (variants.some((entry) => entry === undefined)) continue;
    const resolved = variants as Array<NonNullable<(typeof variants)[number]>>;
    const first = resolved[0];
    // Every variant reads the same ROM offset; matching size and specification establish one encoding.
    if (
      resolved.some(
        (entry) =>
          entry.record.size !== first.record.size ||
          entry.record.specificationId !== first.record.specificationId,
      )
    ) {
      continue;
    }
    let renderedSource = first.source;
    if (resolved.some((entry) => entry.source !== renderedSource)) {
      // DBR/direct-page changes can give identical ROM instructions different RAM, struct, or
      // hardware names. Keep the instruction with a numeric operand instead of inventing a conflict.
      // Removing data references also disables hardware naming; control-flow labels remain usable.
      const numericSources = resolved.map(({ instruction }) =>
        formatSnes65816SourceInstruction(
          {
            ...instruction,
            references: instruction.references.filter((reference) => reference.kind !== "data"),
          },
          undefined,
          sourceAddress,
          sourceLabels,
        ),
      );
      if (numericSources.some((source) => source !== numericSources[0])) continue;
      renderedSource = numericSources[0];
    }
    const use = instructionUses?.get(offset);
    if (use) {
      // Every context must agree with the explicit operand contract. Observed accesses remain
      // comments even when a different DBR/direct-page context forced the numeric fallback above.
      for (const variant of resolved)
        renderedSource = applySnesStructInstructionOperand(
          variant.instruction,
          renderedSource,
          use,
        );
    }
    candidates.set(offset, {
      start: offset,
      end: offset + first.record.size,
      source: renderedSource,
      nodeIds: resolved.map((entry) => entry.record.id),
      ...(use ? { structComments: renderSnesStructUseComments(use) } : {}),
    });
  }

  const owners = new Map<number, number[]>();
  for (const instruction of candidates.values()) {
    for (let offset = instruction.start; offset < instruction.end; offset++) {
      owners.set(offset, [...(owners.get(offset) ?? []), instruction.start]);
    }
  }
  for (const [start, instruction] of [...candidates]) {
    if (
      [...Array(instruction.end - instruction.start).keys()].some(
        (index) => (owners.get(start + index)?.length ?? 0) !== 1,
      )
    ) {
      candidates.delete(start);
      continue;
    }
    const firstAddress = snesRomAddressSpace.fromOutputOffset(start, context);
    const lastAddress = snesRomAddressSpace.fromOutputOffset(instruction.end - 1, context);
    if (firstAddress < 0 || lastAddress !== firstAddress + instruction.end - start - 1) {
      candidates.delete(start);
    }
  }
  return candidates;
};

/**
 * Partitions the complete ROM into deterministic source-emission spans.
 *
 * All instruction, metadata, annotation, region, bank, header, and vector boundaries become cuts
 * before roles are assigned. Because spans cannot cross those boundaries, `roleAt()` can use an
 * indexed point lookup rather than repeatedly scanning the complete annotation shard.
 * @param {RomImage} rom Immutable headerless ROM content.
 * @param {SnesMapper} mapper Selected mapper and bank layout.
 * @param {AnalysisProjectShards} shards Validated project evidence supplying cuts.
 * @param {ReadonlyMap<number, PlannedInstruction>} instructions Safe native-source instructions.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Metadata keyed by file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations Reusable file-space annotation index.
 * @param {StructuredRomLayout | undefined} structure Field-aligned header/vector source plan.
 * @param {readonly SnesStructRomField[]} structFields Physical fields in explicitly bound ROM arrays.
 * @returns {readonly PlannedSpan[]} Complete, ordered, non-overlapping export plan.
 */
const planSpans = (
  rom: RomImage,
  mapper: SnesMapper,
  shards: AnalysisProjectShards,
  instructions: ReadonlyMap<number, PlannedInstruction>,
  metadata: ReadonlyMap<number, readonly NamedLine[]>,
  annotations: HalfOpenIntervalIndex<IntervalAnnotation>,
  structure: StructuredRomLayout | undefined,
  structFields: readonly SnesStructRomField[],
): readonly PlannedSpan[] => {
  const bankSize =
    mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
  const cuts = new Set<number>([0, rom.length]);
  const addExternalCut = (offset: number): void => {
    if (offset <= 0 || offset >= rom.length) return;
    if (structure && offset > structure.start && offset < structure.end) return;
    cuts.add(offset);
  };
  for (let offset = bankSize; offset < rom.length; offset += bankSize) cuts.add(offset);
  for (const field of structure?.fields ?? []) {
    cuts.add(field.start);
    cuts.add(field.end);
  }
  const structIndex = new HalfOpenIntervalIndex(structFields);
  for (const field of structFields) {
    if (structure && field.start < structure.end && structure.start < field.end)
      throw new Error(`Struct field '${field.expression}' overlaps the cartridge header/vectors.`);
    cuts.add(field.start);
    cuts.add(field.end);
  }
  for (const [offset, instruction] of instructions) {
    if (structIndex.overlapping(offset, instruction.end).length > 0)
      throw new Error(
        `ROM struct overlaps decoded code at ${hex(offset)}. Resolve the conflicting evidence before export.`,
      );
    cuts.add(offset);
    cuts.add(instruction.end);
  }
  for (const offset of metadata.keys()) addExternalCut(offset);
  for (const entry of shards.annotations) {
    if (entry.addressSpace !== SNES_FILE_ADDRESS_SPACE) continue;
    if (entry.classification === "opcode" || entry.classification === "operand") continue;
    // Byte-wise imported data classifications need not fragment an explicitly typed field.
    // Labels, comments, and region boundaries still receive their own cuts above/below.
    for (const offset of [entry.start, entry.end]) {
      const field = structIndex.overlapping(offset, offset + 1)[0];
      if (!field || offset === field.start) addExternalCut(offset);
    }
  }
  for (const region of shards.regions) {
    const start = toFileOffset(region.addressSpace, region.start, mapper, rom.length);
    const last = toFileOffset(region.addressSpace, region.end - 1, mapper, rom.length);
    if (start !== undefined) addExternalCut(start);
    if (last !== undefined) addExternalCut(last + 1);
  }
  const sorted = [...cuts].sort((left, right) => left - right);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const instruction = instructions.get(start);
    const structured = structure?.byStart.get(start);
    const structField = structIndex.overlapping(start, end)[0];
    if (instruction?.end === end) return { start, end, role: "code", instruction };
    if (structured?.end === end) return { start, end, role: structured.role, structured };
    if (structField) return { start, end, role: "raw", structField };
    return { start, end, role: roleAt(start, end, annotations) };
  });
};

/**
 * Regroup only whole records. The field plan remains the authority for safety:
 * bank cuts, interior labels/comments, and region boundaries prevent grouping.
 * In those cases the old assert + db/dw renderer preserves exact byte ownership.
 * @param {readonly PlannedSpan[]} spans Safe field-aligned export plan.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Source labels/comments by file offset.
 * @param {AnalysisProjectShards} shards Region boundaries that must remain visible.
 * @param {SnesMapper} mapper Address mapping and bank size.
 * @param {number} romSize Headerless ROM length.
 * @returns {readonly PlannedSpan[]} Same byte coverage with complete records grouped.
 */
const groupStructRecords = (
  spans: readonly PlannedSpan[],
  metadata: ReadonlyMap<number, readonly NamedLine[]>,
  shards: AnalysisProjectShards,
  mapper: SnesMapper,
  romSize: number,
): readonly PlannedSpan[] => {
  const protectedCuts = new Set(metadata.keys());
  const bankSize =
    mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
  for (let offset = bankSize; offset < romSize; offset += bankSize) protectedCuts.add(offset);
  for (const region of shards.regions) {
    const start = toFileOffset(region.addressSpace, region.start, mapper, romSize);
    const last = toFileOffset(region.addressSpace, region.end - 1, mapper, romSize);
    if (start !== undefined) protectedCuts.add(start);
    if (last !== undefined) protectedCuts.add(last + 1);
  }
  const grouped: PlannedSpan[] = [];
  for (let index = 0; index < spans.length;) {
    const first = spans[index];
    const record = first.structField?.record;
    let next = index;
    if (record && first.start === record.start) {
      while (
        next < spans.length &&
        spans[next].structField?.record === record &&
        (next === index || !protectedCuts.has(spans[next].start))
      )
        next++;
    }
    if (record && next > index && spans[next - 1].end === record.end) {
      grouped.push({ start: record.start, end: record.end, role: "raw", structRecord: record });
      index = next;
    } else {
      grouped.push(first);
      index++;
    }
  }
  return grouped;
};

const preflight = (directory: string, force: boolean): SourceExportManifest | undefined => {
  if (!fs.existsSync(directory)) return undefined;
  const manifestFile = path.join(directory, SOURCE_EXPORT_MANIFEST);
  if (!fs.existsSync(manifestFile)) {
    const unexpected = fs
      .readdirSync(directory)
      .filter((entry) => entry !== SNES_RAM_MAP_SOURCE && entry !== SNES_STRUCT_MAP_SOURCE);
    if (!force && unexpected.length > 0) {
      throw new Error(
        `Export directory '${directory}' is not empty; pass --force to write into it.`,
      );
    }
    return undefined;
  }
  const manifest = loadSourceExportManifest(directory);
  if (!force) validateSourceExportFiles(directory, manifest);
  return manifest;
};

const writeFile = (
  root: string,
  relative: string,
  bytes: string | Uint8Array,
  kind: SourceExportFile["kind"],
  files: SourceExportFile[],
): void => {
  const value = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, value);
  files.push({ path: relative, kind, size: value.length, sha256: sourceExportSha256(value) });
};

const regionIdsFor = (
  start: number,
  end: number,
  shards: AnalysisProjectShards,
  mapper: SnesMapper,
  romSize: number,
): readonly string[] =>
  shards.regions
    .filter((region) => {
      const regionStart = toFileOffset(region.addressSpace, region.start, mapper, romSize);
      const regionLast = toFileOffset(region.addressSpace, region.end - 1, mapper, romSize);
      return (
        regionStart !== undefined &&
        regionLast !== undefined &&
        regionStart < end &&
        start < regionLast + 1
      );
    })
    .map((region) => region.id)
    .sort();

/**
 * Writes a deterministic 65816 source tree that can be reassembled with this plugin.
 * Confident CFG nodes become width-qualified instructions; unknown bytes remain
 * `incbin` assets. The internal/expanded SNES headers, vector words, and explicitly
 * bound ROM struct fields become native data source. An optional 512-byte copier
 * header remains an asset. Optional struct bindings also name RAM/ROM operands.
 * Checksums are preserved, not recomputed.
 * @param {{ readonly manifest: AnalysisProjectManifest; readonly shards: AnalysisProjectShards }} project Loaded analysis project.
 * @param {RomImage} rom Immutable ROM used for asset bytes and copier-header extraction.
 * @param {string} directory Destination directory (`main.asm`, `banks/`, `assets/`, manifest).
 * @param {SnesSourceExportOptions} options Provenance hash and optional `--force`.
 * @returns {SourceExportManifest} Written file list, spans, and rebuild configuration.
 */
export const exportSnes65816Source = (
  project: { readonly manifest: AnalysisProjectManifest; readonly shards: AnalysisProjectShards },
  rom: RomImage,
  directory: string,
  options: SnesSourceExportOptions,
): SourceExportManifest => {
  const mapper = project.manifest.mapping.mapper as SnesMapper;
  const context = createSnesAddressContext(mapper);
  const structure = structuredRomLayout(rom, mapper);
  const previousManifest = preflight(directory, options.force ?? false);
  const ramMap = loadSnesRamMap(directory);
  const ramVariables = indexSnesRamMap(ramMap.variables);
  const structMap = loadSnesStructMap(directory);
  const structRomFields = planSnesStructRomFields(structMap, rom.length, (offset) =>
    snesRomAddressSpace.fromOutputOffset(offset, context),
  );
  const structFields = indexSnesStructFields(structMap);
  const indexedStructFields = indexSnesStructFields(structMap, true);
  const instructionUses = indexSnesStructInstructionUses(
    structMap?.instructionUses,
    rom,
    (address) => toFileOffset(SNES_CPU_ADDRESS_SPACE, address, mapper, rom.length),
  );
  const structNames = [
    ...(structMap?.structures.map(({ id }) => id) ?? []),
    ...(structMap?.bindings.map(({ name }) => name) ?? []),
  ];
  const ramNames = new Set(ramMap.variables.map(({ name }) => name.toLowerCase()));
  for (const name of structNames) {
    if (ramNames.has(name.toLowerCase()))
      throw new Error(`Struct-map name '${name}' conflicts with a RAM variable.`);
  }
  const names = snesSourceLabelNames(project.shards, mapper, rom.length, [
    ...ramMap.variables.map(({ name }) => name),
    ...structNames,
  ]);
  const metadata = metadataLines(project.shards, mapper, rom.length, names);
  const sourceLabels = new Map<number, string>();
  for (const label of [...project.shards.labels].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!label.sourceName) continue;
    const offset = toFileOffset(label.addressSpace, label.address, mapper, rom.length);
    if (offset === undefined || (structure && structure.start <= offset && offset < structure.end))
      continue;
    const address = snesRomAddressSpace.fromOutputOffset(offset, context);
    if (address >= 0 && !sourceLabels.has(address)) sourceLabels.set(address, names.get(label.id)!);
  }
  // Build one immutable index for both instruction rejection and raw/padding span roles. Keeping a
  // single instance is essential: these consumers collectively issue a query for most CFG nodes
  // and planned spans in a production ROM.
  const annotations = new HalfOpenIntervalIndex(
    project.shards.annotations.filter(
      ({ addressSpace }) => addressSpace === SNES_FILE_ADDRESS_SPACE,
    ),
  );
  const instructions = planInstructions(
    rom,
    mapper,
    project.shards,
    metadata,
    annotations,
    ramVariables,
    structure,
    sourceLabels,
    structFields,
    indexedStructFields,
    options.instructionGroups,
    instructionUses,
  );
  // Rejected, overlapping and undecoded sites cannot silently acquire authoritative-looking uses.
  // Do this after instruction conflict resolution and before any generated file is written.
  for (const [offset, use] of instructionUses ?? []) {
    if (!instructions.has(offset))
      throw new Error(
        `Struct instruction use at ${hex(use.address)} requires an accepted instruction.`,
      );
  }
  const fieldPlan = planSpans(
    rom,
    mapper,
    project.shards,
    instructions,
    metadata,
    annotations,
    structure,
    structRomFields,
  );
  const planned = groupStructRecords(fieldPlan, metadata, project.shards, mapper, rom.length);
  if (previousManifest && !options.allowCodeRegression) {
    const previousCode = previousManifest.spans.filter((span) => span.role === "code");
    const proposedCode = planned.filter((span) => span.role === "code");
    const lost = lostCodeRanges(previousCode, proposedCode);
    if (lost.length > 0) {
      const bytes = lost.reduce((total, range) => total + range.end - range.start, 0);
      const added = lostCodeRanges(proposedCode, previousCode).reduce(
        (total, range) => total + range.end - range.start,
        0,
      );
      const net = added - bytes;
      throw new Error(
        `Source export would replace ${bytes} previously emitted code byte(s) with non-code spans, ` +
          `starting at ROM offset ${hex(lost[0].start, 6)}. Generated source was preserved. ` +
          `The proposal also adds ${added} new code byte(s), for a net change of ${net >= 0 ? "+" : ""}${net} byte(s). ` +
          "Code absent from a capture is not evidence that it stopped being code. " +
          "Resolve the analysis gaps or explicitly pass --allow-code-regression after reviewing the change.",
      );
    }
  }
  const files: SourceExportFile[] = [];
  const spans: SourceExportSpan[] = [];
  const banks = new Map<number, PlannedSpan[]>();
  const bankSize =
    mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
  for (const span of planned) {
    const bank = Math.floor(span.start / bankSize);
    const entries = banks.get(bank) ?? [];
    entries.push(span);
    banks.set(bank, entries);
  }

  const bankSources: string[] = [];
  for (const [bank, bankSpans] of [...banks].sort(([left], [right]) => left - right)) {
    const bankPath = `banks/bank-${bank.toString(16).padStart(3, "0")}.asm`;
    bankSources.push(bankPath);
    const lines = [`; Generated bank ${bank.toString(16).toUpperCase().padStart(3, "0")}.`];
    let nextAddress: number | undefined;
    let table: { name: string; nextIndex: number } | undefined;
    for (const [spanIndex, span] of bankSpans.entries()) {
      const address = snesRomAddressSpace.fromOutputOffset(span.start, context);
      if (address < 0)
        throw new Error(`Mapper '${mapper}' cannot represent ROM offset ${hex(span.start)}.`);
      const named = span.structured
        ? []
        : renderedMetadata(metadata.get(span.start), Boolean(span.instruction));
      if (
        table &&
        (span.structRecord?.binding.name !== table.name ||
          span.structRecord?.index !== table.nextIndex ||
          named.length > 0 ||
          nextAddress !== address)
      ) {
        lines.push("  endDataStructs");
        table = undefined;
      }
      if (nextAddress !== address) {
        lines.push("", `org ${hex(address)}`);
      }
      if (named.length) {
        lines.push("");
        // Multiple imports can attach an input-sized set of labels/comments to the same offset.
        for (const line of named) lines.push(line);
      }
      if (span.instruction) {
        // Explicit operand-size suffixes fix the encoding. Emitting ambient M/X directives here
        // would make identical instructions churn whenever the preferred captured state changes.
        for (const comment of span.instruction.structComments ?? []) lines.push(`; ${comment}`);
        const inline = (metadata.get(span.start) ?? []).flatMap((line) =>
          line.instructionComment ? [line.instructionComment] : [],
        );
        lines.push(
          `  ${span.instruction.source}${inline.length ? ` ; ${inline.join(" | ")}` : ""}`,
        );
        spans.push({
          id: `code:${span.start.toString(16).padStart(6, "0")}`,
          source: "analysis",
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: span.start,
          end: span.end,
          role: "code",
          file: bankPath,
          nodeIds: span.instruction.nodeIds,
          regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
        });
      } else if (span.structured) {
        const headings: string[] = [];
        if (span.start === structure?.start && structure.start < structure.headerOffset) {
          headings.push("; SNES expanded cartridge header ($FFB0-$FFBF).");
        }
        if (span.start === structure?.headerOffset) {
          headings.push("; SNES internal cartridge header ($FFC0-$FFDF).");
        }
        if (span.start === (structure?.headerOffset ?? -0x20) + 0x20) {
          headings.push("; SNES 65C816 interrupt vector table ($FFE0-$FFFF).");
        }
        lines.push("", ...headings, ...span.structured.lines);
        spans.push({
          id: `${span.role}:${span.start.toString(16).padStart(6, "0")}`,
          source: "rom",
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: span.start,
          end: span.end,
          role: span.role,
          file: bankPath,
          regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
        });
      } else if (span.structRecord) {
        const record = span.structRecord;
        const next = bankSpans[spanIndex + 1]?.structRecord;
        // Stop/restart tables around record labels so their addresses and source
        // lines remain independently navigable. Single records use dataStruct.
        if (
          !table &&
          next?.binding === record.binding &&
          next.start === record.end &&
          next.index === record.index + 1 &&
          !metadata.has(next.start)
        ) {
          table = { name: record.binding.name, nextIndex: record.index };
          lines.push(`  dataStructs ${record.binding.name}`);
        }
        const literal = renderSnesStructInitializer(
          record,
          rom.read(record.start, record.end - record.start)!,
        );
        if (table) {
          lines.push(`    [${record.index}] = ${literal}`);
          table.nextIndex = record.index + 1;
        } else {
          const reference =
            record.binding.count === 1 && record.index === 0
              ? record.binding.name
              : `${record.binding.name}[${record.index}]`;
          lines.push(`  dataStruct ${reference}, ${literal}`);
        }
        spans.push({
          id: `struct:${span.start.toString(16).padStart(6, "0")}`,
          source: SNES_STRUCT_MAP_SOURCE,
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: span.start,
          end: span.end,
          role: "raw",
          file: bankPath,
          regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
        });
      } else if (span.structField) {
        // Each field always renders two lines: a placement assertion and one data directive.
        lines.push(
          ...renderSnesStructData(
            span.structField,
            span.start,
            rom.read(span.start, span.end - span.start)!,
          ),
        );
        spans.push({
          id: `struct:${span.start.toString(16).padStart(6, "0")}`,
          source: SNES_STRUCT_MAP_SOURCE,
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: span.start,
          end: span.end,
          role: "raw",
          file: bankPath,
          regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
        });
      } else {
        // Filenames show the first and last included bytes; spans and reads stay half-open.
        const lastByte = span.end - 1;
        const assetPath = `assets/${span.role}-${span.start.toString(16).padStart(6, "0")}-${lastByte.toString(16).padStart(6, "0")}.bin`;
        const bytes = rom.read(span.start, span.end - span.start)!;
        writeFile(directory, assetPath, bytes, "asset", files);
        lines.push(`  incbin "../${assetPath}"`);
        spans.push({
          id: `${span.role}:${span.start.toString(16).padStart(6, "0")}`,
          source: "rom",
          addressSpace: SNES_FILE_ADDRESS_SPACE,
          start: span.start,
          end: span.end,
          role: span.role,
          file: assetPath,
          regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
        });
      }
      nextAddress = address + span.end - span.start;
    }
    if (table) lines.push("  endDataStructs");
    writeFile(directory, bankPath, `${lines.join("\n")}\n`, "source", files);
  }

  if (rom.identity.headerSize === 512) {
    const copier = "assets/copier-header.bin";
    writeFile(directory, copier, rom.copierHeaderBytes(), "asset", files);
    spans.push({
      id: "copier-header:000000",
      source: "rom",
      addressSpace: "rom.file-with-header",
      start: 0,
      end: 512,
      role: "copier-header",
      file: copier,
    });
  }

  const main = [
    "; Deterministic native source generated by Uttori ASM.",
    "; Edit names/comments with Assembly: Edit Disassembly Annotation. See annotation-report.json for unresolved annotations.",
    mapperDirective(mapper),
    "arch 65816",
    ".smart off",
    "",
    `incsrc "${SNES_HARDWARE_DEFINES_SOURCE}"`,
    `incsrc "${SNES_RAM_DEFINES_SOURCE}"`,
    ...(structMap ? [`incsrc "${SNES_STRUCT_DEFINES_SOURCE}"`] : []),
    "",
    ...bankSources.map((source) => `incsrc "${source}"`),
    "",
  ].join("\n");
  writeFile(directory, SNES_HARDWARE_DEFINES_SOURCE, renderSnesHardwareDefines(), "source", files);
  writeFile(
    directory,
    SNES_RAM_MAP_SCHEMA_SOURCE,
    renderSnesRamMapSchema(),
    "configuration",
    files,
  );
  writeFile(
    directory,
    SNES_RAM_DEFINES_SOURCE,
    renderSnesRamDefines(ramMap.variables),
    "source",
    files,
  );
  writeFile(directory, "main.asm", main, "source", files);
  if (structMap)
    writeFile(
      directory,
      SNES_STRUCT_DEFINES_SOURCE,
      renderSnesStructDefines(structMap),
      "source",
      files,
    );
  const annotationIssues = [...project.shards.labels, ...project.shards.comments]
    .flatMap((record) => {
      const offset = toFileOffset(record.addressSpace, record.address, mapper, rom.length);
      let reason: string | undefined;
      if (offset === undefined)
        reason =
          "Address does not map to this ROM export. Annotation retained in the analysis project.";
      else if (structure && structure.start <= offset && offset < structure.end)
        reason =
          "Annotation is inside a structured header/vector field. Annotation retained in the analysis project.";
      else if (
        "placement" in record &&
        record.placement === "inline-instruction" &&
        !instructions.has(offset)
      )
        reason =
          "No exportable instruction starts here. Rendered as a standalone comment; inline placement remains saved.";
      return reason
        ? [{ id: record.id, addressSpace: record.addressSpace, address: record.address, reason }]
        : [];
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  writeFile(
    directory,
    "annotation-report.json",
    canonicalSourceExportJson({ issues: annotationIssues }),
    "configuration",
    files,
  );
  const configuration = canonicalSourceExportJson({
    $schema: "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
    plugins: [
      {
        module: "@uttori/asm-plugin-snes",
        options: { checksumEnabled: false, checksumMode: "asar" },
      },
    ],
    target: "snes.sfc",
    architecture: "snes.65816",
    entryPoints: ["main.asm"],
    includePaths: ["./"],
    buildOutput: "build/rebuilt-content.sfc",
  });
  writeFile(directory, "uttori-asm.config.json", configuration, "configuration", files);

  const manifest: SourceExportManifest = {
    format: SOURCE_EXPORT_FORMAT,
    schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
    target: project.manifest.target,
    architecture: "snes.65816",
    mapper,
    sourceProjectSha256: options.sourceProjectSha256,
    rom: rom.identity,
    entrySource: "main.asm",
    buildConfiguration: "uttori-asm.config.json",
    contentOutput: "build/rebuilt-content.sfc",
    finalOutput: "build/rebuilt.sfc",
    checksumPolicy: "preserve",
    inputs: [
      ...(structMap
        ? [
            {
              path: SNES_STRUCT_MAP_SOURCE,
              kind: "metadata" as const,
              size: structMap.sourceBytes.length,
              records:
                structMap.structures.length +
                structMap.bindings.length +
                (structMap.instructionUses?.length ?? 0),
              sha256: sourceExportSha256(structMap.sourceBytes),
            },
          ]
        : []),
      {
        path: SNES_RAM_MAP_SOURCE,
        kind: "metadata",
        size: ramMap.sourceBytes.length,
        records: ramMap.variables.length,
        sha256: sourceExportSha256(ramMap.sourceBytes),
      },
    ],
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    spans: spans.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
  };
  const currentPaths = new Set(manifest.files.map((file) => file.path));
  for (const stale of previousManifest?.files ?? []) {
    if (currentPaths.has(stale.path)) continue;
    const staleFile = path.join(directory, stale.path);
    if (fs.existsSync(staleFile) && fs.statSync(staleFile).isFile()) fs.unlinkSync(staleFile);
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, SOURCE_EXPORT_MANIFEST),
    canonicalSourceExportJson(manifest),
  );
  return manifest;
};
