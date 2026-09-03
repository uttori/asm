import { createHash } from "node:crypto";

import type {
  AnalysisProjectShards,
  ImportLossItem,
  ImportReport,
  IntervalAnnotation,
  ProjectComment,
  ProjectLabel,
  ProjectMapping,
  ProjectRegion,
} from "@uttori/asm-disassembler";

import type { SnesMapper } from "./rom-header.js";

// Interoperability implementation derived from the documented/on-disk format and independently
// structured from DiztinGUIsh. The substitutions below are serialized wire-format constants.
const SUBSTITUTIONS: ReadonlyArray<readonly [string, string]> = [
  ["0001E", "ZQ"],
  ["B0001", "Zq"],
  ["C0001", "ZX"],
  ["B7E", "Zx"],
  ["07F01", "ZY"],
  ["0001D", "Zy"],
  ["C7E", "ZZ"],
  ["07E", "Zz"],
  ["00001", "ZS"],
  ["0001", "Zs"],
];

const CLASSIFICATIONS: Readonly<Record<string, IntervalAnnotation["classification"]>> = {
  U: "unreached",
  "+": "opcode",
  ".": "operand",
  A: "data8",
  B: "data16",
  C: "data24",
  D: "data32",
  E: "pointer16",
  F: "pointer24",
  H: "pointer32",
  G: "graphics",
  M: "music",
  X: "empty",
  T: "text",
};

const ARCHITECTURES = ["snes.65816", "snes.spc700", "snes.superfx"] as const;

const xmlDecode = (value: string): string =>
  value.replace(/&(?:#(x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi, (entity, numeric: string) => {
    if (numeric) {
      const radix = numeric[0].toLowerCase() === "x" ? 16 : 10;
      return String.fromCodePoint(
        Number.parseInt(radix === 16 ? numeric.slice(1) : numeric, radix),
      );
    }
    return (
      { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[
        entity.toLowerCase()
      ] ?? entity
    );
  });

const attributes = (source: string): Record<string, string> =>
  Object.fromEntries(
    [...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], xmlDecode(match[2])]),
  );

const ELEMENT_PATTERNS = {
  Data: /<Data\b([^>]*)>([\S\s]*?)<\/Data>/,
  RomBytes: /<RomBytes\b([^>]*)>([\S\s]*?)<\/RomBytes>/,
  Labels: /<Labels\b([^>]*)>([\S\s]*?)<\/Labels>/,
  Comments: /<Comments\b([^>]*)>([\S\s]*?)<\/Comments>/,
  Regions: /<Regions\b([^>]*)>([\S\s]*?)<\/Regions>/,
} as const;

const element = (
  xml: string,
  name: keyof typeof ELEMENT_PATTERNS,
): { opening: string; body: string } | undefined => {
  const match = ELEMENT_PATTERNS[name].exec(xml);
  return match ? { opening: match[1], body: match[2] } : undefined;
};

const fake64 = (character: string): number => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (character === "0") return 0;
  if (character === "A") return 52 << 2;
  const index = alphabet.indexOf(character);
  if (index < 0) throw new Error(`Invalid .dizraw flag character '${character}'.`);
  return index << 2;
};

interface DecodedMetadata {
  readonly classification: IntervalAnnotation["classification"];
  readonly architecture: string;
  readonly m: boolean;
  readonly x: boolean;
  readonly dataBank: number;
  readonly directPage: number;
  readonly points: readonly ("in" | "out" | "end" | "read")[];
}

const decodeMetadata = (line: string): DecodedMetadata => {
  const padded = line.padEnd(9, "0").slice(0, 9);
  const classification = CLASSIFICATIONS[padded[0]];
  if (!classification) throw new Error(`Unknown .dizraw classification '${padded[0]}'.`);
  const flags = fake64(padded[1]);
  const pointValue = (flags >> 4) & 0x0f;
  const architectureValue = Number.parseInt(padded[8], 16) & 0x03;
  const architecture = ARCHITECTURES[architectureValue];
  if (!architecture) throw new Error(`Unknown .dizraw architecture '${padded[8]}'.`);
  const points: Array<"in" | "out" | "end" | "read"> = [];
  if (pointValue & 1) points.push("in");
  if (pointValue & 2) points.push("out");
  if (pointValue & 4) points.push("end");
  if (pointValue & 8) points.push("read");
  return {
    classification,
    architecture,
    x: ((flags >> 2) & 1) !== 0,
    m: ((flags >> 3) & 1) !== 0,
    dataBank: Number.parseInt(padded.slice(2, 4), 16),
    directPage: Number.parseInt(padded.slice(4, 8), 16),
    points,
  };
};

