/**
 * Persist a replacement before exposing it; temporary files always share the destination volume.
 * @param file Destination owned by the caller.
 * @param bytes Complete replacement bytes.
 * @param [mode] Optional permission bits for the replacement; ordinary source callers preserve the existing mode.
 */
export declare function durableReplace(file: string, bytes: string | Uint8Array, mode?: number): void;
/**
 * Flush directory entries after rename/unlink on platforms supporting directory fsync.
 * @param directory Directory whose entries changed.
 */
export declare function syncDirectory(directory: string): void;
/** A cross-process lease; release never removes a replacement owner's lock. */
export interface FileLease {
    /** Drop this process claim when the guarded work finishes or aborts. */
    release(): void;
}
/**
 * Acquire an exclusive local-process lease, reclaiming only a demonstrably dead owner.
 * A hard link exposes a complete owner record atomically, avoiding empty-lock crash windows.
 * Unknown hosts and live/reused PIDs fail closed. No time-based lock stealing is used.
 * @param file Lock path in a private project directory.
 * @returns Caller must release in finally, including after asynchronous work.
 */
export declare function acquireFileLease(file: string): FileLease;
//# sourceMappingURL=durable-files.d.ts.map