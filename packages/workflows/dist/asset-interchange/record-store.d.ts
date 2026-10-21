export { assetPath } from "./paths.js";
/** Hash identities cover exact bytes, independently of Git commits and modification times. */
export declare function assetHash(bytes: string | Uint8Array): string;
/** Staging locators name private crash leftovers and are never valid completed-record identities. */
export declare function readAssetStagingId(value: unknown): string;
/** Exact sorted regular-file inventory; the hash pins names, byte sizes and content hashes for retirement. */
export interface AssetStagingInventory {
    readonly id: string;
    readonly hash: string;
    readonly files: readonly {
        readonly name: string;
        /** File length in bytes, including partially written durable-replacement temporaries. */
        readonly size: number;
        readonly sha256: string;
    }[];
}
/** Refuse symlink components, including private staging parents. Missing directories are created durably. */
export declare function assetDirectory(directory: string): string;
/** Bound reads before allocating, and detect replacement/growth while reading the opened file. */
export declare function readAssetFile(file: string, limit: number): Uint8Array;
/** Complete immutable records, scoped to this checkout. No implicit pruning or cross-checkout baseline authority. */
export declare class AssetRecordStore {
    readonly directory: string;
    constructor(directory: string);
    /** Enumerate complete records only; interrupted staging directories never become usable export authority. */
    inventory<T>(validate: (value: unknown) => T): readonly {
        readonly id: string;
        readonly hash: string;
        readonly value: T;
    }[];
    /** Preview one explicitly selected crash leftover under the caller's operation lease; incomplete metadata is not decoded. */
    stagingInventory(id: string): AssetStagingInventory;
    /** Recheck the exact preview under the caller's lease; unlink only its regular files, never recurse into new content. */
    retireStaging(id: string, expectedHash: string): void;
    /**
     * Validate every file of an explicitly selected immutable record before coordinated retirement.
     * Unexpected files or symlinks stop cleanup; external saved documents and source history are never removed.
     */
    validateRetirement(id: string, expectedHash: string): void;
    /** Recheck the preview immediately before retiring a complete record; callers coordinate the whole cleanup inventory. */
    retire(id: string, expectedHash: string): void;
    /** Stage and flush all content before one directory rename makes the record discoverable. */
    publish(id: string, value: unknown, signal?: AbortSignal): string;
    /** Private storage is still validated unknown data. The caller supplies the semantic schema validator. */
    read<T>(id: string, validate: (value: unknown) => T): {
        readonly value: T;
        readonly hash: string;
    };
}
//# sourceMappingURL=record-store.d.ts.map