export { sourceContentHash } from "../internal/source-inputs.js";
import { type SourceRepository } from "./git.js";
/** Generated metadata describes the baseline, never a restriction on editing working files. */
export declare const SOURCE_GENERATION_FILE = ".uttori/generation.json";
/** Small immutable input identities. Large evidence remains in a separately retained private input store. */
export interface SourceGenerationInputs {
    /** Explicit linked generation intent survives Prepare/Preview/Apply before the new configuration is adopted. */
    readonly assembly?: "linked";
    /** Project slug bound into the generation descriptor. */
    readonly project: string;
    /** Original ROM content hash the generation must rebuild. */
    readonly romSha256: string;
    /** Compact evidence snapshot hash included in the generation inputs. */
    readonly evidenceSha256: string;
    /** Selected Git research snapshot hash included in the generation inputs. */
    readonly researchSha256: string;
    /** Portable archive/evidence inventory; absent only from generations created before catalog adoption. */
    readonly captureCatalogSha256?: string;
    /** Resolved plugin toolchain fingerprint recorded with the generation. */
    readonly toolchainSha256: string;
    /** Hash of target-specific generation options affecting admission checks. */
    readonly optionsSha256: string;
}
/** Exact generated payload. Binary bytes are stored as ordinary Git blobs without text conversion. */
export interface SourceGenerationFile {
    /** Repository-relative path stored as a Git blob in the pure generation commit. */
    readonly path: string;
    /** Exact file bytes written to the generation tree without text normalization. */
    readonly bytes: Uint8Array;
    /** When true, the blob is stored with the executable Git mode bit. */
    readonly executable?: boolean;
}
/** Content identity excludes this descriptor, avoiding a self-referential commit or file hash. */
export interface SourceGenerationDescriptor {
    /** Generation metadata discriminator stored at `.uttori/generation.json`. */
    readonly format: "uttori-source-generation";
    /** Compact input identities hashed into the generation descriptor. */
    readonly inputs: SourceGenerationInputs;
    /** Content hash over every payload file listed in the pure generation commit. */
    readonly payloadSha256: string;
    /** Stable generation id distinct from the Git commit hash. */
    readonly id: string;
}
/** A retained candidate can be merged or discarded without relying on reflog expiry. */
export interface SourceGeneration {
    /** Immutable Git commit object containing the pure generation tree. */
    readonly commit: string;
    /** Root tree object id for the generation commit. */
    readonly tree: string;
    /** Candidate or preview ref retaining the generation in this worktree. */
    readonly ref: string;
    /** Parsed descriptor read from the generation metadata file. */
    readonly descriptor: SourceGenerationDescriptor;
}
/** Git modes and blob identities are sufficient to compare the export with an adoption checkpoint. */
export interface SourceGenerationEntry {
    /** Repository-relative path inside the generation commit. */
    readonly path: string;
    /** Git blob mode recorded for the path. */
    readonly mode: "100644" | "100755";
    /** Git blob object id for the file contents. */
    readonly blob: string;
    /** Content hash verified from the blob bytes. */
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
/** Retain an immutable generation per worktree until preparation supersedes it or a merge accepts it. */
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