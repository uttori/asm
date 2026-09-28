import type { SourceOwner, SourceOwnershipEntry } from "@uttori/asm-disassembler";
/**
 * Internal markers survive comment wrapping and are removed before publication. Source locations
 * therefore describe the actual formatted files, including comments removed by export policy.
 */
export declare class SourceOwnershipBuilder {
    #private;
    readonly entries: SourceOwnershipEntry[];
    /**
     * Wrap an emitted fragment. Nested owners are allowed for fields within a data record.
     * @param {SourceOwner} owner Persistent entity represented by this fragment.
     * @param {readonly string[]} lines Unformatted source lines, which may contain nested markers.
     * @returns {string[]} Marked source, or an empty array when nothing was emitted.
     */
    mark(owner: SourceOwner, lines: readonly string[]): string[];
    /**
     * Finalize formatted source, recording one-based inclusive ranges without emitting markers.
     * @param {string} file Export-relative source path.
     * @param {string} source Source after comment and declaration formatting.
     * @returns {string} Marker-free source whose locations are now recorded in entries.
     */
    render(file: string, source: string): string;
    /**
     * Attach known definition owners after formatting RAM, hardware, and struct declarations.
     * @param {string} file Export-relative definitions path.
     * @param {string} source Final formatted definitions.
     * @param {ReadonlyMap<string, SourceOwner>} owners Persistent owners keyed by emitted symbol spelling.
     * @returns {string} Unmodified source after recording declaration and comment ranges.
     */
    definitions(file: string, source: string, owners: ReadonlyMap<string, SourceOwner>): string;
}
//# sourceMappingURL=source-ownership.d.ts.map