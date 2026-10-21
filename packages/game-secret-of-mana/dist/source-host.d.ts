import { type AssetSourceHost } from "@uttori/asm-workflows/asset-interchange";
import { type SourceOperation } from "@uttori/asm-workflows/source";
/** Bundled hosts provide the private plugin without relying on a project-local installation. */
export declare const somSourceHost: import("@uttori/asm-workflows/source").SourceWorkflowHost;
export declare const executeSourceOperation: (operation: SourceOperation) => Promise<unknown>;
export declare const somAssetSourceHost: AssetSourceHost;
//# sourceMappingURL=source-host.d.ts.map