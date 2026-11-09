import type { IndexedColor } from "../indexed-values.js";
import type { RoomAsset, RoomPiece, RoomPreview } from "./som-room-assets.js";
/** An active declaration with placement in 16-pixel metatile units, retaining its source-order identity. */
export interface SomRoomActivePiece extends RoomPiece {
    /** Index in the room piece list preserving declaration order. */
    readonly sourceIndex: number;
    /** Layout width in metatile units after story filtering. */
    readonly width: number;
    /** Layout height in metatile units after story filtering. */
    readonly height: number;
}
/** One expanded 8x8 native cell. Physical tile/palette identities are descriptive until a source adapter proves ownership. */
export interface SomRoomCell {
    /** Left edge of the 8×8 cell in composition pixels. */
    readonly x: number;
    /** Top edge of the 8×8 cell in composition pixels. */
    readonly y: number;
    /** Static metatile id from the active layout grid. */
    readonly metatile: number;
    /** Native BG map word for this quadrant. */
    readonly word: number;
    /** VRAM tile index referenced by the map word. */
    readonly tile: number;
    /** Three-bit palette bank from the map word. */
    readonly palette: number;
    /** Horizontal flip taken from the map word. */
    readonly flipX: boolean;
    /** Vertical flip taken from the map word. */
    readonly flipY: boolean;
}
/** Mode-1 background pass in low-to-high draw order; transparent native zero never covers an earlier pass. */
export interface SomRoomPass {
    /** BG layer rendered in this pass. */
    readonly layer: 1 | 2;
    /** Priority bit selecting cells for this pass. */
    readonly priority: 0 | 1;
    /** Draw-ordered 8×8 cells belonging to the pass. */
    readonly cells: readonly SomRoomCell[];
}
/**
 * Owned native-resolution composition shared by previews and file presentations.
 * Includes every physical preview tile, its byte coverage, exact palette words and loader provenance.
 * None of these captured values alone grants permission to modify a source resource.
 */
export interface SomRoomComposition {
    /** Composition width in pixels at native scale. */
    readonly width: number;
    /** Composition height in pixels at native scale. */
    readonly height: number;
    /** Preview tileset key derived from the room header. */
    readonly tileset: string;
    /** Story-active pieces expanded with layout dimensions. */
    readonly activePieces: readonly SomRoomActivePiece[];
    /** Row-major final metatile IDs for BG1/BG2; -1 means no piece, while native ID zero is real data. */
    readonly metatiles: readonly [Int16Array, Int16Array];
    /** Mode-1 draw passes ordered low-to-high priority. */
    readonly passes: readonly SomRoomPass[];
    /** Borrowed planar tile bytes from the preview sidecar. */
    readonly graphics: Uint8Array;
    /** Per-byte coverage mask parallel to `graphics`. */
    readonly graphicsKnown: Uint8Array;
    /** Decoded 8×8 index tiles referenced by map words. */
    readonly tiles: readonly Uint8Array[];
    /** CGRAM words captured with the preview tileset. */
    readonly paletteWords: Uint16Array;
    /** Display colors derived from palette words for rendering. */
    readonly palette: readonly IndexedColor[];
    /** Optional capture provenance cloned from the preview sidecar. */
    readonly provenance?: unknown;
    /** Human-readable scope note for preview limitations. */
    readonly limitation: string;
}
/** Preserve the room preview's floor-based 5-bit expansion; native high bits remain in paletteWords. */
export declare function somRoomPaletteColor(word: number, transparent: boolean): IndexedColor;
/** Invert the established floor expansion exactly, preserving bit 15; off-grid RGB8 colors require an explicit user correction. */
export declare function somRoomPaletteWord(before: number, color: IndexedColor): number;
/** Resolve inclusive story predicates and native piece overwrite order before expanding metatile quadrants. */
export declare function composeSomRoom(room: RoomAsset, preview: RoomPreview, story?: Readonly<Record<string, number>>): SomRoomComposition;
/** Render the shared Mode-1 value at native scale, preserving the established opaque preview backdrop. */
export declare function renderSomRoomComposition(composition: SomRoomComposition, layer?: 1 | 2): {
    readonly rgba: Uint8Array;
    readonly width: number;
    readonly height: number;
};
//# sourceMappingURL=som-room-composition.d.ts.map