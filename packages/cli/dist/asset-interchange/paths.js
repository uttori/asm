import fs from "node:fs";
import path from "node:path";
/** Normalize macOS's OS-owned temporary aliases, including paths that do not exist yet. User symlinks remain unresolved. */
export function assetPath(file) {
    const absolute = path.resolve(file);
    if (process.platform === "darwin") {
        for (const alias of ["/var", "/tmp"]) {
            if (absolute === alias || absolute.startsWith(alias + "/")) {
                return path.join(fs.realpathSync(alias), path.relative(alias, absolute));
            }
        }
    }
    return absolute;
}
//# sourceMappingURL=paths.js.map