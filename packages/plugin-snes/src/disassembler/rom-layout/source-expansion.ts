import path from "node:path";

import { assertSourcePath, sourceContentHash } from "@uttori/asm-disassembler";

import { inspectSnesSource, type InspectSnesSourceOptions } from "../source-build.js";
import {
  assertSnesRomExpansion,
  expansionHeaderOffset,
  type SnesRomExpansionPolicy,
} from "./expansion.js";
import type { SnesSourceFreeSpace, SnesSourceRelocation } from "./source-relocation.js";

/** Source-only capacity proposal. The caller pairs these edits with layout and checksum configuration. */
export interface SnesSourceExpansion {
  readonly size: number;
  readonly expansion: SnesRomExpansionPolicy;
  readonly freeSpace: readonly SnesSourceFreeSpace[];
  readonly edits: SnesSourceRelocation["edits"];
  readonly outputSha256: string;
}

const hex = (value: number) => `$${value.toString(16).toUpperCase()}`;

/**
 * Add reviewed storage as ordinary assembly and update an explicit one-byte size header.
 * No source file is written. Existing source must build before capacity changes are proposed.
 */
export function prepareSnesSourceExpansion(options: {
  readonly build: InspectSnesSourceOptions;
  readonly size: number;
  readonly expansion: SnesRomExpansionPolicy;
  readonly freeSpace: readonly SnesSourceFreeSpace[];
  readonly logicalAddress: (offset: number) => number;
}): SnesSourceExpansion {
  const { build, size, expansion } = options;
  if (!build.rawBlocks || build.originalContent || size <= build.expectedSize) {
    throw new Error("Expansion requires editable source with a larger declared capacity.");
  }
  assertSnesRomExpansion(build.rawBlocks.original, size, expansion);
  if (
    build.expansion &&
    (build.expansion.mapper !== expansion.mapper || build.expansion.fillByte !== expansion.fillByte)
  ) {
    throw new Error(
      "Further expansion must preserve the existing mapper and pristine fill policy.",
    );
  }
  const before = inspectSnesSource(build);
  if (before.diagnostics.length) {
    throw new Error(
      `Build and validate existing source before expansion: ${before.diagnostics[0].message}`,
    );
  }
  const header = expansionHeaderOffset(expansion);
  const sizeOffset = header + 0x17;
  const owners = before.mapping.ranges.filter(
    (range) => range.outputStart === sizeOffset && range.outputEnd === sizeOffset + 1,
  );
  if (owners.length !== 1) {
    throw new Error("Expansion needs the ROM-size header as one explicit db source statement.");
  }
  const root = path.resolve(build.root);
  const sources = new Map<string, { before: string; lines: string[]; newline: string }>();
  const read = (name: string) => {
    assertSourcePath(name);
    let source = sources.get(name);
    if (!source) {
      const bytes = before.snapshots.get(path.resolve(root, name));
      if (!bytes) {
        throw new Error(`Expansion source is not in the assembled input snapshot: ${name}`);
      }
      const text = new TextDecoder("utf8", { fatal: true, ignoreBOM: true }).decode(bytes);
      source = {
        before: text,
        lines: text.split(/\r?\n/),
        newline: text.includes("\r\n") ? "\r\n" : "\n",
      };
      sources.set(name, source);
    }
    return source;
  };
  const owner = owners[0];
  const headerPath = path
    .relative(root, before.mapping.fileList[owner.fileIdx].name)
    .split(path.sep)
    .join("/");
  const headerSource = read(headerPath);
  const line = owner.line - 1;
  const statement = headerSource.lines[line];
  const declaration = statement.split(";")[0].trim();
  if (!/^db\s+(?:\$[\da-f]+|\d+)$/i.test(declaration)) {
    throw new Error("Expansion needs the ROM-size header as a literal one-byte db statement.");
  }
  headerSource.lines[line] = statement.replace(
    /(db\s+)(?:\$[\da-f]+|\d+)/i,
    `$1$${(Math.log2(size) - 10).toString(16).toUpperCase()}`,
  );
  const entry = read(build.entrySource);
  const freeSpace = [...options.freeSpace];
  const bankSize = expansion.mapper === "lorom" ? 0x8000 : 0x10000;
  entry.lines.push("", "; Explicit cartridge expansion storage.", expansion.mapper);
  for (let start = build.expectedSize; start < size; start += bankSize) {
    const end = Math.min(start + bankSize, size) - 1;
    const suffix = start.toString(16).toUpperCase().padStart(6, "0");
    const startSymbol = `UttoriExpansion_${suffix}`;
    const endSymbol = `${startSymbol}_End`;
    const id = `expansion:${suffix}`;
    if (
      before.symbols.has(startSymbol) ||
      before.symbols.has(endSymbol) ||
      freeSpace.some((pool) => pool.id === id)
    ) {
      throw new Error(`Expansion storage identity already exists: ${id}`);
    }
    // Keep both labels inside one mapped bank. In LoROM the byte after a bank is not
    // the canonical address of the next file byte; the reserved last byte avoids an ambiguous end.
    if (options.logicalAddress(end) !== options.logicalAddress(start) + end - start) {
      throw new Error("Expansion storage has no contiguous mapper-proven bank address.");
    }
    entry.lines.push(
      `org ${hex(options.logicalAddress(start))}`,
      `${startSymbol}:`,
      `  fillbyte ${hex(expansion.fillByte)}`,
      `  fill ${hex(end - start)}`,
      `${endSymbol}:`,
      `  db ${hex(expansion.fillByte)}`,
    );
    freeSpace.push({
      id,
      start,
      end,
      file: build.entrySource,
      startSymbol,
      endSymbol,
      originalSha256: sourceContentHash(new Uint8Array(end - start).fill(expansion.fillByte)),
    });
  }
  const edits = [...sources].map(([name, source]) => ({
    path: name,
    before: source.before,
    beforeSha256: sourceContentHash(source.before),
    after: source.lines.join(source.newline),
  }));
  const overlays = new Map(build.overlays);
  for (const edit of edits) {
    overlays.set(edit.path, Buffer.from(edit.after));
  }
  const final = inspectSnesSource({
    ...build,
    expectedSize: size,
    expansion,
    overlays,
    targetOptions: { ...build.targetOptions, checksumEnabled: true },
  });
  if (final.diagnostics.length) {
    throw new Error(final.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }
  // Only the size byte and derived checksum may change inside the pre-existing capacity.
  for (let offset = 0; offset < before.output.length; offset++) {
    if (
      offset !== sizeOffset &&
      !(offset >= header + 0x1c && offset < header + 0x20) &&
      before.output[offset] !== final.output[offset]
    ) {
      throw new Error(`Expansion changed unrelated existing bytes at ${hex(offset)}.`);
    }
  }
  return { size, expansion, freeSpace, edits, outputSha256: sourceContentHash(final.output) };
}
