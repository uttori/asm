import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  AssemblyDiagnostic,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolReference,
} from "../diagnostics.js";
import { incrementInternalCounter, measureInternalPhase } from "../internal-instrumentation.js";

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
  /** Per-file mtime (ms since epoch) recorded when the cache was written. Used
   * as a cheap first-pass check before SHA-256 re-hashing on cache reads. */
  fileMtimes: Record<string, number>;
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
   *
   * Uses a two-tier validation strategy:
   * 1. For each file, check mtime first (cheap `statSync`). Files whose mtime
   *    is unchanged are presumed unmodified and their stored hash is reused.
   * 2. Only files whose mtime changed (or whose mtime is missing from the
   *    payload) are re-read and SHA-256 hashed.
   *
   * This avoids reading and hashing every include file on every startup when
   * the project has not changed — the common case for warm LSP restarts.
   *
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
      const payload = measureInternalPhase(
        "cacheDeserialize",
        () => JSON.parse(readFileSync(file, "utf8")) as CachePayload,
      );
      if (payload.version !== CACHE_VERSION || payload.root !== path.resolve(root)) {
        return undefined;
      }
      if (!identitiesMatch(payload.identity, identity)) {
        return undefined;
      }
      const recordedFiles = Object.keys(payload.fileHashes).sort();
      const currentHashes: Record<string, string> = {};
      for (const recorded of recordedFiles) {
        const recordedHash = payload.fileHashes[recorded];
        const recordedMtime = payload.fileMtimes?.[recorded];

        // Fast-path: if the file's mtime matches the stored value, the file
        // has not been modified. Reuse the stored hash without reading the file.
        if (recordedMtime !== undefined) {
          try {
            const currentMtime = statSync(recorded).mtimeMs;
            if (currentMtime === recordedMtime) {
              currentHashes[recorded] = recordedHash;
              continue;
            }
          } catch {
            // File is missing or unreadable; fall through to hashFile which
            // returns undefined and will cause a cache miss below.
          }
        }

        // Slow-path: mtime changed or was not recorded — re-hash the file.
        const hash = hashFile(recorded);
        if (hash === undefined || hash !== recordedHash) {
          return undefined;
        }
        currentHashes[recorded] = hash;
      }
      if (fingerprintForSorted(currentHashes) !== payload.fingerprint) {
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
   * @param {Record<string, number>} fileMtimes Sorted path-to-mtime map.
   * @param {CachedRootAnalysis} analysis Artifacts to store.
   */
  write(
    root: string,
    identity: RootAnalysisCacheIdentity,
    fileHashes: Record<string, string>,
    fileMtimes: Record<string, number>,
    analysis: CachedRootAnalysis,
  ): void {
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      const payload: CachePayload = {
        version: CACHE_VERSION,
        root: path.resolve(root),
        fingerprint: fingerprintForSorted(fileHashes),
        identity: {
          target: identity.target,
          architecture: identity.architecture,
          includePaths: [...identity.includePaths],
        },
        fileHashes,
        fileMtimes,
        analysis,
      };
      const json = measureInternalPhase("cacheSerialize", () => JSON.stringify(payload));
      measureInternalPhase("cacheDiskWrite", () => writeFileSync(this.entryPath(root), json));
      incrementInternalCounter("cacheWriteBytes", json.length);
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
 * SHA-256 of already-sorted `path:hash` pairs. Skips the sort for callers
 * that guarantee the input is already in ascending key order.
 * @param {Record<string, string>} sortedFileHashes Sorted path-to-hash map.
 * @returns {string} Hex digest.
 */
function fingerprintForSorted(sortedFileHashes: Record<string, string>): string {
  const material = Object.entries(sortedFileHashes)
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
