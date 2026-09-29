import { createHash } from "node:crypto";
import path from "node:path";
import { canonicalJson } from "./canonical-json.js";
export const DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
export const DEBUG_MAP_SCHEMA_VERSION = 1;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
/**
 * Creates a deterministic debug map whose fingerprint covers every field except itself.
 * @param {CreateDebugMapOptions} options Output and mapping inputs.
 * @returns {DebugMap} Fingerprinted debug map.
 */
export const createDebugMap = (options) => {
    const sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
    const entries = options.mapping.fileList
        .map((entry, originalId) => {
        const absolute = path.resolve(entry.name);
        const relative = path.relative(sourceRoot, absolute);
        // Keep external sources absolute and normalize separators for portable debug maps.
        const portable = relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : absolute;
        return { entry, originalId, portable: portable.split(path.sep).join("/") };
    })
        .sort((left, right) => left.portable.localeCompare(right.portable));
    const sourceIdByOriginal = new Map();
    const sources = entries.map(({ entry, originalId, portable }, id) => {
        sourceIdByOriginal.set(originalId, id);
        const kind = options.dependencyKinds?.get(entry.name);
        return {
            id,
            path: portable,
            size: entry.size,
            crc32: entry.crc,
            sha256: entry.sha256,
            ...(kind ? { kind } : {}),
        };
    });
    const ranges = options.mapping.ranges
        .map(({ fileIdx, ...range }) => ({ ...range, sourceId: sourceIdByOriginal.get(fileIdx) ?? -1 }))
        .filter((range) => range.sourceId >= 0)
        .sort((left, right) => left.addressSpace.localeCompare(right.addressSpace) ||
        left.architecture.localeCompare(right.architecture) ||
        left.start - right.start ||
        left.end - right.end ||
        left.sourceId - right.sourceId ||
        left.line - right.line);
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
    };
    return {
        ...payload,
        fingerprint: { algorithm: "sha256", value: sha256(canonicalJson(payload)) },
    };
};
/**
 * Recomputes the content fingerprint and output hash for stale-map detection.
 * @param {DebugMap} map Debug map to validate.
 * @param {Uint8Array} output Optional exact output bytes.
 * @returns {readonly string[]} Validation issues.
 */
export const validateDebugMap = (map, output) => {
    const { fingerprint, ...payload } = map;
    const issues = [];
    if (map.format !== DEBUG_MAP_FORMAT) {
        issues.push(`Unsupported debug-map format '${String(map.format)}'.`);
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
 * @param {DebugMap} map Debug map.
 * @param {string} addressSpace Address-space id.
 * @param {number} address Logical address.
 * @param {{ readonly architecture?: string; readonly outputOffset?: number }} options Filters and mirror identity.
 * @returns {readonly DebugMapRange[]} Matching ranges.
 */
export const debugMapRangesForAddress = (map, addressSpace, address, options = {}) => map.ranges.filter((range) => {
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
    return (options.outputOffset !== undefined &&
        range.outputStart !== undefined &&
        range.outputEnd !== undefined &&
        range.outputStart <= options.outputOffset &&
        options.outputOffset < range.outputEnd);
});
/**
 * Resolves one-based source lines to all matching logical ranges.
 * @param {DebugMap} map Debug map.
 * @param {string} sourcePath Source path.
 * @param {number} line One-based line.
 * @param {string} architecture Optional architecture filter.
 * @returns {readonly DebugMapRange[]} Matching logical ranges.
 */
export const debugMapRangesForSource = (map, sourcePath, line, architecture) => {
    const normalized = sourcePath.split(path.sep).join("/");
    const sourceIds = new Set(map.sources
        .filter((source) => source.path === normalized || normalized.endsWith(`/${source.path}`))
        .map((source) => source.id));
    return map.ranges.filter((range) => sourceIds.has(range.sourceId) &&
        range.line === line &&
        (architecture === undefined || range.architecture === architecture));
};
//# sourceMappingURL=debug-map.js.map