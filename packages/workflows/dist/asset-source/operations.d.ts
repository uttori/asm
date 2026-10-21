import type { AssetSourceDraft, AssetSourceHost } from "../asset-interchange/contracts.js";
import { AssetSourceConversionService, type AssetSourceConversionRequest, type AssetSourceConversionAdapter } from "../asset-source-conversion.js";
import { rasterSourceConversionAdapter } from "./raster-adapter.js";
export { type AssetSourceConversionRequest, type AssetConversionContext, type AssetConversionCandidate, type AssetSourceConversionAdapter, type AssetSourceConversionPlan, assetSourceAssemblyInventory, AssetSourceConversionService, } from "../asset-source-conversion.js";
export { rasterSourceConversionAdapter };
/** The editor stages a validated journal before publishing one native WorkspaceEdit; CLI publishes immediately. */
export type AssetSourceOperation = (Omit<AssetSourceConversionRequest, "representation" | "destination"> & {
    readonly action: "asset-source-target";
}) | (AssetSourceConversionRequest & {
    readonly action: "asset-convert";
    readonly drafts?: readonly AssetSourceDraft[];
    readonly stageOnly?: boolean;
}) | {
    readonly action: "asset-conversion-finish";
    readonly directory: string;
    readonly transaction: string;
    readonly outputSha256: string;
    readonly drafts?: readonly AssetSourceDraft[];
};
/** Installed defaults are ordinary adapters; embedders can inject additional codecs/adapters into the exported service. */
export declare function createAssetSourceConversionService(host?: AssetSourceHost, adapters?: readonly AssetSourceConversionAdapter[]): AssetSourceConversionService;
/** Both hosts use the same current-ROM oracle, relevant-draft safeguards and recoverable file journal. */
export declare function executeAssetSourceOperation(value: unknown, options?: {
    readonly host?: AssetSourceHost;
    readonly adapters?: readonly AssetSourceConversionAdapter[];
    readonly signal?: AbortSignal;
    readonly beforePublish?: AssetSourceHost["beforePublish"];
}): Promise<{
    source: string;
    destination: string;
    outputSha256: string;
    changes: readonly import("@uttori/asm-disassembler/source-project").SourceFileChange[];
    snapshots: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    affected: readonly {
        readonly file: string;
        readonly line: number;
        readonly format: string;
    }[];
    retained: readonly string[];
    unresolvedDeclarations: readonly string[];
    assemblyInventory: readonly string[];
    transaction: string | undefined;
} | {
    source: string;
    representation: string;
    representations: readonly {
        id: string;
        mediaType: string;
        extensions: readonly string[];
    }[];
    file: string;
    line: number;
    inputs?: {
        path: string;
        sha256: string;
    }[] | undefined;
    menus?: {
        file: string;
        line: number;
        endLine: number;
        representation: string;
    }[] | undefined;
    transaction?: undefined;
    outputSha256?: undefined;
    state?: undefined;
} | {
    transaction: string;
    outputSha256: string;
    state: "completed";
} | undefined>;
//# sourceMappingURL=operations.d.ts.map