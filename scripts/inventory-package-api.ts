import fs from "node:fs";
import path from "node:path";

import { API, SymbolFlags } from "typescript/unstable/sync";

interface PackageManifest {
  readonly name: string;
  readonly private?: boolean;
  readonly exports?: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
}
/** Reproducible inventory of public symbols and explicit named imports, including type-only consumers. */

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringRecord(value: unknown): value is Record<string, string> {
  return record(value) && Object.values(value).every((item) => typeof item === "string");
}
function isManifest(value: unknown): value is PackageManifest {
  return (
    record(value) &&
    typeof value.name === "string" &&
    (value.private === undefined || typeof value.private === "boolean") &&
    (value.exports === undefined ||
      (record(value.exports) &&
        Object.values(value.exports).every(
          (item) => typeof item === "string" || stringRecord(item),
        )))
  );
}
function readManifest(file: string): PackageManifest {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isManifest(value)) {
    throw new Error("Invalid package manifest: " + file);
  }
  return value;
}
const root = path.resolve(".");
const packages = fs.readdirSync(path.join(root, "packages")).flatMap((folder) => {
  const file = path.join(root, "packages", folder, "package.json");
  if (!fs.existsSync(file)) {
    return [];
  }
  const manifest = readManifest(file);
  return [{ folder, manifest }];
});
function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["dist", "out", "node_modules", ".git"].includes(entry.name)) {
      return [];
    }
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(file);
    }
    return /\.(?:m?js|m?ts)$/.test(file) ? [file] : [];
  });
}
const uses = new Map<string, Set<string>>();
for (const file of ["packages", "scripts", "tests", "secret-of-mana/tools"].flatMap((folder) =>
  sourceFiles(path.join(root, folder)),
)) {
  const source = fs.readFileSync(file, "utf8");
  for (const clause of source.split(/\bimport\s+/).slice(1)) {
    const match = clause
      .replace(/^type\s+/, "")
      .match(/^{([^}]+)}\s+from\s+["'](@uttori\/asm-[^"']+)["']/);
    if (!match) {
      continue;
    }
    for (const field of match[1].split(",")) {
      const name = field
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      const key = match[2] + "#" + name;
      const consumers = uses.get(key) ?? new Set<string>();
      consumers.add(path.relative(root, file));
      uses.set(key, consumers);
    }
  }
}
function category(folder: string, subpath: string): string {
  if (folder === "game-secret-of-mana") {
    return "private game integration";
  }
  if (
    subpath === "./plugin" ||
    subpath === "./target" ||
    (folder.startsWith("plugin-") && folder !== "plugin-loader-node" && subpath === ".")
  ) {
    return "plugin";
  }
  if (
    folder === "assets" ||
    (folder === "core" && ["./canonical-json", "./debug-map"].includes(subpath))
  ) {
    return "portable embedding";
  }
  return "Node host";
}
const api = new API({ cwd: root });
try {
  const configs = packages.map(({ folder }) =>
    path.join(
      root,
      "packages",
      folder,
      fs.existsSync(path.join(root, "packages", folder, "tsconfig.build.json"))
        ? "tsconfig.build.json"
        : "tsconfig.json",
    ),
  );
  const snapshot = api.updateSnapshot({ openProjects: configs });
  const inventory = [];
  for (const [index, { folder, manifest }] of packages.entries()) {
    const project = snapshot.getProject(configs[index]);
    if (!project) {
      throw new Error(`Missing API project ${folder}.`);
    }
    for (const [subpath, condition] of Object.entries(manifest.exports ?? {})) {
      if (typeof condition === "string" || !condition["uttori-source"]?.endsWith(".ts")) {
        continue;
      }
      const file = path.join(root, "packages", folder, condition["uttori-source"]);
      const source = project.program.getSourceFile(file);
      if (!source) {
        throw new Error(`Missing API source ${file}.`);
      }
      const module = project.checker.getSymbolAtLocation(source);
      if (!module) {
        throw new Error(`Missing module symbol ${file}.`);
      }
      const specifier = manifest.name + (subpath === "." ? "" : subpath.slice(1));
      const symbols = project.checker
        .getExportsOfModule(module)
        .map((symbol) => {
          const target =
            symbol.flags & SymbolFlags.Alias ? project.checker.getAliasedSymbol(symbol) : symbol;
          return {
            name: symbol.name,
            kind: target.flags & SymbolFlags.Value ? "runtime" : "type",
            consumers: [...(uses.get(specifier + "#" + symbol.name) ?? [])].toSorted(),
          };
        })
        .toSorted((a, b) => a.name.localeCompare(b.name));
      let browserSymbols: { name: string; kind: string }[] | undefined;
      if (condition.browser) {
        const browserFile = path.join(
          root,
          "packages",
          folder,
          condition.browser.replace("./dist/", "./src/").replace(/\.js$/, ".ts"),
        );
        const browserSource = project.program.getSourceFile(browserFile);
        const browserModule = browserSource && project.checker.getSymbolAtLocation(browserSource);
        if (!browserModule) {
          throw new Error(`Missing browser API ${browserFile}`);
        }
        browserSymbols = project.checker
          .getExportsOfModule(browserModule)
          .map((symbol) => {
            const target =
              symbol.flags & SymbolFlags.Alias ? project.checker.getAliasedSymbol(symbol) : symbol;
            return {
              name: symbol.name,
              kind: target.flags & SymbolFlags.Value ? "runtime" : "type",
            };
          })
          .toSorted((a, b) => a.name.localeCompare(b.name));
      }
      inventory.push({
        specifier,
        category: category(folder, subpath),
        conditions: condition,
        symbols,
        ...(browserSymbols
          ? { browser: { category: "portable embedding", symbols: browserSymbols } }
          : {}),
      });
    }
  }
  const file = path.join(root, "docs/package-api-inventory.json");
  const text = JSON.stringify({ version: 1, entries: inventory }, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(file, "utf8") !== text) {
      throw new Error(
        "API inventory changed; review exports and regenerate with npm run api:inventory.",
      );
    }
  } else {
    fs.writeFileSync(file, text);
  }
  console.log(
    `${inventory.length} entry points, ${inventory.reduce((count, entry) => count + entry.symbols.length, 0)} symbols inventoried.`,
  );
} finally {
  api.close();
}
