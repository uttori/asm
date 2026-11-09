import { type AssetOperationOptions, type AssetSourceHost } from "@uttori/asm-workflows/asset-interchange";
import { executeAssetSourceOperation as convert, type AssetSourceConversionAdapter } from "@uttori/asm-workflows/asset-source";
import { somRoomSourceAdapter } from "./room-adapter.js";
import { somSourceConversionAdapter } from "./source-adapter.js";
import { somSpriteSourceAdapter } from "./sprite-adapter.js";
export { somSourceConversionAdapter, somSpriteSourceAdapter, somRoomSourceAdapter };
export type { SomSpriteSelection } from "./sprite-adapter.js";
export type { SomRoomSelection } from "./room-adapter.js";
/** Explicit host contributions; native conversion and interchange retain separate services and authority. */
export declare const somAssetAdapters: readonly import("@uttori/asm-workflows/asset-interchange").AssetAdapterRegistration[];
/** Native conversion adapters for SoM sprite and room source files. */
export declare const somSourceAdapters: readonly AssetSourceConversionAdapter[];
/** SoM tools use this composed host; generic workflow code knows no game IDs. */
export declare const executeAssetOperation: (value: unknown, options?: AssetOperationOptions) => Promise<unknown>;
/** Convert SoM asset source through the bundled host and adapters. */
export declare const executeAssetSourceOperation: (value: unknown, options?: Parameters<typeof convert>[1]) => Promise<{
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
/** Build a conversion service that uses the SoM host unless another is supplied. */
export declare const createAssetSourceConversionService: (host?: AssetSourceHost) => import("@uttori/asm-workflows/asset-source").AssetSourceConversionService;
//# sourceMappingURL=workflows.d.ts.map