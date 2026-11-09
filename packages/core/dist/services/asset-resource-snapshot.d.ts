import type { AssetFormatContribution, AssetSource } from "../plugin/contracts.js";
/** Hosts choose resolution scope and impose their own read/byte budgets; snapshots remain borrowed here. */
export interface AssetResourceSnapshotHost {
    /** Resolve in the assembly context, or relative to an already resolved declaring resource. */
    resolve(path: string, declaringResource?: string): string | undefined;
    /** Borrow a stable snapshot for this path; the host owns copying, lifetime and read limits. */
    read(path: string): Uint8Array;
    /** Returns the MIME type used when building asset source metadata for a path. */
    mediaType(path: string): string;
}
/** Infer representation hints from registered suffixes before applying legacy resource defaults. */
export declare function assetSourceMediaType(path: string, format?: Readonly<AssetFormatContribution>): string;
/**
 * A synchronous, bounded closure shared by assembly, dependency discovery and explicit editor previews.
 * Each callback gets owned byte/option copies. Paths are read once through the host snapshot; keys
 * can alias bytes but may not change identity or form recursive relative-resource declarations.
 */
export declare function resolveAssetResourceSnapshot(format: Readonly<AssetFormatContribution>, source: AssetSource, options: Readonly<Record<string, unknown>>, host: AssetResourceSnapshotHost): {
    resources: Record<string, AssetSource>;
    paths: Record<string, string>;
};
//# sourceMappingURL=asset-resource-snapshot.d.ts.map