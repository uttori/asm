import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SNES_ROM_FRAMEWORK } from "../fixtures/fixture-manifest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_EXTENSIONS = new Set([".exe", ".dll", ".bin", ".sfc", ".smc"]);

export type PlaceFrameworkOptions = {
  destRoot: string;
};

/**
 * Copies tracked `Global/*.asm` from the pinned SNES ROM Framework submodule
 * into `destRoot/Global`. Executables, DLLs, Firmware, Extras, and the sample
 * ROM stay in the submodule.
 * @param {PlaceFrameworkOptions} options Destination disassembly root.
 * @returns {void}
 */
export function placeSnesRomFramework(options: PlaceFrameworkOptions): void {
  const repoDir = path.resolve(root, SNES_ROM_FRAMEWORK.submodulePath);
  if (!fs.existsSync(path.join(repoDir, ".git"))) {
    throw new Error(
      `SNES ROM Framework submodule is not initialized.\ngit submodule update --init ${SNES_ROM_FRAMEWORK.submodulePath}`,
    );
  }
  const commit = execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (commit !== SNES_ROM_FRAMEWORK.commit) {
    throw new Error(
      `SNES ROM Framework checkout is ${commit}, expected ${SNES_ROM_FRAMEWORK.commit} (V${SNES_ROM_FRAMEWORK.version}).`,
    );
  }

  const listing = execFileSync("git", [
    "-C",
    repoDir,
    "ls-files",
    "-z",
    "--",
    SNES_ROM_FRAMEWORK.globalDir,
  ]);
  const files = listing
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((relative) => {
      const ext = path.extname(relative).toLowerCase();
      return !SKIP_EXTENSIONS.has(ext);
    });
  if (files.length === 0) {
    throw new Error(
      `No framework source files under ${SNES_ROM_FRAMEWORK.globalDir} in ${repoDir}.`,
    );
  }

  const destGlobal = path.join(options.destRoot, SNES_ROM_FRAMEWORK.globalDir);
  fs.mkdirSync(destGlobal, { recursive: true });
  for (const relative of files) {
    const from = path.join(repoDir, relative);
    const to = path.join(options.destRoot, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

type CliOptions = {
  destRoot?: string;
  help: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { help: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--dest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--dest requires a path");
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

function printHelp(): void {
  console.log(`Place the pinned SNES ROM Framework Global sources into a workspace.

Copies only tracked non-binary files from ${SNES_ROM_FRAMEWORK.submodulePath}/${SNES_ROM_FRAMEWORK.globalDir}
(pin ${SNES_ROM_FRAMEWORK.commit}, V${SNES_ROM_FRAMEWORK.version}).

Usage:
  npm run fixture:tmnt:framework -- --dest DIR
`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.destRoot) {
    throw new Error("--dest is required (the TMNT workspace root, not the submodule).");
  }
  placeSnesRomFramework({ destRoot: options.destRoot });
  console.log(
    `Placed SNES ROM Framework V${SNES_ROM_FRAMEWORK.version} Global sources into ${path.join(options.destRoot, SNES_ROM_FRAMEWORK.globalDir)}`,
  );
}

const launchedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (launchedDirectly) {
  main();
}
