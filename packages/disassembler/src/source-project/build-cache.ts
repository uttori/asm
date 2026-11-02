import fs from "node:fs";
import path from "node:path";

/**
 * Accepts a JSON object. Arrays and null are not build receipts.
 * @param value Parsed JSON.
 * @returns True when `value` is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads an optional receipt string. A non-string field is not a receipt this pruner owns.
 * @param record Parsed receipt.
 * @param key Field name.
 * @returns The string field, or undefined when absent.
 */
function receiptString(record: Record<string, unknown>, key: string): string | undefined {
  const field = record[key];
  if (field === undefined) {
    return undefined;
  }
  if (typeof field !== "string") {
    throw new Error("unrecognized build receipt");
  }
  return field;
}

/**
 * Reclaim interrupted attempts before another write, preserving the actual current pair.
 * Unrecognized current pointers defer cleanup until a successful publication establishes ownership.
 */
export function prunePriorSourceBuilds(
  directory: string,
  incoming: string,
  fileName: string,
): string[] {
  const pointer = path.join(directory, "current.json");
  let current = incoming;
  if (fs.existsSync(pointer)) {
    try {
      const stat = fs.lstatSync(pointer);
      if (!stat.isFile() || stat.size > 16 * 1024 * 1024) {
        return [];
      }
      const parsed: unknown = JSON.parse(fs.readFileSync(pointer, "utf8"));
      if (!isRecord(parsed)) {
        return [];
      }
      const id = receiptString(parsed, "inputSha256");
      if (
        !id ||
        !/^[\da-f]{64}$/.test(id) ||
        receiptString(parsed, "outputFile") !== path.join(directory, id, fileName) ||
        receiptString(parsed, "debugMapFile") !== path.join(directory, id, `${fileName}.debug.json`)
      ) {
        return [];
      }
      current = id;
    } catch {
      return [];
    }
  }
  return pruneSourceBuilds(directory, current, fileName);
}

/**
 * Prune only owned build artifacts while the caller holds the publication lease. The current
 * complete pair is the sole cached generation; failed publications retain a pending identity.
 * Unknown files, symlinks and malformed ownership records are left alone and reported, never swept.
 */
export function pruneSourceBuilds(directory: string, current: string, fileName: string): string[] {
  const warnings: string[] = [];
  const ownedNames = new Set([
    fileName,
    `${fileName}.debug.json`,
    "build.json",
    "pending.json",
    "owner.json",
    ".DS_Store",
  ]);
  const candidates: { path: string; hash: string }[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[\da-f]{64}$/.test(entry.name) || entry.name === current) {
      continue;
    }
    const root = path.join(directory, entry.name);
    try {
      const files = fs.readdirSync(root);
      if (
        files.some(
          (file) =>
            !ownedNames.has(file.replace(/\.[\da-f-]{36}\.tmp$/, "")) ||
            !fs.lstatSync(path.join(root, file)).isFile(),
        )
      ) {
        throw new Error("unexpected file or symlink");
      }
      // New builds have a small ownership identity independent of their source inventory.
      // Legacy receipts can contain thousands of inputs; the old 64 KiB cap stranded them.
      const owned = files.includes("owner.json");
      let receiptName = "pending.json";
      if (owned) {
        receiptName = "owner.json";
      } else if (files.includes("build.json")) {
        receiptName = "build.json";
      }
      const receipt = path.join(root, receiptName);
      const stat = fs.statSync(receipt);
      const limit = owned ? 4096 : 16 * 1024 * 1024;
      if (stat.size > limit) {
        throw new Error("oversized build receipt");
      }
      const parsed: unknown = JSON.parse(fs.readFileSync(receipt, "utf8"));
      if (!isRecord(parsed)) {
        throw new Error("unrecognized build receipt");
      }
      if (owned && parsed.format !== "uttori-source-build-owner-v1") {
        throw new Error("unrecognized build owner");
      }
      const value = {
        inputSha256: receiptString(parsed, "inputSha256"),
        outputFile: receiptString(parsed, "outputFile"),
        debugMapFile: receiptString(parsed, "debugMapFile"),
      };
      if (
        value.inputSha256 !== entry.name ||
        value.outputFile !== path.join(root, fileName) ||
        value.debugMapFile !== path.join(root, `${fileName}.debug.json`)
      ) {
        throw new Error("unrecognized build receipt");
      }
      candidates.push({ path: root, hash: entry.name });
    } catch (error) {
      if (warnings.length < 10) {
        warnings.push(`Retained unknown build cache ${entry.name}: ${String(error)}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      // Finder may recreate its metadata during recursive deletion. The bounded
      // retry prevents an otherwise empty owned cache from becoming stranded.
      fs.rmSync(candidate.path, { recursive: true, maxRetries: 3, retryDelay: 20 });
    } catch (error) {
      if (warnings.length < 10) {
        warnings.push(`Could not remove retired build ${candidate.hash}: ${String(error)}`);
      }
    }
  }
  return warnings;
}
