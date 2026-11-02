import type { AssemblyModule } from "../relocatable.js";
export declare const LIBRARY_FORMAT_VERSION = 1;
/** Archive order defines provider priority. Names are identities, never filesystem paths to reopen. */
export interface LibraryMemberInput {
    readonly name: string;
    readonly object: Uint8Array;
}
export interface LibraryMember extends LibraryMemberInput {
    readonly module: AssemblyModule;
    readonly sha256: string;
    readonly exports: readonly string[];
}
/** A verified index maps each global name to member indices in archive order. */
export interface RelocatableLibrary {
    readonly members: readonly LibraryMember[];
    readonly index: ReadonlyMap<string, readonly number[]>;
}
/** Build an indexed archive of complete native objects. Member identities and exports are derived, not supplied. */
export declare function encodeLibrary(inputs: readonly LibraryMemberInput[]): Uint8Array;
/** Authenticate every member/index once, then reuse parsed modules during fixed-point extraction. */
export declare function decodeLibrary(bytes: Uint8Array): RelocatableLibrary;
//# sourceMappingURL=library.d.ts.map