import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import {
  removeInlineComment,
  splitInlineCommands,
} from "../packages/core/src/services/command-text-service.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snesEnvironment = await createSnesAssemblerEnvironment();

type ChecksumMode = "asar" | "simple";
type Mapper = "lorom" | "hirom";

type Fixture = {
  id: string;
  source: string;
  golden: string;
  checksumMode: ChecksumMode;
  mapper: Mapper;
};

import { EXTERNAL_FIXTURES, LOCAL_ROM_DIR } from "../fixtures/fixture-manifest.ts";

const FIXTURES: Fixture[] = [
  {
    id: "yoshi",
    source: `${EXTERNAL_FIXTURES.yoshi.submodulePath}/${EXTERNAL_FIXTURES.yoshi.entrypoint}`,
    golden: `${LOCAL_ROM_DIR}/${EXTERNAL_FIXTURES.yoshi.optionalDiffRom?.filename ?? "yi.sfc"}`,
    checksumMode: EXTERNAL_FIXTURES.yoshi.checksumMode,
    mapper: "lorom",
  },
  {
    id: "chou",
    source: `${EXTERNAL_FIXTURES.chou.submodulePath}/${EXTERNAL_FIXTURES.chou.entrypoint}`,
    golden: `${LOCAL_ROM_DIR}/Chou Makaimura (Japan).sfc`,
    checksumMode: EXTERNAL_FIXTURES.chou.checksumMode,
    mapper: "lorom",
  },
  {
    id: "slideshow",
    source: "fixtures/integration/snes-slideshow/SLIDE.SRC",
    golden: "fixtures/integration/snes-slideshow/SLIDES-GOOD-NEW.sfc",
    checksumMode: "simple",
    mapper: "lorom",
  },
];

const fixtureById = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));

type Options = {
  source?: string;
  golden?: string;
  actual?: string;
  write?: string;
  checksumMode: ChecksumMode;
  mapper: Mapper;
  limit: number;
  window: number;
  bank?: number;
  from?: number;
  to?: number;
  shiftScan: number;
  runs: number;
  json: boolean;
  sourceMap: boolean;
  help: boolean;
};

type EmitHit = {
  pc: number;
  romOffset: number;
  file: string;
  line: number;
  commandIndex: number;
  words: string;
  size: number;
  arch: string;
};

type ByteMismatch = {
  offset: number;
  snes: number;
  actual: number;
  official: number;
};

type MismatchRun = {
  start: number;
  end: number;
  length: number;
  snesStart: number;
  snesEnd: number;
};

type ShiftGuess = {
  delta: number;
  matches: number;
  compared: number;
};

type DiffReport = {
  official: { path: string; size: number; sha256: string };
  actual: { path?: string; size: number; sha256: string };
  mismatches: number;
  first?: ByteMismatch;
  banks: { bank: number; count: number; first: ByteMismatch; hit?: EmitHit }[];
  runCount: number;
  runs: MismatchRun[];
  longestRun?: MismatchRun;
  shift?: ShiftGuess;
  shiftFromLongestRun?: ShiftGuess;
  samples: {
    mismatch: ByteMismatch;
    hit?: EmitHit;
    window: { actual: string; official: string };
  }[];
};

const USAGE = `Compare an assembled ROM against a golden .sfc.

Usage:
  npm run fixture:yoshi:diff -- [options]
  npm run fixture:diff -- --fixture chou [options]
  npm run fixture:diff -- --source <asm> --golden <sfc> [options]

Options:
  --fixture <id>             Named fixture: yoshi (default), chou, slideshow
  --source <path>            Assembly entry (implies assemble)
  --golden <path>            Official/expected ROM
  --actual <path>            Skip assemble; diff this file against golden
  --write <path>             Write assembled bytes to disk
  --checksum-mode asar|simple
  --mapper lorom|hirom       Address mapping for reports (default lorom)
  --limit <n>                First mismatches to print (default 8)
  --window <n>               Hex bytes around each sample (default 8)
  --bank <hex>               Only this SNES bank (e.g. 20 or $20)
  --from <snes-hex>          Start SNES address
  --to <snes-hex>            End SNES address (inclusive)
  --shift-scan <n>           Search |delta| <= n for a byte shift (default 8)
  --runs <n>                 Mismatch runs to print (default 12)
  --json                     Print a JSON report instead of text
  --no-source-map            Do not hook emitInstruction
  -h, --help
`;

/**
 * @param {string} value Hex string, optionally prefixed with $ or 0x.
 * @param {string} option Flag name for error messages.
 * @returns {number} Parsed unsigned integer.
 */
