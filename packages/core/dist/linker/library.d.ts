import type { AssemblyModule } from "../relocatable.js";
/** Bumps when archive metadata layout is incompatible with prior readers. */
export declare const LIBRARY_FORMAT_VERSION = 1;
/** Archive order defines provider priority. Names are identities, never filesystem paths to reopen. */
export interface LibraryMemberInput {
    /** Stable archive member identity distinct from module id. */
    readonly name: string;
    /** Encoded native object bytes for this member. */
    readonly object: Uint8Array;
}
/** Parsed member with verified object hash and export list. */
export interface LibraryMember extends LibraryMemberInput {
    /** Decoded module graph validated against archive metadata. */
    readonly module: AssemblyModule;
    /** Content hash of the member object payload. */
    readonly sha256: string;
    /** Exported symbol names defined by the decoded module. */
    readonly exports: readonly string[];
}
/** A verified index maps each global name to member indices in archive order. */
export interface RelocatableLibrary {
    /** Members in archive order; index positions match extraction priority. */
    readonly members: readonly LibraryMember[];
    /** Global name to member index lists for fixed-point library resolution. */
    readonly index: ReadonlyMap<string, readonly number[]>;
}
/** Build an indexed archive of complete native objects. Member identities and exports are derived, not supplied. */
export declare function encodeLibrary(inputs: readonly LibraryMemberInput[]): Uint8Array;
/** Authenticate every member/index once, then reuse parsed modules during fixed-point extraction. */
export declare function decodeLibrary(bytes: Uint8Array): RelocatableLibrary;
//# sourceMappingURL=library.d.ts.map