import fs from "node:fs";
import path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";

/**
 * Portable debug map and local artifact/root paths used to rank source layouts; the configured
 * root wins ties.
 */
export interface ResolveDebugSourceRootOptions {
  readonly map: DebugMap;
  readonly configuredRoot: string;
  readonly debugMapFile: string;
  readonly programFile: string;
  readonly workspaceRoot?: string;
}

/**
 * Score a relative map path only when it stays under the candidate root and names a file of the
 * recorded byte size.
 * Returns false for absolute paths or filesystem failures; this layout check does not verify
 * content hashes.
 * @param {string} root Candidate absolute source root.
 * @param {DebugMap["sources"][number]} source Portable map path and recorded byte size.
 * @returns {boolean} Whether an in-root file has the expected size; no content hash is checked.
 */
const sourceMatches = (root: string, source: DebugMap["sources"][number]): boolean => {
  // Absolute map paths already identify their files and cannot help choose a portable root.
  if (path.isAbsolute(source.path)) {
    return false;
  }
  const resolved = path.resolve(root, source.path);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return false;
  }
  try {
    const stat = fs.statSync(resolved);
    return stat.isFile() && stat.size === source.size;
  } catch {
    return false;
  }
};

/**
 * Chooses the source root whose on-disk files best match the portable debug-map paths.
 * The configured root wins ties. Adjacent artifact parents support projects opened from above.
 * @param {ResolveDebugSourceRootOptions} options Map, artifacts, and candidate roots.
 * @returns {string} Absolute source root with the most matching mapped files.
 */
export const resolveDebugSourceRoot = (options: ResolveDebugSourceRootOptions): string => {
  const configuredRoot = path.resolve(options.configuredRoot);
  const candidates = [
    configuredRoot,
    ...(options.workspaceRoot ? [path.resolve(options.workspaceRoot)] : []),
    path.dirname(path.resolve(options.debugMapFile)),
    // Generated ROMs/maps commonly live in build/, with mapped sources in its parent.
    path.dirname(path.dirname(path.resolve(options.debugMapFile))),
    path.dirname(path.resolve(options.programFile)),
    path.dirname(path.dirname(path.resolve(options.programFile))),
  ];
  const unique = [...new Set(candidates)];
  // Stat and size checks are enough to distinguish candidate layouts without reading or
  // hashing every source. Bound the sample so opening a large map has predictable latency.
  const relativeSources = options.map.sources
    .filter((source) => !path.isAbsolute(source.path))
    .slice(0, 128);
  if (relativeSources.length === 0) {
    return configuredRoot;
  }
  let bestRoot = configuredRoot;
  let bestMatches = relativeSources.filter((source) =>
    sourceMatches(configuredRoot, source),
  ).length;
  for (const candidate of unique.slice(1)) {
    const matches = relativeSources.filter((source) => sourceMatches(candidate, source)).length;
    // Deliberately keep the configured root on ties: inference should override an explicit
    // launch setting only when another layout has stronger on-disk evidence.
    if (matches > bestMatches) {
      bestRoot = candidate;
      bestMatches = matches;
    }
  }
  return bestRoot;
};
