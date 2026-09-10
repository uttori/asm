import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../ava-helper.js";

/** Ownership rules enforced across production package sources. */
type PackageBoundaryViolationCode =
  | "CORE_IMPORTS_PLUGIN"
  | "DISASSEMBLER_IMPORTS_PLUGIN"
  | "PLUGIN_IMPORTS_CORE_INTERNAL"
  | "CORE_CONTAINS_SNES_IDENTIFIER"
  | "LSP_PROVIDER_IMPORTS_STATIC_CATALOG";

/** A repository-relative diagnostic suitable for AVA assertion output. */
interface PackageBoundaryViolation {
  readonly code: PackageBoundaryViolationCode;
  readonly file: string;
  /** One-based source line containing the violation. */
  readonly line: number;
  readonly message: string;
}

const PROHIBITED_CORE_IDENTIFIERS = new Set([
  "snes",
  "sfc",
  "superfx",
  "lorom",
  "hirom",
  "exlorom",
  "exhirom",
  "sa1rom",
  "fullsa1rom",
  "bigsa1rom",
  "sfxrom",
  "norom",
  "freespace",
  "rats",
]);

const STATIC_CATALOG_IMPORTS = new Set([
  "builtInInstructionCatalogs",
  "cpu65816Catalog",
  "directiveCatalog",
  "spc700Catalog",
  "superFxCatalog",
]);

/** Scan implementation files only; generated declarations do not own dependencies. */
const listTypeScriptFiles = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const file of listTypeScriptFiles(resolved)) files.push(file);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(resolved);
    }
  }
  return files;
};

/** Source text indexed by zero-based character offsets for line reporting. */
interface ParsedSource {
  readonly text: string;
  readonly lineStarts: readonly number[];
}

const sourceFileFor = (file: string): ParsedSource => {
  const text = fs.readFileSync(file, "utf8");
  const lineStarts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") lineStarts.push(index + 1);
  }
  return { text, lineStarts };
};

/** Convert a zero-based character offset to a one-based diagnostic line. */
const lineFor = (sourceFile: ParsedSource, position: number): number => {
  // Find the first line start after the offset, including positions on a newline.
  let low = 0;
  let high = sourceFile.lineStarts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sourceFile.lineStarts[middle] <= position) low = middle + 1;
    else high = middle;
  }
  return low;
};

/** Collect static, re-exported, bare, and literal dynamic imports without loading modules. */
const importSpecifiers = (
  sourceFile: ParsedSource,
): Array<{ module: string; names: readonly string[]; position: number }> => {
  const imports: Array<{ module: string; names: readonly string[]; position: number }> = [];
  const seen = new Set<string>();
  const add = (module: string, names: readonly string[], position: number): void => {
    const key = `${position}:${module}`;
    if (seen.has(key)) return;
    seen.add(key);
    imports.push({ module, names, position });
  };
  // Include both sides of aliases so renaming a static catalog cannot hide its origin.
  const fromPattern = /\bfrom[\t ]*["']([^\n\r"']+)["']/g;
  for (const match of sourceFile.text.matchAll(fromPattern)) {
    const statementStart = Math.max(
      sourceFile.text.lastIndexOf("import", match.index),
      sourceFile.text.lastIndexOf("export", match.index),
    );
    const clause = sourceFile.text.slice(Math.max(0, statementStart), match.index);
    const names = clause.includes("{")
      ? clause
          .slice(clause.indexOf("{") + 1, clause.lastIndexOf("}"))
          .split(",")
          .flatMap((entry) =>
            entry
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/),
          )
          .filter(Boolean)
      : [];
    add(match[1], names, Math.max(0, statementStart));
  }
  const bareImportPattern = /\bimport[\t ]*["']([^\n\r"']+)["']/g;
  for (const match of sourceFile.text.matchAll(bareImportPattern)) {
    add(match[1], [], match.index ?? 0);
  }
  const dynamicImportPattern = /\bimport[\t ]*\([\t ]*["']([^\n\r"']+)["']/g;
  for (const match of sourceFile.text.matchAll(dynamicImportPattern)) {
    add(match[1], [], match.index ?? 0);
  }
  return imports;
};

