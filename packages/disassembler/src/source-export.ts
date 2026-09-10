import { createHash } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "./canonical-json.js";
import type { RomIdentity } from "./rom-image.js";

/** Manifest `format` field for a generated source-export tree. */
export const SOURCE_EXPORT_FORMAT = "uttori-asm-source-export";
/** Current source-export manifest schema; unknown versions are rejected on load. */
export const SOURCE_EXPORT_SCHEMA_VERSION = 1;
/** Filename of the export manifest written next to `main.asm`. */
export const SOURCE_EXPORT_MANIFEST = "generated-files.json";

/** Kind of a generated export file. `asset` is an `incbin` blob; `source` is assembler text. */
export type SourceExportFileKind = "source" | "asset" | "configuration";
/**
 * Role of a contiguous ROM span in the export.
 * `code` is a reconstructed instruction; everything else is emitted as a binary asset.
 */
export type SourceExportSpanRole =
  | "code"
  | "raw"
  | "padding"
  | "snes-header"
  | "vectors"
  | "copier-header";

/** One generated file recorded in `generated-files.json`. */
export interface SourceExportFile {
  /** Path relative to the export directory; must not contain `..`. */
  readonly path: string;
  readonly kind: SourceExportFileKind;
  readonly size: number;
  /** SHA-256 of the file bytes as written; used to detect post-export edits. */
  readonly sha256: string;
}

/** User-owned input consumed while generating the source tree. */
export interface SourceExportInput {
  /** Path relative to the export directory; must not contain `..`. */
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

/** Deterministic rebuild contract written as `generated-files.json`. */
export interface SourceExportManifest {
  readonly format: typeof SOURCE_EXPORT_FORMAT;
  readonly schemaVersion: typeof SOURCE_EXPORT_SCHEMA_VERSION;
  readonly target: string;
  readonly architecture: string;
  readonly mapper: string;
  /** SHA-256 of the analysis project that produced this export. */
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
  /** Rebuilds must keep the original checksum bytes; they are never recomputed. */
  readonly checksumPolicy: "preserve";
  /** User-owned inputs whose drift makes generated source stale without blocking regeneration. */
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

/**
 * Deterministic JSON: sorted object keys, dropped `undefined`, trailing newline.
 * @param {unknown} value Manifest or config object.
 * @returns {string} Canonical JSON text.
 */
export const canonicalSourceExportJson = (value: unknown): string => canonicalJson(value);

/**
 * Asserts that a path is safe for use in a source export manifest.
 * @param {string} relative The path to assert.
 * @returns {void}
 */
const assertSafePath = (relative: string): void => {
  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative.split(/[/\\]/).some((part) => part === ".." || part === "")
  ) {
    throw new Error(`Unsafe generated-file path '${relative}'.`);
  }
};

/**
 * Loads `generated-files.json` and checks format, schema, unique safe paths, and span bounds.
 * @param {string} directory Export directory containing the manifest.
 * @returns {SourceExportManifest} Validated manifest.
 */
export const loadSourceExportManifest = (directory: string): SourceExportManifest => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, SOURCE_EXPORT_MANIFEST), "utf8"),
  ) as SourceExportManifest;
  if (manifest.format !== SOURCE_EXPORT_FORMAT) throw new Error("Invalid source-export format.");
  if (manifest.schemaVersion !== SOURCE_EXPORT_SCHEMA_VERSION) {
    throw new Error(`Unsupported source-export schema ${String(manifest.schemaVersion)}.`);
  }
  const paths = new Set<string>();
  for (const file of manifest.files) {
    assertSafePath(file.path);
    if (paths.has(file.path)) throw new Error(`Duplicate generated-file path '${file.path}'.`);
    paths.add(file.path);
  }
  const inputPaths = new Set<string>();
  for (const input of manifest.inputs ?? []) {
    assertSafePath(input.path);
    if (paths.has(input.path) || inputPaths.has(input.path))
      throw new Error(`Duplicate source-export input path '${input.path}'.`);
    inputPaths.add(input.path);
  }
  for (const span of manifest.spans) {
    if (span.end <= span.start) throw new Error(`Invalid source span '${span.id}'.`);
    if (!paths.has(span.file)) throw new Error(`Source span '${span.id}' names an unknown file.`);
  }
  const contentSpans = manifest.spans
    .filter((span) => span.role !== "copier-header")
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  let cursor = 0;
  for (const span of contentSpans) {
    if (span.start !== cursor) {
      throw new Error(
        `Source spans do not own every content byte exactly once at offset ${cursor}.`,
      );
    }
    cursor = span.end;
  }
  if (cursor !== manifest.rom.contentSize) {
    throw new Error(
      `Source spans cover ${cursor} content bytes, expected ${manifest.rom.contentSize}.`,
    );
  }
  const copierSpans = manifest.spans.filter((span) => span.role === "copier-header");
  if (
    (manifest.rom.headerSize === 0 && copierSpans.length !== 0) ||
    (manifest.rom.headerSize === 512 &&
      (copierSpans.length !== 1 || copierSpans[0].start !== 0 || copierSpans[0].end !== 512))
  ) {
    throw new Error("Source-export copier-header ownership does not match the ROM identity.");
  }
  return manifest;
};

/**
 * Verifies every listed file still matches its recorded size and SHA-256.
 * Used as the `--force` preflight so a drifted export is not silently overwritten.
 * @param {string} directory Export directory.
 * @param {SourceExportManifest} [manifest] Loaded manifest; defaults to reading the directory.
 * @returns {void}
 */
export const validateSourceExportFiles = (
  directory: string,
  manifest = loadSourceExportManifest(directory),
): void => {
  for (const file of manifest.files) {
    const absolute = path.join(directory, file.path);
    if (!fs.existsSync(absolute)) throw new Error(`Generated file '${file.path}' is missing.`);
    const bytes = fs.readFileSync(absolute);
    if (bytes.length !== file.size || sourceExportSha256(bytes) !== file.sha256) {
      throw new Error(`Generated file '${file.path}' was modified after export.`);
    }
  }
};

/**
 * Verifies every user-owned export input still matches the bytes consumed by the last generation.
 * Input drift is expected and should trigger regeneration; unlike generated-file drift it does not
 * prevent source export from proceeding.
 * @param {string} directory Export directory.
 * @param {SourceExportManifest} [manifest] Loaded manifest; defaults to reading the directory.
 * @returns {void}
 */
export const validateSourceExportInputs = (
  directory: string,
  manifest = loadSourceExportManifest(directory),
): void => {
  for (const input of manifest.inputs ?? []) {
    const absolute = path.join(directory, input.path);
    if (!fs.existsSync(absolute)) throw new Error(`Source input '${input.path}' is missing.`);
    const bytes = fs.readFileSync(absolute);
    if (bytes.length !== input.size || sourceExportSha256(bytes) !== input.sha256) {
      throw new Error(`Source input '${input.path}' changed after the last export.`);
    }
  }
};

/** Byte-level comparison of a rebuilt image against the source ROM content. */
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
 * Compares two images without throwing; used for round-trip rebuild reports.
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
