import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";

interface FixtureComparison {
  fixture: string;
  runErrorLegacy?: string;
  legacyOutputSize: number;
  expectedSize: number;
  legacyOutputChecksum: string;
  expectedChecksum: string;
  overallPassed: boolean;
  /** Which checks failed (e.g. "legacy vs golden size") */
  failedChecks: string[];
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

const assembleFixtureLegacy = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
  return assembleSource(source, sourcePath, targetRom, false);
};

const assembleFixtureTree = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
  return assembleSource(source, sourcePath, targetRom, true);
};

const assembleSource = (source: string, sourcePath: string, targetRom?: Uint8Array, useTreePassDriver = false): Buffer => {
  const assembler = new Assembler(targetRom);
  assembler.useTreePassDriver = useTreePassDriver;
  const inputDir = path.dirname(sourcePath);
  assembler.setIncludePaths(["./", inputDir]);
  assembler.setCurrentFile(sourcePath);

  for (const pass of [0, 1, 2]) {
    assembler.setPass(pass);
    if (useTreePassDriver) {
      assembler.setCurrentLine(0);
      assembler.assembleblock(source);
    } else {
      const lines = source.split("\n");
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        assembler.setCurrentLine(lineNumber);
        assembler.assembleblock(lines[lineNumber].trim());
      }
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
  let runErrorLegacy: string | undefined;
  let legacyStats = {
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

  const failedChecks: string[] = [];
  if (legacyStats.size !== expectedStats.size) failedChecks.push("legacy vs golden size");
  if (legacyStats.checksum !== expectedStats.checksum) failedChecks.push("legacy vs golden checksum");
  const overallPassed = failedChecks.length === 0;

  return {
    fixture: fixtureName,
    runErrorLegacy,
    legacyOutputSize: legacyStats.size,
    expectedSize: expectedStats.size,
    legacyOutputChecksum: legacyStats.checksum,
    expectedChecksum: expectedStats.checksum,
    overallPassed,
    failedChecks
  };
};

const ALL_TOP_LEVEL_FIXTURES = discoverTopLevelFixtures();

test("integration fixtures - includes all top-level .asm tests from src/test.ts", t => {
  t.true(ALL_TOP_LEVEL_FIXTURES.length > 0, "At least one fixture should be discovered");
});

test("integration parity gates keep loop and conditional fixtures green", (t) => {
  const loopResult = compareFixture("forloop");
  const conditionalResult = compareFixture("elseif");

  t.true(loopResult.overallPassed, loopResult.failedChecks.join(", "));
  t.true(conditionalResult.overallPassed, conditionalResult.failedChecks.join(", "));
});

test("integration parity gates keep legacy and tree drivers byte-identical on key fixtures", (t) => {
  const fixtures = ["elseif", "includehierarchy", "macrolabels"];
  for (const fixtureName of fixtures) {
    const legacy = assembleFixtureLegacy(fixtureName);
    const tree = assembleFixtureTree(fixtureName);
    t.is(hashBuffer(legacy), hashBuffer(tree), fixtureName);
  }
});

test("integration tree-pass driver executes typed loop/conditional blocks", (t) => {
  const sourcePath = path.resolve(FIXTURES_DIR, "forloop.asm");
  const source = [
    "for i = 0..2",
    "if 1",
    "db $11",
    "else",
    "db $22",
    "endif",
    "endfor",
  ].join("\n");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;

  const legacy = assembleSource(source, sourcePath, targetRom, false);
  const tree = assembleSource(source, sourcePath, targetRom, true);
  t.is(hashBuffer(legacy), hashBuffer(tree));
});



for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
  test.serial(`integration fixture parity - ${fixtureName}`, t => {
    const result = compareFixture(fixtureName);

    if (!result.overallPassed) {
      t.fail(
        [
          `Fixture ${result.fixture} did not match expected output.`,
          `Failed check(s): ${result.failedChecks.join(", ")}`,
          result.runErrorLegacy ? `legacy runError: ${result.runErrorLegacy}` : "legacy runError: none",
          `legacy size: actual=${result.legacyOutputSize} expected=${result.expectedSize}`,
          `legacy sha256: actual=${result.legacyOutputChecksum} expected=${result.expectedChecksum}`
        ].join("\n")
      );
      return;
    }

    t.true(result.overallPassed);
  });
}
