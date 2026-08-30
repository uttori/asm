import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EXTERNAL_FIXTURES,
  LOCAL_ROM_DIR,
  LOCAL_WORKTREE_DIR,
} from "../fixtures/fixture-manifest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRomName = EXTERNAL_FIXTURES.smrpg.localRom?.filename ?? "";
const defaultRomPath = path.resolve(root, LOCAL_ROM_DIR, defaultRomName);

type PointerSection = {
  label: string;
  dest: string;
  batPointerSet: number;
};

/** Mirrors ExtractAssets.bat PointerSet 6 / 12 / 18 / 24 destinations. */
const POINTER_SECTIONS: PointerSection[] = [
  { label: "UncompressedGFXPointers", dest: "Graphics", batPointerSet: 6 },
  { label: "CompressedFilesPointers", dest: "UnsortedData", batPointerSet: 12 },
  { label: "SPCDataPointers", dest: "SPC700", batPointerSet: 18 },
  { label: "BRRPointers", dest: path.join("SPC700", "Samples"), batPointerSet: 24 },
];

type DumpJob = {
  bat: string;
  source: string;
  output: string;
};

/** Generate*.bat print-dumps. Animation's .asm is missing upstream. */
const DUMP_JOBS: DumpJob[] = [
  {
    bat: "GenerateBattleScript.bat",
    source: "SMRPGBattleScriptDis.asm",
    output: "BattleScripts.asm",
  },
  { bat: "GenerateEventScript.bat", source: "SMRPGEventScriptDis.asm", output: "EventScripts.asm" },
  {
    bat: "GenerateAnimationScript.bat",
    source: "SMRPGAnimationScriptDis.asm",
    output: "AnimationScripts.asm",
  },
];

type AssetEntry = {
  start: number;
  end: number;
  filename: string;
};

export type SmrpgExtractOptions = {
  rom: string;
  destRoot: string;
};