const isWithin = (candidate: string, directory: string): boolean => {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/** Split camel case and punctuation to catch target-specific names in source text. */
const splitIdentifier = (identifier: string): string[] =>
  identifier
    .replace(/([\da-z])([A-Z])/g, "$1 $2")
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());

/** Derive the allowed plugin import paths from the core package public exports. */
const coreExportSpecifiers = (root: string): Set<string> => {
  const packageFile = path.join(root, "packages/core/package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8")) as {
    name: string;
    exports?: Record<string, unknown>;
  };
  const specifiers = new Set<string>();
  for (const exportPath of Object.keys(packageJson.exports ?? { ".": true })) {
    specifiers.add(
      exportPath === "." ? packageJson.name : `${packageJson.name}/${exportPath.slice(2)}`,
    );
  }
  return specifiers;
};

/** Check production ownership in a repository root, defaulting to the current workspace. */
function collectPackageBoundaryViolations(root = process.cwd()): PackageBoundaryViolation[] {
  const resolvedRoot = path.resolve(root);
  const coreSource = path.join(resolvedRoot, "packages/core/src");
  const disassemblerSource = path.join(resolvedRoot, "packages/disassembler/src");
  const packagesDirectory = path.join(resolvedRoot, "packages");
  const pluginSources = fs
    .readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("plugin-"))
    .map((entry) => path.join(packagesDirectory, entry.name, "src"));
  const providersFile = path.join(resolvedRoot, "packages/language-server/src/providers.ts");
  const allowedCoreImports = coreExportSpecifiers(resolvedRoot);
  const violations: PackageBoundaryViolation[] = [];

  for (const file of listTypeScriptFiles(coreSource)) {
    const sourceFile = sourceFileFor(file);
    for (const imported of importSpecifiers(sourceFile)) {
      const resolvedImport = imported.module.startsWith(".")
        ? path.resolve(path.dirname(file), imported.module)
        : undefined;
      if (
        imported.module.startsWith("@uttori/asm-plugin-") ||
        (resolvedImport !== undefined &&
          pluginSources.some((pluginSource) => isWithin(resolvedImport, pluginSource)))
      ) {
        violations.push({
          code: "CORE_IMPORTS_PLUGIN",
          file: path.relative(resolvedRoot, file),
          line: lineFor(sourceFile, imported.position),
          message: `core imports plugin implementation '${imported.module}'`,
        });
      }
    }

    const seen = new Set<string>();
    const addIdentifierViolation = (identifier: string, position: number): void => {
      const canonical = identifier.toLowerCase();
      if (!PROHIBITED_CORE_IDENTIFIERS.has(canonical)) return;
      const line = lineFor(sourceFile, position);
      const key = `${line}:${canonical}`;
      if (seen.has(key)) return;
      seen.add(key);
      violations.push({
        code: "CORE_CONTAINS_SNES_IDENTIFIER",
        file: path.relative(resolvedRoot, file),
        line,
        message: `core contains prohibited SNES production identifier '${identifier}'`,
      });
    };
    for (const match of sourceFile.text.matchAll(/[$A-Z_a-z][\w$]*|\b\d+\b/g)) {
      for (const part of splitIdentifier(match[0])) {
        addIdentifierViolation(part, match.index ?? 0);
      }
    }
  }

  for (const file of listTypeScriptFiles(disassemblerSource)) {
    const sourceFile = sourceFileFor(file);
    for (const imported of importSpecifiers(sourceFile)) {
      const resolvedImport = imported.module.startsWith(".")
        ? path.resolve(path.dirname(file), imported.module)
        : undefined;
      if (
        imported.module.startsWith("@uttori/asm-plugin-") ||
        (resolvedImport !== undefined &&
          pluginSources.some((pluginSource) => isWithin(resolvedImport, pluginSource)))
      ) {
        violations.push({
          code: "DISASSEMBLER_IMPORTS_PLUGIN",
          file: path.relative(resolvedRoot, file),
          line: lineFor(sourceFile, imported.position),
          message: `disassembler imports plugin implementation '${imported.module}'`,
        });
      }
    }
  }

  for (const file of pluginSources.flatMap((pluginSource) => listTypeScriptFiles(pluginSource))) {
    const sourceFile = sourceFileFor(file);
    for (const imported of importSpecifiers(sourceFile)) {
      const resolvedImport = imported.module.startsWith(".")
        ? path.resolve(path.dirname(file), imported.module)
        : undefined;
      const usesPrivatePackagePath =
        imported.module.startsWith("@uttori/asm-core/") && !allowedCoreImports.has(imported.module);
      const reachesCoreSource =
        resolvedImport !== undefined && isWithin(resolvedImport, coreSource);
      if (usesPrivatePackagePath || reachesCoreSource) {
        violations.push({
          code: "PLUGIN_IMPORTS_CORE_INTERNAL",
          file: path.relative(resolvedRoot, file),
          line: lineFor(sourceFile, imported.position),
          message: `plugin imports non-exported core path '${imported.module}'`,
        });
      }
    }
  }

  if (fs.existsSync(providersFile)) {
    const sourceFile = sourceFileFor(providersFile);
    for (const imported of importSpecifiers(sourceFile)) {
      if (
        /(?:instruction|directive)-catalog/i.test(imported.module) ||
        /(?:^|\/)plugin-[^/]+(?:\/|$)/.test(imported.module) ||
        imported.module.startsWith("@uttori/asm-plugin-") ||
        imported.names.some((name) => STATIC_CATALOG_IMPORTS.has(name))
      ) {
        violations.push({
          code: "LSP_PROVIDER_IMPORTS_STATIC_CATALOG",
          file: path.relative(resolvedRoot, providersFile),
          line: lineFor(sourceFile, imported.position),
          message: `language-server provider imports static plugin catalog '${imported.module}'`,
        });
      }
    }
  }

  return violations;
}