function parseHex(value: string | undefined, option: string): number {
  if (!value) {
    throw new Error(`${option} requires a hex value.`);
  }
  let digits = value;
  if (digits.startsWith("$")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("0x") || digits.startsWith("0X")) {
    digits = digits.slice(2);
  }
  const parsed = Number.parseInt(digits, 16);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} requires a non-negative hex value.`);
  }
  return parsed;
}

/**
 * @param {string | undefined} value Integer string.
 * @param {string} option Flag name for error messages.
 * @returns {number} Parsed non-negative integer.
 */
function parseNonNegativeInteger(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} requires a non-negative integer.`);
  }
  return parsed;
}

/**
 * @param {string[]} args Process argv after the script name.
 * @returns {Options} Parsed CLI options.
 */
function parseOptions(args: string[]): Options {
  const options: Options = {
    checksumMode: "asar",
    mapper: "lorom",
    limit: 8,
    window: 8,
    shiftScan: 8,
    runs: 12,
    json: false,
    sourceMap: true,
    help: false,
  };
  let fixtureId = "yoshi";
  let sawSource = false;
  let sawGolden = false;
  let sawChecksum = false;
  let sawMapper = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--no-source-map") {
      options.sourceMap = false;
      continue;
    }
    if (argument === "--fixture") {
      fixtureId = args[++index] ?? "";
      continue;
    }
    if (argument === "--source") {
      options.source = args[++index];
      sawSource = true;
      continue;
    }
    if (argument === "--golden") {
      options.golden = args[++index];
      sawGolden = true;
      continue;
    }
    if (argument === "--actual") {
      options.actual = args[++index];
      continue;
    }
    if (argument === "--write") {
      options.write = args[++index];
      continue;
    }
    if (argument === "--checksum-mode") {
      const value = args[++index];
      if (value !== "asar" && value !== "simple") {
        throw new Error("--checksum-mode requires 'asar' or 'simple'.");
      }
      options.checksumMode = value;
      sawChecksum = true;
      continue;
    }
    if (argument.startsWith("--checksum-mode=")) {
      const value = argument.slice("--checksum-mode=".length);
      if (value !== "asar" && value !== "simple") {
        throw new Error("--checksum-mode requires 'asar' or 'simple'.");
      }
      options.checksumMode = value;
      sawChecksum = true;
      continue;
    }
    if (argument === "--mapper") {
      const value = args[++index];
      if (value !== "lorom" && value !== "hirom") {
        throw new Error("--mapper requires 'lorom' or 'hirom'.");
      }
      options.mapper = value;
      sawMapper = true;
      continue;
    }
    if (argument === "--limit") {
      options.limit = parseNonNegativeInteger(args[++index], argument);
      continue;
    }
    if (argument === "--window") {
      options.window = parseNonNegativeInteger(args[++index], argument);
      continue;
    }
    if (argument === "--bank") {
      options.bank = parseHex(args[++index], argument);
      continue;
    }
    if (argument === "--from") {
      options.from = parseHex(args[++index], argument);
      continue;
    }
    if (argument === "--to") {
      options.to = parseHex(args[++index], argument);
      continue;
    }
    if (argument === "--shift-scan") {
      options.shiftScan = parseNonNegativeInteger(args[++index], argument);
      continue;
    }
    if (argument === "--runs") {
      options.runs = parseNonNegativeInteger(args[++index], argument);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!sawSource && !sawGolden && !options.actual) {
    const fixture = fixtureById.get(fixtureId);
    if (!fixture) {
      throw new Error(
        `Unknown fixture '${fixtureId}'. Known: ${[...fixtureById.keys()].join(", ")}`,
      );
    }
    options.source = fixture.source;
    options.golden = fixture.golden;
    if (!sawChecksum) {
      options.checksumMode = fixture.checksumMode;
    }
    if (!sawMapper) {
      options.mapper = fixture.mapper;
    }
  }

  return options;
}

/**
 * @param {string} relativeOrAbsolute Path from cwd or repo root.
 * @returns {string} Absolute path.
 */
function resolvePath(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  const fromCwd = path.resolve(process.cwd(), relativeOrAbsolute);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  return path.resolve(root, relativeOrAbsolute);
}

/**
 * @param {Mapper} mapper ROM mapping.
 * @param {number} offset File offset.
 * @returns {number} SNES CPU address.
 */
