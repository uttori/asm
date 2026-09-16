/** Reflection over a declared record array; end addresses are exclusive and bases may be index-biased. */
export type StructMetadataProperty = "countof" | "bytesof" | "startof" | "endof";
/**
 * Reflect the physical extent of a struct without changing sizeof's single-record meaning.
 * Missing bounds describe one record at index zero; explicit first indexes undo the biased base.
 * @param {object} definition Final layout and native indexed base, after alignment.
 * @param {StructMetadataProperty} property Requested count, byte extent or physical boundary.
 * @returns {number} Record count, byte count or logical address; never stored record contents.
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