import { createHash } from "node:crypto";

import type { AssemblyLinkRecipe } from "@uttori/asm-core";

import type { RomIdentity } from "../model/rom-image.js";

/** Format of the pure renderer's in-memory inventory. */
export const SOURCE_EXPORT_FORMAT = "uttori-asm-source-export";
/** Current in-memory render inventory schema. */
export const SOURCE_EXPORT_SCHEMA_VERSION = 1;

/** Kind of a generated export file. `configuration` covers generated schemas and reports, not the editable build config. */
export type SourceExportFileKind = "source" | "asset" | "configuration";
/**
 * Role of a contiguous ROM span in the export.
 * `code` is a reconstructed instruction. A `raw` role can also contain typed data or converted
 * asset includes; build emission metadata determines conversion progress.
 */
export type SourceExportSpanRole =
  | "code"
  | "raw"
  | "padding"
  | "snes-header"
  | "vectors"
  | "copier-header";

/** One rendered file supplied to the caller's immutable generation sink. */
export interface SourceExportFile {
  /** Path relative to the export directory. Must not contain `..`. */
  readonly path: string;
  readonly kind: SourceExportFileKind;
  readonly size: number;
  /** SHA-256 of the file bytes as written. Used to verify immutable generation payloads. */
  readonly sha256: string;
}

/** User-owned input consumed while generating the source tree. */
export interface SourceExportInput {
  /** Path relative to the export directory. Must not contain `..`. */
  readonly path: string;
  readonly kind: "metadata" | "configuration";
  readonly size: number;
  /** Optional logical record count for status/reporting. */
  readonly records?: number;
  /** SHA-256 of the exact input bytes consumed by the export. */
  readonly sha256: string;
}

/** Half-open ROM interval mapped to a generated source or asset file. */
export interface SourceExportSpan {
  readonly id: string;
  /** Provenance: typically `"analysis"` for code or `"rom"` for assets. */
  readonly source: string;
  readonly addressSpace: string;
  readonly start: number;
  /** Exclusive end. */
  readonly end: number;
  readonly role: SourceExportSpanRole;
  /** Relative path of the file that covers this span. */
  readonly file: string;
  /** CFG node ids that justified a `code` span. */
  readonly nodeIds?: readonly string[];
  /** Analysis-region ids overlapping this span. */
  readonly regionIds?: readonly string[];
}

/** Deterministic in-memory render inventory; Git generation commits own persistence. */
export interface SourceExportManifest {
  /** Optional object-producer entry and layout input. Absolute exports retain their existing inventory. */
  readonly relocatable?: {
    readonly moduleId: string;
    readonly entrySource: string;
    readonly linkRecipe: AssemblyLinkRecipe;
  };
  readonly format: typeof SOURCE_EXPORT_FORMAT;
  readonly schemaVersion: typeof SOURCE_EXPORT_SCHEMA_VERSION;
  readonly target: string;
  readonly architecture: string;
  readonly mapper: string;
  /** Revision-token hash of the producing project. Generation preparation binds this to the research and evidence snapshot. */
  readonly sourceProjectSha256: string;
  readonly rom: RomIdentity;
  /** Relative path of the assembler entry file, usually `main.asm`. */
  readonly entrySource: string;
  /** Relative path of the assembler config used to rebuild. */
  readonly buildConfiguration: string;
  /** Headerless rebuilt image path. */
  readonly contentOutput: string;
  /** Final image path (content plus optional copier header). */
  readonly finalOutput: string;
  /** Rebuilds must keep the original checksum bytes. They are never recomputed. */
  readonly checksumPolicy: "preserve";
  /** Inputs consumed by this render. */
  readonly inputs?: readonly SourceExportInput[];
  readonly files: readonly SourceExportFile[];
  readonly spans: readonly SourceExportSpan[];
}

/**
 * SHA-256 of UTF-8 text or raw bytes, hex-encoded.
 * @param {string | Uint8Array} value Content to hash.
 * @returns {string} 64-character lowercase hex digest.
 */
export const sourceExportSha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

/** Byte-level comparison. Offsets are zero-based within the supplied arrays. */
export interface ByteComparison {
  /** True when lengths and every byte match. */
  readonly equal: boolean;
  readonly expectedLength: number;
  readonly actualLength: number;
  readonly expectedSha256: string;
  readonly actualSha256: string;
  /** First mismatched index, or the shorter length when sizes differ. Omitted when equal. */
  readonly firstDifference?: number;
}

/**
 * Compares two images without throwing. Used for round-trip rebuild reports.
 * @param {Uint8Array} expected Source ROM content (or other oracle).
 * @param {Uint8Array} actual Rebuilt bytes.
 * @returns {ByteComparison} Equality, hashes, and first mismatch index.
 */
export const compareByteImages = (expected: Uint8Array, actual: Uint8Array): ByteComparison => {
  const common = Math.min(expected.length, actual.length);
  let firstDifference: number | undefined;
  for (let index = 0; index < common; index++) {
    if (expected[index] !== actual[index]) {
      firstDifference = index;
      break;
    }
  }
  if (firstDifference === undefined && expected.length !== actual.length) {
    firstDifference = common;
  }
  return {
    equal: firstDifference === undefined,
    expectedLength: expected.length,
    actualLength: actual.length,
    expectedSha256: sourceExportSha256(expected),
    actualSha256: sourceExportSha256(actual),
    ...(firstDifference === undefined ? {} : { firstDifference }),
  };
};
