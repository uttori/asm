import { createHash } from "node:crypto";

import {
  type ImportLossItem,
  type ImportReport,
  type ProjectComment,
  type ProjectLabel,
  type ProjectRegion,
  type RomImage,
  type RuntimeEvidenceBatch,
} from "@uttori/asm-disassembler";

import {
  createSnesAddressContext,
  identifySnesCpuAddress,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
  SNES_SRAM_ADDRESS_SPACE,
  SNES_WRAM_ADDRESS_SPACE,
} from "./address-identities.js";
import { MESEN_CE_EVIDENCE_REVISION, type MesenEvidenceContext } from "./mesen-runtime.js";
import type { SnesMapper } from "./rom-header.js";
import { SPC700_ARAM_ADDRESS_SPACE } from "./spc700-address-space.js";

const LABEL_PATTERN = /^[@A-Z_a-z]+[\w@]*$/;

interface MesenLabelAddress {
  readonly memoryType: "SnesPrgRom" | "SnesWorkRam" | "SnesSaveRam" | "SpcRam";
  readonly addressSpace: string;
  readonly maximum: number;
}

const MEMORY_TYPES: Readonly<Record<string, MesenLabelAddress>> = {
  SnesPrgRom: {
    memoryType: "SnesPrgRom",
    addressSpace: SNES_FILE_ADDRESS_SPACE,
    maximum: 0x1000000,
  },
  PRG: {
    memoryType: "SnesPrgRom",
    addressSpace: SNES_FILE_ADDRESS_SPACE,
    maximum: 0x1000000,
  },
  SnesWorkRam: {
    memoryType: "SnesWorkRam",
    addressSpace: SNES_WRAM_ADDRESS_SPACE,
    maximum: 0x20000,
  },
  WORK: {
    memoryType: "SnesWorkRam",
    addressSpace: SNES_WRAM_ADDRESS_SPACE,
    maximum: 0x20000,
  },
  SnesSaveRam: {
    memoryType: "SnesSaveRam",
    addressSpace: SNES_SRAM_ADDRESS_SPACE,
    maximum: 0x1000000,
  },
  SAVE: {
    memoryType: "SnesSaveRam",
    addressSpace: SNES_SRAM_ADDRESS_SPACE,
    maximum: 0x1000000,
  },
  SpcRam: {
    memoryType: "SpcRam",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    maximum: 0x10000,
  },
  SPCRAM: {
    memoryType: "SpcRam",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    maximum: 0x10000,
  },
};

/** Native label/comment/region records imported from one MesenCE label file. */
export interface MesenLabelImportResult {
  readonly batch: RuntimeEvidenceBatch;
  readonly report: ImportReport;
}

