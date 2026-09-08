/**
 * Reads an object-record JSON array without retaining the complete shard text beside its objects.
 * Syntax and the exact byte hash are checked before any records are returned to the caller.
 * @param {string} file Shard path.
 * @param {string} expectedSha256 Expected hash of persisted bytes.
 * @returns {unknown[]} Parsed object records.
 */
export declare const readObjectArrayFile: (file: string, expectedSha256: string) => unknown[];
//# sourceMappingURL=json-array-file.d.ts.map