function romToSnes(mapper: Mapper, offset: number): number {
  if (mapper === "hirom") {
    return 0xc00000 + offset;
  }
  const bank = offset >> 15;
  return (bank << 16) | 0x8000 | (offset & 0x7fff);
}

/**
 * @param {Mapper} mapper ROM mapping.
 * @param {number} snes SNES CPU address.
 * @returns {number} File offset.
 */
function snesToRom(mapper: Mapper, snes: number): number {
  if (mapper === "hirom") {
    return snes & 0x3fffff;
  }
  const bank = (snes >> 16) & 0x7f;
  return (bank << 15) | (snes & 0x7fff);
}

/**
 * @param {number} value Byte or address.
 * @param {number} width Pad width.
 * @returns {string} Lowercase hex.
 */
function hexPad(value: number, width: number): string {
  return value.toString(16).padStart(width, "0");
}

/**
 * @param {Uint8Array} bytes Bytes to hash.
 * @returns {string} SHA-256 hex digest.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const processedLineCache = new Map<string, number[]>();

/**
 * Maps assembler command indices (blank/comment lines stripped) onto 1-based file lines.
 * @param {string} filePath Source path recorded during emit.
 * @returns {number[]} commandIndex → file line.
 */
function processedIndexToFileLines(filePath: string): number[] {
  const cached = processedLineCache.get(filePath);
  if (cached) {
    return cached;
  }
  const lines: number[] = [];
  if (!fs.existsSync(filePath)) {
    processedLineCache.set(filePath, lines);
    return lines;
  }
  const rawLines = fs.readFileSync(filePath, "utf8").split("\n");
  let buffer = "";
  for (let index = 0; index < rawLines.length; index += 1) {
    let line = rawLines[index].trim();
    if (!line) {
      continue;
    }
    if (line.startsWith(";`+")) {
      lines.push(index + 1);
      continue;
    }
    line = removeInlineComment(line).trim();
    if (!line) {
      continue;
    }
    if (line.endsWith("\\")) {
      buffer += line.slice(0, -1);
      continue;
    }
    if (line.endsWith(",")) {
      buffer += line;
      continue;
    }
    const command = buffer + line;
    buffer = "";
    const parts = splitInlineCommands([command]);
    for (let count = 0; count < parts.length; count += 1) {
      lines.push(index + 1);
    }
  }
  processedLineCache.set(filePath, lines);
  return lines;
}

/**
 * @param {string} filePath Source path.
 * @param {number} commandIndex 0-based preprocessed command index.
 * @returns {number} 1-based file line, or commandIndex+1 when unmapped.
 */
function fileLineForCommand(filePath: string, commandIndex: number): number {
  const mapped = processedIndexToFileLines(filePath)[commandIndex];
  if (mapped === undefined) {
    return commandIndex + 1;
  }
  return mapped;
}

/**
 * @param {Uint8Array} bytes ROM slice.
 * @param {number} center Inclusive center offset.
 * @param {number} window Bytes on each side.
 * @returns {string} Hex dump of the window.
 */
function hexWindow(bytes: Uint8Array, center: number, window: number): string {
  const start = Math.max(0, center - window);
  const end = Math.min(bytes.length, center + window + 1);
  return Buffer.from(bytes.subarray(start, end)).toString("hex");
}

/**
 * Assemble `source` with the production SNES host.
 * @param {object} input Assemble parameters.
 * @param {string} input.sourcePath Assembly entry.
 * @param {ChecksumMode} input.checksumMode Checksum mode.
 * @param {boolean} input.sourceMap Whether to record emit hits.
 * @returns {{ bytes: Buffer; hits: EmitHit[] }} Assembled image and emit map.
 */