/** MesenCE label text plus a deterministic loss report for unsupported project records. */
export interface MesenLabelExportResult {
  readonly text: string;
  readonly report: ImportReport;
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const reportFor = (
  operation: "import" | "export",
  sourceName: string,
  sourceSha256: string,
  imported: Readonly<Record<string, number>>,
  unsupported: readonly ImportLossItem[],
  warnings: readonly string[],
): ImportReport => ({
  id: `${operation}:mesence-labels:${sourceSha256}`,
  format: "mesence-labels",
  sourceName,
  sourceSha256,
  sourceVersion: `text@${MESEN_CE_EVIDENCE_REVISION}`,
  imported,
  unsupported,
  warnings,
});

const splitMesenLine = (line: string): readonly string[] => {
  const fields: string[] = [];
  let remainder = line;
  for (let index = 0; index < 3; index++) {
    const separator = remainder.indexOf(":");
    if (separator < 0) {
      break;
    }
    fields.push(remainder.slice(0, separator));
    remainder = remainder.slice(separator + 1);
  }
  fields.push(remainder);
  return fields;
};

/**
 * Imports stock MesenCE `MemoryType:HEX[-HEX]:Label[:Comment]` label text.
 * @param {string} text Complete label file text.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenLabelImportResult} Native label/comment/region batch and report.
 */
export const importMesenLabels = (
  text: string,
  rom: RomImage,
  mapper: SnesMapper,
  context: MesenEvidenceContext,
): MesenLabelImportResult => {
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
  const sourceSha256 = sha256(text);
  const evidenceId = `import:mesence-labels:${sourceSha256}`;
  const labels: ProjectLabel[] = [];
  const comments: ProjectComment[] = [];
  const regions: ProjectRegion[] = [];
  const unsupported: ImportLossItem[] = [];
  let invalidLines = 0;

  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = lineIndex === 0 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
    if (line === "") {
      continue;
    }
    const fields = splitMesenLine(line);
    const memory = MEMORY_TYPES[fields[0] ?? ""];
    if (fields.length < 3 || !memory) {
      invalidLines++;
      continue;
    }
    const range = (fields[1] ?? "").split("-");
    if (range.length > 2 || !range.every((value) => /^[\dA-Fa-f]+$/.test(value))) {
      invalidLines++;
      continue;
    }
    const start = Number.parseInt(range[0], 16);
    const inclusiveEnd = range[1] === undefined ? start : Number.parseInt(range[1], 16);
    const maximum = memory.memoryType === "SnesPrgRom" ? rom.length : memory.maximum;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(inclusiveEnd) ||
      start < 0 ||
      inclusiveEnd < start ||
      inclusiveEnd >= maximum
    ) {
      invalidLines++;
      continue;
    }
    const name = fields[2] ?? "";
    if (name !== "" && !LABEL_PATTERN.test(name)) {
      invalidLines++;
      continue;
    }
    const comment = (fields[3] ?? "").replaceAll("\\n", "\n");
    const suffix = `${sourceSha256}:${lineIndex + 1}`;
    if (name !== "") {
      labels.push({
        id: `mesence:label:${suffix}`,
        addressSpace: memory.addressSpace,
        address: start,
        name,
        ...(comment === "" ? {} : { comment }),
        evidence: [evidenceId],
      });
    } else if (comment !== "") {
      comments.push({
        id: `mesence:comment:${suffix}`,
        addressSpace: memory.addressSpace,
        address: start,
        text: comment,
        evidence: [evidenceId],
      });
    }
    if (inclusiveEnd > start) {
      regions.push({
        id: `mesence:region:${suffix}`,
        addressSpace: memory.addressSpace,
        start,
        end: inclusiveEnd + 1,
        name: name || `${memory.memoryType}_${start.toString(16).toUpperCase()}`,
        attributes: { mesenMemoryType: memory.memoryType },
        evidence: [evidenceId],
      });
    }
  }
  if (invalidLines > 0) {
    unsupported.push({
      field: "labelLines",
      count: invalidLines,
      reason:
        "Line was malformed, out of range, used an unsupported memory type, or had an invalid Mesen label name.",
    });
  }
  const report = reportFor(
    "import",
    context.sourceName,
    sourceSha256,
    { labels: labels.length, comments: comments.length, regions: regions.length },
    unsupported,
    [
      "MesenCE label text has no embedded ROM identity; addresses were checked against the loaded project context.",
    ],
  );
  return {
    report,
    batch: {
      labels,
      comments,
      regions,
      evidence: [
        {
          id: evidenceId,
          source: "import",
          sourceId: `mesence:${MESEN_CE_EVIDENCE_REVISION}:labels`,
          confidence: "high",
          detail: `Imported MesenCE labels from ${context.sourceName}.`,
        },
      ],
      imports: [report],
    },
  };
};

interface ExportEntry {
  readonly memoryType: MesenLabelAddress["memoryType"];
  readonly address: number;
  readonly name: string;
  readonly comment?: string;
  readonly sourceId: string;
}

const exportAddress = (
  addressSpace: string,
  address: number,
  rom: RomImage,
  mapper: SnesMapper,
): Omit<ExportEntry, "name" | "comment" | "sourceId"> | undefined => {
  if (addressSpace === SNES_FILE_ADDRESS_SPACE && address < rom.length) {
    return { memoryType: "SnesPrgRom", address };
  }
  if (addressSpace === SNES_CPU_ADDRESS_SPACE) {
    const identity = identifySnesCpuAddress(address, createSnesAddressContext(mapper), rom.length);
    return identity ? { memoryType: "SnesPrgRom", address: identity.fileOffset } : undefined;
  }
  if (addressSpace === SNES_WRAM_ADDRESS_SPACE && address < 0x20000) {
    return { memoryType: "SnesWorkRam", address };
  }
  if (addressSpace === SNES_SRAM_ADDRESS_SPACE && address < 0x1000000) {
    return { memoryType: "SnesSaveRam", address };
  }
  if (addressSpace === SPC700_ARAM_ADDRESS_SPACE && address < 0x10000) {
    return { memoryType: "SpcRam", address };
  }
  return undefined;
};

