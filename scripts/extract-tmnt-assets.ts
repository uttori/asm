import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmntDir = path.resolve(root, "fixtures/integration/TMNT-IV---Turtles-In-Time-SNES-Disassembly");
const gameDir = path.resolve(tmntDir, "Teenage_Mutant_Ninja_Turtles_IV");
const asarScriptsDir = path.resolve(gameDir, "AsarScripts");
const pointerFile = path.resolve(asarScriptsDir, "AssetPointersAndFiles.asm");
const defaultRomName = "Teenage Mutant Ninja Turtles IV - Turtles in Time (USA).sfc";
const defaultRomPath = path.resolve(tmntDir, defaultRomName);

type PointerSection = {
  label: string;
  dest: string;
  batPointerSet: number;
};

/** Mirrors ExtractAssets.bat USA PointerSet destinations. */
const POINTER_SECTIONS: PointerSection[] = [
  { label: "UncompressedGFXPointers", dest: "Graphics", batPointerSet: 6 },
  { label: "CompressedGFXPointers", dest: path.join("Graphics", "Compressed"), batPointerSet: 12 },
  { label: "DynamicSpritesPointers", dest: path.join("Graphics", "DynamicSprites"), batPointerSet: 18 },
  { label: "CompressedTilemapsPointers", dest: path.join("Tilemaps", "Compressed"), batPointerSet: 24 },
  { label: "Map32Pointers", dest: path.join("Tilemaps", "Compressed", "Map32"), batPointerSet: 30 },
  { label: "LevelDataPointers", dest: path.join("LevelData", "Compressed"), batPointerSet: 36 },
  { label: "PalettePointers", dest: "Palettes", batPointerSet: 42 },
  { label: "CompressedOAMDataPointers", dest: "CompressedOAMData", batPointerSet: 48 },
  { label: "SPC700EnginePointers", dest: "SPC700", batPointerSet: 54 },
  { label: "MusicPointers", dest: path.join("SPC700", "Music"), batPointerSet: 60 },
  { label: "BRRPointers", dest: path.join("SPC700", "Samples"), batPointerSet: 66 },
];

type AssetEntry = {
  start: number;
  end: number;
  filename: string;
};

type Options = {
  rom: string;
  help: boolean;
};

/**
 * Parses CLI flags.
 * @param {string[]} argv Process arguments after the node/tsx binary.
 * @returns {Options} Parsed options.
 */
function parseArgs(argv: string[]): Options {
  const options: Options = {
    rom: defaultRomPath,
    help: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--rom") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--rom requires a path");
      }
      options.rom = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--rom=")) {
      options.rom = path.resolve(arg.slice("--rom=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

/**
 * LoROM snestopc used by ExtractAssets.bat (`lorom` + headerless ROM).
 * @param {number} address 24-bit SNES address.
 * @param {number} headerSize Copier header bytes (0 or 512).
 * @returns {number} File offset.
 */
function loromFileOffset(address: number, headerSize: number): number {
  return headerSize + (((address & 0x7f0000) >> 1) | (address & 0x7fff));
}

/**
 * Detects a 512-byte copier header.
 * @param {number} size ROM file size in bytes.
 * @returns {number} Header size.
 */
function detectHeaderSize(size: number): number {
  if (size % 1024 === 512) {
    return 512;
  }
  return 0;
}

/**
 * USA ROMBit $0001: every `if !ROMVer&(…) != $00` in this file is false, so keep else.
 * @param {string} source Pointer file text.
 * @returns {string} Source with PAL/AUS branches removed.
 */
function applyUsaRomVer(source: string): string {
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  const skipIfBody: boolean[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^if\s+!ROMVer&/.test(trimmed)) {
      skipIfBody.push(true);
      continue;
    }
    if (/^else$/i.test(trimmed) && skipIfBody.length > 0) {
      skipIfBody[skipIfBody.length - 1] = false;
      continue;
    }
    if (/^endif$/i.test(trimmed) && skipIfBody.length > 0) {
      skipIfBody.pop();
      continue;
    }
    if (skipIfBody.some((skip) => skip)) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

/**
 * Builds label → quoted `db` filename from AssetPointersAndFiles.asm.
 * @param {string} source Pointer file text.
 * @returns {Map<string, string>} Filename map.
 */
function parseFilenameTable(source: string): Map<string, string> {
  const names = new Map<string, string>();
  const pattern = /^([A-Za-z0-9_]+):\s*\r?\n\s*db\s+"([^"]+)"/gm;
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    names.set(match[1], match[2]);
    match = pattern.exec(source);
  }
  return names;
}

