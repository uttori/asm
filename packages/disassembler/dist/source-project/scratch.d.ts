import type { SourceRepository } from "./git.js";
/** Private, disposable work; none of these directories can contain authoritative source or evidence. */
type ScratchPurpose = "generation" | "preview" | "prepare";
/** Cleanup reports uncertain ownership instead of deleting unrecognized data. */
export interface SourceScratchCleanup {
    /** Scratch directories reclaimed after proving an owner record and active lease. */
    readonly removed: string[];
    /** Paths left intact because ownership, shape, or concurrent use could not be verified. */
    readonly retained: {
        readonly path: string;
        readonly reason: string;
    }[];
}
/** Reclaim interrupted owned work in this worktree; never inspect or alter its source checkout. */
export declare function pruneSourceScratch(repository: SourceRepository): SourceScratchCleanup;
/**
 * A leased directory survives SIGKILL only until the next source operation.
 * Creation/publication of the owner record is serialized with cleanup; dispose belongs in finally.
 */
export declare function createSourceScratch(repository: SourceRepository, purpose: ScratchPurpose): {
    readonly directory: string;
    readonly cleanup: SourceScratchCleanup;
    dispose(): void;
};
export {};
//# sourceMappingURL=scratch.d.ts.map