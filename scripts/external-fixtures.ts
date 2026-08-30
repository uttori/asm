import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import { create65xxAssemblerEnvironment, NES_65XX_TARGET_ID } from "@uttori/asm-plugin-65xx";
import {
  EXTERNAL_FIXTURE_IDS,
  EXTERNAL_FIXTURES,
  LOCAL_ROM_DIR,
  LOCAL_WORKTREE_DIR,
  getExternalFixture,
  isExternalFixtureId,
  type ExternalFixtureId,
  type ExternalFixtureSpec,
  SNES_ROM_FRAMEWORK,
} from "../fixtures/fixture-manifest.ts";
import { extractSmrpgAssets } from "./extract-smrpg-assets.ts";
import { extractTmntAssets } from "./extract-tmnt-assets.ts";
import { placeSnesRomFramework } from "./place-snes-rom-framework.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

const ZELDA_BANKS = [
  "Z_00.asm",
  "Z_01.asm",
  "Z_02.asm",
  "Z_03.asm",
  "Z_04.asm",
  "Z_05.asm",
  "Z_06.asm",
  "Z_07.asm",
];

const snesEnvironment = await createSnesAssemblerEnvironment();
const nesEnvironment = await create65xxAssemblerEnvironment();

export type FixtureIssue =
  | "uninitialized"
  | "wrong-commit"
  | "dirty"
  | "missing-rom"
  | "wrong-rom-hash"
  | "missing-assets"
  | "missing-entrypoint";

export type FixtureStatus = {
  id: ExternalFixtureId;
  ready: boolean;
  commit?: string;
  expectedCommit: string;
  issues: FixtureIssue[];
  details: string[];
  setupInstructions: string;
};

export type PreparedFixture = {
  spec: ExternalFixtureSpec;
  workspace: string;
  ephemeral: boolean;
  rom?: Buffer;
};

export type AssembleOptions = {
  keepWorktree?: boolean;
};

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function parseRequestedFixtures(
  raw = process.env.UTTORI_EXTERNAL_FIXTURES,
): ExternalFixtureId[] {
  if (!raw || raw.trim() === "" || raw.trim() === "all") {
    return [...EXTERNAL_FIXTURE_IDS];
  }
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const id of ids) {
    if (!isExternalFixtureId(id)) {
      throw new Error(
        `Unknown external fixture '${id}'. Available: ${EXTERNAL_FIXTURE_IDS.join(", ")}.`,
      );
    }
  }
  return ids as ExternalFixtureId[];
}

export function resolveProjectPath(...parts: string[]): string {
  return path.resolve(PROJECT_ROOT, ...parts);
}

export function localRomPath(spec: ExternalFixtureSpec): string | undefined {
  if (!spec.localRom) return undefined;
  return resolveProjectPath(LOCAL_ROM_DIR, spec.localRom.filename);
}

export function optionalDiffRomPath(spec: ExternalFixtureSpec): string | undefined {
  if (!spec.optionalDiffRom) return undefined;
  return resolveProjectPath(LOCAL_ROM_DIR, spec.optionalDiffRom.filename);
}

function submoduleDir(spec: { submodulePath: string }): string {
  return resolveProjectPath(spec.submodulePath);
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function tryGit(args: string[], cwd: string): string | undefined {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

function meaningfulPorcelain(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const relative = line.slice(3).replace(/^"|"$/g, "");
      return path.basename(relative) !== ".DS_Store";
    })
    .join("\n")
    .trim();
}

function isGitWorktree(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  if (!fs.existsSync(path.join(dir, ".git"))) return false;
  return tryGit(["rev-parse", "--is-inside-work-tree"], dir) === "true";
}

function isSubmoduleInitialized(spec: { submodulePath: string }): boolean {
  return isGitWorktree(submoduleDir(spec));
}

