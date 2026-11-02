import { createHash } from "node:crypto";
import path from "node:path";

import type {
  AddressToLineMapping,
  SerializableAddressRange,
  InstructionSourceInfo,
  AssetEmissionInfo,
  StructFieldEmissionInfo,
} from "./addressToLine.js";
import { canonicalJson } from "./canonical-json.js";

/** Format discriminator written into every serialized debug map payload. */
export const DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
/** Schema version bumped when required debug-map fields change shape. */
export const DEBUG_MAP_SCHEMA_VERSION = 1;

/** Fingerprinted source file or binary dependency entry in a debug map catalog. */
export interface DebugMapSource {
  /** Stable source index referenced by ranges and optional metadata tables. */
  readonly id: number;
  /** Portable path relative to the configured source root when possible. */
  readonly path: string;
  /** Byte length of the source file at fingerprint time. */
  readonly size: number;
  /** CRC32 of source bytes for quick stale detection. */
  readonly crc32: number;
  /** SHA-256 of source bytes for exact identity checks. */
  readonly sha256: string;
  /** Binary/resource dependencies have no source lines of their own. */
  readonly kind?: "binary" | "resource";
}

/** Address range mapped to a cataloged source line within an architecture and address space. */
export interface DebugMapRange extends Omit<SerializableAddressRange, "source"> {
  /** Index into the debug map sources table for this range. */
  readonly sourceId: number;
}

/** Final encoder operand values attached to a fingerprinted source snapshot. */
export interface DebugMapInstruction extends Omit<InstructionSourceInfo, "fileIdx"> {
  /** Index into the debug map sources table for the instruction occurrence. */
  readonly sourceId: number;
}

/** Source statement and binary input provenance for one emitted asset stream. */
export interface DebugMapAsset extends Omit<AssetEmissionInfo, "fileIdx" | "assetFileIdx"> {
  /** Source index for the assembly statement that emitted the asset. */
  readonly sourceId: number;
  /** Source index for the binary asset file itself. */
  readonly assetSourceId: number;
}

/** Scalar record attribution resolved by the linker or absolute source writer. */
export interface DebugMapField extends Omit<StructFieldEmissionInfo, "fileIdx"> {
  /** Source index for the struct field emission statement. */
  readonly sourceId: number;
}

/** Serializable debug map binding output bytes to sources, ranges, and optional metadata. */
export interface DebugMap {
  /** Optional struct field emissions when the builder recorded them. */
  readonly fields?: readonly DebugMapField[];
  /** Format discriminator matching DEBUG_MAP_FORMAT. */
  readonly format: typeof DEBUG_MAP_FORMAT;
  /** Schema version matching DEBUG_MAP_SCHEMA_VERSION. */
  readonly schemaVersion: typeof DEBUG_MAP_SCHEMA_VERSION;
  /** Content hash covering every field except this fingerprint object. */
  readonly fingerprint: { readonly algorithm: "sha256"; readonly value: string };
  /** Target contribution identifier for the linked output. */
  readonly target: string;
  /** Linked output size and digest recorded at map creation time. */
  readonly output: { readonly size: number; readonly sha256: string };
  /** Ordered source catalog referenced by ranges and metadata tables. */
  readonly sources: readonly DebugMapSource[];
  /** Address ranges mapped back to source lines. */
  readonly ranges: readonly DebugMapRange[];
  /** Optional additive editor metadata; older maps remain valid without it. */
  readonly instructions?: readonly DebugMapInstruction[];
  /** Optional asset metadata; binary inputs never receive assembly line mappings. */
  readonly assets?: readonly DebugMapAsset[];
}

/** Inputs required to build a deterministic debug map from an address mapping. */
export interface CreateDebugMapOptions {
  /** Target contribution identifier stored in the map. */
  readonly target: string;
  /** Final output bytes hashed into the map payload. */
  readonly output: Uint8Array;
  /** Address-to-line mapping collected during assembly or linking. */
  readonly mapping: AddressToLineMapping;
  /** Optional classification of non-source dependencies by absolute path. */
  readonly dependencyKinds?: ReadonlyMap<string, "binary" | "resource">;
  /** Base directory used to make source paths portable. Defaults to the process cwd. */
  readonly sourceRoot?: string;
}

/** Computes a lowercase hex SHA-256 digest for strings or byte payloads. */
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Creates a deterministic debug map whose fingerprint covers every field except itself.
 * @param options Output and mapping inputs.
 * @returns Fingerprinted debug map.
 */
