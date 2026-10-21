import fs from "node:fs";
import path from "node:path";

/** One packed version and the exact dependency identities resolved from its declaring directory. */
export interface PackageArchiveNode {
  readonly archive: string;
  readonly dependencies: readonly string[];
}

/**
 * Select only declared transitive archives. Unrelated workspace packages must never rescue an
 * undeclared import; missing graph nodes fail rather than falling back to the workspace or registry.
 */
export function declaredArchiveClosure(
  roots: readonly string[],
  packages: ReadonlyMap<string, PackageArchiveNode>,
): string[] {
  const visited = new Set<string>();
  const archives = new Set<string>();
  const visit = (identity: string): void => {
    if (visited.has(identity)) {
      return;
    }
    const node = packages.get(identity);
    if (!node) {
      throw new Error(`No packed dependency: ${identity}`);
    }
    visited.add(identity);
    archives.add(node.archive);
    for (const dependency of node.dependencies) {
      visit(dependency);
    }
  };
  for (const root of roots) {
    visit(root);
  }
  return [...archives];
}

/** Export conditions checked by an ordinary Node consumer, without source loaders or path aliases. */
export interface PackageConsumerExports {
  readonly imports: readonly string[];
  readonly commonJsImports: readonly string[];
  readonly jsonImports: readonly string[];
}

/** Write a standalone runtime probe in the isolated consumer, so imports resolve from that tree. */
export function writePackageExportProbe(
  directory: string,
  exports: PackageConsumerExports,
): string {
  const file = path.join(directory, "package-exports.mjs");
  fs.writeFileSync(
    file,
    [
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
      `for (const specifier of ${JSON.stringify(exports.imports)}) await import(specifier);`,
      `for (const specifier of ${JSON.stringify(exports.commonJsImports)}) require(specifier);`,
      `for (const specifier of ${JSON.stringify(exports.jsonImports)}) await import(specifier, { with: { type: "json" } });`,
      "",
    ].join("\n"),
  );
  return file;
}
