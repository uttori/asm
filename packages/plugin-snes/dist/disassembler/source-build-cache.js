import fs from "node:fs";
import path from "node:path";
/**
 * Accepts a JSON object. Arrays and null are not build receipts.
 * @param {unknown} value Parsed JSON.
 * @returns {boolean} True when `value` is a non-array object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Reads an optional receipt string. A non-string field is not a receipt this pruner owns.
 * @param {Record<string, unknown>} record Parsed receipt.
 * @param {string} key Field name.
 * @returns {string | undefined} The string field, or undefined when absent.
 */
function receiptString(record, key) {
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
 * Prune only owned build artifacts while the caller holds the publication lease. Three successful
 * generations include the current receipt; failed publications have a recoverable pending receipt.
 * Unknown files, symlinks and malformed ownership records are left alone and reported, never swept.
 */
export function pruneSnesSourceBuilds(directory, current) {
    const warnings = [];
    const ownedNames = new Set([
        "program.sfc",
        "program.sfc.debug.json",
        "build.json",
        "pending.json",
    ]);
    const candidates = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^[\da-f]{64}$/.test(entry.name) || entry.name === current) {
            continue;
        }
        const root = path.join(directory, entry.name);
        try {
            const files = fs.readdirSync(root);
            if (files.some((file) => !ownedNames.has(file.replace(/\.[\da-f-]{36}\.tmp$/, "")) ||
                !fs.lstatSync(path.join(root, file)).isFile())) {
                throw new Error("unexpected file or symlink");
            }
            const complete = files.includes("build.json");
            const receipt = path.join(root, complete ? "build.json" : "pending.json");
            const stat = fs.statSync(receipt);
            if (stat.size > 65536) {
                throw new Error("oversized build receipt");
            }
            const parsed = JSON.parse(fs.readFileSync(receipt, "utf8"));
            if (!isRecord(parsed)) {
                throw new Error("unrecognized build receipt");
            }
            const value = {
                inputSha256: receiptString(parsed, "inputSha256"),
                outputFile: receiptString(parsed, "outputFile"),
                debugMapFile: receiptString(parsed, "debugMapFile"),
            };
            if (value.inputSha256 !== entry.name ||
                value.outputFile !== path.join(root, "program.sfc") ||
                value.debugMapFile !== path.join(root, "program.sfc.debug.json")) {
                throw new Error("unrecognized build receipt");
            }
            candidates.push({ path: root, hash: entry.name, modified: stat.mtimeMs, complete });
        }
        catch (error) {
            if (warnings.length < 10) {
                warnings.push(`Retained unknown build cache ${entry.name}: ${String(error)}`);
            }
        }
    }
    candidates.sort((a, b) => b.modified - a.modified || a.hash.localeCompare(b.hash));
    let retained = 1;
    for (const candidate of candidates) {
        if (candidate.complete && retained++ < 3) {
            continue;
        }
        try {
            fs.rmSync(candidate.path, { recursive: true });
        }
        catch (error) {
            if (warnings.length < 10) {
                warnings.push(`Could not remove retired build ${candidate.hash}: ${String(error)}`);
            }
        }
    }
    return warnings;
}
//# sourceMappingURL=source-build-cache.js.map