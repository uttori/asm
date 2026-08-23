import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "./ava-helper.js";

import { Assembler } from "./test-assembler.js";

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
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "fixtures/asar/tests");
const EXPECTED_DIR = path.resolve(PROJECT_ROOT, "fixtures/asar/expected");
const ASSEMBLY_STAGES = ["collectDefinitions", "resolveLayout", "emitProgram"] as const;
const SOURCE_ROM_PATH = path.resolve(PROJECT_ROOT, "fixtures/asar/dummy_rom.sfc");

/** Unique per-test temp dir for target ROM; set by test.before, cleaned by test.after.always */
let tempDir: string;
let TARGET_ROM_PATH: string;

test.before(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-js-integration-"));
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

const SLIDESHOW_SRC_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/snes-slideshow/SLIDE.SRC");
const SLIDESHOW_EXPECTED_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/snes-slideshow/SLIDES-GOOD-NEW.sfc");
const SLIDESHOW_TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/snes-slideshow/test.sfc");

const CHOU_SRC_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/chou/Chou.asm");
const CHOU_EXPECTED_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/chou/chou.sfc");
const CHOU_TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "fixtures/integration/chou/test.sfc");

const YOSHI_DIR = path.resolve(PROJECT_ROOT, "fixtures/integration/yoshisisland-disassembly");
const YOSHI_SRC_PATH = path.resolve(YOSHI_DIR, "disassembly/assemble.asm");
const YOSHI_EXPECTED_SHA256 = "9b4957466798bbdb5b43a450bbb60b2591ae81d95b891430f62d53ca62e8bc7b";

const SMRPG_DIR = path.resolve(PROJECT_ROOT, "fixtures/integration/Super-Mario-RPG-Disassembly");
const SMRPG_GLOBAL_DIR = path.resolve(SMRPG_DIR, "Global");
const SMRPG_GAME_DIR = path.resolve(SMRPG_DIR, "SMRPG");
const SMRPG_SRC_PATH = path.resolve(SMRPG_GLOBAL_DIR, "AssembleFile.asm");
const SMRPG_ENGINE_BIN_PATH = path.resolve(SMRPG_GAME_DIR, "SPC700/Engine.bin");
const SMRPG_EXPECTED_SHA256 = "740646f3535bfb365ca44e70d46ab433467b142bd84010393070bd0b141af853";

const TMNT_DIR = path.resolve(PROJECT_ROOT, "fixtures/integration/TMNT-IV---Turtles-In-Time-SNES-Disassembly");
const TMNT_GLOBAL_DIR = path.resolve(TMNT_DIR, "Global");
const TMNT_GAME_DIR = path.resolve(TMNT_DIR, "Teenage_Mutant_Ninja_Turtles_IV");
const TMNT_SRC_PATH = path.resolve(TMNT_GLOBAL_DIR, "AssembleFile.asm");
const TMNT_SPC_BIN_PATH = path.resolve(TMNT_GAME_DIR, "SPC700/SPC700DataBlocks_TMNTIV.bin");
const TMNT_EXPECTED_SHA256 = "5b82cdd6f2da56f43680d6a5021faebe2e06036d30602c1a7917aa414cf8b5f4";

const EMPTY_SHA256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

const hashBuffer = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

interface TreeLegacyComparison {
  fixture: string;
  legacyHash?: string;
  treeHash?: string;
  legacyError?: string;
  treeError?: string;
  overallPassed: boolean;
}

// Some fixtures are intentionally "error fixtures". For these cases, parity
// means both drivers fail the same way, not that both produce ROM bytes.
const TREE_LEGACY_ERROR_EQUIVALENCE_FIXTURES = new Set([
  "0x",
  "advanced-prints",
  "assert-fail",
  "assert-pass",
  "badrep",
  "badsublabel",
  "global_label_error_macrolabel",
  "half_bank_check",
  "incbin_error",
  "incsrcloop",
  "include-dir",
  "labels_static_fail",
  "readoob",
]);

const equivalentFixtureErrors = (fixtureName: string, legacyError?: string, treeError?: string): boolean => {
  if (!legacyError || !treeError || !TREE_LEGACY_ERROR_EQUIVALENCE_FIXTURES.has(fixtureName)) {
    return false;
  }

  return legacyError === treeError;
};

const STAGED_TREE_ERROR_EQUIVALENCE_FIXTURES = TREE_LEGACY_ERROR_EQUIVALENCE_FIXTURES;

