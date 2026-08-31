import fs from "node:fs";
import path from "node:path";

import { test } from "./ava-helper.js";

const root = process.cwd();
const packageDirectories = [
  "cli",
  "core",
  "language-server",
  "plugin-65xx",
  "plugin-author",
  "plugin-loader-node",
  "plugin-snes",
  "vscode-extension",
] as const;

test("all npm workspaces use the flat packages layout", (t) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
    workspaces: string[];
  };

  t.deepEqual(manifest.workspaces, ["packages/*"]);
  for (const directory of packageDirectories) {
    t.true(fs.existsSync(path.join(root, "packages", directory, "package.json")), directory);
  }
  for (const obsoleteRoot of ["editors", "language-server", "plugins"]) {
    t.false(fs.existsSync(path.join(root, obsoleteRoot)), obsoleteRoot);
  }
  for (const obsoleteCliRoot of ["src", "dist"]) {
    t.false(fs.existsSync(path.join(root, obsoleteCliRoot)), obsoleteCliRoot);
  }
});

test("the CLI workspace owns the executable and root development command", (t) => {
  const rootManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const cliManifest = JSON.parse(
    fs.readFileSync(path.join(root, "packages/cli/package.json"), "utf8"),
  ) as {
    name: string;
    bin: Record<string, string>;
    dependencies: Record<string, string>;
    files: string[];
  };
  const coreManifest = JSON.parse(
    fs.readFileSync(path.join(root, "packages/core/package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };

  t.is(cliManifest.name, "@uttori/asm-cli");
  t.is(cliManifest.bin["uttori-asm"], "out/cli.mjs");
  t.deepEqual(Object.keys(cliManifest.dependencies).sort(), [
    "@uttori/asm-core",
    "@uttori/asm-plugin-loader-node",
    "@uttori/asm-plugin-snes",
  ]);
  t.false("@uttori/asm-cli" in (coreManifest.dependencies ?? {}));
  t.false("@uttori/asm-plugin-loader-node" in (coreManifest.dependencies ?? {}));
  t.true(cliManifest.files.includes("out"));
  t.true(rootManifest.scripts.cli.includes("--workspace @uttori/asm-cli"));
});

test("package lock records every flat workspace", (t) => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as {
    packages: Record<string, unknown>;
  };

  const lockedWorkspaces = Object.keys(lock.packages)
    .filter((entry) => entry.startsWith("packages/"))
    .sort();
  t.deepEqual(
    lockedWorkspaces,
    packageDirectories.map((directory) => `packages/${directory}`).sort(),
  );
});