function assembleSource(input: {
  sourcePath: string;
  checksumMode: ChecksumMode;
  sourceMap: boolean;
  mapper: Mapper;
}): { bytes: Buffer; hits: EmitHit[] } {
  const source = fs.readFileSync(input.sourcePath, "utf8");
  const assembler = new Assembler({
    environment: snesEnvironment,
    target: SNES_TARGET_ID,
    targetOptions: { checksumMode: input.checksumMode },
    collectSourceMetadata: false,
  });
  const hits: EmitHit[] = [];
  const originalEmit = assembler.emitInstruction.bind(assembler);

  if (input.sourceMap) {
    assembler.emitInstruction = function emitMapped(instruction) {
      if (!assembler.enforceResolvedLabels) {
        return originalEmit(instruction);
      }
      const start = assembler.currentTargetAddress;
      let words: readonly string[];
      let commandIndex = assembler.currentLine;
      let file = assembler.currentFile;
      if (Array.isArray(instruction)) {
        words = instruction;
      } else {
        words = instruction.words;
        commandIndex = instruction.sourceLine;
        file = instruction.sourceFile || file;
      }
      const result = originalEmit(instruction);
      hits.push({
        pc: start,
        romOffset: snesToRom(input.mapper, start),
        file,
        line: fileLineForCommand(file, commandIndex),
        commandIndex,
        words: words.join(" "),
        size: assembler.currentTargetAddress - start,
        arch: String(assembler.arch),
      });
      return result;
    };
  }

  try {
    assembler.setIncludePaths(["./", path.dirname(input.sourcePath)]);
    assembler.setCurrentFile(input.sourcePath);
    assembler.assembleProgram(assembler.buildProgramModel(source, input.sourcePath, 0));
    return { bytes: Buffer.from(assembler.getBinaryOutput()), hits };
  } finally {
    assembler.emitInstruction = originalEmit;
    assembler.dispose();
  }
}

/**
 * @param {EmitHit[]} hits Emit hits in PC order per bank.
 * @returns {Map<number, EmitHit[]>} Hits grouped by SNES bank.
 */
function indexHitsByBank(hits: EmitHit[]): Map<number, EmitHit[]> {
  const hitsByBank = new Map<number, EmitHit[]>();
  for (const hit of hits) {
    const bank = hit.pc >>> 16;
    let list = hitsByBank.get(bank);
    if (!list) {
      list = [];
      hitsByBank.set(bank, list);
    }
    list.push(hit);
  }
  for (const list of hitsByBank.values()) {
    list.sort((a, b) => a.pc - b.pc);
  }
  return hitsByBank;
}

/**
 * Last emit whose PC is at or before `snes`.
 * @param {Map<number, EmitHit[]>} hitsByBank Indexed hits.
 * @param {number} snes SNES address of the mismatch.
 * @returns {EmitHit | undefined} Nearest hit.
 */