const equivalentStagedTreeErrors = (fixtureName: string, stagedError?: string, treeError?: string): boolean => {
  if (!stagedError || !treeError || !STAGED_TREE_ERROR_EQUIVALENCE_FIXTURES.has(fixtureName)) {
    return false;
  }

  return stagedError === treeError;
};

interface StagedTreeComparison {
  fixture: string;
  stagedHash?: string;
  treeHash?: string;
  stagedError?: string;
  treeError?: string;
  overallPassed: boolean;
}

const compareStagedVsTree = (fixtureName: string): StagedTreeComparison => {
  let stagedHash: string | undefined;
  let treeHash: string | undefined;
  let stagedError: string | undefined;
  let treeError: string | undefined;

  try {
    stagedHash = hashBuffer(assembleFixtureStaged(fixtureName));
  } catch (error) {
    stagedError = error instanceof Error ? error.message : String(error);
  }

  try {
    treeHash = hashBuffer(assembleFixtureTree(fixtureName));
  } catch (error) {
    treeError = error instanceof Error ? error.message : String(error);
  }

  const outputsMatch = Boolean(stagedHash && treeHash && stagedHash === treeHash);
  const equivalentErrors = equivalentStagedTreeErrors(fixtureName, stagedError, treeError);

  return {
    fixture: fixtureName,
    stagedHash,
    treeHash,
    stagedError,
    treeError,
    overallPassed: outputsMatch || equivalentErrors,
  };
};

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

const assembleFixtureStaged = (fixtureName: string): Buffer => {
  const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
  return assembleSourceStaged(source, sourcePath, targetRom);
};

