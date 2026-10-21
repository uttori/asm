import type { AssetSourceDraft } from "./contracts.js";
/** Small serializable file operations; image payloads and source replacement bytes stay inside the worker. */
export type AssetFileOperation = {
    readonly directory: string;
    readonly document: string;
    readonly manifest: string;
    /** Dirty drafts captured by the editor before starting; a live publication gate supplements this snapshot. */
    readonly drafts?: readonly AssetSourceDraft[];
} & ({
    readonly action: "asset-export";
    readonly adapter: string;
    readonly selection: string;
    readonly presentation?: "tilemap" | "raster" | "indexed-png";
} | {
    readonly action: "asset-review";
} | {
    readonly action: "asset-apply";
    readonly review: string;
});
/** Maintenance moves only trusted journal bytes or explicitly reviewed private records. */
export type AssetMaintenanceOperation = {
    readonly action: "asset-recover";
    readonly directory: string;
    readonly direction: "before" | "after";
    readonly drafts?: readonly AssetSourceDraft[];
} | {
    readonly action: "asset-cleanup";
    readonly directory: string;
    readonly policy: string;
    readonly review?: string;
};
export type AssetOperation = AssetFileOperation | AssetMaintenanceOperation;
/** Validate the lightweight IPC boundary before worker file reads; paths and draft metadata have separate bounded work. */
export declare function readAssetOperation(value: unknown): AssetOperation;
//# sourceMappingURL=operation-records.d.ts.map