/**
 * Parses one `dl start,end,name,nameEnd` pointer table.
 * @param {string} source Pointer file text.
 * @param {string} label Section prefix (e.g. UncompressedGFXPointers).
 * @param {Map<string, string>} filenames Label filename map.
 * @returns {AssetEntry[]} Table entries.
 */
function parsePointerSection(
  source: string,
  label: string,
  filenames: Map<string, string>,
): AssetEntry[] {
  const block = source.match(new RegExp(`${label}Start:([\\s\\S]*?)${label}End:`, "m"));
  if (!block) {
    return [];
  }

  const entries: AssetEntry[] = [];
  const linePattern = /^\s*dl\s+\$([0-9A-Fa-f]+)\s*,\s*\$([0-9A-Fa-f]+)\s*,\s*([A-Za-z0-9_]+)\s*,/gm;
  let match: RegExpExecArray | null = linePattern.exec(block[1]);
  while (match) {
    const nameLabel = match[3];
    let filename = filenames.get(nameLabel);
    if (!filename) {
      filename = `${nameLabel}.bin`;
    }
    entries.push({
      start: Number.parseInt(match[1], 16),
      end: Number.parseInt(match[2], 16),
      filename,
    });
    match = linePattern.exec(block[1]);
  }
  return entries;
}

/**
 * Writes one ROM slice. Returns bytes written.
 * @param {Uint8Array} rom ROM image.
 * @param {number} headerSize Copier header size.
 * @param {AssetEntry} entry Pointer entry.
 * @param {string} destDir Destination directory.
 * @returns {number} Bytes written.
 */
function extractEntry(
  rom: Uint8Array,
  headerSize: number,
  entry: AssetEntry,
  destDir: string,
): number {
  const start = loromFileOffset(entry.start, headerSize);
  const end = loromFileOffset(entry.end, headerSize);
  if (end < start) {
    throw new Error(`${entry.filename}: end ${entry.end.toString(16)} < start ${entry.start.toString(16)}`);
  }
  if (end > rom.length) {
    throw new Error(`${entry.filename}: offset ${end} past ROM size ${rom.length}`);
  }
  const slice = rom.subarray(start, end);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, entry.filename), slice);
  return slice.length;
}

/**
 * ExtractAssets.bat (USA / ROMBit $0001 / TMNTIV_USA.sfc).
 * @param {string} romPath Headerless or headered TMNTIV (USA) ROM.
 * @returns {void}
 */
function extractAssets(romPath: string): void {
  if (!fs.existsSync(romPath)) {
    throw new Error(
      `ROM not found: ${romPath}\nPlace "${defaultRomName}" in ${tmntDir} or pass --rom`,
    );
  }
  if (!fs.existsSync(pointerFile)) {
    throw new Error(`Missing pointer table: ${pointerFile}`);
  }

  const rom = new Uint8Array(fs.readFileSync(romPath));
  const headerSize = detectHeaderSize(rom.length);
  const source = applyUsaRomVer(fs.readFileSync(pointerFile, "utf8"));
  const filenames = parseFilenameTable(source);

  console.log(`ExtractAssets (TMNTIV_USA): ${path.basename(romPath)} (${rom.length} bytes, header ${headerSize})`);

  let files = 0;
  let bytes = 0;
  for (const section of POINTER_SECTIONS) {
    const entries = parsePointerSection(source, section.label, filenames);
    if (entries.length === 0) {
      console.log(`  ${section.label}: skipped (empty / commented, PointerSet ${section.batPointerSet})`);
      continue;
    }
    const destDir = path.join(gameDir, section.dest);
    let sectionBytes = 0;
    for (const entry of entries) {
      sectionBytes += extractEntry(rom, headerSize, entry, destDir);
    }
    files += entries.length;
    bytes += sectionBytes;
    console.log(`  ${section.dest}: ${entries.length} files, ${sectionBytes} bytes`);
  }
  console.log(`Extracted ${files} files (${bytes} bytes)`);

  const sentinel = path.join(asarScriptsDir, "AssetsExtracted.txt");
  if (!fs.existsSync(sentinel)) {
    fs.writeFileSync(
      sentinel,
      "This file is used to tell the assembly script that the assets have been extracted. Do not delete this file.\n",
    );
  }
}

/**
 * Prints usage.
 * @returns {void}
 */
function printHelp(): void {
  console.log(`Extract TMNTIV (USA) assets for the integration fixture.

Covers AsarScripts bats:
  ExtractAssets.bat              GFX, tilemaps, palettes, OAM, SPC, BRR (USA / ROMBit $0001)

Usage:
  npm run fixture:tmnt:extract -- [--rom PATH]

Default ROM:
  ${defaultRomName}
  (ExtractAssets.bat name: TMNTIV_USA.sfc)
`);
}

/**
 * CLI entry.
 * @returns {void}
 */
function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  extractAssets(options.rom);
}

main();