const escapeComment = (value: string): string => value.replace(/\r\n|\r|\n/g, "\\n");

/**
 * Exports representable native labels and comments in stock MesenCE label-file syntax.
 * @param {readonly ProjectLabel[]} labels Native labels.
 * @param {readonly ProjectComment[]} comments Native address comments.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {string} sourceName Output display name for the report.
 * @returns {MesenLabelExportResult} Deterministic text plus loss report.
 */
export const exportMesenLabels = (
  labels: readonly ProjectLabel[],
  comments: readonly ProjectComment[],
  rom: RomImage,
  mapper: SnesMapper,
  sourceName = "project.mlb",
): MesenLabelExportResult => {
  const entries: ExportEntry[] = [];
  const unsupported: ImportLossItem[] = [];
  let invalidNames = 0;
  let unsupportedAddresses = 0;
  for (const label of labels) {
    if (!LABEL_PATTERN.test(label.name)) {
      invalidNames++;
      continue;
    }
    const mapped = exportAddress(label.addressSpace, label.address, rom, mapper);
    if (!mapped) {
      unsupportedAddresses++;
      continue;
    }
    entries.push({
      ...mapped,
      name: label.name,
      ...(label.comment ? { comment: label.comment } : {}),
      sourceId: label.id,
    });
  }
  for (const comment of comments) {
    const mapped = exportAddress(comment.addressSpace, comment.address, rom, mapper);
    if (!mapped) {
      unsupportedAddresses++;
      continue;
    }
    entries.push({ ...mapped, name: "", comment: comment.text, sourceId: comment.id });
  }
  if (invalidNames > 0) {
    unsupported.push({
      field: "labels.name",
      count: invalidNames,
      reason: "Native label name does not match MesenCE's label grammar.",
    });
  }
  if (unsupportedAddresses > 0) {
    unsupported.push({
      field: "labels.addressSpace",
      count: unsupportedAddresses,
      reason: "Address is not representable as Mesen SNES PRG/WRAM/SRAM or SPC RAM.",
    });
  }

  const byAddress = new Map<string, ExportEntry>();
  let collisions = 0;
  for (const entry of entries.sort((left, right) => left.sourceId.localeCompare(right.sourceId))) {
    const key = `${entry.memoryType}:${entry.address}`;
    const current = byAddress.get(key);
    if (!current) {
      byAddress.set(key, entry);
      continue;
    }
    collisions++;
    if (current.name === "" && entry.name !== "") {
      byAddress.set(key, {
        ...entry,
        comment: [entry.comment, current.comment].filter(Boolean).join("\n"),
      });
    } else if (entry.comment) {
      byAddress.set(key, {
        ...current,
        comment: [current.comment, entry.comment].filter(Boolean).join("\n"),
      });
    }
  }
  if (collisions > 0) {
    unsupported.push({
      field: "labels.collisions",
      count: collisions,
      reason: "Multiple native records at one Mesen address were deterministically combined.",
    });
  }
  const order: Readonly<Record<ExportEntry["memoryType"], number>> = {
    SnesPrgRom: 0,
    SnesWorkRam: 1,
    SnesSaveRam: 2,
    SpcRam: 3,
  };
  const rows = [...byAddress.values()]
    .sort(
      (left, right) =>
        order[left.memoryType] - order[right.memoryType] ||
        left.address - right.address ||
        left.sourceId.localeCompare(right.sourceId),
    )
    .map(
      (entry) =>
        `${entry.memoryType}:${entry.address.toString(16).toUpperCase().padStart(4, "0")}:${entry.name}${entry.comment ? `:${escapeComment(entry.comment)}` : ""}`,
    );
  const text = rows.length === 0 ? "" : `${rows.join("\n")}\n`;
  const outputSha256 = sha256(text);
  return {
    text,
    report: reportFor("export", sourceName, outputSha256, { labels: rows.length }, unsupported, []),
  };
};
