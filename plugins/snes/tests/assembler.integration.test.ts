import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "../../../tests/ava-helper.js";

import { Assembler } from "../../../tests/test-assembler.js";

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
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, "../../..");
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "fixtures/asar/tests");
const EXPECTED_DIR = path.resolve(PROJECT_ROOT, "fixtures/asar/expected");
const SOURCE_ROM_PATH = path.resolve(PROJECT_ROOT, "fixtures/asar/dummy_rom.sfc");

/** Unique per-test temp dir for target ROM; set by test.before, cleaned by test.after.always */
let tempDir: string;
let TARGET_ROM_PATH: string;

test.before(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-integration-"));
  TARGET_ROM_PATH = path.join(tempDir, "dummy_rom.sfc");
  if (fs.existsSync(SOURCE_ROM_PATH)) {
    fs.copyFileSync(SOURCE_ROM_PATH, TARGET_ROM_PATH);
  }
});

test.after.always(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

const SLIDESHOW_SRC_PATH = path.resolve(
  PROJECT_ROOT,
  "fixtures/integration/snes-slideshow/SLIDE.SRC",
);
const SLIDESHOW_EXPECTED_PATH = path.resolve(
  PROJECT_ROOT,
  "fixtures/integration/snes-slideshow/SLIDES-GOOD-NEW.sfc",
);
const SLIDESHOW_TARGET_ROM_PATH = path.resolve(
  PROJECT_ROOT,
  "fixtures/integration/snes-slideshow/test.sfc",
);

const EMPTY_SHA256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

const hashBuffer = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const getFileStats = (filePath: string): { size: number; checksum: string } => {
  if (!fs.existsSync(filePath)) {
    return {
      size: 0,
      checksum: EMPTY_SHA256,
    };
  }
  const fileBuffer = fs.readFileSync(filePath);
  return {
    size: fileBuffer.length,
    checksum: hashBuffer(fileBuffer),
  };
};

const assembleFixtureStaged = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH)
    ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH))
    : undefined;
  return assembleSourceStaged(source, sourcePath, targetRom);
};

const assembleSourceStaged = (
  source: string,
  sourcePath: string,
  targetRom?: Uint8Array,
  checksumMode?: "asar" | "simple",
): Buffer => {
  const assembler = new Assembler(targetRom, { collectSourceMetadata: false });
  assembler.setIncludePaths(["./", path.dirname(sourcePath)]);
  assembler.setCurrentFile(sourcePath);
  if (checksumMode) {
    assembler.setChecksumMode(checksumMode);
  }
  const program = assembler.buildProgramModel(source, sourcePath, 0);
  assembler.assembleProgram(program);
  return Buffer.from(assembler.getBinaryOutput());
};

const discoverTopLevelFixtures = (): string[] =>
  fs
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
    checksum: EMPTY_SHA256,
  };

  try {
    const output = assembleFixtureStaged(fixtureName);
    outputStats = {
      size: output.length,
      checksum: hashBuffer(output),
    };
  } catch (error: unknown) {
    runError = error instanceof Error ? error.message : JSON.stringify(error);
  }

  const failedChecks: string[] = [];
  if (outputStats.size !== expectedStats.size) failedChecks.push("staged vs golden size");
  if (outputStats.checksum !== expectedStats.checksum)
    failedChecks.push("staged vs golden checksum");
  const overallPassed = failedChecks.length === 0;

  return {
    fixture: fixtureName,
    runError,
    outputSize: outputStats.size,
    expectedSize: expectedStats.size,
    outputChecksum: outputStats.checksum,
    expectedChecksum: expectedStats.checksum,
    overallPassed,
    failedChecks,
  };
};

const ALL_TOP_LEVEL_FIXTURES = discoverTopLevelFixtures();
const STAGED_GOLDEN_KNOWN_FAILURES = new Set<string>([]);

test("integration fixtures include all top-level Asar tests", (t) => {
  t.true(ALL_TOP_LEVEL_FIXTURES.length > 0, "At least one fixture should be discovered");
});

test("integration SuperFX architecture fixture matches Asar golden", (t) => {
  const result = compareFixture("arch-superfx");
  t.true(
    result.overallPassed,
    `${result.failedChecks.join(", ")}${result.runError ? ` (${result.runError})` : ""}`,
  );
});

test.serial("integration staged production path matches all top-level golden fixtures", (t) => {
  const failures: string[] = [];
  for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
    const result = compareFixture(fixtureName);
    if (STAGED_GOLDEN_KNOWN_FAILURES.has(fixtureName)) {
      if (result.overallPassed) {
        failures.push(
          `${fixtureName}: unexpectedly passed; remove it from STAGED_GOLDEN_KNOWN_FAILURES`,
        );
      }
      continue;
    }
    if (!result.overallPassed) {
      failures.push(
        `${fixtureName}: ${result.failedChecks.join(", ")}${result.runError ? ` (${result.runError})` : ""}`,
      );
    }
  }
  t.deepEqual(failures, []);
});

test.serial("integration staged production path handles static-label directive operands", (t) => {
  const output = assembleFixtureStaged("labels_static_pass");
  const expected = fs.readFileSync(path.resolve(EXPECTED_DIR, "labels_static_pass.asm.sfc"));
  t.deepEqual(output, expected);
});

test("integration SLIDESHOW regression keeps CLI-style include flow byte-identical", (t) => {
  const source = fs.readFileSync(SLIDESHOW_SRC_PATH, "utf8");
  const expected = fs.readFileSync(SLIDESHOW_EXPECTED_PATH);
  const targetRom = fs.existsSync(SLIDESHOW_TARGET_ROM_PATH)
    ? new Uint8Array(fs.readFileSync(SLIDESHOW_TARGET_ROM_PATH))
    : undefined;
  const output = assembleSourceStaged(source, SLIDESHOW_SRC_PATH, targetRom, "simple");
  t.is(hashBuffer(output), hashBuffer(expected));
});
