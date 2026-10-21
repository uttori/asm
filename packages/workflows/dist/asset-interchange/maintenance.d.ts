import type { AssetSourceHost } from "./contracts.js";
/** Explicit retirement list. Retained reviews continue to pin their export; no age-based or automatic pruning occurs. */
export interface AssetRetentionPolicy {
    readonly exports: readonly string[];
    readonly reviews: readonly string[];
    /** Optional explicit crash leftovers, named with their full `.staging-<uuid>` directory basenames in each store. */
    readonly staging?: {
        readonly exports: readonly string[];
        readonly reviews: readonly string[];
    };
}
/** Validate private-record identifiers before any filesystem operation or cleanup plan is constructed. */
export declare function readAssetRetentionPolicy(value: unknown): AssetRetentionPolicy;
/** Review or execute exactly one explicit retention policy under the same per-project operation lease. */
export declare function cleanupAssetInterchange(directory: string, value: unknown, applyPlan?: string): Promise<{
    exports: readonly string[];
    reviews: readonly string[];
    staging?: {
        readonly exports: readonly string[];
        readonly reviews: readonly string[];
    };
    id: string;
    stagingInventory: {
        exports: import("./record-store.js").AssetStagingInventory[];
        reviews: import("./record-store.js").AssetStagingInventory[];
    };
    applied: boolean;
}>;
/** Recovery uses the journal's exact before/after bytes and rejects unknown external replacements. */
export declare function recoverAssetInterchange(directory: string, direction: "before" | "after", host?: Pick<AssetSourceHost, "beforePublish" | "completed">, signal?: AbortSignal): Promise<import("@uttori/asm-disassembler/source-project").SourceFileTransaction | undefined>;
//# sourceMappingURL=maintenance.d.ts.map