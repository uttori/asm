import type { AssetSourceAdapter, AssetSourceHost, AssetStructureCodec } from "./contracts.js";
import { AssetInterchangeService } from "./service.js";
export type { AssetFileOperation, AssetMaintenanceOperation, AssetOperation, } from "./operation-records.js";
import { type AssetFileOperation } from "./operation-records.js";
/** Hosts register factories so each adapter retains its own validated selection and binding types. */
export interface AssetAdapterRegistration {
    readonly id: string;
    create(directory: string, codec: AssetStructureCodec, host: AssetSourceHost): Pick<AssetInterchangeService<unknown, unknown>, "export" | "review" | "apply">;
}
/** Close over the typed adapter; callers only see the service's validated unknown-input boundary. */
export declare function registerAssetAdapter<Selection, Bindings>(adapter: AssetSourceAdapter<Selection, Bindings>): AssetAdapterRegistration;
/** Registration is per host, never mutable process-global state. Duplicate IDs are rejected. */
export interface AssetOperationOptions {
    readonly host?: AssetSourceHost;
    readonly adapters?: readonly AssetAdapterRegistration[];
    readonly signal?: AbortSignal;
    readonly beforePublish?: AssetSourceHost["beforePublish"];
}
/** Command and worker entry point shares file lifecycle and explicit maintenance semantics. */
export declare function executeAssetOperation(value: unknown, options?: AssetOperationOptions): Promise<unknown>;
/** Dispatch installed adapters explicitly. New games can inject their own adapter into the same service. */
export declare function executeAssetFileOperation(operation: AssetFileOperation, options?: AssetOperationOptions): Promise<unknown>;
//# sourceMappingURL=operations.d.ts.map