function nearestHit(hitsByBank: Map<number, EmitHit[]>, snes: number): EmitHit | undefined {
  const list = hitsByBank.get(snes >>> 16);
  if (!list || list.length === 0) {
    return undefined;
  }
  let low = 0;
  let high = list.length - 1;
  let best: EmitHit | undefined;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const hit = list[mid];
    if (hit.pc <= snes) {
      best = hit;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

/**
 * @param {Uint8Array} actual Assembled bytes.
 * @param {Uint8Array} official Golden bytes.
 * @param {number} start Inclusive file offset.
 * @param {number} maxDelta Absolute delta to search.
 * @returns {ShiftGuess | undefined} Best non-zero shift, if any beats delta 0.
 */
function guessShift(
  actual: Uint8Array,
  official: Uint8Array,
  start: number,
  maxDelta: number,
): ShiftGuess | undefined {
  if (maxDelta <= 0) {
    return undefined;
  }
  const end = Math.min(actual.length, official.length);
  if (start >= end) {
    return undefined;
  }
  const score = (delta: number): ShiftGuess => {
    let matches = 0;
    let compared = 0;
    for (let offset = start; offset < end; offset += 1) {
      const other = offset + delta;
      if (other < 0 || other >= official.length) {
        continue;
      }
      compared += 1;
      if (actual[offset] === official[other]) {
        matches += 1;
      }
    }
    return { delta, matches, compared };
  };
  let best = score(0);
  for (let delta = -maxDelta; delta <= maxDelta; delta += 1) {
    if (delta === 0) {
      continue;
    }
    const guess = score(delta);
    if (guess.compared === 0) {
      continue;
    }
    if (guess.matches > best.matches) {
      best = guess;
    }
  }
  if (best.delta === 0) {
    return undefined;
  }
  return best;
}

/**
 * @param {object} input Diff inputs.
 * @returns {DiffReport} Structured mismatch report.
 */
function diffRoms(input: {
  actual: Buffer;
  official: Buffer;
  officialPath: string;
  actualPath?: string;
  mapper: Mapper;
  limit: number;
  window: number;
  bank?: number;
  from?: number;
  to?: number;
  shiftScan: number;
  runs: number;
  hits: EmitHit[];
}): DiffReport {
  const hitsByBank = indexHitsByBank(input.hits);
  const minLength = Math.min(input.actual.length, input.official.length);
  const fromOffset = input.from === undefined ? 0 : snesToRom(input.mapper, input.from);
  let toOffset = minLength;
  if (input.to !== undefined) {
    toOffset = Math.min(minLength, snesToRom(input.mapper, input.to) + 1);
  }

  const banks = new Map<number, { count: number; first: ByteMismatch }>();
  const allRuns: MismatchRun[] = [];
  const samples: DiffReport["samples"] = [];
  let mismatches = 0;
  let first: ByteMismatch | undefined;
  let runStart = -1;

  const inBankFilter = (snes: number): boolean => {
    if (input.bank === undefined) {
      return true;
    }
    return snes >>> 16 === input.bank;
  };

  const closeRun = (end: number) => {
    if (runStart < 0) {
      return;
    }
    const snesStart = romToSnes(input.mapper, runStart);
    const snesEnd = romToSnes(input.mapper, end - 1);
    allRuns.push({
      start: runStart,
      end,
      length: end - runStart,
      snesStart,
      snesEnd,
    });
    runStart = -1;
  };

  for (let offset = fromOffset; offset < toOffset; offset += 1) {
    const snes = romToSnes(input.mapper, offset);
    if (!inBankFilter(snes)) {
      closeRun(offset);
      continue;
    }
    if (input.actual[offset] === input.official[offset]) {
      closeRun(offset);
      continue;
    }
    mismatches += 1;
    const mismatch: ByteMismatch = {
      offset,
      snes,
      actual: input.actual[offset],
      official: input.official[offset],
    };
    if (!first) {
      first = mismatch;
    }
    const bank = snes >>> 16;
    const bankInfo = banks.get(bank);
    if (!bankInfo) {
      banks.set(bank, { count: 1, first: mismatch });
    } else {
      bankInfo.count += 1;
    }
    if (runStart < 0) {
      runStart = offset;
    }
    if (samples.length < input.limit) {
      samples.push({
        mismatch,
        hit: nearestHit(hitsByBank, snes),
        window: {
          actual: hexWindow(input.actual, offset, input.window),
          official: hexWindow(input.official, offset, input.window),
        },
      });
    }
  }
  closeRun(toOffset);

  let longestRun: MismatchRun | undefined;
  for (const run of allRuns) {
    if (!longestRun || run.length > longestRun.length) {
      longestRun = run;
    }
  }
  const shiftStart = first?.offset ?? fromOffset;
  const shift = guessShift(input.actual, input.official, shiftStart, input.shiftScan);
  let shiftFromLongestRun: ShiftGuess | undefined;
  if (longestRun) {
    shiftFromLongestRun = guessShift(
      input.actual,
      input.official,
      longestRun.start,
      input.shiftScan,
    );
  }

  return {
    official: {
      path: input.officialPath,
      size: input.official.length,
      sha256: sha256(input.official),
    },
    actual: {
      path: input.actualPath,
      size: input.actual.length,
      sha256: sha256(input.actual),
    },
    mismatches,
    first,
    banks: [...banks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bank, info]) => ({
        bank,
        count: info.count,
        first: info.first,
        hit: nearestHit(hitsByBank, info.first.snes),
      })),
    runCount: allRuns.length,
    runs: allRuns.slice(0, input.runs),
    longestRun,
    shift,
    shiftFromLongestRun,
    samples,
  };
}

/**
 * @param {EmitHit | undefined} hit Source hit.
 * @returns {string} Trailing attribution, or empty.
 */
function formatHit(hit: EmitHit | undefined): string {
  if (!hit) {
    return "";
  }
  return `  ${path.basename(hit.file)}:${hit.line} [${hit.arch}] ${hit.words} (pc $${hexPad(hit.pc, 6)} size ${hit.size})`;
}

/**
 * @param {DiffReport} report Report to print.
 * @param {Options} options CLI options.
 */
