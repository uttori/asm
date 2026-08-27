import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  AssemblyDiagnostic,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolReference,
} from "../diagnostics.js";

/** Serialized per-root analysis artifacts persisted between sessions. */
export type CachedRootAnalysis = {
  followedIncludes: boolean;
  diagnostics: AssemblyDiagnostic[];
  symbols: AssemblySymbolDefinition[];
  references: AssemblySymbolReference[];
  includeEdges: AssemblyIncludeEdge[];
};

/** Assembler settings that must match for a cache entry to be reused. */
export type RootAnalysisCacheIdentity = {
  target: string;
  architecture: string;
  includePaths: readonly string[];
};

const CACHE_VERSION = 1;

type CachePayload = {
  version: number;
  root: string;
  fingerprint: string;
  identity: RootAnalysisCacheIdentity;
  fileHashes: Record<string, string>;
  analysis: CachedRootAnalysis;
};

/**
 * Disk-backed cache of full-pass workspace analysis artifacts.
 *
 * Entries are keyed by root path. A hit requires the stored file-content
 * fingerprint and assembler identity (target/arch/include paths) to match.
 */
export class RootAnalysisCache {
  readonly cacheDir: string;

  /**
   * @param {string} cacheDir Absolute directory used to store cache JSON files.
   */
  constructor(cacheDir: string) {
    this.cacheDir = path.resolve(cacheDir);
  }

  /**
   * Loads a cached analysis when every recorded file hash still matches.
   * @param {string} root Absolute root source path.
   * @param {RootAnalysisCacheIdentity} identity Current assembler identity.
   * @param {(file: string) => string | undefined} hashFile Content hasher.
   * @returns {CachedRootAnalysis | undefined} The cached artifacts, or undefined on miss.
   */
  read(
    root: string,
    identity: RootAnalysisCacheIdentity,
    hashFile: (file: string) => string | undefined,
  ): CachedRootAnalysis | undefined {
    const file = this.entryPath(root);
    if (!existsSync(file)) {
      return undefined;
    }
    try {
      const payload = JSON.parse(readFileSync(file, "utf8")) as CachePayload;
      if (payload.version !== CACHE_VERSION || payload.root !== path.resolve(root)) {
        return undefined;
      }
      if (!identitiesMatch(payload.identity, identity)) {
        return undefined;
      }
      const currentHashes: Record<string, string> = {};
      for (const recorded of Object.keys(payload.fileHashes).sort()) {
        const hash = hashFile(recorded);
        if (hash === undefined || hash !== payload.fileHashes[recorded]) {
          return undefined;
        }
        currentHashes[recorded] = hash;
      }
      if (fingerprintFor(currentHashes) !== payload.fingerprint) {
        return undefined;
      }
      return payload.analysis;
    } catch {
      return undefined;
    }
  }

  /**
   * Persists a full-pass analysis. Failures are ignored so a cache write can
   * never block or break the language server.
   * @param {string} root Absolute root source path.
   * @param {RootAnalysisCacheIdentity} identity Current assembler identity.
   * @param {Record<string, string>} fileHashes Sorted path-to-hash map.
   * @param {CachedRootAnalysis} analysis Artifacts to store.
   */
  write(
    root: string,
    identity: RootAnalysisCacheIdentity,
    fileHashes: Record<string, string>,
    analysis: CachedRootAnalysis,
  ): void {
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      const payload: CachePayload = {
        version: CACHE_VERSION,
        root: path.resolve(root),
        fingerprint: fingerprintFor(fileHashes),
        identity: {
          target: identity.target,
          architecture: identity.architecture,
          includePaths: [...identity.includePaths],
        },
        fileHashes,
        analysis,
      };
      writeFileSync(this.entryPath(root), JSON.stringify(payload));
    } catch {
      // Cache is a speed optimization; a write failure must not surface to the user.
    }
  }

  /**
   * Deletes the cache entry for a root, if present.
   * @param {string} root Absolute root source path.
   */
  invalidate(root: string): void {
    try {
      unlinkSync(this.entryPath(root));
    } catch {
      // Missing files are already a miss.
    }
  }

  /**
   * @param {string} root Absolute root source path.
   * @returns {string} Cache JSON path for the root.
   */
  entryPath(root: string): string {
    const id = createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 32);
    return path.join(this.cacheDir, `${id}.json`);
  }
}

/**
 * SHA-256 of the sorted `path:hash` pairs. Used as the cache-entry fingerprint.
 * @param {Record<string, string>} fileHashes Path-to-content-hash map.
 * @returns {string} Hex digest.
 */
export function fingerprintFor(fileHashes: Record<string, string>): string {
  const material = Object.entries(fileHashes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, hash]) => `${file}:${hash}`)
    .join("\n");
  return createHash("sha256").update(material).digest("hex");
}

/**
 * SHA-256 of file bytes.
 * @param {Uint8Array} bytes File contents.
 * @returns {string} Hex digest.
 */
export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function identitiesMatch(
  stored: RootAnalysisCacheIdentity,
  current: RootAnalysisCacheIdentity,
): boolean {
  if (stored.target !== current.target || stored.architecture !== current.architecture) {
    return false;
  }
  const left = [...stored.includePaths].sort();
  const right = [...current.includePaths].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
