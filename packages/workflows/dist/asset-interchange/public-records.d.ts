import type { InterchangeCapabilities } from "@uttori/asm-assets/interchange";
import type { AssetExportManifest, AssetImportReview } from "./contracts.js";
export declare function object(value: unknown): Record<string, unknown>;
export declare function text(value: unknown): string;
export declare function digest(value: unknown): string;
export declare function locator(value: unknown): string;
export declare function number(value: unknown, maximum: number): number;
export declare function strings(value: unknown, maximum?: number): string[];
export declare function bytes(value: unknown): Uint8Array;
export declare function capabilities(value: unknown): InterchangeCapabilities;
/** Manifest metadata selects a private record; it cannot grant paths, mappings or capabilities. */
export declare function readAssetExportManifest(value: unknown): AssetExportManifest;
/** Validate a bounded public review received over IPC; only the private persisted plan can authorize application. */
export declare function readAssetImportReview(value: unknown): AssetImportReview;
/** Freeze the complete review summary, including consumer lists, before returning it to a host. */
export declare function immutableReview(value: AssetImportReview): AssetImportReview;
//# sourceMappingURL=public-records.d.ts.map