const assembleSource = (source: string, sourcePath: string, targetRom?: Uint8Array, useTreeExecution = false): Buffer => {
  const assembler = new Assembler(targetRom, { collectSourceMetadata: false });
  const inputDir = path.dirname(sourcePath);
  assembler.setIncludePaths(["./", inputDir]);
  assembler.setCurrentFile(sourcePath);

  for (const stage of ASSEMBLY_STAGES) {
    assembler.activateStage(stage);
    if (useTreeExecution) {
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

/** Mirrors Assemble_SMRPG.bat for ROMID=SMRPG_U: FileType 0 → 4 (Engine.bin) → 1 → 2. */
const assembleSmrpgU = (useLegacy: boolean): Buffer => {
  const source = fs.readFileSync(SMRPG_SRC_PATH, "utf8");
  const includePaths = ["./", SMRPG_GLOBAL_DIR, SMRPG_GAME_DIR];
  const runPass = (
    fileType: number,
    extraDefines: Record<string, string> | undefined,
    baseRom: Uint8Array | undefined,
  ): Buffer => {
    const assembler = new Assembler(baseRom, { collectSourceMetadata: false });
    // FileType 2 FinalizeROM writes almost nothing. Constructor keeps baseImage
    // for reads only (spcblock tests pass a zero-filled buffer as targetRom).
    if (baseRom && baseRom.length > 0) {
      assembler.romdata = Array.from(baseRom);
    }
    assembler.setChecksumMode("asar");
    assembler.setIncludePaths(includePaths);
    assembler.setCurrentFile(SMRPG_SRC_PATH);
    assembler.defines.set("GameID", "SMRPG");
    assembler.defines.set("ROMID", "SMRPG_U");
    assembler.defines.set("FileType", String(fileType));
    if (extraDefines) {
      for (const [name, value] of Object.entries(extraDefines)) {
        assembler.defines.set(name, value);
      }
    }
    if (useLegacy) {
      for (const stage of ASSEMBLY_STAGES) {
        assembler.activateStage(stage);
        const lines = source.split("\n");
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
          assembler.setCurrentLine(lineNumber);
          assembler.assembleblock(lines[lineNumber].trim());
        }
        assembler.finishPass();
      }
    } else {
      const program = assembler.buildProgramModel(source, SMRPG_SRC_PATH, 0);
      assembler.assembleProgram(program);
    }
    return Buffer.from(assembler.getBinaryOutput());
  };

  const initialized = runPass(0, undefined, undefined);
  const engine = runPass(4, { PathToFile: "SPC700/Engine.asm" }, undefined);
  fs.writeFileSync(SMRPG_ENGINE_BIN_PATH, engine);
  try {
    const assembled = runPass(1, undefined, initialized);
    return runPass(2, undefined, assembled);
  } finally {
    fs.rmSync(SMRPG_ENGINE_BIN_PATH, { force: true });
  }
};

/** Mirrors Assemble_TMNTIV.bat for ROMID=TMNTIV_U (TMNTIV_USA): FileType 0 → 4 → 1 → 2. */
const assembleTmntivUsa = (useLegacy: boolean): Buffer => {
  const source = fs.readFileSync(TMNT_SRC_PATH, "utf8");
  const includePaths = ["./", TMNT_GLOBAL_DIR, TMNT_GAME_DIR];
  const runPass = (
    fileType: number,
    extraDefines: Record<string, string> | undefined,
    baseRom: Uint8Array | undefined,
  ): Buffer => {
    const assembler = new Assembler(baseRom, { collectSourceMetadata: false });
    if (baseRom && baseRom.length > 0) {
      assembler.romdata = Array.from(baseRom);
    }
    assembler.setChecksumMode("asar");
    assembler.setIncludePaths(includePaths);
    assembler.setCurrentFile(TMNT_SRC_PATH);
    assembler.defines.set("GameID", "TMNTIV");
    assembler.defines.set("ROMID", "TMNTIV_U");
    assembler.defines.set("MainFolder", "Teenage_Mutant_Ninja_Turtles_IV");
    assembler.defines.set("FileType", String(fileType));
    if (extraDefines) {
      for (const [name, value] of Object.entries(extraDefines)) {
        assembler.defines.set(name, value);
      }
    }
    if (useLegacy) {
      for (const stage of ASSEMBLY_STAGES) {
        assembler.activateStage(stage);
        const lines = source.split("\n");
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
          assembler.setCurrentLine(lineNumber);
          assembler.assembleblock(lines[lineNumber].trim());
        }
        assembler.finishPass();
      }
    } else {
      const program = assembler.buildProgramModel(source, TMNT_SRC_PATH, 0);
      assembler.assembleProgram(program);
    }
    return Buffer.from(assembler.getBinaryOutput());
  };

  const initialized = runPass(0, undefined, undefined);
  const engine = runPass(4, undefined, undefined);
  fs.writeFileSync(TMNT_SPC_BIN_PATH, engine);
  try {
    const assembled = runPass(1, undefined, initialized);
    return runPass(2, undefined, assembled);
  } finally {
    fs.rmSync(TMNT_SPC_BIN_PATH, { force: true });
  }
};

const compareTreeVsLegacy = (fixtureName: string): TreeLegacyComparison => {
  let legacyHash: string | undefined;
  let treeHash: string | undefined;
  let legacyError: string | undefined;
  let treeError: string | undefined;

  try {
    legacyHash = hashBuffer(assembleFixtureLegacy(fixtureName));
  } catch (error) {
    legacyError = error instanceof Error ? error.message : String(error);
  }

  try {
    treeHash = hashBuffer(assembleFixtureTree(fixtureName));
  } catch (error) {
    treeError = error instanceof Error ? error.message : String(error);
  }

  const outputsMatch = Boolean(legacyHash && treeHash && legacyHash === treeHash);
  const equivalentErrors = equivalentFixtureErrors(fixtureName, legacyError, treeError);

  return {
    fixture: fixtureName,
    legacyHash,
    treeHash,
    legacyError,
    treeError,
    overallPassed: outputsMatch || equivalentErrors,
  };
};

const discoverTopLevelFixtures = (): string[] => fs
  .readdirSync(FIXTURES_DIR)
  .filter((fileName) => fileName.endsWith(".asm"))
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => path.basename(fileName, ".asm"));