type Options = SmrpgExtractOptions & {
  dumpScripts: boolean;
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
    destRoot: path.resolve(root, LOCAL_WORKTREE_DIR, "smrpg"),
    dumpScripts: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--dump-scripts") {
      options.dumpScripts = true;
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
    if (arg === "--dest") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--dest requires a path");
      }
      options.destRoot = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--dest=")) {
      options.destRoot = path.resolve(arg.slice("--dest=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

/**
 * HiROM snestopc used by ExtractAssets.bat (`hirom` + headerless ROM).
 * @param {number} address 24-bit SNES address.
 * @param {number} headerSize Copier header bytes (0 or 512).
 * @returns {number} File offset.
 */
function hiromFileOffset(address: number, headerSize: number): number {
  return headerSize + (address & 0x3fffff);
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
  const linePattern =
    /^\s*dl\s+\$([0-9A-Fa-f]+)\s*,\s*\$([0-9A-Fa-f]+)\s*,\s*([A-Za-z0-9_]+)\s*,/gm;
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
  const start = hiromFileOffset(entry.start, headerSize);
  const end = hiromFileOffset(entry.end, headerSize);
  if (end < start) {
    throw new Error(
      `${entry.filename}: end ${entry.end.toString(16)} < start ${entry.start.toString(16)}`,
    );
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
 * ExtractAssets.bat (USA / ROMBit $0001).
 * @param {SmrpgExtractOptions} options ROM path and destination disassembly root.
 * @returns {void}
 */
export function extractSmrpgAssets(options: SmrpgExtractOptions): void {
  const gameDir = path.resolve(options.destRoot, "SMRPG");
  const pointerFile = path.resolve(gameDir, "AsarScripts/AssetPointersAndFiles.asm");
  if (!fs.existsSync(options.rom)) {
    throw new Error(
      `ROM not found: ${options.rom}\nPlace "${defaultRomName}" in ${path.join(root, LOCAL_ROM_DIR)} or pass --rom`,
    );
  }
  if (!fs.existsSync(pointerFile)) {
    throw new Error(`Missing pointer table: ${pointerFile}`);
  }

  const rom = new Uint8Array(fs.readFileSync(options.rom));
  const headerSize = detectHeaderSize(rom.length);
  const source = fs.readFileSync(pointerFile, "utf8");
  const filenames = parseFilenameTable(source);

  console.log(
    `ExtractAssets (USA): ${path.basename(options.rom)} (${rom.length} bytes, header ${headerSize})`,
  );

  let files = 0;
  let bytes = 0;
  for (const section of POINTER_SECTIONS) {
    const entries = parsePointerSection(source, section.label, filenames);
    if (entries.length === 0) {
      console.log(
        `  ${section.label}: skipped (empty / commented, PointerSet ${section.batPointerSet})`,
      );
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
}

/**
 * True when `bin` looks like Alcaro asar, not electron-asar.
 * @param {string} bin Executable path or name.
 * @returns {boolean} Whether --fix-checksum is accepted.
 */
function isAlcaroAsar(bin: string): boolean {
  try {
    const help = execFileSync(bin, ["--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return help.includes("--fix-checksum");
  } catch {
    return false;
  }
}

/**
 * Resolves Alcaro asar for Generate*.bat dumps.
 * @returns {string | undefined} Executable path.
 */
function findAlcaroAsar(): string | undefined {
  const envBin = process.env.ASAR;
  if (envBin && isAlcaroAsar(envBin)) {
    return envBin;
  }
  if (isAlcaroAsar("asar")) {
    return "asar";
  }
  return undefined;
}

/**
 * GenerateBattle/Event/AnimationScript.bat via Alcaro asar `print` dumps.
 * @param {string} romPath SMRPG (USA) ROM.
 * @param {string} destRoot Copied disassembly root.
 * @returns {void}
 */
function dumpScripts(romPath: string, destRoot: string): void {
  const asarScriptsDir = path.resolve(destRoot, "SMRPG/AsarScripts");
  const asar = findAlcaroAsar();
  if (!asar) {
    console.log(
      "Skipping Generate*.bat dumps: Alcaro asar not on PATH (electron-asar does not count). Set ASAR=/path/to/asar to enable.",
    );
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smrpg-asar-"));
  const tempRom = path.join(tempDir, "SMRPG.sfc");
  try {
    fs.copyFileSync(romPath, tempRom);
    for (const job of DUMP_JOBS) {
      const sourcePath = path.join(asarScriptsDir, job.source);
      const outputPath = path.join(asarScriptsDir, job.output);
      if (!fs.existsSync(sourcePath)) {
        console.log(`  ${job.bat}: skipped (missing ${job.source})`);
        continue;
      }
      console.log(`  ${job.bat}: ${job.source} → ${job.output}`);
      const printed = execFileSync(asar, [sourcePath, tempRom], {
        cwd: asarScriptsDir,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      fs.writeFileSync(outputPath, printed);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Prints usage.
 * @returns {void}
 */
function printHelp(): void {
  console.log(`Extract SMRPG (USA) assets for the integration fixture.

Covers AsarScripts bats:
  ExtractAssets.bat              uncompressed GFX, compressed data, SPC blobs
  GenerateBattleScript.bat       BattleScripts.asm   (needs Alcaro asar)
  GenerateEventScript.bat        EventScripts.asm    (needs Alcaro asar)
  GenerateAnimationScript.bat    AnimationScripts.asm (upstream .asm missing)

Usage:
  npm run fixture:smrpg:extract -- [--rom PATH] [--dest DIR] [--dump-scripts]

Default ROM:
  ${path.join(LOCAL_ROM_DIR, defaultRomName)}
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
  extractSmrpgAssets(options);
  if (options.dumpScripts) {
    console.log("Generate*.bat dumps:");
    dumpScripts(options.rom, options.destRoot);
  }
}

const launchedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (launchedDirectly) {
  main();
}
