import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  projectSourceLabelNames,
  type ProjectLabel,
  type ProjectComment,
  type IntervalAnnotation,
  type AnalysisControlFlowNodeRecord,
  type SourceGenerationFile,
} from "@uttori/asm-disassembler";

import { Cpu6502Decoder, formatCpu6502Instruction } from "../decoder.js";
import { ricoh2a03Cpu } from "../instructions/opcodes.js";
import { NES_CHR_CODEC, NES_TEXT_CODEC, nesChrPng, decodeNesText, nesTextMap } from "./assets.js";
import type { NesCartridge } from "./cartridge.js";
import { NES_HARDWARE_SYMBOLS, nesHardwareOperand, nesHardwareSource } from "./hardware.js";
import { matchesNesResearch, nesResearchMapper, nesStoredMapper } from "./research.js";
import { nesSourceDataRanges, nesSourceDefinition, nesSourceHex } from "./source-data.js";

/** One physical output segment, independent of the runtime mapper selection. */
export interface NesSourceSegment {
  readonly name: string;
  readonly offset: number;
  readonly size: number;
  readonly origin: number;
}

/** Stable 8 KiB PRG/CHR ownership with separate trainer/trailer segments. Offsets include the iNES header. */
export function nesSourceSegments(
  rom: NesCartridge,
  _nodes: readonly AnalysisControlFlowNodeRecord[] = [],
): readonly NesSourceSegment[] {
  const segments: NesSourceSegment[] = [];
  if (rom.trainer.size) {
    segments.push({ name: "TRAINER", ...rom.trainer, origin: 0x7000 });
  }
  for (let offset = 0; offset < rom.prg.size; offset += 8192) {
    const bank = offset / 8192;
    let origin = 0x8000;
    if (offset === rom.prg.size - 16384) {
      origin = 0xc000;
    }
    if (offset === rom.prg.size - 8192) {
      origin = 0xe000;
    }
    // Canonical origins stay stable as captures discover additional aliases for a bank.
    segments.push({
      name: `PRG_${bank.toString(16).padStart(2, "0")}`,
      offset: rom.prg.offset + offset,
      size: 8192,
      origin,
    });
  }
  for (let offset = 0; offset < rom.chr.size; offset += 8192) {
    segments.push({
      name: `CHR_${(offset / 8192).toString(16).padStart(2, "0")}`,
      offset: rom.chr.offset + offset,
      size: 8192,
      origin: 0,
    });
  }
  // Keep nonstandard trailing bytes without assigning them CPU-code meaning.
  for (let offset = 0; offset < rom.trailing.size; offset += 8192) {
    segments.push({
      name: `TRAILER_${offset}`,
      offset: rom.trailing.offset + offset,
      size: Math.min(8192, rom.trailing.size - offset),
      origin: 0,
    });
  }
  return segments;
}

