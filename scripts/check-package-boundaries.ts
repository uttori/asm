import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type PackageBoundaryViolationCode =
  | "CORE_IMPORTS_PLUGIN"
  | "PLUGIN_IMPORTS_CORE_INTERNAL"
  | "CORE_CONTAINS_SNES_IDENTIFIER"
  | "LSP_PROVIDER_IMPORTS_STATIC_CATALOG";

export interface PackageBoundaryViolation {
  readonly code: PackageBoundaryViolationCode;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

const PROHIBITED_CORE_IDENTIFIERS = new Set([
  "snes",
  "sfc",
  "65816",
  "spc700",
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

const listTypeScriptFiles = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(resolved));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(resolved);
    }
  }
  return files;
};

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

const lineFor = (sourceFile: ParsedSource, position: number): number => {
  let low = 0;
  let high = sourceFile.lineStarts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sourceFile.lineStarts[middle] <= position) low = middle + 1;
    else high = middle;
  }
  return low;
};

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

const splitIdentifier = (identifier: string): string[] =>
  identifier
    .replace(/([\da-z])([A-Z])/g, "$1 $2")
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());

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

export function collectPackageBoundaryViolations(root = process.cwd()): PackageBoundaryViolation[] {
  const resolvedRoot = path.resolve(root);
  const coreSource = path.join(resolvedRoot, "packages/core/src");
  const pluginsSource = path.join(resolvedRoot, "plugins");
  const providersFile = path.join(resolvedRoot, "language-server/src/providers.ts");
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
        (resolvedImport !== undefined && isWithin(resolvedImport, pluginsSource))
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

  for (const file of listTypeScriptFiles(pluginsSource).filter((entry) =>
    entry.includes(`${path.sep}src${path.sep}`),
  )) {
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
        imported.module.includes("/plugins/") ||
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

export function assertPackageBoundaries(root = process.cwd()): void {
  const violations = collectPackageBoundaryViolations(root);
  if (violations.length === 0) return;
  const details = violations
    .map(
      (violation) => `${violation.file}:${violation.line} [${violation.code}] ${violation.message}`,
    )
    .join("\n");
  throw new Error(
    `Package boundary check failed with ${violations.length} violation(s):\n${details}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  try {
    assertPackageBoundaries();
    console.log("Package boundaries: OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
