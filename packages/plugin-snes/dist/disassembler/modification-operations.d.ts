import { type OwnedAssetRecipe } from "./modification-assets.js";
import { type RomModificationProject, type ModificationOperationOptions } from "./modification-project.js";
/** A reviewable explicit placement plan; pointer locations are headerless ROM offsets. */
export interface RomPlacementPlan {
    readonly manifestSha256: string;
    readonly expansion?: {
        readonly size: number;
        readonly fill: number;
    };
    readonly replacement: string;
    readonly offset: number;
    readonly size: number;
    /** Required when short binary/asset content should be padded. Assembly must emit its full budget. */
    readonly fill?: number;
    readonly pointers: readonly {
        readonly id: string;
        readonly offset: number;
        readonly width: 2 | 3;
        /** Required CPU bank for a 16-bit pointer; this does not infer the game's data bank. */
        readonly bank?: number;
        readonly addend?: number;
    }[];
}
/** Validate a candidate through the same parser as Build, then publish one manifest pointer.
 * Retained prior manifests and inputs let interrupted or unwanted operations be recovered without data loss.
 * @param {string} file Current manifest, protected by the caller's modification lease.
 * @param {RomModificationProject} project Complete candidate contract; owned inputs must already exist.
 */
export declare function publishModificationManifest(file: string, project: RomModificationProject): void;
/** Relocate one owner and create its explicitly listed pointers in one manifest commit.
 * @param {object} options Manifest and exact reviewed plan. Stale plans, bank changes and overlaps fail without publishing.
 * @returns {string} Saved manifest path. Original inputs and old manifest remain available in history.
 */
export declare function applyRomPlacement(options: {
    manifestFile: string;
    plan: RomPlacementPlan;
}): string;
/** Extract a binary replacement into an editable native model or palette-preserving indexed PNG.
 * @param {object} options Existing binary owner and explicit native format/palette ROM offset.
 * @returns {Promise<string>} Newly owned input path. Existing input is retained, and encoding must reproduce it exactly before publication.
 */
export declare function extractRomAsset(options: ModificationOperationOptions & {
    id: string;
    format: string;
    paletteOffset?: number;
    paletteSize?: number;
    transforms?: OwnedAssetRecipe["transforms"];
}): Promise<string>;
/** Copy an externally edited asset into ownership after validating its recipe and allocation.
 * @param {object} options Selected owner, edited file and optional explicit plugin recipe; no codec is guessed.
 * @returns {Promise<string>} New owned input path. Failure leaves the prior manifest and input untouched.
 */
export declare function importRomAsset(options: ModificationOperationOptions & {
    id: string;
    sourceFile: string;
    recipe?: OwnedAssetRecipe;
    fill?: number;
}): Promise<string>;
/** Remove ownership while retaining input bytes and a prior manifest for recovery.
 * @param {object} options Owning manifest and stable replacement ID.
 */
export declare function removeRomReplacement(options: {
    manifestFile: string;
    id: string;
}): void;
/** Upgrade a phase-4 project without changing its baseline pin or any owned input.
 * @param {ModificationOperationOptions} options Existing project and trusted verification services.
 * @returns {Promise<string>} Retained snapshot path; external edits are never used as baseline bytes.
 */
export declare function retainRomModificationBaseline(options: ModificationOperationOptions): Promise<string>;
//# sourceMappingURL=modification-operations.d.ts.map