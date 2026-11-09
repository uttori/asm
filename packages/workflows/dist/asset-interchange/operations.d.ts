import type { AssetSourceAdapter, AssetSourceHost, AssetStructureCodec } from "./contracts.js";
import { AssetInterchangeService } from "./service.js";
export type { AssetFileOperation, AssetMaintenanceOperation, AssetOperation, } from "./operation-records.js";
import { type AssetFileOperation } from "./operation-records.js";
/** Hosts register factories so each adapter retains its own validated selection and binding types. */
export interface AssetAdapterRegistration {
    /** Adapter identifier matched against export manifests. */
    readonly id: string;
    /** Bind this adapter to a project directory, codec, and source host. */
    create(directory: string, codec: AssetStructureCodec, host: AssetSourceHost): Pick<AssetInterchangeService<unknown, unknown>, "export" | "review" | "apply">;
}
/** Close over the typed adapter; callers only see the service's validated unknown-input boundary. */
export declare function registerAssetAdapter<Selection, Bindings>(adapter: AssetSourceAdapter<Selection, Bindings>): AssetAdapterRegistration;
/** Registration is per host, never mutable process-global state. Duplicate IDs are rejected. */
export interface AssetOperationOptions {
    /** Optional source host override; defaults to the saved-source host. */
    readonly host?: AssetSourceHost;
    /** Optional adapter list; defaults to registered game adapters. */
    readonly adapters?: readonly AssetAdapterRegistration[];
    /** Optional cooperative cancellation. */
    readonly signal?: AbortSignal;
    /** Optional last-look hook invoked immediately before publication. */
    readonly beforePublish?: AssetSourceHost["beforePublish"];
}
/** Command and worker entry point shares file lifecycle and explicit maintenance semantics. */
export declare function executeAssetOperation(value: unknown, options?: AssetOperationOptions): Promise<unknown>;
/** Dispatch installed adapters explicitly. New games can inject their own adapter into the same service. */
export declare function executeAssetFileOperation(operation: AssetFileOperation, options?: AssetOperationOptions): Promise<unknown>;
//# sourceMappingURL=operations.d.ts.map