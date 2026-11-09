import { createHash } from "node:crypto";
/** Format of the pure renderer's in-memory inventory. */
export const SOURCE_EXPORT_FORMAT = "uttori-asm-source-export";
/** Current in-memory render inventory schema. */
export const SOURCE_EXPORT_SCHEMA_VERSION = 1;
/**
 * SHA-256 of UTF-8 text or raw bytes, hex-encoded.
 * @param value Content to hash.
 * @returns 64-character lowercase hex digest.
 */
export const sourceExportSha256 = (value) => createHash("sha256").update(value).digest("hex");
/**
 * Compares two images without throwing. Used for round-trip rebuild reports.
 * @param expected Source ROM content (or other oracle).
 * @param actual Rebuilt bytes.
 * @returns Equality, hashes, and first mismatch index.
 */
export const compareByteImages = (expected, actual) => {
    const common = Math.min(expected.length, actual.length);
    let firstDifference;
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
//# sourceMappingURL=source-export.js.map