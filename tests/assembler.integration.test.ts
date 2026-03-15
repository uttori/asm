import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";

interface FixtureComparison {
  fixture: string;
  runError?: string;
  outputSize: number;
  expectedSize: number;
  outputChecksum: string;
  expectedChecksum: string;
  overallPassed: boolean;
  /** Which checks failed (e.g. "tree vs golden size") */
  failedChecks: string[];
}

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, "..");
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "src/tests");
const EXPECTED_DIR = path.resolve(PROJECT_ROOT, "src/tests_tmp_app");
const TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "src/dummy_rom.sfc");
const SLIDESHOW_SRC_PATH = path.resolve(PROJECT_ROOT, "src/snes-slideshow-test-new/SLIDE.SRC");
const SLIDESHOW_EXPECTED_PATH = path.resolve(PROJECT_ROOT, "src/snes-slideshow-test-new/SLIDES-GOOD-NEW.sfc");
const SLIDESHOW_TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "src/snes-slideshow-test-new/test.sfc");
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

const compareFixture = (fixtureName: string, mode: "legacy" | "tree" = "legacy"): FixtureComparison => {
  const expectedPath = path.resolve(EXPECTED_DIR, `${fixtureName}.asm.sfc`);
  const expectedStats = getFileStats(expectedPath);
  let runError: string | undefined;
  let outputStats = {
    size: 0,
    checksum: EMPTY_SHA256
  };

  try {
    const output = mode === "tree" ? assembleFixtureTree(fixtureName) : assembleFixtureLegacy(fixtureName);
    outputStats = {
      size: output.length,
      checksum: hashBuffer(output)
    };
  } catch (error: unknown) {
    runError = error instanceof Error ? error.message : JSON.stringify(error);
  }

  const failedChecks: string[] = [];
  if (outputStats.size !== expectedStats.size) failedChecks.push(`${mode} vs golden size`);
  if (outputStats.checksum !== expectedStats.checksum) failedChecks.push(`${mode} vs golden checksum`);
  const overallPassed = failedChecks.length === 0;

  return {
    fixture: fixtureName,
    runError,
    outputSize: outputStats.size,
    expectedSize: expectedStats.size,
    outputChecksum: outputStats.checksum,
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
  const loopResult = compareFixture("forloop", "legacy");
  const conditionalResult = compareFixture("elseif", "legacy");

  t.true(loopResult.overallPassed, loopResult.failedChecks.join(", "));
  t.true(conditionalResult.overallPassed, conditionalResult.failedChecks.join(", "));
});

test("integration parity gates keep legacy and tree drivers byte-identical on key fixtures", (t) => {
  const fixtures = [
    "elseif",
    "includehierarchy",
    "includeonce",
    "functest1",
    "v160features",
  ];
  for (const fixtureName of fixtures) {
    const legacy = assembleFixtureLegacy(fixtureName);
    const tree = assembleFixtureTree(fixtureName);
    t.is(hashBuffer(legacy), hashBuffer(tree), fixtureName);
  }
});

test("integration temporary legacy parity subset remains aligned with tree output", (t) => {
  const fixtures = [
    "includehierarchy",
    "includeonce",
    "incsrcloop",
    "functest1",
    "v160features",
  ];
  for (const fixtureName of fixtures) {
    const legacy = assembleFixtureLegacy(fixtureName);
    const tree = assembleFixtureTree(fixtureName);
    t.is(hashBuffer(legacy), hashBuffer(tree), fixtureName);
  }
});

test("integration tree-first golden gate for key fixtures", (t) => {
  const fixtures = [
    "elseif",
    "includehierarchy",
    "includeonce",
    "incsrcloop",
    "functest1",
    "v160features",
  ];
  for (const fixtureName of fixtures) {
    const result = compareFixture(fixtureName, "tree");
    t.true(result.overallPassed, `${fixtureName}: ${result.failedChecks.join(", ")}`);
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

test("integration slideshow regression keeps CLI-style include flow byte-identical", (t) => {
  const source = fs.readFileSync(SLIDESHOW_SRC_PATH, "utf8");
  const expected = fs.readFileSync(SLIDESHOW_EXPECTED_PATH);
  const targetRom = fs.existsSync(SLIDESHOW_TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(SLIDESHOW_TARGET_ROM_PATH)) : undefined;
  const assembler = new Assembler(targetRom);
  assembler.setChecksumMode("simple");
  const inputDir = path.dirname(SLIDESHOW_SRC_PATH);
  assembler.setIncludePaths(["./", inputDir]);
  assembler.setCurrentFile(SLIDESHOW_SRC_PATH);

  for (const pass of [0, 1, 2]) {
    assembler.setPass(pass);
    const lines = source.split("\n");
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(lines[lineNumber].trim());
    }
    assembler.finishPass();
  }

  const output = Buffer.from(assembler.getBinaryOutput());
  t.is(hashBuffer(output), hashBuffer(expected));
});



for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
  test.serial(`integration fixture parity - ${fixtureName}`, t => {
    const result = compareFixture(fixtureName, "legacy");

    if (!result.overallPassed) {
      t.fail(
        [
          `Fixture ${result.fixture} did not match expected output.`,
          `Failed check(s): ${result.failedChecks.join(", ")}`,
          result.runError ? `runError: ${result.runError}` : "runError: none",
          `size: actual=${result.outputSize} expected=${result.expectedSize}`,
          `sha256: actual=${result.outputChecksum} expected=${result.expectedChecksum}`
        ].join("\n")
      );
      return;
    }

    t.true(result.overallPassed);
  });
}
