/** RGBA8 display slot; its array index remains an identity even when colors are equal. */
export type SpriteEditorColor = [number, number, number, number];
/** One identified indexed image. Pixel owners are fixed; placement views have immutable artwork. */
export interface SpriteEditorImage {
    /** Unique image identity within the bundle; 1 to 1024 characters. */
    readonly id: string;
    /** Native owner identity; images sharing an owner must agree on pixels or movement deltas. */
    readonly owner: string;
    /** Identifier of the bundle frame that displays this image. */
    readonly frame: string;
    /** `pixels` images edit artwork at a fixed position; `placement` images move with fixed artwork. */
    readonly role: "pixels" | "placement";
    /** Width in pixels; at most the canvas width. */
    readonly width: number;
    /** Height in pixels; at most the canvas height. */
    readonly height: number;
    /** Absolute editor x of the left edge in pixels; may be negative. */
    readonly x: number;
    /** Absolute editor y of the top edge in pixels; may be negative. */
    readonly y: number;
    /** Row-major palette indexes, `width * height` entries, each in `allowedIndexes`. */
    readonly indexes: readonly number[];
    /** Non-empty unique palette slots this image may use; constrains it to one palette group. */
    readonly allowedIndexes: readonly number[];
    /** Inclusive absolute editor-coordinate limits. Native units are supplied by the adapter. */
    readonly moveBounds?: readonly [number, number, number, number];
}
/** Portable session description. Source paths, codecs and native ownership stay in the host baseline. */
export interface SpriteEditorBundle {
    /** Schema discriminator. */
    readonly format: "uttori-sprite-editor";
    /** Schema version. */
    readonly version: 1;
    /** Session identity a result must echo back unchanged. */
    readonly session: string;
    /** Host adapter identity that interprets the derived deltas. */
    readonly adapter: string;
    /** Canvas width in pixels, 1 to 4096. */
    readonly width: number;
    /** Canvas height in pixels, 1 to 4096. */
    readonly height: number;
    /** Palette slot rendered as transparent; fixed for the session. */
    readonly transparentIndex: number;
    /** Display palette; slot positions are identities even when colors repeat. */
    readonly palette: readonly SpriteEditorColor[];
    /** Unique palette slots whose colors a result may change; all others must stay equal. */
    readonly editablePaletteIndexes: readonly number[];
    /** Non-empty unique frame identities in display order. */
    readonly frames: readonly string[];
    /** Non-empty images in layer order; array position is each image's required `layerOrder`. */
    readonly images: readonly SpriteEditorImage[];
}
/** Extracted cel state; display names and runtime image IDs are deliberately absent. */
export interface SpriteEditorCel {
    /** Identity of the bundle image this cel edits. */
    readonly id: string;
    /** Frame identity; must match the bundle image. */
    readonly frame: string;
    /** Width in pixels; must match the bundle image. */
    readonly width: number;
    /** Height in pixels; must match the bundle image. */
    readonly height: number;
    /** Absolute editor x in pixels; may differ only for placement images within their bounds. */
    readonly x: number;
    /** Absolute editor y in pixels; may differ only for placement images within their bounds. */
    readonly y: number;
    /** Row-major palette indexes; may differ only for pixel images, using allowed slots. */
    readonly indexes: readonly number[];
    /** Cel opacity, 0 to 255; only 255 is accepted. */
    readonly opacity: number;
    /** Cel z-index offset; only 0 is accepted. */
    readonly zIndex: number;
    /** Layer position; must equal the image's index in the bundle. */
    readonly layerOrder: number;
}
/** Untrusted editing result. Validate it against a host-owned bundle before invoking an adapter. */
export interface SpriteEditorResult {
    /** Schema discriminator. */
    readonly format: "uttori-sprite-result";
    /** Schema version. */
    readonly version: 1;
    /** Must equal the bundle session. */
    readonly session: string;
    /** Canvas width in pixels; must equal the bundle. */
    readonly width: number;
    /** Canvas height in pixels; must equal the bundle. */
    readonly height: number;
    /** Transparent palette slot; must equal the bundle. */
    readonly transparentIndex: number;
    /** Edited palette with the bundle's slot count; only editable slots may change. */
    readonly palette: readonly SpriteEditorColor[];
    /** The bundle's frame identities, in any order. */
    readonly frames: readonly string[];
    /** One cel per bundle image, each identity exactly once. */
    readonly images: readonly SpriteEditorCel[];
}
/** Supported deltas, with absolute positions and same-slot palette colors. All arrays are owned copies. */
export interface SpriteEditorChanges {
    /** Pixel images whose indexes differ from the bundle, with complete replacement indexes. */
    readonly pixels: readonly {
        id: string;
        indexes: number[];
    }[];
    /** Placement images that moved, with their new absolute editor coordinates. */
    readonly positions: readonly {
        id: string;
        x: number;
        y: number;
    }[];
    /** Editable palette slots whose RGBA8 color changed. */
    readonly colors: readonly {
        index: number;
        color: SpriteEditorColor;
    }[];
}
/** Bound dimensions, inventory and adapter capabilities before allocating editor images. */
export declare function validateSpriteEditorBundle(bundle: SpriteEditorBundle): void;
/** Validate complete output and derive permitted deltas. No native bytes or files are changed. */
export declare function inspectSpriteEditorResult(bundle: SpriteEditorBundle, input: unknown): SpriteEditorChanges;
/** Build an owned no-edit result for fixtures and adapters. */
export declare function spriteEditorBaselineResult(bundle: SpriteEditorBundle): SpriteEditorResult;
//# sourceMappingURL=sprite-editing.d.ts.map