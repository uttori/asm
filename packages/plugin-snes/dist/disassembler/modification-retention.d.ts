/** One retained artifact, measured without following symbolic links. Reasons explain every protected item. */
export interface RetentionItem {
    readonly id: string;
    readonly path: string;
    readonly category: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly modifiedAt: string;
    readonly protected: readonly string[];
    readonly pinned: boolean;
}
/** The scope bounds dependency discovery. External projects must be represented by explicit pins. */
export interface RetentionInventory {
    readonly scope: string;
    readonly items: readonly RetentionItem[];
    readonly totalBytes: number;
    readonly eligibleBytes: number;
    readonly fingerprint: string;
}
/** Inventory only tool-owned histories. Editable inputs, databases and capture archives are never candidates.
 * @param {object} options Modification manifest defining the project and sibling dependency scope.
 * @returns {RetentionInventory} Read-only inventory and fingerprint required for cleanup.
 */
export declare function reviewModificationRetention(options: {
    manifestFile: string;
}): RetentionInventory;
/** Pin/unpin only a discovered artifact. Pins survive editor restarts and are included in stale-review detection.
 * @param {object} options Discovered artifact ID and optional label; omitted label removes its pin.
 */
export declare function pinModificationRetention(options: {
    manifestFile: string;
    itemId: string;
    label?: string;
}): void;
/** Delete exactly the reviewed eligible set. A changed dependency or any changed content rejects the entire request.
 * @param {object} options Exact inventory fingerprint and explicitly selected eligible artifact IDs.
 * @returns {object} Removed artifact/byte counts and durable progress receipt.
 */
export declare function pruneModificationRetention(options: {
    manifestFile: string;
    fingerprint: string;
    selected: readonly string[];
}): {
    removed: number;
    bytes: number;
    receiptFile: string;
};
//# sourceMappingURL=modification-retention.d.ts.map