import fs from "node:fs";
import path from "node:path";

import { test } from "../ava-helper.js";

/** Type-only edges matter too: installed declarations must not pull a host back into a lower package. */
const allowed: Readonly<Record<string, readonly string[]>> = {
  assets: [],
  capture: [],
  core: [],
  "plugin-loader-node": ["core"],
  disassembler: ["core", "capture"],
  "plugin-snes": ["assets", "core", "disassembler"],
  "plugin-65xx": ["assets", "core", "disassembler", "capture"],
  workflows: ["assets", "core", "disassembler", "plugin-snes", "plugin-65xx", "plugin-loader-node"],
  "game-secret-of-mana": ["assets", "core", "disassembler", "workflows"],
  "debug-adapter": ["core", "capture"],
  "debug-sidecar-ares": ["core", "capture", "debug-adapter", "plugin-snes", "plugin-65xx"],
  "language-server": [
    "assets",
    "core",
    "disassembler",
    "plugin-loader-node",
    "plugin-snes",
    "plugin-65xx",
    "game-secret-of-mana",
  ],
  cli: [
    "assets",
    "core",
    "disassembler",
    "plugin-loader-node",
    "plugin-snes",
    "plugin-65xx",
    "workflows",
    "game-secret-of-mana",
  ],
  "vscode-extension": [
    "assets",
    "core",
    "disassembler",
    "debug-adapter",
    "debug-sidecar-ares",
    "plugin-snes",
    "plugin-65xx",
    "capture",
    "workflows",
    "game-secret-of-mana",
  ],
  "plugin-author": ["core"],
};
interface Manifest {
  name: string;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringRecord(value: unknown): value is Record<string, string> {
  return record(value) && Object.values(value).every((item) => typeof item === "string");
}
function readManifest(file: string): Manifest {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    !record(value) ||
    typeof value.name !== "string" ||
    (value.exports !== undefined && !record(value.exports)) ||
    (value.dependencies !== undefined && !stringRecord(value.dependencies)) ||
    (value.devDependencies !== undefined && !stringRecord(value.devDependencies))
  ) {
    throw new Error("Invalid package manifest: " + file);
  }
  return {
    name: value.name,
    exports: record(value.exports) ? value.exports : undefined,
    dependencies: stringRecord(value.dependencies) ? value.dependencies : undefined,
    devDependencies: stringRecord(value.devDependencies) ? value.devDependencies : undefined,
  };
}
const root = path.resolve("packages");
const manifests = new Map(
  Object.keys(allowed).map((folder) => [
    folder,
    readManifest(path.join(root, folder, "package.json")),
  ]),
);
const byName = new Map([...manifests].map(([folder, manifest]) => [manifest.name, folder]));

function violation(owner: string, specifier: string): string | undefined {
  const name = specifier.split("/").slice(0, 2).join("/");
  const target = byName.get(name);
  if (!target || target === owner) {
    return undefined;
  }
  if (!allowed[owner].includes(target)) {
    return `upward import: ${owner} -> ${target}`;
  }
  const manifest = manifests.get(owner)!;
  // Executable bundles explicitly compose the private game; it is never a public runtime dependency.
  const bundledGame =
    target === "game-secret-of-mana" &&
    ["cli", "language-server", "vscode-extension"].includes(owner);
  if (!manifest.dependencies?.[name] && !(bundledGame && manifest.devDependencies?.[name])) {
    return `undeclared dependency: ${owner} -> ${name}`;
  }
  const subpath = specifier === name ? "." : "." + specifier.slice(name.length);
  if (!Object.hasOwn(manifests.get(target)!.exports ?? {}, subpath)) {
    return `private subpath: ${specifier}`;
  }
  return undefined;
}
function sources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sources(file);
    }
    return file.endsWith(".ts") ? [file] : [];
  });
}

test("all production workspace imports obey ownership, public subpaths and declared dependencies", (t) => {
  const failures: string[] = [];
  for (const owner of Object.keys(allowed)) {
    for (const file of sources(path.join(root, owner, "src"))) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g,
      )) {
        const issue = violation(owner, match[1]);
        if (issue) {
          failures.push(`${path.relative(root, file)}: ${issue}`);
        }
        if (
          match[1].startsWith(".") &&
          !path.resolve(path.dirname(file), match[1]).startsWith(path.join(root, owner) + path.sep)
        ) {
          failures.push(`${file}: relative cross-package import`);
        }
      }
    }
  }
  t.deepEqual(failures, []);
});

test("boundary checks reject upward, private and undeclared imports", (t) => {
  t.regex(violation("disassembler", "@uttori/asm-debug-adapter")!, /upward/);
  t.regex(violation("workflows", "@uttori/asm-game-secret-of-mana")!, /upward/);
  t.regex(violation("plugin-snes", "@uttori/asm-core/src/assembler")!, /private/);
  const manifest = manifests.get("assets")!;
  t.falsy(manifest.dependencies?.["@uttori/asm-core"]);
  t.regex(violation("assets", "@uttori/asm-core")!, /upward/);
});

test("declared runtime dependency graph is acyclic", (t) => {
  const completed = new Set<string>(),
    active = new Set<string>();
  const visit = (folder: string): void => {
    if (active.has(folder)) {
      throw new Error(`Dependency cycle through ${folder}`);
    }
    if (completed.has(folder)) {
      return;
    }
    active.add(folder);
    for (const name of Object.keys(manifests.get(folder)!.dependencies ?? {})) {
      const target = byName.get(name);
      if (target) {
        visit(target);
      }
    }
    active.delete(folder);
    completed.add(folder);
  };
  t.notThrows(() => {
    for (const folder of manifests.keys()) {
      visit(folder);
    }
  });
});
