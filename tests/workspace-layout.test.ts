import fs from "node:fs";
import path from "node:path";

import { test } from "./ava-helper.js";

const root = process.cwd();
const packageDirectories = [
  "core",
  "language-server",
  "plugin-65xx",
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