/** Export every physical byte once; ambiguous instruction boundaries remain editable binary data. */
export function exportNesSource(
  rom: NesCartridge,
  nodes: readonly AnalysisControlFlowNodeRecord[],
  romSha256: string,
  research: {
    readonly labels?: readonly ProjectLabel[];
    readonly comments?: readonly ProjectComment[];
    /** Explicit data classifications and versioned text/graphics layouts, qualified to original bytes. */
    readonly annotations?: readonly IntervalAnnotation[];
  } = {},
): {
  files: SourceGenerationFile[];
  segments: readonly NesSourceSegment[];
  codeBytes: number;
  ranges: readonly { start: number; end: number }[];
} {
  const segments = nesSourceSegments(rom, nodes);
  const files: SourceGenerationFile[] = [];
  const add = (path: string, value: string | Uint8Array) =>
    files.push({ path, bytes: typeof value === "string" ? Buffer.from(value) : value });
  // Character-table ownership follows the complete glyph map, independently of string annotation IDs.
  const textTables = new Map<string, string>();
  const names = projectSourceLabelNames(
    research.labels ?? [],
    NES_HARDWARE_SYMBOLS.map((entry) => entry.name),
  );
  const notes = new Map<number, string[]>();
  const labelsAt = new Map<number, string[]>();
  const definitions: string[] = [];
  const ramDefinitions: string[] = [];
  const dataRanges = nesSourceDataRanges(rom, research.annotations ?? []);
  for (const record of [...(research.labels ?? []), ...(research.comments ?? [])]) {
    // A CPU alias can execute from several contexts; select every proven physical owner, once.
    const matching = nodes.filter((node) =>
      matchesNesResearch(rom, record, node.address, nesStoredMapper(node.incomingState)),
    );
    const offsets = new Set(matching.map((node) => node.fileOffset!));
    if (record.addressSpace === "nes.file") {
      offsets.add(record.address);
    } else if (record.mapping?.fileOffset !== undefined) {
      // A proved data label need not have an instruction node at its original-image anchor.
      offsets.add(record.mapping.fileOffset);
    }
    const name = names.get(record.id);
    if (name && "name" in record && !record.suppressed) {
      const owners = [...offsets].map((offset) => ({
        offset,
        segment: segments.find(
          (item) => offset >= item.offset - 16 && offset < item.offset - 16 + item.size,
        ),
      }));
      if (owners.some((owner) => !owner.segment)) {
        throw new Error(`Research label '${record.id}' is outside the original image.`);
      }
      const owner = owners.at(0);
      let address = record.address;
      if (record.addressSpace === "nes.file" && owner?.segment) {
        address = owner.segment.origin + owner.offset - (owner.segment.offset - 16);
      }
      const canonical =
        owner?.segment && owner.segment.origin + owner.offset - (owner.segment.offset - 16);
      const canDefineLabel = owners.length === 1 && canonical === address;
      if (owner && canDefineLabel) {
        labelsAt.set(owner.offset, [...(labelsAt.get(owner.offset) ?? []), name]);
      } else {
        // CPU aliases must keep their original numeric value when the export bank uses another origin.
        const isRam =
          record.addressSpace === "nes.cpu" &&
          (address < 0x2000 || (address >= 0x6000 && address < 0x8000));
        const description = record.comment ?? record.inlineComment ?? record.id;
        if (isRam) {
          ramDefinitions.push(...nesSourceDefinition(name, address, description));
        } else {
          definitions.push(...nesSourceDefinition(name, address, description));
        }
        for (const physical of owners) {
          const physicalName = `${name}_ROM_${nesSourceHex(physical.offset, 6).slice(1)}`;
          labelsAt.set(physical.offset, [...(labelsAt.get(physical.offset) ?? []), physicalName]);
        }
      }
    }
    const text =
      "text" in record
        ? record.text
        : [record.comment, record.inlineComment].filter(Boolean).join("\n");
    if (text) {
      for (const offset of offsets) {
        notes.set(offset, [
          ...(notes.get(offset) ?? []),
          ...text.split(/[\n\r\u2028\u2029]/).map((line) => `; ${line}`),
        ]);
      }
    }
  }
  // Sort ownership boundaries once; each emitted span advances monotonically through this list.
  const markers = [
    ...new Set([
      ...labelsAt.keys(),
      ...notes.keys(),
      ...dataRanges.flatMap((range) => [range.start, range.end]),
    ]),
  ].toSorted((left, right) => left - right);
  add(
    "defines.asm",
    nesHardwareSource(rom.mapper) +
      "\n; Original CPU aliases and research constants.\n" +
      definitions.join("\n") +
      "\n",
  );
  add(
    "ram-defines.asm",
    "; RAM identities from the project's authoritative research declarations.\n; Addresses use the original CPU domain; scratch roles remain local to their routines.\n\n" +
      ramDefinitions.join("\n") +
      "\n",
  );
  const bytes = rom.bytes();
  const payload = bytes.subarray(16);
  for (let offset = 0; offset < payload.length; offset += 4096) {
    add(
      `assets/raw/${offset.toString(16).padStart(6, "0")}.bin`,
      payload.slice(offset, offset + 4096),
    );
  }
  const memory = segments
    .map(
      (segment) =>
        `${segment.name}: start = $${segment.origin.toString(16).toUpperCase()}, size = $${segment.size.toString(16).toUpperCase()}, file = %O;`,
    )
    .join("\n");
  const layout = segments
    .map((segment) => `${segment.name}: load = ${segment.name}, type = ro;`)
    .join("\n");
  const targetOptions = {
    sourceStyle: "asar",
    header: [...rom.header()],
    linkerConfig: `MEMORY {\n${memory}\n}\nSEGMENTS {\n${layout}\n}\n`,
  };
  add(
    "uttori-asm.config.json",
    canonicalJson({
      plugins: [{ module: "@uttori/asm-plugin-65xx", options: targetOptions }],
      target: "65xx.nes",
      architecture: "65xx.2a03",
      entryPoints: ["main.asm"],
      includePaths: ["./"],
    }),
  );
  add(
    "source-raw.json",
    canonicalJson({ format: "uttori-source-raw", version: 1, romSha256, blockSize: 4096 }),
  );
  const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
  let codeBytes = 0;
  const ranges: { start: number; end: number }[] = [];
  const main: string[] = [
    "; Physical cartridge segments. Mapper state determines where PRG banks execute.",
    // Asar incsrc files share symbols; no export declarations are needed between banks.
    'incsrc "defines.asm"',
    'incsrc "ram-defines.asm"',
  ];
  for (const segment of segments) {
    const start = segment.offset - 16;
    const end = start + segment.size;
    const available = nodes.filter(
      (node) =>
        node.fileOffset !== undefined &&
        node.fileOffset >= start &&
        node.fileOffset + node.size <= end,
    );
    const observed = available.filter((node) => node.id.startsWith("nes:runtime:"));
    // Only ROM-validated capture nodes establish an observed boundary. Propagated static evidence
    // is not proof of execution and must yield when it starts inside a captured operand.
    const candidates = available.filter(
      (node) =>
        node.id.startsWith("nes:runtime:") ||
        !observed.some(
          (other) =>
            other.fileOffset! < node.fileOffset! + node.size &&
            other.fileOffset! + other.size > node.fileOffset! &&
            (other.fileOffset !== node.fileOffset || other.size !== node.size),
        ),
    );
    const byOffset = new Map<number, AnalysisControlFlowNodeRecord>();
    for (const node of candidates) {
      const offset = node.fileOffset!;
      const conflicting = candidates.some(
        (other) =>
          other.fileOffset! < offset + node.size &&
          other.fileOffset! + other.size > offset &&
          (other.fileOffset !== offset || other.size !== node.size),
      );
      if (!conflicting) {
        byOffset.set(offset, node);
      }
    }
    const lines = [
      `; Physical ${segment.name} bank; org excludes the iNES header, base selects its logical origin.`,
      `org ${nesSourceHex(start, 6)}`,
      `base ${nesSourceHex(segment.origin)}`,
      "",
      `${segment.name}_start:`,
    ];
    let offset = start;
    let markerIndex = 0;
    while (offset < end) {
      for (const name of labelsAt.get(offset) ?? []) {
        lines.push("", `${name}:`);
      }
      // Behavior comments belong to the following label body, with the same indent as its instructions.
      lines.push(...(notes.get(offset) ?? []).map((line) => `  ${line}`));
      const data = dataRanges.find((range) => range.start <= offset && offset < range.end);
      // These native codecs do not implement recompression; ignoring it would emit a different representation.
      if (data?.annotation.asset?.compression) {
        throw new Error(`Compressed NES source asset '${data.annotation.id}' is unsupported.`);
      }
      while (markerIndex < markers.length && markers[markerIndex] <= offset) {
        markerIndex++;
      }
      const nextMarker = Math.min(end, markers[markerIndex] ?? end);
      if (segment.name.startsWith("CHR_")) {
        const next = Math.min(data?.end ?? end, nextMarker);
        if (offset % 16 || (next - offset) % 16) {
          throw new Error("CHR source boundaries must align to complete 16-byte tiles.");
        }
        if (
          data?.annotation.asset &&
          (data.annotation.asset.codecId !== NES_CHR_CODEC ||
            data.annotation.asset.codecVersion !== "1.0.0" ||
            Object.keys(data.annotation.asset.options ?? {}).length > 0)
        ) {
          throw new Error("Unsupported NES CHR asset codec.");
        }
        const graphicsName =
          (labelsAt.get(offset) ?? [])[0] ??
          `Gfx_${segment.name}_${nesSourceHex(offset - start).slice(1)}`;
        const file = `assets/graphics/${graphicsName}.png`;
        const tiles = (next - offset) / 16;
        let columns = Math.min(16, tiles);
        while (tiles % columns) {
          columns--;
        }
        add(file, nesChrPng(payload.subarray(offset, next), columns));
        lines.push(`  includeAsset("../${file}", "${NES_CHR_CODEC}")`);
        offset = next;
        continue;
      }
      if (
        data?.annotation.classification === "text" &&
        data.annotation.asset?.codecId === NES_TEXT_CODEC
      ) {
        const asset = data.annotation.asset;
        if (
          asset.codecVersion !== "1.0.0" ||
          !asset.options ||
          typeof asset.options !== "object" ||
          Array.isArray(asset.options)
        ) {
          throw new Error("NES text requires a supported, explicit glyph mapping.");
        }
        const options = asset.options;
        const next = Math.min(data.end, nextMarker);
        const text = decodeNesText(payload.subarray(offset, next), options);
        // Byte order canonicalizes equivalent maps whose object properties were declared in different orders.
        const table =
          [...nesTextMap(options)]
            .toSorted((left, right) => left[1] - right[1])
            .map(([character, value]) => `${character}=${nesSourceHex(value, 2).slice(1)}`)
            .join("\n") + "\n";
        let file = textTables.get(table);
        if (file === undefined) {
          // Allocate shared names in physical first-use order, so research renames do not rename table files.
          file = `assets/text/alphabet_${nesSourceHex(textTables.size, 2).slice(1)}.tbl`;
          textTables.set(table, file);
          add(file, table);
        }
        // Scope the character map to this string so opcode operands and following raw data retain their values.
        lines.push(
          "  pushtable",
          `  table "../${file}"`,
          `  db ${JSON.stringify(text)}`,
          "  pulltable",
        );
        offset = next;
        continue;
      }
      if (data && ["data8", "data16", "pointer16"].includes(data.annotation.classification)) {
        const width = data.annotation.classification === "data8" ? 1 : 2;
        const next = Math.min(data.end, nextMarker, offset + width * 8);
        if ((next - offset) % width) {
          throw new Error(`Unaligned typed NES data '${data.annotation.id}'.`);
        }
        const values: string[] = [];
        for (let at = offset; at < next; at += width) {
          let value = payload[at];
          if (width === 2) {
            value |= payload[at + 1] << 8;
          }
          let expression = nesSourceHex(value, width * 2);
          if (data.annotation.classification === "pointer16") {
            const targets = (research.labels ?? []).filter(
              (label) =>
                !label.suppressed &&
                matchesNesResearch(rom, label, value, nesResearchMapper(data.annotation.mapping)),
            );
            if (targets.length === 1) {
              expression = names.get(targets[0].id) ?? expression;
            }
          }
          values.push(expression);
        }
        const directive = width === 1 ? "db" : "dw";
        lines.push(`  ${directive} ${values.join(", ")}`);
        offset = next;
        continue;
      }
      const node = byOffset.get(offset);
      if (node && !data && offset + node.size <= nextMarker && segment.name.startsWith("PRG_")) {
        const decoded = decoder.decode({
          source: new Uint8ArrayDecoderSource(payload.subarray(offset, offset + node.size)),
          offset: 0,
          logicalAddress: segment.origin + offset - start,
        });
        if (decoded.kind === "instruction" && decoded.instruction.size === node.size) {
          let operand = nesHardwareOperand(decoded.instruction, rom.mapper);
          // Substitute the encoded base/pointer, never a runtime effective address that includes X/Y.
          // Immediate constants and relative displacements are not memory labels.
          if (!operand && decoded.instruction.operands[0]?.kind === "address") {
            const address = decoded.instruction.operands[0]?.value;
            const owners = candidates.filter((candidate) => candidate.fileOffset === offset);
            const resolved = owners.map((owner) => {
              const labels = (research.labels ?? []).filter(
                (label) =>
                  !label.suppressed &&
                  address !== undefined &&
                  matchesNesResearch(rom, label, address, nesStoredMapper(owner.incomingState)),
              );
              return labels.length === 1 ? names.get(labels[0].id) : undefined;
            });
            // A physical instruction can run under several mappings. Name its operand only when all agree.
            if (
              resolved.length &&
              resolved.every((name) => name !== undefined && name === resolved[0])
            ) {
              operand = resolved[0];
            }
          }
          // The build debug map carries physical/CPU coordinates; source comments retain research prose.
          const formatted = formatCpu6502Instruction(decoded.instruction, operand);
          // Noncanonical opcode encodings keep their explicit bytes using Asar's db spelling.
          const source = formatted.startsWith(".byte ") ? `db ${formatted.slice(6)}` : formatted;
          lines.push(`  ${source}`);
          ranges.push({ start: offset, end: offset + node.size });
          offset += node.size;
          codeBytes += node.size;
          continue;
        }
      }
      const block = Math.floor(offset / 4096) * 4096;
      let next = offset + 1;
      while (next < Math.min(end, block + 4096, nextMarker) && !byOffset.has(next)) {
        next++;
      }
      // Opaque bytes stand apart from the preceding decoded label body or scoped text table.
      lines.push(
        "",
        `incbin "../assets/raw/${block.toString(16).padStart(6, "0")}.bin":${nesSourceHex(offset - block)}..${nesSourceHex(next - block)}`,
      );
      offset = next;
    }
    lines.push(
      "",
      `${segment.name}_end:`,
      `  assert ((${segment.name}_end - ${segment.name}_start) & $FFFF) == ${nesSourceHex(segment.size)}, "${segment.name} size changed"`,
      "",
    );
    const file = `banks/${segment.name.toLowerCase()}.asm`;
    add(file, lines.join("\n"));
    main.push(`incsrc "${file}"`);
  }
  add(
    "source-code.json",
    canonicalJson({ format: "uttori-source-code", version: 1, romSha256, ranges }),
  );
  add("main.asm", main.join("\n") + "\n");
  return { files, segments, codeBytes, ranges };
}
