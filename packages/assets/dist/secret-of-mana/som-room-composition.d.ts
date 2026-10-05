import type { IndexedColor } from "../indexed-values.js";
import type { RoomAsset, RoomPiece, RoomPreview } from "./som-room-assets.js";
/** An active declaration with placement in 16-pixel metatile units, retaining its source-order identity. */
export interface SomRoomActivePiece extends RoomPiece {
    readonly sourceIndex: number;
    readonly width: number;
    readonly height: number;
}
/** One expanded 8x8 native cell. Physical tile/palette identities are descriptive until a source adapter proves ownership. */
export interface SomRoomCell {
    readonly x: number;
    readonly y: number;
    readonly metatile: number;
    readonly word: number;
    readonly tile: number;
    readonly palette: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
}
/** Mode-1 background pass in low-to-high draw order; transparent native zero never covers an earlier pass. */
export interface SomRoomPass {
    readonly layer: 1 | 2;
    readonly priority: 0 | 1;
    readonly cells: readonly SomRoomCell[];
}
/**
 * Owned native-resolution composition shared by previews and file presentations.
 * Includes every physical preview tile, its byte coverage, exact palette words and loader provenance.
 * None of these captured values alone grants permission to modify a source resource.
 */
export interface SomRoomComposition {
    readonly width: number;
    readonly height: number;
    readonly tileset: string;
    readonly activePieces: readonly SomRoomActivePiece[];
    /** Row-major final metatile IDs for BG1/BG2; -1 means no piece, while native ID zero is real data. */
    readonly metatiles: readonly [Int16Array, Int16Array];
    readonly passes: readonly SomRoomPass[];
    readonly graphics: Uint8Array;
    readonly graphicsKnown: Uint8Array;
    readonly tiles: readonly Uint8Array[];
    readonly paletteWords: Uint16Array;
    readonly palette: readonly IndexedColor[];
    readonly provenance?: unknown;
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