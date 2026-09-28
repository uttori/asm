import type { IndexedImage } from "./image.js";
/** Indexed edits with explicit optional canvas replacement; palette slots keep their identity. */
export interface IndexedPngEdit {
    readonly palette?: IndexedImage["palette"];
    readonly indexes?: Uint8Array;
    /** Explicit new canvas dimensions; resizing requires a complete replacement index buffer. */
    readonly dimensions?: {
        readonly width: number;
        readonly height: number;
    };
    /** Unsafe ancillary chunks retained only after format-specific validation by the caller. */
    readonly preserveChunks?: readonly string[];
}
/**
 * Rewrite indexed pixels/palette without RGB conversion or index remapping. Palette-only
 * changes retain IDAT bytes (including Adam7). Pixel changes use deterministic unfiltered
 * packed rows. Unknown unsafe ancillary chunks are dropped unless explicitly validated
 * by the caller; safe-to-copy chunks survive. An unchanged edit returns an exact copy.
 * @param {Uint8Array} source Complete indexed PNG validated before rewriting.
 * @param {IndexedPngEdit} edit Pixel/canvas and same-slot palette replacements and validated ancillary chunk names.
 * @returns {Uint8Array} Owned PNG bytes with unchanged palette slot identities.
 */
export declare function rewriteIndexedPng(source: Uint8Array, edit: IndexedPngEdit): Uint8Array;
/** Create an editable indexed PNG without quantization or palette reordering.
 * @param {Pick<IndexedImage, "width" | "height" | "indexes" | "palette">} image Exact pixels and RGBA palette slots; duplicate colors remain distinct slots.
 * @returns {Uint8Array} Owned PNG with eight-bit indexes, validated by the ordinary PNG importer.
 */
export declare function createIndexedPng(image: Pick<IndexedImage, "width" | "height" | "indexes" | "palette">): Uint8Array;
//# sourceMappingURL=png-edit.d.ts.map