export const createDebugMap = (options: CreateDebugMapOptions): DebugMap => {
  const sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
  const entries = options.mapping.fileList
    .map((entry, originalId) => {
      const absolute = path.resolve(entry.name);
      const relative = path.relative(sourceRoot, absolute);
      // Keep external sources absolute and normalize separators for portable debug maps.
      const portable =
        relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : absolute;
      return { entry, originalId, portable: portable.split(path.sep).join("/") };
    })
    .toSorted((left, right) => left.portable.localeCompare(right.portable));
  const sourceIdByOriginal = new Map<number, number>();
  const sources: DebugMapSource[] = entries.map(({ entry, originalId, portable }, id) => {
    sourceIdByOriginal.set(originalId, id);
    const kind = options.dependencyKinds?.get(entry.name);
    return Object.assign(
      {},
      {
        id,
        path: portable,
        size: entry.size,
        crc32: entry.crc,
        sha256: entry.sha256,
      },
      kind ? { kind } : {},
    );
  });
  const ranges: DebugMapRange[] = options.mapping.ranges
    .map(({ fileIdx, ...range }) => ({ ...range, sourceId: sourceIdByOriginal.get(fileIdx) ?? -1 }))
    .filter((range) => range.sourceId >= 0)
    .toSorted(
      (left, right) =>
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.architecture.localeCompare(right.architecture) ||
        left.start - right.start ||
        left.end - right.end ||
        left.sourceId - right.sourceId ||
        left.line - right.line,
    );
  const payload = {
    format: DEBUG_MAP_FORMAT,
    schemaVersion: DEBUG_MAP_SCHEMA_VERSION,
    target: options.target,
    output: { size: options.output.length, sha256: sha256(options.output) },
    sources,
    ranges,
    ...(options.mapping.instructions.length
      ? {
          instructions: options.mapping.instructions
            .map(({ fileIdx, ...entry }) => ({
              ...entry,
              sourceId: sourceIdByOriginal.get(fileIdx) ?? -1,
            }))
            .filter((entry) => entry.sourceId >= 0),
        }
      : {}),
    ...(options.mapping.structFields.length
      ? {
          fields: options.mapping.structFields
            .map(({ fileIdx, ...field }) => ({
              ...field,
              sourceId: sourceIdByOriginal.get(fileIdx) ?? -1,
            }))
            .filter((field) => field.sourceId >= 0),
        }
      : {}),
    ...(options.mapping.assets.length
      ? {
          assets: options.mapping.assets
            .map(({ fileIdx, assetFileIdx, ...entry }) => ({
              ...entry,
              sourceId: sourceIdByOriginal.get(fileIdx) ?? -1,
              assetSourceId: sourceIdByOriginal.get(assetFileIdx) ?? -1,
            }))
            .filter((entry) => entry.sourceId >= 0 && entry.assetSourceId >= 0),
        }
      : {}),
  } as const;
  return {
    ...payload,
    fingerprint: { algorithm: "sha256", value: sha256(canonicalJson(payload)) },
  };
};

/** Debug map payload accepted before strict format field narrowing during validation. */
type UncheckedDebugMap = Omit<DebugMap, "format" | "schemaVersion" | "fingerprint"> & {
  readonly format: string;
  readonly schemaVersion: number;
  readonly fingerprint: { readonly algorithm: string; readonly value: string };
};

/**
 * Recomputes the content fingerprint and output hash for stale-map detection.
 * @param map Debug map to validate. Format fields are checked here.
 * @param output Optional exact output bytes.
 * @returns Validation issues.
 */
export const validateDebugMap = (
  map: UncheckedDebugMap,
  output?: Uint8Array,
): readonly string[] => {
  const { fingerprint, ...payload } = map;
  const issues: string[] = [];
  if (map.format !== DEBUG_MAP_FORMAT) {
    issues.push(`Unsupported debug-map format '${map.format}'.`);
  }
  if (map.schemaVersion !== DEBUG_MAP_SCHEMA_VERSION) {
    issues.push(`Unsupported debug-map schema ${String(map.schemaVersion)}.`);
  }
  const actualFingerprint = sha256(canonicalJson(payload));
  if (fingerprint.algorithm !== "sha256" || fingerprint.value !== actualFingerprint) {
    issues.push("Debug-map fingerprint mismatch.");
  }
  if (output) {
    if (output.length !== map.output.size) {
      issues.push("Debug-map output size mismatch.");
    }
    if (sha256(output) !== map.output.sha256) {
      issues.push("Debug-map output SHA-256 mismatch.");
    }
  }
  return issues;
};

/**
 * Resolves a logical runtime address, falling back to an output offset for mirrors.
 * @param map Debug map.
 * @param addressSpace Address-space id.
 * @param address Logical address.
 * @param options Filters and mirror identity.
 * @returns Matching ranges.
 */
export const debugMapRangesForAddress = (
  map: DebugMap,
  addressSpace: string,
  address: number,
  options: { readonly architecture?: string; readonly outputOffset?: number } = {},
): readonly DebugMapRange[] =>
  map.ranges.filter((range) => {
    // Drop other CPUs when the caller names one (e.g. 65816 vs SPC700).
    if (options.architecture !== undefined && range.architecture !== options.architecture) {
      return false;
    }
    // Direct hit: logical address sits in this range's half-open [start, end) in the requested space.
    if (range.addressSpace === addressSpace && range.start <= address && address < range.end) {
      return true;
    }
    // Mirror fallback: same ROM bytes at a different bus address, matched by output offset
    // (e.g. $008000 vs $808000 both mapping to file offset 0). Unmapped ranges have no output span.
    return (
      options.outputOffset !== undefined &&
      range.outputStart !== undefined &&
      range.outputEnd !== undefined &&
      range.outputStart <= options.outputOffset &&
      options.outputOffset < range.outputEnd
    );
  });

/**
 * Resolves one-based source lines to all matching logical ranges.
 * @param map Debug map.
 * @param sourcePath Source path.
 * @param line One-based line.
 * @param architecture Optional architecture filter.
 * @returns Matching logical ranges.
 */
export const debugMapRangesForSource = (
  map: DebugMap,
  sourcePath: string,
  line: number,
  architecture?: string,
): readonly DebugMapRange[] => {
  const normalized = sourcePath.split(path.sep).join("/");
  const sourceIds = new Set(
    map.sources
      .filter((source) => source.path === normalized || normalized.endsWith(`/${source.path}`))
      .map((source) => source.id),
  );
  return map.ranges.filter(
    (range) =>
      sourceIds.has(range.sourceId) &&
      range.line === line &&
      (architecture === undefined || range.architecture === architecture),
  );
};
