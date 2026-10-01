import { createHash } from "node:crypto";
import path from "node:path";
/** SHA-256 for a bounded source identity, independent of the repository's Git hash algorithm. */
export const sourceContentHash = (value) => createHash("sha256").update(value).digest("hex");
/** Portable project-relative paths cannot escape their root or enter Git's own administrative data. */
export function assertSourcePath(relative) {
    if (!relative ||
        relative.includes("\0") ||
        relative.includes("\\") ||
        path.isAbsolute(relative) ||
        /^[A-Za-z]:/.test(relative) ||
        relative
            .split("/")
            .some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
        throw new Error(`Invalid source project path: ${relative}`);
    }
}
//# sourceMappingURL=source-inputs.js.map