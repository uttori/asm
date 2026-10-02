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
  /** Binary and resource inputs are dependencies, never assembly source files. */
  assetDependencies: Readonly<Record<string, "binary" | "resource">>;
};

/** Assembler settings that must match for a cache entry to be reused. */
export type RootAnalysisCacheIdentity = {
  target: string;
  architecture: string;
  includePaths: readonly string[];
  /** Converter IDs and versions invalidate cached analysis even when files are unchanged. */
  converterIdentity: string;
  /** Target settings can affect active conversion and symbol layout. */
  targetOptionsIdentity: string;
};

// Older entries flattened multiline records and cannot safely supply rename ranges.
const CACHE_VERSION = 4;

type CachePayload = {
  version: number;
  root: string;
  fingerprint: string;
  identity: RootAnalysisCacheIdentity;
  fileHashes: Record<string, string>;
  /** Per-file mtime (ms since epoch) recorded when the cache was written. Used
   * as a cheap first-pass check before SHA-256 re-hashing on cache reads.
   * Absent on entries written before mtimes were stored. */
  fileMtimes?: Partial<Record<string, number>>;
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
   * 1. For assembly source, check mtime first (cheap `statSync`). Files whose
   *    mtime is unchanged reuse their stored hash.
   * 2. Hash binary resources on every read, even when mtime is unchanged;
   *    generated assets may be replaced while preserving timestamps.
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
      const payload = measureInternalPhase("cacheDeserialize", (): unknown =>
        JSON.parse(readFileSync(file, "utf8")),
      );
      if (!isCachePayload(payload)) {
        return undefined;
      }
      if (payload.version !== CACHE_VERSION || payload.root !== path.resolve(root)) {
        return undefined;
      }
      if (!identitiesMatch(payload.identity, identity)) {
        return undefined;
      }
      const recordedFiles = Object.keys(payload.fileHashes).toSorted();
      const currentHashes: Record<string, string> = {};
      for (const recorded of recordedFiles) {
        const recordedHash = payload.fileHashes[recorded];
        const recordedMtime = payload.fileMtimes?.[recorded];

        // Source files use the mtime fast path. Binary inputs always rehash so
        // copy tools that preserve timestamps cannot leave a stale dependency graph.
        if (
          recordedMtime !== undefined &&
          !Object.hasOwn(payload.analysis.assetDependencies, recorded)
        ) {
          try {
            const currentMtime = statSync(recorded).mtimeMs;
            if (currentMtime === recordedMtime) {
              currentHashes[recorded] = recordedHash;
              continue;
            }
          } catch {
            // File is missing or unreadable. Fall through to hashFile which
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
          converterIdentity: identity.converterIdentity,
          targetOptionsIdentity: identity.targetOptionsIdentity,
        },
        fileHashes,
        fileMtimes,
        analysis,
      };
      const json = measureInternalPhase("cacheSerialize", () => JSON.stringify(payload));
      measureInternalPhase("cacheDiskWrite", () => writeFileSync(this.entryPath(root), json));
      incrementInternalCounter("cacheWriteBytes", json.length);
    } catch {
      // Cache is a speed optimization. A write failure must not surface to the user.
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
    .toSorted(([left], [right]) => left.localeCompare(right))
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

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function isNumberRecord(value: unknown): value is Partial<Record<string, number>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "number")
  );
}

function isCacheIdentity(value: unknown): value is RootAnalysisCacheIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    "target" in value &&
    typeof value.target === "string" &&
    "architecture" in value &&
    typeof value.architecture === "string" &&
    "converterIdentity" in value &&
    typeof value.converterIdentity === "string" &&
    "targetOptionsIdentity" in value &&
    typeof value.targetOptionsIdentity === "string" &&
    "includePaths" in value &&
    isUnknownArray(value.includePaths) &&
    value.includePaths.every((entry) => typeof entry === "string")
  );
}

function isCachedAnalysis(value: unknown): value is CachedRootAnalysis {
  return (
    typeof value === "object" &&
    value !== null &&
    "followedIncludes" in value &&
    typeof value.followedIncludes === "boolean" &&
    "diagnostics" in value &&
    isUnknownArray(value.diagnostics) &&
    "symbols" in value &&
    isUnknownArray(value.symbols) &&
    "references" in value &&
    isUnknownArray(value.references) &&
    "includeEdges" in value &&
    isUnknownArray(value.includeEdges) &&
    "assetDependencies" in value &&
    typeof value.assetDependencies === "object" &&
    value.assetDependencies !== null &&
    !Array.isArray(value.assetDependencies)
  );
}

function isCachePayload(value: unknown): value is CachePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "number" &&
    "root" in value &&
    typeof value.root === "string" &&
    "fingerprint" in value &&
    typeof value.fingerprint === "string" &&
    "identity" in value &&
    isCacheIdentity(value.identity) &&
    "fileHashes" in value &&
    isStringRecord(value.fileHashes) &&
    "analysis" in value &&
    isCachedAnalysis(value.analysis) &&
    (!("fileMtimes" in value) || value.fileMtimes === undefined || isNumberRecord(value.fileMtimes))
  );
}

function identitiesMatch(
  stored: RootAnalysisCacheIdentity,
  current: RootAnalysisCacheIdentity,
): boolean {
  if (stored.target !== current.target || stored.architecture !== current.architecture) {
    return false;
  }
  if (stored.converterIdentity !== current.converterIdentity) {
    return false;
  }
  if (stored.targetOptionsIdentity !== current.targetOptionsIdentity) {
    return false;
  }
  const left = [...stored.includePaths].toSorted();
  const right = [...current.includePaths].toSorted();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
