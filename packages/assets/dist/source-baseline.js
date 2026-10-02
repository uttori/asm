import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
/** Reject platform-dependent aliases and paths that escape a selected source root.
 * @param {unknown} name Portable project-relative path.
 * @returns {string} Validated path, unchanged.
 */
export function assetRelativePath(name) {
    if (typeof name !== "string" ||
        !name ||
        /[\0:\\]/.test(name) ||
        name.startsWith("/") ||
        name.split("/").some((p) => !p || p === "." || p === "..")) {
        throw new Error(`Invalid project-relative asset path: ${String(name)}.`);
    }
    return name;
}
/** Reject symlinks in every path component, including the selected root.
 * @param {string} root Existing source directory.
 * @param {string} name Project-relative path to an existing regular file.
 * @returns {string} Host absolute path whose components were checked.
 */
export function assetSourcePath(root, name) {
    assetRelativePath(name);
    if (!fs.lstatSync(root).isDirectory()) {
        throw new Error("Asset root must be a real directory.");
    }
    let current = fs.realpathSync(root);
    const parts = name.split("/");
    for (const [index, part] of parts.entries()) {
        current = path.join(current, part);
        const info = fs.lstatSync(current);
        if (info.isSymbolicLink() ||
            (index === parts.length - 1 ? !info.isFile() : !info.isDirectory())) {
            throw new Error(`Non-regular asset path: ${name}.`);
        }
    }
    return current;
}
/** Fingerprint supplied source bytes; no root or machine-specific path is persisted.
 * @param {string} identity Host-selected project and adapter revision identity.
 * @param {ReadonlyMap<string, Uint8Array>} sources Exact bytes captured at export time.
 * @returns {AssetSourceBaseline} JSON-serializable snapshot, independent of subsequent buffer edits.
 */
export function createAssetSourceBaseline(identity, sources) {
    if (typeof identity !== "string" || !identity) {
        throw new Error("Asset baseline requires an identity.");
    }
    return {
        version: 1,
        identity,
        files: [...sources]
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([name, bytes]) => ({
            path: assetRelativePath(name),
            size: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
        })),
    };
}
/** Version, identity, and a file list are present; each fingerprint is checked separately.
 * @param {unknown} value Untrusted parsed JSON.
 * @returns {boolean} Whether the envelope can be read as a version-one baseline.
 */
function isBaselineEnvelope(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (!("version" in value) || !("identity" in value) || !("files" in value)) {
        return false;
    }
    const identity = value.identity;
    return (value.version === 1 &&
        typeof identity === "string" &&
        identity !== "" &&
        Array.isArray(value.files));
}
/** Validate a persisted baseline before reading any of its paths.
 * @param {unknown} value Untrusted parsed JSON.
 * @returns {AssetSourceBaseline} Validated version-one baseline.
 */
export function parseAssetSourceBaseline(value) {
    if (!isBaselineEnvelope(value)) {
        throw new Error("Invalid asset baseline.");
    }
    const seen = new Set();
    const files = [];
    for (const file of value.files) {
        if (typeof file !== "object" || file === null) {
            throw new Error("Invalid asset fingerprint.");
        }
        const size = "size" in file ? file.size : undefined;
        const sha256 = "sha256" in file ? file.sha256 : undefined;
        const entryPath = "path" in file ? file.path : undefined;
        if (typeof size !== "number" ||
            !Number.isSafeInteger(size) ||
            size < 0 ||
            typeof sha256 !== "string" ||
            !/^[\da-f]{64}$/.test(sha256)) {
            throw new Error("Invalid asset fingerprint.");
        }
        const relative = assetRelativePath(entryPath);
        if (seen.has(relative)) {
            throw new Error(`Duplicate baseline path: ${relative}.`);
        }
        seen.add(relative);
        files.push({ path: relative, size, sha256 });
    }
    return { version: value.version, identity: value.identity, files };
}
/** Detect edits made since export, not merely since the current import command started.
 * @param {string} root Current source directory or an unchanged relocated copy.
 * @param {AssetSourceBaseline} input Persisted baseline, revalidated before use.
 * @param {string} identity Expected project/adapter identity supplied independently by the host.
 * @returns {void} Throws with every stale or missing dependency before publication.
 */
export function assertAssetSourceBaseline(root, input, identity) {
    const baseline = parseAssetSourceBaseline(input);
    if (baseline.identity !== identity) {
        throw new Error("Asset baseline belongs to a different project or adapter revision.");
    }
    const changed = [];
    for (const file of baseline.files) {
        try {
            const bytes = fs.readFileSync(assetSourcePath(root, file.path));
            if (bytes.length !== file.size ||
                createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
                changed.push(file.path);
            }
        }
        catch {
            changed.push(file.path);
        }
    }
    if (changed.length) {
        throw new Error(`Stale asset baseline: ${changed.join(", ")}.`);
    }
}
//# sourceMappingURL=source-baseline.js.map