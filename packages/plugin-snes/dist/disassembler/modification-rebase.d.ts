import { buildModifiedRom, type ModificationOperationOptions } from "./modification-project.js";
/** Each conflict preserves base/new/owned bytes and the stable replacement owner at a file offset. */
export interface RebaseConflict {
    readonly id: string;
    readonly offset: number;
    readonly size: number;
    readonly reason: string;
    readonly base: string;
    readonly incoming: string;
    readonly owned: string;
}
/** A rebase creates a new owned project. The original project, captures and last successful build stay intact. */
export interface RomRebaseReview {
    readonly format: "uttori-rom-rebase-review";
    readonly originalManifest: string;
    readonly originalSha256: string;
    readonly candidateManifest: string;
    readonly candidateSha256: string;
    /** Candidate files manually reconciled since the initial fork; original versions remain under .old-owned/inputs. */
    readonly editedInputs?: readonly string[];
    readonly originalInputHashes: Readonly<Record<string, string>>;
    readonly candidateBuild?: {
        readonly outputPath: string;
        readonly changedBytes: number;
    };
    readonly buildError?: string;
    readonly inputHashes: Readonly<Record<string, string>>;
    readonly conflicts: readonly RebaseConflict[];
    /** User resolves each conflict explicitly; absent entries block acceptance. */
    readonly resolutions: Readonly<Record<string, "keep-owned" | "take-baseline">>;
    readonly baseRom: string;
    readonly ownedRom: string;
    readonly newRom: string;
}
/** Assemble a retained generation in a scratch owned project. Plugin paths still resolve from the original config.
 * @param {object} options Existing project, host services and scratch directory under its review folder.
 * @returns {Promise<object>} Verified old owned output, independently of newer or externally edited live source.
 */
export declare function buildRetainedModification(options: ModificationOperationOptions & {
    directory: string;
}): Promise<Awaited<ReturnType<typeof buildModifiedRom>>>;
/** Prepare a three-way fork against an independently verified new baseline. No old pins are rewritten.
 * @param {object} options Original project, new baseline/ROM and new destination directory.
 * @returns {Promise<string>} Review JSON path. Accept requires explicit conflict decisions and a successful candidate build.
 */
export declare function reviewRomRebase(options: ModificationOperationOptions & {
    sourceDirectory: string;
    romFile: string;
    directory: string;
}): Promise<string>;
/** Accept only the reviewed fork, after validating all conflict choices and rebuilding its exact inputs.
 * @param {object} options Review JSON with user-filled resolutions; other fields remain pinned to the retained review.
 * @returns {Promise<object>} New manifest and verified output; the host may now explicitly select this target.
 */
export declare function acceptRomRebase(options: Omit<ModificationOperationOptions, "manifestFile"> & {
    reviewFile: string;
}): Promise<{
    manifestFile: string;
    build: Awaited<ReturnType<typeof buildModifiedRom>>;
}>;
/** Create a fully user-owned source tree in a new directory, with provenance but no generated manifest.
 * @param {object} options Verified baseline, ROM and fresh destination. Generated files are copied, never edited in place.
 * @returns {Promise<string>} New assembly entry path. Analysis databases and runtime captures remain with their original ROM.
 */
export declare function detachRomSource(options: Omit<ModificationOperationOptions, "manifestFile"> & {
    sourceDirectory: string;
    romFile: string;
    directory: string;
    draft?: {
        readonly reviewFile: string;
        readonly sha256: string;
    };
}): Promise<string>;
/** Rebuild manually reconciled candidate inputs and issue a fresh review without losing earlier versions.
 * @param {object} options Existing review file, its exact digest and trusted build services.
 * @returns {Promise<string>} Updated public review path. Acceptance still needs explicit conflict decisions.
 */
export declare function refreshRomRebaseReview(options: Omit<ModificationOperationOptions, "manifestFile"> & {
    reviewFile: string;
    reviewSha256: string;
}): Promise<string>;
//# sourceMappingURL=modification-rebase.d.ts.map