const sameMetadata = (left: DecodedMetadata, right: DecodedMetadata): boolean =>
  left.classification === right.classification &&
  left.architecture === right.architecture &&
  left.m === right.m &&
  left.x === right.x &&
  left.dataBank === right.dataBank &&
  left.directPage === right.directPage &&
  left.points.join(",") === right.points.join(",");

const decodeRomByteLines = (body: string, maximumBytes: number): string[] => {
  const normalized = xmlDecode(body).replaceAll("\r", "").trim();
  const [header, ...encodedLines] = normalized.split("\n");
  if (!header) throw new Error(".dizraw RomBytes section is missing its format header.");
  const options = header.split(",");
  const version = options.find((option) => option.startsWith("version:"));
  if (version !== "version:200" && version !== "version:201") {
    throw new Error(`Unsupported .dizraw RomBytes format '${version ?? "missing version"}'.`);
  }
  let lines = encodedLines;
  if (options.includes("compress_table_1")) {
    lines = lines.map((line) => {
      let decoded = line;
      for (const [longText, shortText] of [...SUBSTITUTIONS].reverse()) {
        decoded = decoded.replaceAll(shortText, longText);
      }
      return decoded;
    });
  }
  if (options.includes("compress_groupblocks")) {
    const expanded: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("r")) {
        expanded.push(line);
        continue;
      }
      const match = /^r (\d+) (.+)$/.exec(line);
      if (!match) throw new Error(`Invalid .dizraw repeater command '${line}'.`);
      const count = Number(match[1]);
      if (!Number.isSafeInteger(count) || count < 0 || expanded.length + count > maximumBytes) {
        throw new Error(
          `.dizraw RomBytes expansion exceeds the ${maximumBytes}-byte safety limit.`,
        );
      }
      for (let index = 0; index < count; index++) expanded.push(match[2]);
    }
    lines = expanded;
  }
  const decoded = lines
    .map((line) => line.slice(0, line.indexOf(";") < 0 ? undefined : line.indexOf(";")).trimEnd())
    .filter((line) => line.length > 0);
  if (decoded.length > maximumBytes) {
    throw new Error(`.dizraw RomBytes section exceeds the ${maximumBytes}-byte safety limit.`);
  }
  return decoded;
};

const metadataIntervals = (lines: readonly string[], evidenceId: string): IntervalAnnotation[] => {
  if (lines.length === 0) return [];
  const output: IntervalAnnotation[] = [];
  let start = 0;
  let active = decodeMetadata(lines[0]);
  const push = (end: number): void => {
    output.push({
      id: `dizraw:metadata:${start.toString(16).padStart(6, "0")}-${end.toString(16).padStart(6, "0")}`,
      addressSpace: "rom.file",
      start,
      end,
      classification: active.classification,
      architecture: active.architecture,
      state: {
        m: active.m,
        x: active.x,
        dataBank: active.dataBank,
        directPage: active.directPage,
      },
      ...(active.points.length === 0 ? {} : { points: active.points }),
      evidence: [evidenceId],
    });
  };
  for (let index = 1; index < lines.length; index++) {
    const decoded = decodeMetadata(lines[index]);
    if (!sameMetadata(active, decoded)) {
      push(index);
      start = index;
      active = decoded;
    }
  }
  push(lines.length);
  return output;
};

const DIZ_MAPPERS: Readonly<Record<string, SnesMapper>> = {
  LoRom: "lorom",
  HiRom: "hirom",
  ExLoRom: "exlorom",
  ExHiRom: "exhirom",
  Sa1Rom: "sa1rom",
  ExSa1Rom: "bigsa1rom",
  SuperFx: "sfxrom",
};

const DIZ_SPEEDS: Readonly<Record<string, string>> = {
  SlowRom: "slow",
  FastRom: "fast",
  Unknown: "unknown",
};

export interface DizRawImportResult {
  /** Mapper/speed taken from `Data.RomMapMode` / `RomSpeed`. */
  readonly mapping: ProjectMapping;
  /** Labels, comments, regions, classification intervals, and import evidence. */
  readonly shards: AnalysisProjectShards;
  /** Counts plus a loss list for DiztinGUIsh-only fields that are not portable. */
  readonly report: ImportReport;
  /** Number of per-byte metadata rows after expansion (should match ROM size). */
  readonly metadataBytes: number;
}

/** Safety and identity options for `importDizRaw`. */
export interface DizRawImportOptions {
  /** Display name recorded in the import report; defaults to `import.dizraw`. */
  readonly sourceName?: string;
  /** When set, the expanded RomBytes row count must equal this headerless size. */
  readonly expectedRomSize?: number;
  /** Expansion cap for compressed/repeated RomBytes; default 16 MiB. */
  readonly maximumMetadataBytes?: number;
}

