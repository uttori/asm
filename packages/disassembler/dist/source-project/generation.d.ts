export { sourceContentHash } from "../internal/source-inputs.js";
import { type SourceRepository } from "./git.js";
/** Generated metadata describes the baseline, never a restriction on editing working files. */
export declare const SOURCE_GENERATION_FILE = ".uttori/generation.json";
/** Small immutable input identities. Large evidence remains in a separately retained private input store. */
export interface SourceGenerationInputs {
    readonly project: string;
    readonly romSha256: string;
    readonly evidenceSha256: string;
    readonly researchSha256: string;
    /** Portable archive/evidence inventory; absent only from generations created before catalog adoption. */
    readonly captureCatalogSha256?: string;
    readonly toolchainSha256: string;
    readonly optionsSha256: string;
}
/** Exact generated payload. Binary bytes are stored as ordinary Git blobs without text conversion. */
export interface SourceGenerationFile {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly executable?: boolean;
}
/** Content identity excludes this descriptor, avoiding a self-referential commit or file hash. */
export interface SourceGenerationDescriptor {
    readonly format: "uttori-source-generation";
    readonly inputs: SourceGenerationInputs;
    readonly payloadSha256: string;
    readonly id: string;
}
/** A retained candidate can be merged or discarded without relying on reflog expiry. */
export interface SourceGeneration {
    readonly commit: string;
    readonly tree: string;
    readonly ref: string;
    readonly descriptor: SourceGenerationDescriptor;
}
/** Git modes and blob identities are sufficient to compare the export with an adoption checkpoint. */
export interface SourceGenerationEntry {
    readonly path: string;
    readonly mode: "100644" | "100755";
    readonly blob: string;
    readonly sha256: string;
}
/**
 * Verify pure payload bytes from Git itself, in bounded batches. Reading a descriptor alone would
 * allow a customized source commit to be used accidentally as the next generation's parent.
 */
export declare function verifySourceGeneration(repository: SourceRepository, commit: string): Promise<{
    descriptor: SourceGenerationDescriptor;
    files: SourceGenerationEntry[];
}>;
/** Each worktree owns its pins even when another worktree prepares the identical immutable commit. */
export declare function sourceCandidateRef(repository: SourceRepository, commit: string): string;
/** Bound candidate pins atomically per worktree; reuse and direct CLI selection obey the same limit. */
export declare function pinSourceCandidate(repository: SourceRepository, commit: string, signal?: AbortSignal): Promise<string>;
/** Validate all externally loaded identity fields before using a descriptor for ancestry selection. */
export declare function parseSourceGeneration(value: unknown): SourceGenerationDescriptor;
/** Read generation metadata from an immutable commit, never the edited worktree. */
export declare function generationAt(repository: SourceRepository, commit: string): Promise<SourceGenerationDescriptor>;
/**
 * Write a pure generation using an alternate index. The user's files and staging area are never
 * checked out or changed. The renderer must finish pure-ROM validation before calling this function.
 */
export declare function retainSourceGeneration(repository: SourceRepository, options: {
    readonly files: readonly SourceGenerationFile[];
    readonly inputs: SourceGenerationInputs;
    readonly parent?: string;
    readonly signal?: AbortSignal;
}): Promise<SourceGeneration>;
/** Find the accepted pure parent in ordinary source ancestry; a descriptor alone is not a GC root. */
export declare function acceptedSourceGeneration(repository: SourceRepository, sourceCommit: string): Promise<string>;
//# sourceMappingURL=generation.d.ts.map