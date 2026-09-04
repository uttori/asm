import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { parseAresRuntimeManifest } from "../packages/debug-sidecar-ares/src/ares-process-host.js";

const PATCH_FILES = Object.freeze([
  "ares/sfc/cpu/cpu.cpp",
  "ares/sfc/system/system.cpp",
  "cmake/macos/compilerconfig.cmake",
  "headless/headless.cpp",
  "nall/nall/gdb/server.cpp",
  "nall/nall/gdb/server.hpp",
]);
const HEADLESS_PATCH_FILES = Object.freeze([
  ".gitignore",
  "CMakeLists.txt",
  "ares/ares/random.hpp",
  "headless/CMakeLists.txt",
  "headless/cli.cpp",
  "headless/cli.hpp",
  "headless/emulators.cpp",
  "headless/emulators.hpp",
  "headless/headless.cpp",
  "headless/parse.cpp",
  "headless/parse.hpp",
  "headless/runtime.cpp",
  "headless/runtime.hpp",
  "headless/settings.cpp",
  "headless/settings.hpp",
  "headless/states.cpp",
  "headless/states.hpp",
  "headless/video-output.cpp",
  "headless/video-output.hpp",
  "mia/CMakeLists.txt",
  "nall/nall/arguments.hpp",
]);
const HEADLESS_PATCH_COMMITS = 9;
const MAX_ADDED_LINES = 250;
const MAX_DELETED_LINES = 25;

interface Options {
  readonly repo: string;
  readonly manifest: string;
  readonly headlessPatch: string;
  readonly patch: string;
  readonly executable: string;
  readonly rom: string;
  readonly runtimeDirectory: string;
}

const workspace = process.cwd();
const defaults: Options = {
  repo: path.join(workspace, "Local Only/ares-headless-pr"),
  manifest: path.join(workspace, "Local Only/ares-phase10-live-runtime/ares-runtime-manifest.json"),
  headlessPatch: path.join(
    workspace,
    "Local Only/ares-phase10-live-runtime/patches/headless-series.patch",
  ),
  patch: path.join(
    workspace,
    "Local Only/ares-phase10-live-runtime/patches/0001-Add-bounded-SNES-debugger-hooks-to-headless-runtime.patch",
  ),
  executable: path.join(workspace, "Local Only/ares-phase10-live-runtime/bin/ares-headless"),
  rom: path.join(workspace, "Local Only/Secret of Mana (USA).sfc"),
  runtimeDirectory: path.join(workspace, "Local Only/ares-phase10-live-runtime"),
};
const currentDefaults: Options = {
  repo: path.join(workspace, "Local Only/ares-current-port"),
  manifest: path.join(workspace, "Local Only/ares-current-live-runtime/ares-runtime-manifest.json"),
  headlessPatch: path.join(
    workspace,
    "Local Only/ares-current-live-runtime/patches/headless-series.patch",
  ),
  patch: path.join(
    workspace,
    "Local Only/ares-current-live-runtime/patches/0001-Add-bounded-SNES-debugger-hooks-to-headless-runtime.patch",
  ),
  executable: path.join(workspace, "Local Only/ares-current-live-runtime/bin/ares-headless"),
  rom: path.join(workspace, "Local Only/Secret of Mana (USA).sfc"),
  runtimeDirectory: path.join(workspace, "Local Only/ares-current-live-runtime"),
};

const usage = `Usage: npm run fixture:ares:drift -- [options]

Options:
  --current              Use the current-upstream local validation preset
  --repo <path>          Local ares git checkout
  --manifest <path>      Versioned ares runtime manifest
  --headless-patch <p>   Complete nine-commit headless format-patch series
  --patch <path>         Complete one-commit format-patch
  --ares <path>          Built ares-headless executable
  --rom <path>           Intentional local-only test ROM
  --runtime-dir <path>   Directory containing manifest resources
  --help                 Show this help
`;

const optionNames = new Map<string, keyof Options>([
  ["--repo", "repo"],
  ["--manifest", "manifest"],
  ["--headless-patch", "headlessPatch"],
  ["--patch", "patch"],
  ["--ares", "executable"],
  ["--rom", "rom"],
  ["--runtime-dir", "runtimeDirectory"],
]);