function printReport(report: DiffReport, options: Options): void {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`official ${report.official.size} ${report.official.sha256}`);
  console.log(`actual   ${report.actual.size} ${report.actual.sha256}`);
  if (report.actual.size !== report.official.size) {
    console.log(`size mismatch actual ${report.actual.size} official ${report.official.size}`);
  }
  if (report.mismatches === 0 && report.actual.size === report.official.size) {
    console.log("match");
    return;
  }

  for (let index = 0; index < report.samples.length; index += 1) {
    const sample = report.samples[index];
    const { mismatch } = sample;
    console.log(
      `#${index + 1} off 0x${hexPad(mismatch.offset, 0)} $${hexPad(mismatch.snes, 6)} actual ${hexPad(mismatch.actual, 2)} official ${hexPad(mismatch.official, 2)}${formatHit(sample.hit)}`,
    );
    if (options.window > 0) {
      console.log(`    actual   ${sample.window.actual}`);
      console.log(`    official ${sample.window.official}`);
    }
  }

  const first = report.first;
  if (first) {
    console.log(
      `mismatches ${report.mismatches} first 0x${hexPad(first.offset, 0)} $${hexPad(first.snes, 6)}`,
    );
  } else {
    console.log(`mismatches ${report.mismatches}`);
  }

  const printShift = (label: string, guess: ShiftGuess | undefined) => {
    if (!guess) {
      console.log(`${label}: none in ±${options.shiftScan}`);
      return;
    }
    let ratio = 0;
    if (guess.compared > 0) {
      ratio = guess.matches / guess.compared;
    }
    console.log(
      `${label} delta=${guess.delta} matches ${guess.matches}/${guess.compared} (${(ratio * 100).toFixed(1)}%)`,
    );
  };
  printShift("shift from first", report.shift);
  printShift("shift from longest run", report.shiftFromLongestRun);

  if (report.longestRun) {
    const run = report.longestRun;
    console.log(
      `longest run n=${run.length} off 0x${hexPad(run.start, 0)}-0x${hexPad(run.end, 0)} $${hexPad(run.snesStart, 6)}-$${hexPad(run.snesEnd, 6)}`,
    );
  }

  if (report.runs.length > 0) {
    console.log(`mismatch runs (first ${report.runs.length} of ${report.runCount}):`);
    for (const run of report.runs) {
      console.log(
        `  n=${run.length} off 0x${hexPad(run.start, 0)}-0x${hexPad(run.end, 0)} $${hexPad(run.snesStart, 6)}-$${hexPad(run.snesEnd, 6)}`,
      );
    }
  }

  console.log("first mismatch per bank:");
  for (const bank of report.banks) {
    console.log(
      `  $${hexPad(bank.bank, 2)} n=${bank.count} off 0x${hexPad(bank.first.offset, 0)} $${hexPad(bank.first.snes, 6)} ${hexPad(bank.first.actual, 2)} vs ${hexPad(bank.first.official, 2)}${formatHit(bank.hit)}`,
    );
  }
}

function main(): number {
  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(USAGE);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (!options.golden) {
    console.error("Missing --golden (or --fixture).");
    console.error(USAGE);
    return 2;
  }

  const goldenPath = resolvePath(options.golden);
  if (!fs.existsSync(goldenPath)) {
    console.error(`Golden ROM not found: ${goldenPath}`);
    console.error(`Pass --golden PATH or place the ROM under ${LOCAL_ROM_DIR}/.`);
    return 2;
  }
  const official = fs.readFileSync(goldenPath);

  let actual: Buffer;
  let hits: EmitHit[] = [];
  let actualPath: string | undefined = options.actual;

  if (options.actual) {
    const resolved = resolvePath(options.actual);
    if (!fs.existsSync(resolved)) {
      console.error(`Actual ROM not found: ${resolved}`);
      return 2;
    }
    actual = fs.readFileSync(resolved);
    actualPath = resolved;
  } else {
    if (!options.source) {
      console.error("Missing --source (or --actual).");
      console.error(USAGE);
      return 2;
    }
    const sourcePath = resolvePath(options.source);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source not found: ${sourcePath}`);
      console.error("Initialize the matching submodule (see npm run fixtures:status).");
      return 2;
    }
    if (!options.json) {
      console.error(`assembling ${sourcePath} (checksum ${options.checksumMode})`);
    }
    const assembled = assembleSource({
      sourcePath,
      checksumMode: options.checksumMode,
      sourceMap: options.sourceMap,
      mapper: options.mapper,
    });
    actual = assembled.bytes;
    hits = assembled.hits;
  }

  if (options.write) {
    const writePath = resolvePath(options.write);
    fs.mkdirSync(path.dirname(writePath), { recursive: true });
    fs.writeFileSync(writePath, actual);
    if (!options.json) {
      console.error(`wrote ${writePath} (${actual.length} bytes)`);
    }
  }

  const report = diffRoms({
    actual,
    official,
    officialPath: goldenPath,
    actualPath,
    mapper: options.mapper,
    limit: options.limit,
    window: options.window,
    bank: options.bank,
    from: options.from,
    to: options.to,
    shiftScan: options.shiftScan,
    runs: options.runs,
    hits,
  });
  printReport(report, options);
  if (report.mismatches === 0 && report.actual.size === report.official.size) {
    return 0;
  }
  return 1;
}

process.exitCode = main();
