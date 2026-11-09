/** Reflection over a declared record array. End addresses are exclusive and bases may be index-biased. */
export type StructMetadataProperty = "countof" | "bytesof" | "startof" | "endof";
/**
 * Reflect the physical extent of a struct without changing sizeof's single-record meaning.
 * Missing bounds describe one record at index zero. Explicit first indexes undo the biased base.
 * @param definition Final layout and native indexed base, after alignment.
 * @param property Requested count, byte extent or physical boundary.
 * @returns Record count, byte count or logical address. Never stored record contents.
 */
export declare function getStructMetadata(definition: {
    readonly base: number;
    readonly size: number;
    readonly indexRange?: {
        readonly first: number;
        readonly count: number;
    };
}, property: StructMetadataProperty): number;
//# sourceMappingURL=struct-metadata.d.ts.map