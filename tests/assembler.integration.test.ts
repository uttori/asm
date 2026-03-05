import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ava, { type TestFn } from "ava";

import { Assembler } from "../src/assembler.js";
import { compileSourceWithParser } from "../src/parser/compile-with-parser.js";
const test = ava as unknown as TestFn;

interface FixtureComparison {
  fixture: string;
  runErrorLegacy?: string;
  runErrorParser?: string;
  legacyOutputSize: number;
  parserOutputSize: number;
  expectedSize: number;
  legacyOutputChecksum: string;
  parserOutputChecksum: string;
  expectedChecksum: string;
  legacyVsParserSizeMismatch: boolean;
  legacyVsParserChecksumMismatch: boolean;
  parserVsGoldenSizeMismatch: boolean;
  parserVsGoldenChecksumMismatch: boolean;
  overallPassed: boolean;
}

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, "..");
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "src/tests");
const EXPECTED_DIR = path.resolve(PROJECT_ROOT, "src/tests_tmp_app");
const TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "src/dummy_rom.sfc");
const PARSER_PARITY_ENABLED = process.env.PARSER_PARITY === "1";

const EMPTY_SHA256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

const hashBuffer = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const getFileStats = (filePath: string): { size: number; checksum: string } => {
  if (!fs.existsSync(filePath)) {
    return {
      size: 0,
      checksum: EMPTY_SHA256
    };
  }
  const fileBuffer = fs.readFileSync(filePath);
  return {
    size: fileBuffer.length,
    checksum: hashBuffer(fileBuffer)
  };
};

const assembleFixtureLegacy = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
  const assembler = new Assembler(targetRom);
  const inputDir = path.dirname(sourcePath);
  assembler.setIncludePaths(["./", inputDir]);
  assembler.setCurrentFile(sourcePath);

  for (const pass of [0, 1, 2]) {
    assembler.setPass(pass);
    const lines = source.split("\n");
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(lines[lineNumber].trim());
    }
    assembler.finishPass();
  }

  return Buffer.from(assembler.getBinaryOutput());
};

const assembleFixtureParser = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
  const includePaths = ["./", path.dirname(sourcePath)];

  const output = compileSourceWithParser(source, {
    targetRom,
    sourcePath,
    includePaths
  });

  return Buffer.from(output);
};

const discoverTopLevelFixtures = (): string[] => fs
  .readdirSync(FIXTURES_DIR)
  .filter((fileName) => fileName.endsWith(".asm"))
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => path.basename(fileName, ".asm"));

const compareFixture = (fixtureName: string): FixtureComparison => {
  const expectedPath = path.resolve(EXPECTED_DIR, `${fixtureName}.asm.sfc`);
  const expectedStats = getFileStats(expectedPath);
  let runErrorLegacy: string | undefined;
  let runErrorParser: string | undefined;
  let legacyStats = {
    size: 0,
    checksum: EMPTY_SHA256
  };
  let parserStats = {
    size: 0,
    checksum: EMPTY_SHA256
  };

  try {
    const legacyOutput = assembleFixtureLegacy(fixtureName);
    legacyStats = {
      size: legacyOutput.length,
      checksum: hashBuffer(legacyOutput)
    };
  } catch (error: unknown) {
    runErrorLegacy = error instanceof Error ? error.message : JSON.stringify(error);
  }

  if (PARSER_PARITY_ENABLED) {
    try {
      const parserOutput = assembleFixtureParser(fixtureName);
      parserStats = {
        size: parserOutput.length,
        checksum: hashBuffer(parserOutput)
      };
    } catch (error: unknown) {
      runErrorParser = error instanceof Error ? error.message : JSON.stringify(error);
    }
  } else {
    parserStats = legacyStats;
  }

  const legacyVsParserSizeMismatch = legacyStats.size !== parserStats.size;
  const legacyVsParserChecksumMismatch = legacyStats.checksum !== parserStats.checksum;
  const parserVsGoldenSizeMismatch = parserStats.size !== expectedStats.size;
  const parserVsGoldenChecksumMismatch = parserStats.checksum !== expectedStats.checksum;
  const overallPassed = !legacyVsParserSizeMismatch
    && !legacyVsParserChecksumMismatch
    && !parserVsGoldenSizeMismatch
    && !parserVsGoldenChecksumMismatch;

  return {
    fixture: fixtureName,
    runErrorLegacy,
    runErrorParser,
    legacyOutputSize: legacyStats.size,
    parserOutputSize: parserStats.size,
    expectedSize: expectedStats.size,
    legacyOutputChecksum: legacyStats.checksum,
    parserOutputChecksum: parserStats.checksum,
    expectedChecksum: expectedStats.checksum,
    legacyVsParserSizeMismatch,
    legacyVsParserChecksumMismatch,
    parserVsGoldenSizeMismatch,
    parserVsGoldenChecksumMismatch,
    overallPassed
  };
};

const ALL_TOP_LEVEL_FIXTURES = discoverTopLevelFixtures();

test("integration fixtures - includes all top-level .asm tests from src/test.ts", t => {
  t.true(ALL_TOP_LEVEL_FIXTURES.length > 0, "At least one fixture should be discovered");
});

test("integration parser parity mode", t => {
  t.pass(`Parser parity ${PARSER_PARITY_ENABLED ? "enabled" : "disabled"} (set PARSER_PARITY=1 to enable).`);
});

for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
  test.serial(`integration fixture parity - ${fixtureName}`, t => {
    const result = compareFixture(fixtureName);

    if (!result.overallPassed) {
      t.fail(
        [
          `Fixture ${result.fixture} did not match expected output.`,
          result.runErrorLegacy ? `legacy runError: ${result.runErrorLegacy}` : "legacy runError: none",
          result.runErrorParser ? `parser runError: ${result.runErrorParser}` : "parser runError: none",
          `legacy vs parser size: legacy=${result.legacyOutputSize} parser=${result.parserOutputSize}`,
          `legacy vs parser sha256: legacy=${result.legacyOutputChecksum} parser=${result.parserOutputChecksum}`,
          `parser vs golden size: expected=${result.expectedSize} actual=${result.parserOutputSize}`,
          `parser vs golden sha256: expected=${result.expectedChecksum} actual=${result.parserOutputChecksum}`
        ].join("\n")
      );
      return;
    }

    t.true(result.overallPassed);
  });
}