function copyGitTrackedTree(repoDir: string, destDir: string): void {
  const listing = execFileSync("git", ["-C", repoDir, "ls-files", "-z"]);
  const files = listing.toString("utf8").split("\0").filter(Boolean);
  if (files.length === 0) {
    throw new Error(`No tracked files in ${repoDir}; initialize the submodule first.`);
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const relative of files) {
    const from = path.join(repoDir, relative);
    const to = path.join(destDir, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

function readValidatedRom(spec: ExternalFixtureSpec): Buffer {
  if (!spec.localRom) {
    throw new Error(`${spec.id} does not require a local ROM.`);
  }
  const romPath = localRomPath(spec);
  if (!romPath || !fs.existsSync(romPath)) {
    throw new Error(
      `Missing local ROM '${spec.localRom.filename}' for ${spec.id}.\n${spec.setupInstructions}`,
    );
  }
  const rom = fs.readFileSync(romPath);
  if (rom.length !== spec.localRom.bytes) {
    throw new Error(
      `Wrong ROM size for ${spec.id}: ${rom.length} bytes, expected ${spec.localRom.bytes}.\n${spec.setupInstructions}`,
    );
  }
  const digest = sha256(rom);
  if (digest !== spec.localRom.sha256) {
    throw new Error(
      `Wrong ROM hash for ${spec.id}: ${digest}, expected ${spec.localRom.sha256}. The wrong revision cannot be used for extraction.\n${spec.setupInstructions}`,
    );
  }
  return rom;
}

function extractZeldaBins(rom: Buffer, xmlText: string, binRoot: string): void {
  const pattern =
    /<Binary\s+Offset=['"](\d+)['"]\s+Length=['"](\d+)['"]\s+FileName=['"]([^'"]+)['"]\s*\/>/g;
  for (const match of xmlText.matchAll(pattern)) {
    const offset = Number(match[1]) + 16;
    const length = Number(match[2]);
    const relative = match[3].replaceAll("\\", "/");
    const dest = path.join(binRoot, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, rom.subarray(offset, offset + length));
  }
}

function keepWorktreeRequested(options?: AssembleOptions): boolean {
  return options?.keepWorktree === true || process.env.UTTORI_FIXTURE_KEEP_WORKTREE === "1";
}

function assertReady(status: FixtureStatus): void {
  if (status.ready) return;
  throw new Error(
    `External fixture '${status.id}' is not ready (${status.issues.join(", ")}).\n${status.details.join("\n")}\n${status.setupInstructions}`,
  );
}

export function getFixtureStatus(id: ExternalFixtureId): FixtureStatus {
  const spec = getExternalFixture(id);
  const issues: FixtureIssue[] = [];
  const details: string[] = [];
  const dir = submoduleDir(spec);

  if (!isSubmoduleInitialized(spec)) {
    issues.push("uninitialized");
    details.push(`Submodule not initialized at ${spec.submodulePath}.`);
    return {
      id,
      ready: false,
      expectedCommit: spec.commit,
      issues,
      details,
      setupInstructions: spec.setupInstructions,
    };
  }

  const commit = tryGit(["rev-parse", "HEAD"], dir);
  if (!commit) {
    issues.push("uninitialized");
    details.push(`Could not read HEAD in ${spec.submodulePath}.`);
  } else if (commit !== spec.commit) {
    issues.push("wrong-commit");
    details.push(`Pinned commit is ${spec.commit}, checkout is ${commit}.`);
  }

  const porcelain = meaningfulPorcelain(tryGit(["status", "--porcelain"], dir) ?? "");
  if (porcelain.length > 0) {
    const lines = porcelain.split("\n");
    const preview = lines.slice(0, 12).join("\n");
    const extra = lines.length > 12 ? `\n... ${lines.length - 12} more` : "";
    issues.push("dirty");
    details.push(`Submodule worktree is dirty (${lines.length} paths):\n${preview}${extra}`);
  }

  const entrypoint = path.join(dir, spec.entrypoint);
  if (spec.id !== "tmnt" && spec.id !== "zelda" && !fs.existsSync(entrypoint)) {
    issues.push("missing-entrypoint");
    details.push(`Missing entrypoint ${spec.entrypoint}.`);
  }

  if (spec.localRom) {
    const romPath = localRomPath(spec);
    if (!romPath || !fs.existsSync(romPath)) {
      issues.push("missing-rom");
      details.push(`Missing ${path.join(LOCAL_ROM_DIR, spec.localRom.filename)}.`);
    } else {
      const rom = fs.readFileSync(romPath);
      if (rom.length !== spec.localRom.bytes || sha256(rom) !== spec.localRom.sha256) {
        issues.push("wrong-rom-hash");
        details.push(
          `ROM ${spec.localRom.filename} is ${rom.length} bytes / ${sha256(rom)}; expected ${spec.localRom.bytes} / ${spec.localRom.sha256}.`,
        );
      }
    }
  }

  if (spec.frameworkPath) {
    const frameworkDir = resolveProjectPath(SNES_ROM_FRAMEWORK.submodulePath);
    if (!isGitWorktree(frameworkDir)) {
      issues.push("missing-assets");
      details.push(
        `SNES ROM Framework submodule is not initialized at ${SNES_ROM_FRAMEWORK.submodulePath}.`,
      );
    } else {
      const frameworkCommit = tryGit(["rev-parse", "HEAD"], frameworkDir);
      if (frameworkCommit !== SNES_ROM_FRAMEWORK.commit) {
        issues.push("missing-assets");
        details.push(
          `SNES ROM Framework pin is ${SNES_ROM_FRAMEWORK.commit}, checkout is ${frameworkCommit ?? "unknown"}.`,
        );
      }
    }
  }

  const blocking = issues.filter((issue) => issue !== "dirty");
  return {
    id,
    ready: blocking.length === 0,
    commit,
    expectedCommit: spec.commit,
    issues,
    details,
    setupInstructions: spec.setupInstructions,
  };
}

export function getAllFixtureStatuses(): FixtureStatus[] {
  return EXTERNAL_FIXTURE_IDS.map((id) => getFixtureStatus(id));
}

export function prepareExternalFixture(
  id: ExternalFixtureId,
  options?: AssembleOptions,
): PreparedFixture {
  const spec = getExternalFixture(id);
  const status = getFixtureStatus(id);
  assertReady(status);

  const keep = keepWorktreeRequested(options);
  const needsCopy = !spec.selfContained || keep || spec.id === "tmnt" || spec.id === "zelda";
  let workspace = submoduleDir(spec);
  let ephemeral = false;
  const rom = spec.localRom ? readValidatedRom(spec) : undefined;

  if (needsCopy) {
    workspace = keep
      ? resolveProjectPath(LOCAL_WORKTREE_DIR, spec.id)
      : fs.mkdtempSync(path.join(os.tmpdir(), `uttori-${spec.id}-`));
    fs.rmSync(workspace, { recursive: true, force: true });
    copyGitTrackedTree(submoduleDir(spec), workspace);
    ephemeral = !keep;
  }

  if (spec.id === "tmnt") {
    placeSnesRomFramework({ destRoot: workspace });
  }

  if (spec.id === "chou" && spec.configPath && keep) {
    fs.copyFileSync(
      resolveProjectPath(spec.configPath),
      path.join(workspace, "uttori-asm.config.json"),
    );
  }

  if (spec.id === "smrpg") {
    if (!rom) throw new Error("SMRPG ROM is required before extraction.");
    extractSmrpgAssets({ rom: localRomPath(spec) as string, destRoot: workspace });
  }

  if (spec.id === "tmnt") {
    if (!rom) throw new Error("TMNT ROM is required before extraction.");
    extractTmntAssets({ rom: localRomPath(spec) as string, destRoot: workspace });
  }

  if (spec.id === "zelda") {
    if (!rom) throw new Error("Zelda ROM is required before extraction.");
    const xmlPath = path.join(workspace, "src/bins.xml");
    extractZeldaBins(rom, fs.readFileSync(xmlPath, "utf8"), workspace);
    const driverPath = path.join(workspace, spec.entrypoint);
    fs.writeFileSync(driverPath, `${ZELDA_BANKS.map((name) => `.include "${name}"`).join("\n")}\n`);
  }

  if (spec.extractedAssetSentinels.length > 0) {
    const missing = spec.extractedAssetSentinels.filter(
      (relative) => !fs.existsSync(path.join(workspace, relative)),
    );
    if (missing.length > 0) {
      throw new Error(`Missing extracted assets for ${spec.id}: ${missing.join(", ")}.`);
    }
  }

  return { spec, workspace, ephemeral, rom };
}

export function cleanupPreparedFixture(prepared: PreparedFixture): void {
  if (prepared.ephemeral && fs.existsSync(prepared.workspace)) {
    fs.rmSync(prepared.workspace, { recursive: true, force: true });
  }
}

function assembleSnesSource(
  source: string,
  sourcePath: string,
  includePaths: string[],
  checksumMode: "asar" | "simple",
  extra?: {
    defines?: Record<string, string>;
    baseRom?: Uint8Array;
    writeOutputBytes?: boolean;
  },
): Buffer {
  const assembler = new Assembler({
    environment: snesEnvironment,
    target: SNES_TARGET_ID,
    targetOptions: { checksumMode },
    baseImage: extra?.baseRom,
    collectSourceMetadata: false,
  });
  try {
    if (extra?.writeOutputBytes && extra.baseRom && extra.baseRom.length > 0) {
      assembler.outputBytes = Array.from(extra.baseRom);
    }
    assembler.setIncludePaths(includePaths);
    assembler.setCurrentFile(sourcePath);
    if (extra?.defines) {
      for (const [name, value] of Object.entries(extra.defines)) {
        assembler.defines.set(name, value);
      }
    }
    const program = assembler.buildProgramModel(source, sourcePath, 0);
    assembler.assembleProgram(program);
    return Buffer.from(assembler.getBinaryOutput());
  } finally {
    assembler.dispose();
  }
}

function assembleSmrpg(workspace: string): Buffer {
  const spec = EXTERNAL_FIXTURES.smrpg;
  const sourcePath = path.join(workspace, spec.entrypoint);
  const globalDir = path.join(workspace, "Global");
  const gameDir = path.join(workspace, "SMRPG");
  const enginePath = path.join(gameDir, "SPC700/Engine.bin");
  const source = fs.readFileSync(sourcePath, "utf8");
  const includePaths = ["./", globalDir, gameDir];
  const runPass = (
    fileType: number,
    extraDefines: Record<string, string> | undefined,
    baseRom: Uint8Array | undefined,
  ): Buffer =>
    assembleSnesSource(source, sourcePath, includePaths, "asar", {
      defines: {
        GameID: "SMRPG",
        ROMID: "SMRPG_U",
        FileType: String(fileType),
        ...extraDefines,
      },
      baseRom,
      writeOutputBytes: true,
    });

  const initialized = runPass(0, undefined, undefined);
  const engine = runPass(4, { PathToFile: "SPC700/Engine.asm" }, undefined);
  fs.writeFileSync(enginePath, engine);
  try {
    const assembled = runPass(1, undefined, initialized);
    return runPass(2, undefined, assembled);
  } finally {
    fs.rmSync(enginePath, { force: true });
  }
}

function assembleTmnt(workspace: string): Buffer {
  const spec = EXTERNAL_FIXTURES.tmnt;
  const sourcePath = path.join(workspace, spec.entrypoint);
  const globalDir = path.join(workspace, "Global");
  const gameDir = path.join(workspace, "Teenage_Mutant_Ninja_Turtles_IV");
  const spcPath = path.join(gameDir, "SPC700/SPC700DataBlocks_TMNTIV.bin");
  const source = fs.readFileSync(sourcePath, "utf8");
  const includePaths = ["./", globalDir, gameDir];
  const runPass = (
    fileType: number,
    extraDefines: Record<string, string> | undefined,
    baseRom: Uint8Array | undefined,
  ): Buffer =>
    assembleSnesSource(source, sourcePath, includePaths, "asar", {
      defines: {
        GameID: "TMNTIV",
        ROMID: "TMNTIV_U",
        MainFolder: "Teenage_Mutant_Ninja_Turtles_IV",
        FileType: String(fileType),
        ...extraDefines,
      },
      baseRom,
      writeOutputBytes: true,
    });

  const initialized = runPass(0, undefined, undefined);
  const engine = runPass(4, undefined, undefined);
  fs.writeFileSync(spcPath, engine);
  try {
    const assembled = runPass(1, undefined, initialized);
    return runPass(2, undefined, assembled);
  } finally {
    fs.rmSync(spcPath, { force: true });
  }
}

function assembleZelda(workspace: string, rom: Buffer): Buffer {
  const spec = EXTERNAL_FIXTURES.zelda;
  const srcDir = path.join(workspace, "src");
  const cfgPath = path.join(srcDir, "Z.cfg");
  const driverPath = path.join(workspace, spec.entrypoint);
  const assembler = new Assembler({
    environment: nesEnvironment,
    target: NES_65XX_TARGET_ID,
    architecture: "65xx.6502",
    targetOptions: {
      linkerConfig: fs.readFileSync(cfgPath, "utf8"),
      header: [...rom.subarray(0, 16)],
      fillByte: 0xff,
    },
    collectSourceMetadata: false,
  });
  try {
    assembler.setIncludePaths([srcDir, workspace]);
    assembler.setCurrentFile(driverPath);
    assembler.assembleSource(fs.readFileSync(driverPath, "utf8"), driverPath);
    return Buffer.from(assembler.getBinaryOutput());
  } finally {
    assembler.dispose();
  }
}

export function assemblePreparedFixture(prepared: PreparedFixture): Buffer {
  const { spec, workspace, rom } = prepared;
  if (spec.id === "smrpg") return assembleSmrpg(workspace);
  if (spec.id === "tmnt") return assembleTmnt(workspace);
  if (spec.id === "zelda") {
    if (!rom) throw new Error("Zelda assembly requires the validated input ROM.");
    return assembleZelda(workspace, rom);
  }
  const sourcePath = path.join(workspace, spec.entrypoint);
  const source = fs.readFileSync(sourcePath, "utf8");
  return assembleSnesSource(
    source,
    sourcePath,
    ["./", path.dirname(sourcePath)],
    spec.checksumMode,
  );
}

export function assembleExternalFixture(id: ExternalFixtureId, options?: AssembleOptions): Buffer {
  const prepared = prepareExternalFixture(id, options);
  try {
    return assemblePreparedFixture(prepared);
  } finally {
    cleanupPreparedFixture(prepared);
  }
}

export function assertAssembledMatchesManifest(id: ExternalFixtureId, output: Uint8Array): void {
  const spec = getExternalFixture(id);
  const digest = sha256(output);
  if (output.length !== spec.expectedBytes || digest !== spec.expectedSha256) {
    throw new Error(
      `${spec.displayName} output ${output.length} bytes / ${digest}, expected ${spec.expectedBytes} / ${spec.expectedSha256}.`,
    );
  }
}

export function listDirtySubmodules(options?: { includeUntracked?: boolean }): string[] {
  const dirty: string[] = [];
  const args =
    options?.includeUntracked === false
      ? ["status", "--porcelain", "--untracked-files=no"]
      : ["status", "--porcelain"];
  for (const spec of [...Object.values(EXTERNAL_FIXTURES), SNES_ROM_FRAMEWORK]) {
    if (!isSubmoduleInitialized(spec)) continue;
    const porcelain = meaningfulPorcelain(tryGit(args, submoduleDir(spec)) ?? "");
    if (porcelain.length > 0) {
      dirty.push(`${spec.submodulePath}:\n${porcelain}`);
    }
  }
  return dirty;
}

export function assertSubmodulesClean(): void {
  const dirty = listDirtySubmodules({ includeUntracked: false });
  if (dirty.length > 0) {
    throw new Error(
      `External fixture submodules have tracked changes after execution:\n${dirty.join("\n")}`,
    );
  }
}

export function assertParentWorktreeClean(): void {
  const porcelain = tryGit(["status", "--porcelain"], PROJECT_ROOT) ?? "";
  if (porcelain.length > 0) {
    throw new Error(`Parent worktree is dirty:\n${porcelain}`);
  }
}
