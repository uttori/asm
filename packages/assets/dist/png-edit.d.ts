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
 * Rewrite same-slot palettes or complete indexed canvases. No-op edits return an
 * owned exact copy; palette-only edits retain IDAT, including Adam7. Unsafe private
 * chunks survive only when the caller explicitly validates and retains their names.
 * @param {Uint8Array} source Borrowed complete indexed PNG.
 * @param {IndexedPngEdit} edit Exact replacements, without quantization or palette remapping.
 * @returns {Uint8Array} Owned PNG bytes, encoded with deterministic unfiltered rows for pixel edits.
 */
export declare function rewriteIndexedPng(source: Uint8Array, edit: IndexedPngEdit): Uint8Array;
/**
 * Create an editable PNG with eight-bit indexes and unchanged palette-slot identity.
 * @param {Pick<IndexedImage, "width" | "height" | "indexes" | "palette">} image Exact row-major pixels and RGBA8 palette slots; duplicate colors stay distinct.
 * @returns {Uint8Array} Owned PNG bytes within the asset limits.
 */
export declare function createIndexedPng(image: Pick<IndexedImage, "width" | "height" | "indexes" | "palette">): Uint8Array;
//# sourceMappingURL=png-edit.d.ts.map