import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function errorCode(error) {
    if (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string") {
        return error.code;
    }
    return undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Persist a replacement before exposing it; temporary files always share the destination volume.
 * @param {string} file Destination owned by the caller.
 * @param {string | Uint8Array} bytes Complete replacement bytes.
 * @param {number} [mode] Optional permission bits for the replacement; ordinary source callers preserve the existing mode.
 */
export function durableReplace(file, bytes, mode) {
    ensureDurableDirectory(path.dirname(path.resolve(file)));
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
        const fd = fs.openSync(temporary, "wx", mode);
        try {
            fs.writeFileSync(fd, bytes);
            fs.fsyncSync(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        fs.renameSync(temporary, file);
        syncDirectory(path.dirname(file));
    }
    finally {
        fs.rmSync(temporary, { force: true });
    }
}
/** Flush new parent entries too, so the first receipt in a new history directory is durable.
 * @param {string} directory Absolute directory path.
 */
function ensureDurableDirectory(directory) {
    if (fs.existsSync(directory)) {
        return;
    }
    const parent = path.dirname(directory);
    ensureDurableDirectory(parent);
    try {
        fs.mkdirSync(directory);
    }
    catch (error) {
        if (errorCode(error) !== "EEXIST") {
            throw error;
        }
    }
    syncDirectory(parent);
}
/** Flush directory entries after rename/unlink on platforms supporting directory fsync.
 * @param {string} directory Directory whose entries changed.
 */
export function syncDirectory(directory) {
    // Windows does not allow opening directories through this API.
    if (process.platform === "win32") {
        return;
    }
    const fd = fs.openSync(directory, "r");
    try {
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
}
/** Acquire an exclusive local-process lease, reclaiming only a demonstrably dead owner.
 * A hard link exposes a complete owner record atomically, avoiding empty-lock crash windows.
 * Unknown hosts and live/reused PIDs fail closed. No time-based lock stealing is used.
 * @param {string} file Lock path in a private project directory.
 * @returns {FileLease} Caller must release in finally, including after asynchronous work.
 */
export function acquireFileLease(file) {
    ensureDurableDirectory(path.dirname(path.resolve(file)));
    const owner = JSON.stringify({ pid: process.pid, host: os.hostname(), token: randomUUID() });
    const candidate = `${file}.${randomUUID()}.owner`;
    durableReplace(candidate, owner);
    try {
        try {
            fs.linkSync(candidate, file);
        }
        catch (error) {
            if (errorCode(error) !== "EEXIST") {
                throw error;
            }
            const previous = fs.readFileSync(file, "utf8");
            const parsed = JSON.parse(previous);
            let dead = false;
            if (isRecord(parsed) &&
                parsed.host === os.hostname() &&
                typeof parsed.pid === "number" &&
                Number.isSafeInteger(parsed.pid) &&
                parsed.pid > 0) {
                try {
                    process.kill(parsed.pid, 0);
                }
                catch (cause) {
                    dead = errorCode(cause) === "ESRCH";
                }
            }
            if (!dead) {
                throw new Error(`An operation owns ${file}. Retry after it finishes.`, { cause: error });
            }
            // Serialize reclaimers. A crash during reclamation is itself recoverable through this lease.
            const recovery = acquireFileLease(`${file}.recovery`);
            try {
                if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === previous) {
                    fs.unlinkSync(file);
                }
                fs.linkSync(candidate, file);
            }
            finally {
                recovery.release();
            }
        }
        syncDirectory(path.dirname(file));
    }
    finally {
        fs.rmSync(candidate, { force: true });
    }
    return {
        release() {
            if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === owner) {
                fs.unlinkSync(file);
                syncDirectory(path.dirname(file));
            }
        },
    };
}
//# sourceMappingURL=durable-files.js.map