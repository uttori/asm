/** RGBA8 display slot; its array index remains an identity even when colors are equal. */
export type SpriteEditorColor = [number, number, number, number];
/** One identified indexed image. Pixel owners are fixed; placement views have immutable artwork. */
export interface SpriteEditorImage {
    readonly id: string;
    readonly owner: string;
    readonly frame: string;
    readonly role: "pixels" | "placement";
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
    readonly indexes: readonly number[];
    readonly allowedIndexes: readonly number[];
    /** Inclusive absolute editor-coordinate limits. Native units are supplied by the adapter. */
    readonly moveBounds?: readonly [number, number, number, number];
}
/** Portable session description. Source paths, codecs and native ownership stay in the host baseline. */
export interface SpriteEditorBundle {
    readonly format: "uttori-sprite-editor";
    readonly version: 1;
    readonly session: string;
    readonly adapter: string;
    readonly width: number;
    readonly height: number;
    readonly transparentIndex: number;
    readonly palette: readonly SpriteEditorColor[];
    readonly editablePaletteIndexes: readonly number[];
    readonly frames: readonly string[];
    readonly images: readonly SpriteEditorImage[];
}
/** Extracted cel state; display names and runtime image IDs are deliberately absent. */
export interface SpriteEditorCel {
    readonly id: string;
    readonly frame: string;
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
    readonly indexes: readonly number[];
    readonly opacity: number;
    readonly zIndex: number;
    readonly layerOrder: number;
}
/** Untrusted editing result. Validate it against a host-owned bundle before invoking an adapter. */
export interface SpriteEditorResult {
    readonly format: "uttori-sprite-result";
    readonly version: 1;
    readonly session: string;
    readonly width: number;
    readonly height: number;
    readonly transparentIndex: number;
    readonly palette: readonly SpriteEditorColor[];
    readonly frames: readonly string[];
    readonly images: readonly SpriteEditorCel[];
}
/** Supported deltas, with absolute positions and same-slot palette colors. All arrays are owned copies. */
export interface SpriteEditorChanges {
    readonly pixels: readonly {
        id: string;
        indexes: number[];
    }[];
    readonly positions: readonly {
        id: string;
        x: number;
        y: number;
    }[];
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