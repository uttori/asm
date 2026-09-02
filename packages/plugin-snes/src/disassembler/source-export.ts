import { Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import {
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_MANIFEST,
  SOURCE_EXPORT_SCHEMA_VERSION,
  canonicalSourceExportJson,
  loadSourceExportManifest,
  sourceExportSha256,
  validateSourceExportFiles,
  type AnalysisControlFlowNodeRecord,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type RomImage,
  type SourceExportFile,
  type SourceExportManifest,
  type SourceExportSpan,
  type SourceExportSpanRole,
} from "@uttori/asm-disassembler";
import * as fs from "node:fs";
import path from "node:path";

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
import type { SnesMapper } from "./rom-header.js";

/** Options for `exportSnes65816Source`. `sourceProjectSha256` is required provenance. */
export interface SnesSourceExportOptions {
  /**
   * Overwrite an existing export directory. Without this, a populated directory
   * that is not a previous export, or a previous export whose files drifted, is rejected.
   */
  readonly force?: boolean;
  /** SHA-256 of the analysis project that produced this export (provenance). */
  readonly sourceProjectSha256: string;
}

interface PlannedInstruction {
  readonly start: number;
  readonly end: number;
  readonly source: string;
  readonly state: Cpu65816DecodeState;
  readonly nodeIds: readonly string[];
}

interface PlannedSpan {
  readonly start: number;
  readonly end: number;
  readonly role: SourceExportSpanRole;
  readonly instruction?: PlannedInstruction;
}

interface NamedLine {
  readonly name?: string;
  readonly comment?: string;
}

const hex = (value: number, width = 6): string =>
  `$${value.toString(16).toUpperCase().padStart(width, "0")}`;

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
 * @returns {string} Native source with a `.b`, `.w`, or `.l` suffix where width is selectable.
 */
export const formatSnes65816SourceInstruction = (instruction: DecodedInstruction): string => {
  const formatted = formatCpu65816Instruction(instruction);
  const space = formatted.indexOf(" ");
  const mnemonic = space < 0 ? formatted : formatted.slice(0, space);
  const operand = space < 0 ? "" : formatted.slice(space);
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
  return `${mnemonic}${suffix}${operand}`;
};

const mapperDirective = (mapper: SnesMapper): string =>
  mapper === "bigsa1rom" ? "fullsa1rom" : mapper;

const roleAt = (
  start: number,
  end: number,
  mapper: SnesMapper,
  shards: AnalysisProjectShards,
): SourceExportSpanRole => {
  const headerBase: Partial<Record<SnesMapper, number>> = {
    lorom: 0x7fc0,
    sfxrom: 0x7fc0,
    sa1rom: 0x7fc0,
    bigsa1rom: 0x7fc0,
    hirom: 0xffc0,
    exlorom: 0x407fc0,
    exhirom: 0x40ffc0,
  };
  const base = headerBase[mapper];
  if (base !== undefined && start >= base && end <= base + 0x20) return "snes-header";
  if (base !== undefined && start >= base + 0x20 && end <= base + 0x40) return "vectors";
  if (
    shards.annotations.some(
      (entry) =>
        entry.addressSpace === SNES_FILE_ADDRESS_SPACE &&
        entry.classification === "empty" &&
        entry.start <= start &&
        end <= entry.end,
    )
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

const sanitizedLabel = (name: string): string => {
  const body = name.replaceAll(/\W/g, "_").replaceAll(/_+/g, "_");
  return `L_${body || "unnamed"}`;
};

const metadataLines = (
  shards: AnalysisProjectShards,
  mapper: SnesMapper,
  romSize: number,
): ReadonlyMap<number, readonly NamedLine[]> => {
  const values = new Map<number, NamedLine[]>();
  const append = (offset: number | undefined, line: NamedLine): void => {
    if (offset === undefined) return;
    values.set(offset, [...(values.get(offset) ?? []), line]);
  };
  const used = new Map<string, number>();
  for (const label of [...shards.labels].sort((a, b) => a.id.localeCompare(b.id))) {
    let name = sanitizedLabel(label.name);
    const count = used.get(name) ?? 0;
    used.set(name, count + 1);
    if (count > 0) name = `${name}_${count + 1}`;
    append(toFileOffset(label.addressSpace, label.address, mapper, romSize), {
      name,
      ...(label.comment ? { comment: label.comment } : {}),
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
      comment: comment.text,
    });
  }
  return values;
};

const renderedMetadata = (lines: readonly NamedLine[] | undefined): string[] => {
  if (!lines) return [];
  const output: string[] = [];
  for (const line of lines) {
    if (line.comment) {
      for (const text of line.comment.split(/\r?\n/)) output.push(`; ${text.replaceAll("\r", "")}`);
    }
    if (line.name) output.push(`${line.name}:`);
  }
  return output;
};

const rejectedByAnnotation = (
  node: AnalysisControlFlowNodeRecord,
  shards: AnalysisProjectShards,
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
  return shards.annotations.some(
    (entry) =>
      entry.addressSpace === SNES_FILE_ADDRESS_SPACE &&
      rawClassifications.has(entry.classification) &&
      entry.start < node.fileOffset + node.size &&
      node.fileOffset < entry.end,
  );
};

const planInstructions = (
  rom: RomImage,
  mapper: SnesMapper,
  shards: AnalysisProjectShards,
  metadata: ReadonlyMap<number, readonly NamedLine[]>,
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
    let low = 0;
    let high = metadataOffsets.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (metadataOffsets[middle] <= start) low = middle + 1;
      else high = middle;
    }
    return low < metadataOffsets.length && metadataOffsets[low] < end;
  };
  const groups = new Map<number, AnalysisControlFlowNodeRecord[]>();
  for (const record of shards.analysis) {
    if (
      record.kind !== "cfg-node" ||
      record.fileOffset < 0 ||
      record.fileOffset + record.size > rom.length ||
      conflictNodes.has(record.id) ||
      rejectedByAnnotation(record, shards)
    ) {
      continue;
    }
    if (hasInteriorMetadata(record.fileOffset, record.fileOffset + record.size)) {
      continue;
    }
    groups.set(record.fileOffset, [...(groups.get(record.fileOffset) ?? []), record]);
  }

  const candidates = new Map<number, PlannedInstruction>();
  for (const [offset, records] of [...groups].sort(([left], [right]) => left - right)) {
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
        return { record, state, source: formatSnes65816SourceInstruction(result.instruction) };
      });
    if (variants.some((entry) => entry === undefined)) continue;
    const resolved = variants as Array<NonNullable<(typeof variants)[number]>>;
    if (
      resolved.some(
        (entry) =>
          entry.record.size !== resolved[0].record.size || entry.source !== resolved[0].source,
      )
    ) {
      continue;
    }
    const first = resolved[0];
    candidates.set(offset, {
      start: offset,
      end: offset + first.record.size,
      source: first.source,
      state: first.state,
      nodeIds: resolved.map((entry) => entry.record.id),
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
    const context = createSnesAddressContext(mapper);
    const firstAddress = snesRomAddressSpace.fromOutputOffset(start, context);
    const lastAddress = snesRomAddressSpace.fromOutputOffset(instruction.end - 1, context);
    if (firstAddress < 0 || lastAddress !== firstAddress + instruction.end - start - 1) {
      candidates.delete(start);
    }
  }
  return candidates;
};

const headerCuts = (mapper: SnesMapper): readonly number[] => {
  const base: Partial<Record<SnesMapper, number>> = {
    lorom: 0x7fc0,
    sfxrom: 0x7fc0,
    sa1rom: 0x7fc0,
    hirom: 0xffc0,
    exlorom: 0x407fc0,
    exhirom: 0x40ffc0,
  };
  const value = base[mapper];
  return value === undefined ? [] : [value, value + 0x20, value + 0x40];
};

const planSpans = (
  rom: RomImage,
  mapper: SnesMapper,
  shards: AnalysisProjectShards,
  instructions: ReadonlyMap<number, PlannedInstruction>,
  metadata: ReadonlyMap<number, readonly NamedLine[]>,
): readonly PlannedSpan[] => {
  const bankSize =
    mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
  const cuts = new Set<number>([0, rom.length]);
  for (let offset = bankSize; offset < rom.length; offset += bankSize) cuts.add(offset);
  for (const offset of headerCuts(mapper)) if (offset > 0 && offset < rom.length) cuts.add(offset);
  for (const [offset, instruction] of instructions) {
    cuts.add(offset);
    cuts.add(instruction.end);
  }
  for (const offset of metadata.keys()) cuts.add(offset);
  for (const entry of shards.annotations) {
    if (entry.addressSpace !== SNES_FILE_ADDRESS_SPACE) continue;
    if (entry.classification === "opcode" || entry.classification === "operand") continue;
    if (entry.start > 0 && entry.start < rom.length) cuts.add(entry.start);
    if (entry.end > 0 && entry.end < rom.length) cuts.add(entry.end);
  }
  for (const region of shards.regions) {
    const start = toFileOffset(region.addressSpace, region.start, mapper, rom.length);
    const last = toFileOffset(region.addressSpace, region.end - 1, mapper, rom.length);
    if (start !== undefined) cuts.add(start);
    if (last !== undefined && last + 1 < rom.length) cuts.add(last + 1);
  }
  const sorted = [...cuts].sort((left, right) => left - right);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const instruction = instructions.get(start);
    return instruction?.end === end
      ? { start, end, role: "code", instruction }
      : { start, end, role: roleAt(start, end, mapper, shards) };
  });
};