/** Create a minimal workspace; each caller removes it with t.teardown. */
const boundaryFixture = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-boundaries-"));
  const write = (file: string, contents: string): void => {
    const resolved = path.join(root, file);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, contents);
  };
  write(
    "packages/core/package.json",
    JSON.stringify({
      name: "@uttori/asm-core",
      exports: { ".": "./src/index.ts", "./plugin": "./src/plugin/index.ts" },
    }),
  );
  write("packages/core/src/index.ts", "export const core = true;\n");
  write("packages/disassembler/src/index.ts", "export const disassembler = true;\n");
  write("packages/plugin-example/src/index.ts", 'import "@uttori/asm-core/plugin";\n');
  write("packages/language-server/src/providers.ts", 'import { core } from "@uttori/asm-core";\n');
  return root;
};

test("package boundary checker accepts the repository ownership graph", (t) => {
  t.deepEqual(collectPackageBoundaryViolations(), []);
});

test("package boundary checker rejects core plugin imports and SNES identifiers", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "packages/core/src/index.ts"),
    'import snes from "@uttori/asm-plugin-snes";\nexport const mapper = "lorom";\n',
  );

  const codes = collectPackageBoundaryViolations(root).map((violation) => violation.code);
  t.true(codes.includes("CORE_IMPORTS_PLUGIN"));
  t.true(codes.includes("CORE_CONTAINS_SNES_IDENTIFIER"));
});

test("package boundary checker rejects private core imports from plugins", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "packages/plugin-example/src/index.ts"),
    'import { Assembler } from "@uttori/asm-core/assembler";\n',
  );

  t.deepEqual(
    collectPackageBoundaryViolations(root).map((violation) => violation.code),
    ["PLUGIN_IMPORTS_CORE_INTERNAL"],
  );
});

test("package boundary checker keeps the generic disassembler independent of target plugins", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "packages/disassembler/src/index.ts"),
    'import snes from "@uttori/asm-plugin-snes";\n',
  );

  t.deepEqual(
    collectPackageBoundaryViolations(root).map((violation) => violation.code),
    ["DISASSEMBLER_IMPORTS_PLUGIN"],
  );
});

test("package boundary checker rejects static catalogs in LSP providers", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "packages/language-server/src/providers.ts"),
    'import { cpu65816Catalog } from "../../plugin-snes/src/tooling/instruction-catalog.js";\n',
  );

  t.deepEqual(
    collectPackageBoundaryViolations(root).map((violation) => violation.code),
    ["LSP_PROVIDER_IMPORTS_STATIC_CATALOG"],
  );
});
