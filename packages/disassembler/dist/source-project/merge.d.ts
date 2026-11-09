import { type SourceGeneration } from "./generation.js";
import { type SourceRepository } from "./git.js";
/** Preview describes saved working files, including unstaged edits, without changing Git's real index. */
export interface SourceMergePreview {
    /** Commit at HEAD when the preview was rendered. */
    readonly head: string;
    /** Git tree of the saved working files plus overlays, written through a private index. */
    readonly sourceTree: string;
    /** Pure generation commit proposed for merging. */
    readonly candidate: string;
    /** Accepted generation commit in HEAD's ancestry; the candidate's sole generation parent. */
    readonly base: string;
    /** Merged tree; equals `sourceTree` when the candidate is already the accepted generation. */
    readonly resultTree: string;
    /** Repository-relative paths Git reported as conflicted; empty for a clean merge. */
    readonly conflicts: readonly string[];
    /** Git's full diagnostic stream includes nontext conflicts that have no conflict markers. */
    readonly messages: string;
    /** One retained preview per worktree; replacing this ref releases the previous preview snapshot. */
    readonly ref?: string;
}
/** Verification belongs to an exact staged tree and matching binary/debug-map pair. */
export interface SourceBuildVerification {
    /** SHA-256 of the built binary. */
    readonly outputSha256: string;
    /** SHA-256 of the debug map published with that binary. */
    readonly debugMapSha256: string;
    /** SHA-256 identity of the plugin toolchain that produced the pair. */
    readonly toolchainSha256: string;
    /** Human-readable checks performed; must be non-empty to be accepted. */
    readonly checks: readonly string[];
}
/** Worktree-local recovery hints. Native Git state remains authoritative after terminal operations. */
export interface SourceMergeJournal {
    /** Journal format discriminator. */
    readonly format: "uttori-source-merge";
    /** Random identifier for one merge operation. */
    readonly id: string;
    /** Whether the operation adopts an existing export or merges a regeneration. */
    readonly kind: "adopt" | "regenerate";
    /** Checkpoint commit at HEAD before Git started the merge. */
    readonly before: string;
    /** Pure generation commit being merged. */
    readonly candidate: string;
    /** Candidate pin under `refs/uttori/candidates/` that retains `candidate`. */
    readonly candidateRef: string;
    /** Full `refs/heads/` name of the branch the merge started on. */
    readonly branch: string;
    /** Staged tree that passed build verification; absent until validation succeeds. */
    readonly validatedTree?: string;
    /** Build verification recorded for `validatedTree`. */
    readonly verification?: SourceBuildVerification;
}
/** A journal never reports a terminal commit as verified unless its exact tree was checked. */
export interface SourceMergeStatus {
    /**
     * Reconciled state: `idle` without a journal or after completion on another branch, `merging`
     * while Git's merge of the candidate is pending, `checkpoint` when HEAD is still the pre-merge
     * commit, `committed`/`verified` once the candidate is in HEAD's ancestry, and `diverged` when
     * Git state no longer matches the journal.
     */
    readonly phase: "idle" | "merging" | "checkpoint" | "committed" | "verified" | "diverged";
    /** Commit at HEAD when the status was read. */
    readonly head: string;
    /** Paths with unmerged index entries, including binary and delete conflicts. */
    readonly conflicts: readonly string[];
    /** Recovery journal; omitted whenever the phase is `idle`. */
    readonly journal?: SourceMergeJournal;
}
/**
 * Prepare one replacement proposal while excluding source publication and merge operations.
 * The renderer must verify original-ROM equality before resolving. Rendering failure or cancellation
 * before replacement keeps previous candidates and previews. Replacement commits one Git ref
 * transaction; once published, its proposal remains retained even if the host is interrupted.
 */
export declare function prepareSourceGeneration<T extends {
    readonly generation: SourceGeneration;
}>(repository: SourceRepository, render: () => Promise<T>, signal?: AbortSignal): Promise<T>;
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
/** Apply the previewed merge to a clean checkout using its existing HEAD; leave the result uncommitted. */
export declare function applySourceGeneration(repository: SourceRepository, generation: SourceGeneration, preview: SourceMergePreview): Promise<SourceMergeStatus>;
/**
 * Validate the exact staged/worktree result, then create the ordinary merge commit when needed.
 * Existing terminal commits are verified in place. Git hooks are honored; a hook changing the tree
 * invalidates the receipt rather than receiving a false pass.
 */
export declare function finishSourceGeneration(repository: SourceRepository, options: {
    readonly message: string;
    readonly validate: (tree: string) => Promise<SourceBuildVerification>;
    /** Human-readable phase boundaries, including native work performed between builds. */
    readonly onProgress?: (message: string) => void;
}): Promise<SourceMergeStatus>;
/** Explicitly discard an unneeded pure candidate. Git's usual object expiry controls eventual reclamation. */
export declare function discardSourceGeneration(repository: SourceRepository, candidate: string): Promise<void>;
/** Abort only our active merge. No stash, reset, or untracked-file cleanup is performed. */
export declare function abortSourceGeneration(repository: SourceRepository): Promise<SourceMergeStatus>;
//# sourceMappingURL=merge.d.ts.map