const compareFixture = (fixtureName: string, mode: "legacy" | "tree" | "staged" = "legacy"): FixtureComparison => {
  const expectedPath = path.resolve(EXPECTED_DIR, `${fixtureName}.asm.sfc`);
  const expectedStats = getFileStats(expectedPath);
  let runError: string | undefined;
  let outputStats = {
    size: 0,
    checksum: EMPTY_SHA256
  };

  try {
    const output = mode === "tree"
      ? assembleFixtureTree(fixtureName)
      : mode === "staged"
        ? assembleFixtureStaged(fixtureName)
        : assembleFixtureLegacy(fixtureName);
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
const TREE_GOLDEN_KNOWN_FAILURES = new Set<string>([]);
const TREE_LEGACY_KNOWN_FAILURES = new Set<string>([]);
const STAGED_GOLDEN_KNOWN_FAILURES = new Set<string>([]);

test("integration parity helper treats selected equivalent errors as parity", (t) => {
  for (const fixtureName of [
    "0x",
    "advanced-prints",
    "assert-fail",
    "assert-pass",
    "badrep",
    "badsublabel",
    "global_label_error_macrolabel",
    "half_bank_check",
    "incbin_error",
    "include-dir",
    "labels_static_fail",
    "readoob",
  ]) {
    const result = compareTreeVsLegacy(fixtureName);
    t.true(
      result.overallPassed,
      `${fixtureName}: tree=${result.treeHash ?? result.treeError} legacy=${result.legacyHash ?? result.legacyError}`
    );
  }
});

test("integration fixtures include all top-level Asar tests", t => {
  t.true(ALL_TOP_LEVEL_FIXTURES.length > 0, "At least one fixture should be discovered");
});

test("integration parity gates keep loop and conditional fixtures green", (t) => {
  const loopResult = compareFixture("forloop", "legacy");
  const conditionalResult = compareFixture("elseif", "legacy");

  t.true(loopResult.overallPassed, loopResult.failedChecks.join(", "));
  t.true(conditionalResult.overallPassed, conditionalResult.failedChecks.join(", "));
});

test("integration SuperFX architecture fixture matches Asar golden", (t) => {
  const result = compareFixture("arch-superfx", "staged");
  t.true(
    result.overallPassed,
    `${result.failedChecks.join(", ")}${result.runError ? ` (${result.runError})` : ""}`,
  );
});

test("integration parity gates keep staged and tree drivers byte-identical on key fixtures", (t) => {
  const fixtures = [
    "elseif",
    "forloop",
    "includehierarchy",
    "includeonce",
    "incsrcloop",
    "functest1",
    "v160features",
    "arch-superfx",
  ];
  for (const fixtureName of fixtures) {
    const result = compareStagedVsTree(fixtureName);
    t.true(
      result.overallPassed,
      `${fixtureName}: staged=${result.stagedHash ?? result.stagedError} tree=${result.treeHash ?? result.treeError}`
    );
  }
});

test("integration parity gates keep legacy and tree drivers byte-identical on key fixtures", (t) => {
  const fixtures = [
    "elseif",
    "includehierarchy",
    "includeonce",
    "functest1",
    "v160features",
    "arch-superfx",
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
    "arch-superfx",
  ];
  for (const fixtureName of fixtures) {
    const result = compareTreeVsLegacy(fixtureName);
    t.true(
      result.overallPassed,
      `${fixtureName}: tree=${result.treeHash ?? result.treeError} legacy=${result.legacyHash ?? result.legacyError}`
    );
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
    "arch-superfx",
  ];
  for (const fixtureName of fixtures) {
    const result = compareFixture(fixtureName, "tree");
    t.true(result.overallPassed, `${fixtureName}: ${result.failedChecks.join(", ")}`);
  }
});

test.serial("integration tree-first golden gate covers all top-level fixtures", (t) => {
  for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
    const result = compareFixture(fixtureName, "tree");
    if (TREE_GOLDEN_KNOWN_FAILURES.has(fixtureName)) {
      t.false(
        result.overallPassed,
        `${fixtureName} unexpectedly passed tree-vs-golden; remove from TREE_GOLDEN_KNOWN_FAILURES`
      );
      continue;
    }
    t.true(
      result.overallPassed,
      `${fixtureName}: ${result.failedChecks.join(", ")}${result.runError ? ` (${result.runError})` : ""}`
    );
  }
});

test.serial("integration staged production path matches all top-level golden fixtures", (t) => {
  const failures: string[] = [];
  for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
    const result = compareFixture(fixtureName, "staged");
    if (STAGED_GOLDEN_KNOWN_FAILURES.has(fixtureName)) {
      if (result.overallPassed) {
        failures.push(`${fixtureName}: unexpectedly passed; remove it from STAGED_GOLDEN_KNOWN_FAILURES`);
      }
      continue;
    }
    if (!result.overallPassed) {
      failures.push(
        `${fixtureName}: ${result.failedChecks.join(", ")}${result.runError ? ` (${result.runError})` : ""}`
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

test.serial("integration staged and tree outputs remain byte-identical for all top-level fixtures", (t) => {
  for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
    const result = compareStagedVsTree(fixtureName);
    t.true(
      result.overallPassed,
      `${fixtureName}: staged=${result.stagedHash ?? result.stagedError} tree=${result.treeHash ?? result.treeError}`
    );
  }
});

test.serial("integration tree and legacy outputs remain byte-identical for all top-level fixtures", (t) => {
  for (const fixtureName of ALL_TOP_LEVEL_FIXTURES) {
    const result = compareTreeVsLegacy(fixtureName);
    if (TREE_LEGACY_KNOWN_FAILURES.has(fixtureName)) {
      t.false(
        result.overallPassed,
        `${fixtureName} unexpectedly reached tree-vs-legacy parity; remove from TREE_LEGACY_KNOWN_FAILURES`
      );
      continue;
    }
    t.true(
      result.overallPassed,
      `${fixtureName}: tree=${result.treeHash ?? result.treeError} legacy=${result.legacyHash ?? result.legacyError}`
    );
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

test("integration SLIDESHOW regression keeps CLI-style include flow byte-identical", (t) => {
  const source = fs.readFileSync(SLIDESHOW_SRC_PATH, "utf8");
  const expected = fs.readFileSync(SLIDESHOW_EXPECTED_PATH);
  const targetRom = fs.existsSync(SLIDESHOW_TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(SLIDESHOW_TARGET_ROM_PATH)) : undefined;
  const output = assembleSourceStaged(source, SLIDESHOW_SRC_PATH, targetRom, "simple");
  t.is(hashBuffer(output), hashBuffer(expected));
});

test.serial("integration CHOU regression keeps legacy include flow byte-identical", (t) => {
  t.timeout(15 * 60_000);
  const source = fs.readFileSync(CHOU_SRC_PATH, "utf8");
  const expected = fs.readFileSync(CHOU_EXPECTED_PATH);
  const targetRom = fs.existsSync(CHOU_TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(CHOU_TARGET_ROM_PATH)) : undefined;
  const assembler = new Assembler(targetRom, { collectSourceMetadata: false });
  assembler.setChecksumMode("simple");
  assembler.setIncludePaths(["./", path.dirname(CHOU_SRC_PATH)]);
  assembler.setCurrentFile(CHOU_SRC_PATH);
  for (const stage of ASSEMBLY_STAGES) {
    assembler.activateStage(stage);
    const lines = source.split("\n");
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(lines[lineNumber].trim());
    }
    assembler.finishPass();
  }
  t.is(hashBuffer(Buffer.from(assembler.getBinaryOutput())), hashBuffer(expected));
});

test.serial("integration CHOU staged production path preserves include resolution", (t) => {
  t.timeout(15 * 60_000);
  const source = fs.readFileSync(CHOU_SRC_PATH, "utf8");
  const expected = fs.readFileSync(CHOU_EXPECTED_PATH);
  const targetRom = fs.existsSync(CHOU_TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(CHOU_TARGET_ROM_PATH)) : undefined;
  const output = assembleSourceStaged(source, CHOU_SRC_PATH, targetRom, "simple");
  t.is(hashBuffer(output), hashBuffer(expected));
});

test.serial("integration YOSHI regression keeps legacy include flow byte-identical", (t) => {
  t.timeout(30 * 60_000);
  const source = fs.readFileSync(YOSHI_SRC_PATH, "utf8");
  const assembler = new Assembler(undefined, { collectSourceMetadata: false });
  assembler.setChecksumMode("asar");
  assembler.setIncludePaths(["./", path.dirname(YOSHI_SRC_PATH)]);
  assembler.setCurrentFile(YOSHI_SRC_PATH);
  for (const stage of ASSEMBLY_STAGES) {
    assembler.activateStage(stage);
    const lines = source.split("\n");
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(lines[lineNumber].trim());
    }
    assembler.finishPass();
  }
  t.is(hashBuffer(Buffer.from(assembler.getBinaryOutput())), YOSHI_EXPECTED_SHA256);
});

test.serial("integration YOSHI staged production path preserves include resolution", (t) => {
  t.timeout(30 * 60_000);
  const source = fs.readFileSync(YOSHI_SRC_PATH, "utf8");
  const output = assembleSourceStaged(source, YOSHI_SRC_PATH, undefined, "asar");
  t.is(hashBuffer(output), YOSHI_EXPECTED_SHA256);
});

test.serial("integration SMRPG_U regression keeps legacy include flow byte-identical", (t) => {
  t.timeout(30 * 60_000);
  t.is(hashBuffer(assembleSmrpgU(true)), SMRPG_EXPECTED_SHA256);
});

test.serial("integration SMRPG_U staged production path preserves include resolution", (t) => {
  t.timeout(30 * 60_000);
  t.is(hashBuffer(assembleSmrpgU(false)), SMRPG_EXPECTED_SHA256);
});

test.serial("integration TMNTIV_USA regression keeps legacy include flow byte-identical", (t) => {
  t.timeout(30 * 60_000);
  t.is(hashBuffer(assembleTmntivUsa(true)), TMNT_EXPECTED_SHA256);
});

test.serial("integration TMNTIV_USA staged production path preserves include resolution", (t) => {
  t.timeout(30 * 60_000);
  t.is(hashBuffer(assembleTmntivUsa(false)), TMNT_EXPECTED_SHA256);
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
