import { type SourceGeneration } from "./generation.js";
import { type SourceRepository } from "./git.js";
/** Preview describes saved working files, including unstaged edits, without changing Git's real index. */
export interface SourceMergePreview {
    readonly head: string;
    readonly sourceTree: string;
    readonly candidate: string;
    readonly base: string;
    readonly resultTree: string;
    readonly conflicts: readonly string[];
    /** Git's full diagnostic stream includes nontext conflicts that have no conflict markers. */
    readonly messages: string;
    /** One retained preview per worktree; replacing this ref releases the previous preview snapshot. */
    readonly ref?: string;
}
/** Verification belongs to an exact staged tree and matching binary/debug-map pair. */
export interface SourceBuildVerification {
    readonly outputSha256: string;
    readonly debugMapSha256: string;
    readonly toolchainSha256: string;
    readonly checks: readonly string[];
}
/** Worktree-local recovery hints. Native Git state remains authoritative after terminal operations. */
export interface SourceMergeJournal {
    readonly format: "uttori-source-merge";
    readonly id: string;
    readonly kind: "adopt" | "regenerate";
    readonly before: string;
    readonly candidate: string;
    readonly candidateRef: string;
    readonly branch: string;
    readonly validatedTree?: string;
    readonly verification?: SourceBuildVerification;
}
/** A journal never reports a terminal commit as verified unless its exact tree was checked. */
export interface SourceMergeStatus {
    readonly phase: "idle" | "merging" | "checkpoint" | "committed" | "verified" | "diverged";
    readonly head: string;
    readonly conflicts: readonly string[];
    readonly journal?: SourceMergeJournal;
}
/** Compare source trees using a private index, preserving partial staging in the real index. */
export declare function snapshotSourceTree(repository: SourceRepository, overlays?: readonly {
    readonly path: string;
    readonly bytes: Uint8Array;
}[]): Promise<string>;
/** Render a merge preview against saved edits. No commit is added to the user's branch. */
export declare function previewSourceGeneration(repository: SourceRepository, candidate: string, overlays?: readonly {
    readonly path: string;
    readonly bytes: Uint8Array;
}[]): Promise<SourceMergePreview>;
/** Reconcile extension restarts and Git operations performed from another terminal. */
export declare function sourceMergeStatus(repository: SourceRepository): Promise<SourceMergeStatus>;
/**
 * Adopt a verified existing export exactly once. The caller explicitly requested initialization;
 * the pending merge still needs normal validation and a user-visible commit.
 */
export declare function adoptSourceGeneration(repository: SourceRepository, generation: SourceGeneration): Promise<SourceMergeStatus>;
/** Apply only the previewed source contents after a clean explicit checkpoint. */
export declare function applySourceGeneration(repository: SourceRepository, generation: SourceGeneration, preview: SourceMergePreview): Promise<SourceMergeStatus>;
/**
 * Validate the exact staged/worktree result, then create the ordinary merge commit when needed.
 * Existing terminal commits are verified in place. Git hooks are honored; a hook changing the tree
 * invalidates the receipt rather than receiving a false pass.
 */
export declare function finishSourceGeneration(repository: SourceRepository, options: {
    readonly message: string;
    readonly validate: (tree: string) => Promise<SourceBuildVerification>;
}): Promise<SourceMergeStatus>;
/** Explicitly discard an unneeded pure candidate. Git's usual object expiry controls eventual reclamation. */
export declare function discardSourceGeneration(repository: SourceRepository, candidate: string): Promise<void>;
/** Abort only our active merge. No stash, reset, or untracked-file cleanup is performed. */
export declare function abortSourceGeneration(repository: SourceRepository): Promise<SourceMergeStatus>;
//# sourceMappingURL=merge.d.ts.map