import path from "node:path";
import { sourceContentHash } from "../internal/source-inputs.js";
/** Narrow parsed JSON to a plain object record. */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Validate persisted totals before presenting them as conversion progress. */
export function isSourceBuildCoverage(value) {
    if (!isRecord(value)) {
        return false;
    }
    const record = value;
    return (typeof record.romSha256 === "string" &&
        /^[\da-f]{64}$/.test(record.romSha256) &&
        [record.totalBytes, record.remainingBytes, record.convertedBytes].every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0) &&
        Number(record.remainingBytes) + Number(record.convertedBytes) === record.totalBytes);
}
/**
 * Count original bytes still included from the declared raw-block directory. Ordinary binary
 * assets do not count as unconverted. Input slices, rather than output placement or file sizes,
 * keep repeated includes, relocation, unused blocks and expanded ROM capacity from skewing totals.
 * Missing slice metadata fails instead of reporting misleading complete conversion.
 */
export function sourceBuildCoverage(mapping, root, raw) {
    if (!Number.isSafeInteger(raw.blockSize) || raw.blockSize < 1 || raw.blockSize > 65536) {
        throw new Error("Invalid coverage raw-block size.");
    }
    const directory = path.resolve(root, raw.directory);
    const blocks = new Map();
    for (let start = 0; start < raw.original.length; start += raw.blockSize) {
        blocks.set(path.join(directory, `${start.toString(16).padStart(6, "0")}.bin`), start);
    }
    const ranges = [];
    for (const asset of mapping.assets) {
        if (asset.format !== "raw") {
            continue;
        }
        const file = Number.isSafeInteger(asset.assetFileIdx) &&
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
        if (inputStart === undefined ||
            inputEnd === undefined ||
            !Number.isSafeInteger(inputStart) ||
            !Number.isSafeInteger(inputEnd) ||
            inputStart < 0 ||
            inputEnd < inputStart ||
            inputEnd > length ||
            inputEnd - inputStart !== asset.size) {
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
//# sourceMappingURL=build-coverage.js.map