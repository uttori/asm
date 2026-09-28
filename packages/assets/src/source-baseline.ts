import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Portable file fingerprint; paths are relative to a caller-selected project root. */
export interface AssetSourceFingerprint {
  readonly path: string;
  /** Exact byte count, independent of text encoding or filesystem allocation. */
  readonly size: number;
  /** Lowercase hexadecimal digest of the complete file contents. */
  readonly sha256: string;
}

/** Persistent editing-session baseline. Identity includes the host's project/codec revision. */
export interface AssetSourceBaseline {
  readonly version: 1;
  readonly identity: string;
  readonly files: readonly AssetSourceFingerprint[];
}

/** Reject platform-dependent aliases and paths that escape a selected source root.
 * @param {string} name Portable project-relative path.
 * @returns {string} Validated path, unchanged.
 */
export function assetRelativePath(name: string): string {
  if (
    typeof name !== "string" ||
    !name ||
    /[\0:\\]/.test(name) ||
    name.startsWith("/") ||
    name.split("/").some((p) => !p || p === "." || p === "..")
  ) {
    throw new Error(`Invalid project-relative asset path: ${name}.`);
  }
  return name;
}

/** Reject symlinks in every path component, including the selected root.
 * @param {string} root Existing source directory.
 * @param {string} name Project-relative path to an existing regular file.
 * @returns {string} Host absolute path whose components were checked.
 */
export function assetSourcePath(root: string, name: string): string {
  assetRelativePath(name);
  if (!fs.lstatSync(root).isDirectory()) {
    throw new Error("Asset root must be a real directory.");
  }
  let current = fs.realpathSync(root);
  const parts = name.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (
      info.isSymbolicLink() ||
      (index === parts.length - 1 ? !info.isFile() : !info.isDirectory())
    ) {
      throw new Error(`Non-regular asset path: ${name}.`);
    }
  }
  return current;
}

/** Fingerprint supplied source bytes; no root or machine-specific path is persisted.
 * @param {string} identity Host-selected project and adapter revision identity.
 * @param {ReadonlyMap<string, Uint8Array>} sources Exact bytes captured at export time.
 * @returns {AssetSourceBaseline} JSON-serializable snapshot, independent of subsequent buffer edits.
 */
export function createAssetSourceBaseline(
  identity: string,
  sources: ReadonlyMap<string, Uint8Array>,
): AssetSourceBaseline {
  if (typeof identity !== "string" || !identity) {
    throw new Error("Asset baseline requires an identity.");
  }
  return {
    version: 1,
    identity,
    files: [...sources]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => ({
        path: assetRelativePath(name),
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      })),
  };
}

/** Validate a persisted baseline before reading any of its paths.
 * @param {unknown} value Untrusted parsed JSON.
 * @returns {AssetSourceBaseline} Validated version-one baseline.
 */
export function parseAssetSourceBaseline(value: unknown): AssetSourceBaseline {
  const baseline = value as AssetSourceBaseline;
  if (
    !baseline ||
    baseline.version !== 1 ||
    typeof baseline.identity !== "string" ||
    !baseline.identity ||
    !Array.isArray(baseline.files)
  ) {
    throw new Error("Invalid asset baseline.");
  }
  const seen = new Set<string>();
  for (const file of baseline.files as readonly AssetSourceFingerprint[]) {
    if (
      !file ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[\da-f]{64}$/.test(file.sha256)
    ) {
      throw new Error("Invalid asset fingerprint.");
    }
    assetRelativePath(file.path);
    if (seen.has(file.path)) {
      throw new Error(`Duplicate baseline path: ${file.path}.`);
    }
    seen.add(file.path);
  }
  return baseline;
}

/** Detect edits made since export, not merely since the current import command started.
 * @param {string} root Current source directory or an unchanged relocated copy.
 * @param {AssetSourceBaseline} input Persisted baseline, revalidated before use.
 * @param {string} identity Expected project/adapter identity supplied independently by the host.
 * @returns {void} Throws with every stale or missing dependency before publication.
 */
export function assertAssetSourceBaseline(
  root: string,
  input: AssetSourceBaseline,
  identity: string,
): void {
  const baseline = parseAssetSourceBaseline(input);
  if (baseline.identity !== identity) {
    throw new Error("Asset baseline belongs to a different project or adapter revision.");
  }
  const changed: string[] = [];
  for (const file of baseline.files) {
    try {
      const bytes = fs.readFileSync(assetSourcePath(root, file.path));
      if (
        bytes.length !== file.size ||
        createHash("sha256").update(bytes).digest("hex") !== file.sha256
      ) {
        changed.push(file.path);
      }
    } catch {
      changed.push(file.path);
    }
  }
  if (changed.length) {
    throw new Error(`Stale asset baseline: ${changed.join(", ")}.`);
  }
}
