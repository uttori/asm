/** Persist a replacement before exposing it; temporary files always share the destination volume.
 * @param {string} file Destination owned by the caller.
 * @param {string | Uint8Array} bytes Complete replacement bytes.
 * @param {number} [mode] Optional permission bits for the replacement; ordinary source callers preserve the existing mode.
 */
export declare function durableReplace(file: string, bytes: string | Uint8Array, mode?: number): void;
/** Flush directory entries after rename/unlink on platforms supporting directory fsync.
 * @param {string} directory Directory whose entries changed.
 */
export declare function syncDirectory(directory: string): void;
/** A cross-process lease; release never removes a replacement owner's lock. */
export interface FileLease {
    release(): void;
}
/** Acquire an exclusive local-process lease, reclaiming only a demonstrably dead owner.
 * A hard link exposes a complete owner record atomically, avoiding empty-lock crash windows.
 * Unknown hosts and live/reused PIDs fail closed. No time-based lock stealing is used.
 * @param {string} file Lock path in a private project directory.
 * @returns {FileLease} Caller must release in finally, including after asynchronous work.
 */
export declare function acquireFileLease(file: string): FileLease;
//# sourceMappingURL=durable-files.d.ts.map