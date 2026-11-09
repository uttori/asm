import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameLayout, SpriteAtlasSource } from "./som-types.js";
/**
 * Cross-check all catalogue users against supplied layouts, independent of filesystem/bank names.
 * @param catalog Shared palette catalogue.
 * @param atlases Layouts to reconcile.
 * @returns Mismatches and the number of actual uses.
 */
export declare function inspectSpritePaletteUsers(catalog: SpritePaletteCatalog, atlases: readonly {
    id: string;
    layout: FrameLayout;
}[]): {
    errors: string[];
    uses: number;
};
/**
 * Return explicitly validated native chunk names that an indexed PNG rewrite may retain.
 * Callers supply compression declarations from the include map. Unknown native chunks are
 * not retained implicitly, and an undeclared boss stream fails before authoring changes.
 * @param atlas Atlas PNG and layout.
 * @param catalog Shared palette catalogue.
 * @returns Private PNG chunk names safe to retain.
 */
export declare function frameAtlasPreservedChunks(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog): string[];
/**
 * Plan physical palette-word changes without requiring or rewriting PNG display colors.
 * Shared ROM aliases are updated together; native hidden bits and unedited words stay exact.
 */
export declare function planSpritePaletteWords(catalog: SpritePaletteCatalog, edits: readonly {
    palette: string;
    index: number;
    rgb: number[];
}[]): {
    catalog: SpritePaletteCatalog;
    palettes: string[];
};
/**
 * Plan exact RGB8 edits by catalogue slot. All atlases must be supplied so stale users fail.
 * Results are owned values; the host publishes them together. Variant-only users retain
 * their primary PNG palette. Unrepresentable colors fail instead of being quantized.
 * @param catalog Current shared palette catalogue.
 * @param atlases Identified sources/layouts and optional native compression declarations.
 * @param edits Palette slot edits (index includes firstIndex).
 * @returns Updated catalogue and owned PNG bytes.
 */
export declare function planSpritePaletteEdits(catalog: SpritePaletteCatalog, atlases: readonly SpriteAtlasSource[], edits: readonly {
    palette: string;
    index: number;
    rgb: number[];
}[]): {
    catalog: SpritePaletteCatalog;
    images: Map<string, Uint8Array<ArrayBufferLike>>;
    palettes: string[];
};
//# sourceMappingURL=som-palette-edit.d.ts.map