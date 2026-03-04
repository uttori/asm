import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ava, { type TestFn } from "ava";

import { Assembler } from "../src/assembler.js";
const test = ava as unknown as TestFn;

interface FixtureComparison {
  fixture: string;
  runError?: string;
  outputSize: number;
  expectedSize: number;
  outputChecksum: string;
  expectedChecksum: string;
  fileSizeMismatch: boolean;
  checksumMismatch: boolean;
  overallPassed: boolean;
}

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, "..");
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "src/tests");
const EXPECTED_DIR = path.resolve(PROJECT_ROOT, "src/tests_tmp_app");
const TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "src/dummy_rom.sfc");

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

const assembleFixture = (fixtureName: string): Buffer => {
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

const discoverTopLevelFixtures = (): string[] => fs
  .readdirSync(FIXTURES_DIR)
  .filter((fileName) => fileName.endsWith(".asm"))
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => path.basename(fileName, ".asm"));

const compareFixture = (fixtureName: string): FixtureComparison => {
  const expectedPath = path.resolve(EXPECTED_DIR, `${fixtureName}.asm.sfc`);
  const expectedStats = getFileStats(expectedPath);
  let runError: string | undefined;
  let outputStats = {
    size: 0,
    checksum: EMPTY_SHA256
  };

  try {
    const output = assembleFixture(fixtureName);
    outputStats = {
      size: output.length,
      checksum: hashBuffer(output)
    };
  } catch (error: unknown) {
    runError = error instanceof Error ? error.message : JSON.stringify(error);
  }

  const fileSizeMismatch = outputStats.size !== expectedStats.size;
  const checksumMismatch = outputStats.checksum !== expectedStats.checksum;
  const overallPassed = !fileSizeMismatch && !checksumMismatch;

  return {
    fixture: fixtureName,
    runError,
    outputSize: outputStats.size,
    expectedSize: expectedStats.size,
    outputChecksum: outputStats.checksum,
    expectedChecksum: expectedStats.checksum,
    fileSizeMismatch,
    checksumMismatch,
    overallPassed
  };
};

const ALL_TOP_LEVEL_FIXTURES = discoverTopLevelFixtures();

test("integration fixtures - includes all top-level .asm tests from src/test.ts", t => {
  t.true(ALL_TOP_LEVEL_FIXTURES.length > 0, "At least one fixture should be discovered");
});

for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
  test.serial(`integration fixture parity - ${fixtureName}`, t => {
    const result = compareFixture(fixtureName);

    if (!result.overallPassed) {
      t.fail(
        [
          `Fixture ${result.fixture} did not match expected output.`,
          result.runError ? `runError: ${result.runError}` : "runError: none",
          `size: expected=${result.expectedSize} actual=${result.outputSize}`,
          `sha256: expected=${result.expectedChecksum} actual=${result.outputChecksum}`
        ].join("\n")
      );
      return;
    }

    t.true(result.overallPassed);
  });
}
