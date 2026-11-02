import path from "node:path";

import type { AddressToLineMapping } from "@uttori/asm-core";

import { sourceContentHash } from "../internal/source-inputs.js";

/** Conversion progress over the immutable original ROM, excluding any newly added capacity. */
export interface SourceBuildCoverage {
  /** Content hash of the immutable original ROM used for the coverage contract. */
  readonly romSha256: string;
  /** Byte length of that original ROM, excluding any expanded output capacity. */
  readonly totalBytes: number;
  /** Unique original bytes still consumed through raw-block includes, even after relocation. */
  readonly remainingBytes: number;
  /** Bytes represented by instructions, structured data, or converted assets. */
  readonly convertedBytes: number;
}

/** Small selected-build projection; dependency hashes remain in that build's full receipt. */
export interface SourceBuildSummary {
  /** Receipt schema version for persisted build summaries. */
  readonly version: 1;
  /** Content hash of the selected build inputs recorded in the full receipt. */
  readonly inputSha256: string;
  /** Absent for builds without an original-ROM raw-block contract. */
  readonly coverage?: SourceBuildCoverage;
}

/** Narrow parsed JSON to a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate persisted totals before presenting them as conversion progress. */
export function isSourceBuildCoverage(value: unknown): value is SourceBuildCoverage {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;
  return (
    typeof record.romSha256 === "string" &&
    /^[\da-f]{64}$/.test(record.romSha256) &&
    [record.totalBytes, record.remainingBytes, record.convertedBytes].every(
      (count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0,
    ) &&
    Number(record.remainingBytes) + Number(record.convertedBytes) === record.totalBytes
  );
}

/**
 * Count original bytes still included from the declared raw-block directory. Ordinary binary
 * assets do not count as unconverted. Input slices, rather than output placement or file sizes,
 * keep repeated includes, relocation, unused blocks and expanded ROM capacity from skewing totals.
 * Missing slice metadata fails instead of reporting misleading complete conversion.
 */
export function sourceBuildCoverage(
  mapping: AddressToLineMapping,
  root: string,
  raw: { readonly directory: string; readonly original: Uint8Array; readonly blockSize: number },
): SourceBuildCoverage {
  if (!Number.isSafeInteger(raw.blockSize) || raw.blockSize < 1 || raw.blockSize > 65536) {
    throw new Error("Invalid coverage raw-block size.");
  }
  const directory = path.resolve(root, raw.directory);
  const blocks = new Map<string, number>();
  for (let start = 0; start < raw.original.length; start += raw.blockSize) {
    blocks.set(path.join(directory, `${start.toString(16).padStart(6, "0")}.bin`), start);
  }
  const ranges: { start: number; end: number }[] = [];
  for (const asset of mapping.assets) {
    if (asset.format !== "raw") {
      continue;
    }
    const file =
      Number.isSafeInteger(asset.assetFileIdx) &&
      asset.assetFileIdx >= 0 &&
      asset.assetFileIdx < mapping.fileList.length
        ? mapping.fileList[asset.assetFileIdx]
        : undefined;
    if (!file) {
      throw new Error("Coverage refers to a missing binary dependency.");
    }
    const block = blocks.get(path.resolve(root, file.name));
    if (block === undefined) {
      continue;
    }
    const { inputStart, inputEnd } = asset;
    const length = Math.min(raw.blockSize, raw.original.length - block);
    if (
      inputStart === undefined ||
      inputEnd === undefined ||
      !Number.isSafeInteger(inputStart) ||
      !Number.isSafeInteger(inputEnd) ||
      inputStart < 0 ||
      inputEnd < inputStart ||
      inputEnd > length ||
      inputEnd - inputStart !== asset.size
    ) {
      throw new Error("Coverage requires exact, bounded raw-block input slices.");
    }
    ranges.push({ start: block + inputStart, end: block + inputEnd });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  let remainingBytes = 0;
  let through = 0;
  // The same original slice may be included more than once at different output addresses.
  for (const { start, end } of ranges) {
    remainingBytes += Math.max(0, end - Math.max(through, start));
    through = Math.max(through, end);
  }
  return {
    romSha256: sourceContentHash(raw.original),
    totalBytes: raw.original.length,
    remainingBytes,
    convertedBytes: raw.original.length - remainingBytes,
  };
}
