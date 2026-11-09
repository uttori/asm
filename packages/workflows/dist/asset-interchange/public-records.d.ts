import type { InterchangeCapabilities } from "@uttori/asm-assets/interchange";
import type { AssetExportManifest, AssetImportReview } from "./contracts.js";
/** Require a plain JSON object, rejecting arrays and null. */
export declare function object(value: unknown): Record<string, unknown>;
/** Require a nonempty string of at most 4,096 characters. */
export declare function text(value: unknown): string;
/** Require a 64-character lowercase hex SHA-256 digest. */
export declare function digest(value: unknown): string;
/** Require a lowercase UUID used as an export locator. */
export declare function locator(value: unknown): string;
/** Require a nonnegative safe integer no greater than `maximum`. */
export declare function number(value: unknown, maximum: number): number;
/** Require an array of text values, capped at `maximum` entries. */
export declare function strings(value: unknown, maximum?: number): string[];
/** Require a Uint8Array within the decoded-asset byte limit. */
export declare function bytes(value: unknown): Uint8Array;
/** Require a complete interchange-capability flags object. */
export declare function capabilities(value: unknown): InterchangeCapabilities;
/** Manifest metadata selects a private record; it cannot grant paths, mappings or capabilities. */
export declare function readAssetExportManifest(value: unknown): AssetExportManifest;
/** Validate a bounded public review received over IPC; only the private persisted plan can authorize application. */
export declare function readAssetImportReview(value: unknown): AssetImportReview;
/** Freeze the complete review summary, including consumer lists, before returning it to a host. */
export declare function immutableReview(value: AssetImportReview): AssetImportReview;
//# sourceMappingURL=public-records.d.ts.map