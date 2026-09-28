/** Caller-owned edit of an existing regular file; before bytes protect against stale plans. */
export interface AssetFileChange {
    readonly path: string;
    readonly before: Uint8Array;
    readonly after: Uint8Array;
}
/**
 * Stage all replacements before publishing, then recover earlier replacements on failure.
 * Requires existing regular files and directories; creation/deletion is deliberately outside
 * this small authoring operation. This is not atomic to concurrent readers or crash-atomic.
 * On an unrecoverable conflict, backup files are retained and their locations reported.
 * @param {readonly AssetFileChange[]} changes Validated replacements for existing files; no creation or deletion.
 */
export declare function applyAssetFileChanges(changes: readonly AssetFileChange[]): void;
//# sourceMappingURL=file-edits.d.ts.map