const preflight = (directory: string, force: boolean): SourceExportManifest | undefined => {
  if (!fs.existsSync(directory)) return undefined;
  const manifestFile = path.join(directory, SOURCE_EXPORT_MANIFEST);
  if (!fs.existsSync(manifestFile)) {
    if (!force && fs.readdirSync(directory).length > 0) {
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

const widthDirective = (
  flag: Cpu65816DecodeState["m"],
  sixteen: string,
  eight: string,
): string[] => {
  if (flag === 0) return [sixteen];
  if (flag === 1) return [eight];
  return [];
};

const stateDirectives = (state: Cpu65816DecodeState): readonly string[] => [
  ...widthDirective(state.m, ".a16", ".a8"),
  ...widthDirective(state.x, ".i16", ".i8"),
];

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
 * Confident CFG nodes become width-qualified instructions; everything else is
 * `incbin` assets. Banks, SNES header, vectors, and an optional 512-byte copier
 * header are split at mapper-aware cuts. Checksums are preserved, not recomputed.
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
  const previousManifest = preflight(directory, options.force ?? false);
  const metadata = metadataLines(project.shards, mapper, rom.length);
  const instructions = planInstructions(rom, mapper, project.shards, metadata);
  const planned = planSpans(rom, mapper, project.shards, instructions, metadata);
  const files: SourceExportFile[] = [];
  const spans: SourceExportSpan[] = [];
  const banks = new Map<number, PlannedSpan[]>();
  const bankSize =
    mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
  for (const span of planned) {
    const bank = Math.floor(span.start / bankSize);
    banks.set(bank, [...(banks.get(bank) ?? []), span]);
  }

  const bankSources: string[] = [];
  for (const [bank, bankSpans] of [...banks].sort(([left], [right]) => left - right)) {
    const bankPath = `banks/bank-${bank.toString(16).padStart(3, "0")}.asm`;
    bankSources.push(bankPath);
    const lines = [`; Generated bank ${bank.toString(16).toUpperCase().padStart(3, "0")}.`];
    for (const span of bankSpans) {
      const address = snesRomAddressSpace.fromOutputOffset(span.start, context);
      if (address < 0)
        throw new Error(`Mapper '${mapper}' cannot represent ROM offset ${hex(span.start)}.`);
      lines.push("", `org ${hex(address)}`, ...renderedMetadata(metadata.get(span.start)));
      if (span.instruction) {
        lines.push(...stateDirectives(span.instruction.state), span.instruction.source);
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
      } else {
        const assetPath = `assets/${span.role}-${span.start.toString(16).padStart(6, "0")}-${span.end.toString(16).padStart(6, "0")}.bin`;
        const bytes = rom.read(span.start, span.end - span.start)!;
        writeFile(directory, assetPath, bytes, "asset", files);
        lines.push(`incbin "../${assetPath}"`);
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
    }
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
    mapperDirective(mapper),
    "arch 65816",
    ".smart off",
    "",
    ...bankSources.map((source) => `incsrc "${source}"`),
    "",
  ].join("\n");
  writeFile(directory, "main.asm", main, "source", files);
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
