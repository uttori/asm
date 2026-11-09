import { type AssetSourceHost } from "@uttori/asm-workflows/asset-interchange";
import { type SourceOperation } from "@uttori/asm-workflows/source";
/** Bundled hosts provide the private plugin without relying on a project-local installation. */
export declare const somSourceHost: import("@uttori/asm-workflows/source").SourceWorkflowHost;
/** Run a source operation against the bundled SoM plugin host. */
export declare const executeSourceOperation: (operation: SourceOperation) => Promise<unknown>;
/** Asset host that inspects SoM Git source projects through the bundled plugin. */
export declare const somAssetSourceHost: AssetSourceHost;
//# sourceMappingURL=source-host.d.ts.map