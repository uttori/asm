import type { AssetSourceHost } from "./contracts.js";
export type { AssetFileOperation, AssetMaintenanceOperation, AssetOperation, } from "./operation-records.js";
import { type AssetFileOperation } from "./operation-records.js";
/** Command and worker entry point shares file lifecycle and explicit maintenance semantics. */
export declare function executeAssetOperation(value: unknown, options?: {
    readonly signal?: AbortSignal;
    readonly beforePublish?: AssetSourceHost["beforePublish"];
}): Promise<unknown>;
/** Dispatch installed adapters explicitly. New games can inject their own adapter into the same service. */
export declare function executeAssetFileOperation(operation: AssetFileOperation, options?: {
    readonly signal?: AbortSignal;
    readonly beforePublish?: AssetSourceHost["beforePublish"];
}): Promise<unknown>;
//# sourceMappingURL=operations.d.ts.map