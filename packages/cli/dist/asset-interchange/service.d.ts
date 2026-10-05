import type { AssetExportManifest, AssetImportReview, AssetSourceAdapter, AssetSourceHost, AssetStructureCodec } from "./contracts.js";
export { readAssetExportManifest, readAssetImportReview } from "./public-records.js";
/** One portable production codec; capability intersection is persisted with each export. */
export declare const asepriteStructureCodec: AssetStructureCodec;
/** Normal source loading/building shared by CLI and editor workers; optional hooks add host coordination. */
export declare const savedAssetSourceHost: AssetSourceHost;
/** Saved-source lifecycle shared by command-line and editor hosts. Reviews persist exact plans, never guessed editor intent. */
export declare class AssetInterchangeService<Selection, Bindings> {
    readonly directory: string;
    readonly adapter: AssetSourceAdapter<Selection, Bindings>;
    readonly codec: AssetStructureCodec;
    readonly host: AssetSourceHost;
    constructor(directory: string, adapter: AssetSourceAdapter<Selection, Bindings>, codec?: AssetStructureCodec, host?: AssetSourceHost);
    private implementation;
    private stores;
    private context;
    private drafts;
    private parseBaseline;
    private parseReview;
    private load;
    /** Publish artifacts first and the complete private record last. An interrupted export grants no partial authority. */
    export(selectionValue: unknown, outputs: {
        readonly document: string;
        readonly manifest: string;
    }, signal?: AbortSignal): Promise<AssetExportManifest>;
    /** Decode and build once, then persist a stable exact plan. A review never writes selected source. */
    review(manifestValue: unknown, documentFile: string, signal?: AbortSignal): Promise<AssetImportReview>;
    /** Apply the saved review, revalidating exact inputs and output. Never silently recompute a different native plan. */
    apply(manifestValue: unknown, documentFile: string, reviewId: string, signal?: AbortSignal): Promise<{
        readonly review: AssetImportReview;
        readonly transaction?: string;
    }>;
}
//# sourceMappingURL=service.d.ts.map