/**
 * Imports uncompressed XML `.dizraw` (DiztinGUIsh project) into native shards.
 * Compressed `.diz` is rejected. Mapper, speed, labels, comments, regions,
 * per-byte classification, architecture, M/X, DBR, direct page, and in/out/end/read
 * points are imported; UI settings and context-mapping aliases are reported as loss.
 * @param {string} xml Uncompressed `.dizraw` XML document.
 * @param {DizRawImportOptions} [options] Source name, ROM-size check, and expansion cap.
 * @returns {DizRawImportResult} Mapping, shards, loss report, and metadata row count.
 */
export const importDizRaw = (
  xml: string,
  options: DizRawImportOptions = {},
): DizRawImportResult => {
  if (
    !xml.trimStart().startsWith("<?xml") &&
    !xml.trimStart().startsWith("<ProjectXmlSerializer-Root")
  ) {
    throw new Error(
      "Only uncompressed XML .dizraw input is supported; compressed .diz input is not supported.",
    );
  }
  const rootMatch = /<ProjectXmlSerializer-Root\b([^>]*)>/.exec(xml);
  const projectMatch = /<Project\b([^>]*)>/.exec(xml);
  const data = element(xml, "Data");
  const romBytes = element(xml, "RomBytes");
  if (!rootMatch || !projectMatch || !data || !romBytes) {
    throw new Error(
      "Invalid .dizraw project: required root, Project, Data, or RomBytes element missing.",
    );
  }
  const rootAttributes = attributes(rootMatch[1]);
  const projectAttributes = attributes(projectMatch[1]);
  const dataAttributes = attributes(data.opening);
  const mapper = DIZ_MAPPERS[dataAttributes.RomMapMode];
  if (!mapper) throw new Error(`Unsupported .dizraw mapper '${dataAttributes.RomMapMode}'.`);
  const sourceSha256 = createHash("sha256").update(xml).digest("hex");
  const sourceName = options.sourceName ?? "import.dizraw";
  const evidenceId = `import:dizraw:${sourceSha256.slice(0, 16)}`;

  const labelsElement = element(data.body, "Labels");
  const labels: ProjectLabel[] = [];
  if (labelsElement) {
    for (const match of labelsElement.body.matchAll(/<sys:Item\b([^>]*)>([\S\s]*?)<\/sys:Item>/g)) {
      const itemAttributes = attributes(match[1]);
      const valueMatch = /<Value\b([^>]*)\/?\s*>/.exec(match[2]);
      if (!valueMatch) continue;
      const valueAttributes = attributes(valueMatch[1]);
      const address = Number(itemAttributes.Key);
      if (!Number.isSafeInteger(address) || address < 0) {
        throw new Error(`Invalid .dizraw label address '${itemAttributes.Key}'.`);
      }
      labels.push({
        id: `dizraw:label:${address.toString(16).padStart(6, "0")}:${labels.length}`,
        addressSpace: "snes.cpu",
        address,
        name: valueAttributes.Name ?? "",
        ...(valueAttributes.Comment ? { comment: valueAttributes.Comment } : {}),
        ...(valueAttributes.Author ? { author: valueAttributes.Author } : {}),
        ...(valueAttributes.Confidence ? { confidence: valueAttributes.Confidence } : {}),
        evidence: [evidenceId],
      });
    }
  }

  const comments: ProjectComment[] = [];
  const commentsElement = element(data.body, "Comments");
  if (commentsElement) {
    for (const match of commentsElement.body.matchAll(
      /<sys:Item\b([^>]*)>([\S\s]*?)<\/sys:Item>/g,
    )) {
      const itemAttributes = attributes(match[1]);
      const valueStart = match[2].indexOf("<Value");
      const valueOpeningEnd = match[2].indexOf(">", valueStart);
      const valueEnd = match[2].indexOf("</Value>", valueOpeningEnd);
      if (valueStart < 0 || valueOpeningEnd < 0 || valueEnd < 0) continue;
      const address = Number(itemAttributes.Key);
      if (!Number.isSafeInteger(address) || address < 0) {
        throw new Error(`Invalid .dizraw comment address '${itemAttributes.Key}'.`);
      }
      comments.push({
        id: `dizraw:comment:${address.toString(16).padStart(6, "0")}:${comments.length}`,
        addressSpace: "snes.cpu",
        address,
        text: xmlDecode(match[2].slice(valueOpeningEnd + 1, valueEnd)),
        evidence: [evidenceId],
      });
    }
  }

  const regions: ProjectRegion[] = [];
  const regionsElement = element(data.body, "Regions");
  if (regionsElement) {
    for (const match of regionsElement.body.matchAll(/<[^>]*Region\b([^>]*)\/?\s*>/g)) {
      const value = attributes(match[1]);
      const start = Number(value.StartSnesAddress);
      const end = Number(value.EndSnesAddress) + 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
        throw new Error(
          `Invalid .dizraw region range '${value.StartSnesAddress}'–'${value.EndSnesAddress}'.`,
        );
      }
      regions.push({
        id: `dizraw:region:${start.toString(16).padStart(6, "0")}-${end.toString(16).padStart(6, "0")}:${regions.length}`,
        addressSpace: "snes.cpu",
        start,
        end,
        name: value.RegionName ?? "",
        ...(value.ContextToApply ? { context: value.ContextToApply } : {}),
        ...(value.Priority === undefined ? {} : { priority: Number(value.Priority) }),
        attributes: {
          ...(value.ExportSeparateFile === undefined
            ? {}
            : { exportSeparateFile: value.ExportSeparateFile === "true" }),
          ...(value.ExportType === undefined ? {} : { exportType: value.ExportType }),
          ...(value.AssetType === undefined ? {} : { assetType: value.AssetType }),
          ...(value.AssetVersion === undefined ? {} : { assetVersion: value.AssetVersion }),
          ...(value.AssetName === undefined ? {} : { assetName: value.AssetName }),
          ...(value.AssetOptions === undefined ? {} : { assetOptions: value.AssetOptions }),
        },
        evidence: [evidenceId],
      });
    }
  }

  const maximumMetadataBytes = options.maximumMetadataBytes ?? 0x1000000;
  if (!Number.isSafeInteger(maximumMetadataBytes) || maximumMetadataBytes <= 0) {
    throw new Error("maximumMetadataBytes must be a positive safe integer.");
  }
  const metadataLines = decodeRomByteLines(romBytes.body, maximumMetadataBytes);
  if (options.expectedRomSize !== undefined && metadataLines.length !== options.expectedRomSize) {
    throw new Error(
      `.dizraw metadata covers ${metadataLines.length} bytes, but the ROM contains ${options.expectedRomSize} content bytes.`,
    );
  }
  const annotations = metadataIntervals(metadataLines, evidenceId);
  const unsupported: ImportLossItem[] = [];
  const recordUnsupported = (field: string, present: boolean, reason: string): void => {
    if (present) unsupported.push({ field, count: 1, reason });
  };
  recordUnsupported(
    "Project.LogWriterSettings",
    /<LogWriterSettings\b/.test(xml),
    "assembly export formatting is not analysis data",
  );
  recordUnsupported(
    "Project.ProjectSettings",
    /<ProjectSettings\b/.test(xml),
    "DiztinGUIsh UI and serializer preferences are not portable analysis data",
  );
  recordUnsupported(
    "Project.InternalRomGameName",
    projectAttributes.InternalRomGameName !== undefined,
    "the native project identifies the ROM by SHA-256 instead",
  );
  recordUnsupported(
    "Project.InternalCheckSum",
    projectAttributes.InternalCheckSum !== undefined,
    "the native project identifies the ROM by SHA-256 instead",
  );
  const contextMappings = (labelsElement?.body.match(/<ContextMappings\b/g) ?? []).length;
  if (contextMappings > 0) {
    unsupported.push({
      field: "Data.Labels.ContextMappings",
      count: contextMappings,
      reason: "context-specific alternate label names are not represented in the native schema",
    });
  }
  const report: ImportReport = {
    id: evidenceId,
    format: "dizraw",
    sourceName,
    sourceSha256,
    ...(rootAttributes.SaveVersion ? { sourceVersion: rootAttributes.SaveVersion } : {}),
    imported: {
      mapper: 1,
      speed: dataAttributes.RomSpeed ? 1 : 0,
      metadataBytes: metadataLines.length,
      annotationIntervals: annotations.length,
      labels: labels.length,
      comments: comments.length,
      regions: regions.length,
    },
    unsupported,
    warnings: [],
  };
  return {
    mapping: {
      mapper,
      ...(dataAttributes.RomSpeed
        ? { speed: DIZ_SPEEDS[dataAttributes.RomSpeed] ?? dataAttributes.RomSpeed }
        : {}),
      source: "import",
      candidates: [],
    },
    metadataBytes: metadataLines.length,
    report,
    shards: {
      analysis: [],
      annotations,
      labels,
      comments,
      regions,
      runtime: [],
      evidence: [
        {
          id: evidenceId,
          source: "import",
          sourceId: sourceSha256,
          confidence: "certain",
          detail: `Imported from ${sourceName}`,
        },
      ],
      imports: [report],
    },
  };
};
