import { type SourceRepository } from "./git.js";
/** Persist ownership before publishing a candidate/preview ref; unknown historical pins are never guessed. */
export declare function registerSourcePinOwner(repository: SourceRepository): Promise<void>;
/**
 * Release only pins whose registered linked-worktree administration was removed by Git.
 * Missing mounts, moved repositories, main-worktree pins and unrecognized refs are preserved.
 */
export declare function pruneSourcePins(repository: SourceRepository): Promise<{
    removed: string[];
    retained: string[];
}>;
//# sourceMappingURL=pins.d.ts.map