const parseArguments = (arguments_: readonly string[]): Options => {
  let parsed: Record<keyof Options, string> = { ...defaults };
  const seen = new Set<keyof Options>();
  let selectedCurrent = false;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    }
    if (argument === "--current") {
      if (index !== 0 || selectedCurrent)
        throw new Error("Argument '--current' must appear once and before path overrides.");
      parsed = { ...currentDefaults };
      selectedCurrent = true;
      continue;
    }
    const name = optionNames.get(argument ?? "");
    if (!name) throw new Error(`Unknown argument '${String(argument)}'.\n${usage}`);
    if (seen.has(name)) throw new Error(`Duplicate argument '${String(argument)}'.`);
    const value = arguments_[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Argument '${String(argument)}' requires a path.`);
    parsed[name] = path.resolve(value);
    seen.add(name);
  }
  return parsed;
};

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const fileSha256 = (file: string): string => sha256(readFileSync(file));

const gitText = (repo: string, arguments_: readonly string[]): string =>
  execFileSync("git", ["-C", repo, ...arguments_], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const gitBytes = (repo: string, arguments_: readonly string[]): Buffer =>
  execFileSync("git", ["-C", repo, ...arguments_], {
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const assertEqual = (actual: string | number, expected: string | number, label: string): void => {
  if (actual !== expected)
    throw new Error(`${label} mismatch: expected '${String(expected)}', got '${String(actual)}'.`);
};

const assertFile = (file: string, label: string): void => {
  if (!statSync(file).isFile()) throw new Error(`${label} is not a file: ${file}`);
};

const assertDirectory = (directory: string, label: string): void => {
  if (!statSync(directory).isDirectory())
    throw new Error(`${label} is not a directory: ${directory}`);
};

const options = parseArguments(process.argv.slice(2));
assertDirectory(options.repo, "Ares checkout");
assertFile(options.manifest, "Ares manifest");
assertFile(options.headlessPatch, "Ares headless patch series");
assertFile(options.patch, "Ares patch");
assertFile(options.executable, "Ares executable");
assertFile(options.rom, "Test ROM");
assertDirectory(options.runtimeDirectory, "Ares runtime directory");

const manifest = parseAresRuntimeManifest(JSON.parse(readFileSync(options.manifest, "utf8")));
assertEqual(process.platform, manifest.platform, "Host platform");
assertEqual(process.arch, manifest.architecture, "Host architecture");

const worktreeStatus = gitText(options.repo, ["status", "--porcelain=v1", "--untracked-files=all"]);
assertEqual(worktreeStatus, "", "Ares worktree status");
assertEqual(gitText(options.repo, ["rev-parse", "HEAD"]), manifest.forkRevision, "Fork revision");
assertEqual(
  gitText(options.repo, ["rev-parse", `${manifest.forkRevision}^`]),
  manifest.headlessBaseRevision,
  "Fork parent",
);
assertEqual(
  Number(
    gitText(options.repo, [
      "rev-list",
      "--count",
      `${manifest.headlessBaseRevision}..${manifest.forkRevision}`,
    ]),
  ),
  1,
  "Project patch commit count",
);
assertEqual(
  gitText(options.repo, ["rev-parse", "origin/master"]),
  manifest.upstreamRevision,
  "Pinned origin/master revision",
);
const mergeBase = gitText(options.repo, [
  "merge-base",
  manifest.upstreamRevision,
  manifest.forkRevision,
]);
if (!mergeBase)
  throw new Error("Pinned upstream and fork revisions have no visible common ancestor.");
const headlessPatchCommits = Number(
  gitText(options.repo, [
    "rev-list",
    "--count",
    `${manifest.upstreamRevision}..${manifest.headlessBaseRevision}`,
  ]),
);
assertEqual(headlessPatchCommits, HEADLESS_PATCH_COMMITS, "Headless patch commit count");
const headlessChangedFiles = gitText(options.repo, [
  "diff",
  "--name-only",
  `${mergeBase}..${manifest.headlessBaseRevision}`,
])
  .split("\n")
  .filter(Boolean)
  .sort();
assertEqual(
  JSON.stringify(headlessChangedFiles),
  JSON.stringify([...HEADLESS_PATCH_FILES].sort()),
  "Headless patch file allowlist",
);
assertEqual(
  gitText(options.repo, ["diff", "--check", `${mergeBase}..${manifest.headlessBaseRevision}`]),
  "",
  "Headless patch whitespace check",
);
const generatedHeadlessPatch = gitBytes(options.repo, [
  "format-patch",
  "--stdout",
  `${manifest.upstreamRevision}..${manifest.headlessBaseRevision}`,
]);
const storedHeadlessPatch = readFileSync(options.headlessPatch);
assertEqual(
  sha256(generatedHeadlessPatch),
  manifest.headlessPatchSha256,
  "Generated headless patch SHA-256",
);
assertEqual(
  sha256(storedHeadlessPatch),
  manifest.headlessPatchSha256,
  "Stored headless patch SHA-256",
);
if (!generatedHeadlessPatch.equals(storedHeadlessPatch))
  throw new Error("Stored headless patch bytes differ from format-patch output.");

const changedFiles = gitText(options.repo, [
  "diff-tree",
  "--no-commit-id",
  "--name-only",
  "-r",
  manifest.forkRevision,
])
  .split("\n")
  .filter(Boolean)
  .sort();
assertEqual(
  JSON.stringify(changedFiles),
  JSON.stringify([...PATCH_FILES].sort()),
  "Patch file allowlist",
);
assertEqual(
  gitText(options.repo, [
    "diff",
    "--check",
    `${manifest.headlessBaseRevision}..${manifest.forkRevision}`,
  ]),
  "",
  "Patch whitespace check",
);
const lineCounts = gitText(options.repo, [
  "diff",
  "--numstat",
  `${manifest.headlessBaseRevision}..${manifest.forkRevision}`,
])
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
  .reduce(
    (totals, [addedText, deletedText]) => {
      const added = Number(addedText);
      const deleted = Number(deletedText);
      if (!Number.isSafeInteger(added) || !Number.isSafeInteger(deleted))
        throw new Error("Patch budget cannot include binary or invalid numstat entries.");
      return { added: totals.added + added, deleted: totals.deleted + deleted };
    },
    { added: 0, deleted: 0 },
  );
if (lineCounts.added > MAX_ADDED_LINES || lineCounts.deleted > MAX_DELETED_LINES)
  throw new Error(
    `Patch budget exceeded: ${lineCounts.added}/${MAX_ADDED_LINES} added, ${lineCounts.deleted}/${MAX_DELETED_LINES} deleted.`,
  );

const generatedPatch = gitBytes(options.repo, [
  "format-patch",
  "--stdout",
  "-1",
  manifest.forkRevision,
]);
const storedPatch = readFileSync(options.patch);
assertEqual(sha256(generatedPatch), manifest.patchSha256, "Generated patch SHA-256");
assertEqual(sha256(storedPatch), manifest.patchSha256, "Stored patch SHA-256");
if (!generatedPatch.equals(storedPatch))
  throw new Error("Stored patch bytes differ from format-patch output.");

assertEqual(fileSha256(options.executable), manifest.executableSha256, "Executable SHA-256");
assertEqual(fileSha256(options.rom), manifest.romSha256, "ROM SHA-256");
for (const resource of manifest.resources) {
  const resourceFile = path.join(options.runtimeDirectory, resource.path);
  assertFile(resourceFile, `Runtime resource '${resource.path}'`);
  assertEqual(
    fileSha256(resourceFile),
    resource.sha256,
    `Runtime resource '${resource.path}' SHA-256`,
  );
}

const [upstreamOnlyText, forkOnlyText] = gitText(options.repo, [
  "rev-list",
  "--left-right",
  "--count",
  `${manifest.upstreamRevision}...${manifest.forkRevision}`,
]).split(/\s+/);
const upstreamOnlyCommits = Number(upstreamOnlyText);
const forkOnlyCommits = Number(forkOnlyText);
if (!Number.isSafeInteger(upstreamOnlyCommits) || !Number.isSafeInteger(forkOnlyCommits))
  throw new Error("Git returned invalid fork drift counts.");

process.stdout.write(
  `${JSON.stringify(
    {
      status: "pass",
      upstreamRevision: manifest.upstreamRevision,
      headlessBaseRevision: manifest.headlessBaseRevision,
      forkRevision: manifest.forkRevision,
      mergeBaseRevision: mergeBase,
      headlessPatchCommits,
      headlessChangedFiles,
      headlessPatchSha256: manifest.headlessPatchSha256,
      projectPatchCommits: 1,
      patchLineCounts: lineCounts,
      changedFiles,
      patchSha256: manifest.patchSha256,
      executableSha256: manifest.executableSha256,
      romSha256: manifest.romSha256,
      resourceCount: manifest.resources.length,
      drift: { upstreamOnlyCommits, forkOnlyCommits },
    },
    undefined,
    2,
  )}\n`,
);
