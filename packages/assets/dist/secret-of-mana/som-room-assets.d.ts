import type { AssetInput } from "../registry.js";
interface RoomCondition {
    variable: number;
    minimum: number;
    maximum: number;
}
interface RoomEntity extends RoomCondition {
    flags: number;
    event: number;
    x: number;
    y: number;
    orientationAndLayer: number;
    entity: number;
    interaction: number;
}
interface RoomPiece extends RoomCondition {
    marker?: number;
    layer: number;
    layout: number;
    x: number;
    y: number;
}
/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references. */
export interface RoomAsset {
    format: string;
    version: number;
    id: number;
    header: number[];
    entities: RoomEntity[];
    pieces: RoomPiece[];
    triggers: number[];
    sections?: Record<string, {
        address: number;
        bytes: number;
    }>;
    previewStory?: Record<string, number>;
    name?: string;
}
interface RoomPreviewLayout {
    tiles: number[];
    width: number;
    height: number;
}
interface RoomPreviewTileset {
    graphics: string;
    graphicsKnown: string;
    colors: number[];
    layerWords: number[][];
}
/** Captured tilesets and layouts used only by the room preview. */
export interface RoomPreview {
    format: string;
    version: number;
    tilesets: Record<string, RoomPreviewTileset>;
    layouts: Record<string, RoomPreviewLayout>;
}
/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references.
 * @param {AssetInput} source JSON room records.
 * @returns {RoomAsset} Validated room.
 */
export declare function parseRoomAsset(source: AssetInput): RoomAsset;
/** Parse a captured preview sidecar. Render still checks tileset and layout contents.
 * @param {Uint8Array} bytes JSON bytes for a `som.room.preview` document.
 * @returns {RoomPreview} Preview envelope with tileset and layout records.
 */
export declare function parseRoomPreview(bytes: Uint8Array): RoomPreview;
/**
 * Repack one fixed section. Changing record counts or adding layer markers requires relocation,
 * so length changes fail instead of silently overwriting an adjacent room's records.
 * @param {RoomAsset} room Editable room records.
 * @param {string} section `objects`, `assembly`, or `triggers`.
 * @returns {Uint8Array} Native bytes for that fixed span.
 */
export declare function encodeRoomSection(room: RoomAsset, section: string): Uint8Array<ArrayBuffer>;
/**
 * Validate every section, so an invalid edit cannot hide behind a different include.
 * @param {{mediaType: string, bytes: Uint8Array}} source Serialized editable room records.
 * @param {{section?: unknown}} options Selects one of the three fixed ROM spans.
 * @returns {{primaryOutput: string, outputs: Record<string, {bytes: Uint8Array}>}} Validated native bytes for all spans.
 */
export declare function convertRoomAsset(source: AssetInput, options: Readonly<Record<string, unknown>>): {
    primaryOutput: string;
    outputs: Record<string, {
        bytes: Uint8Array;
    }>;
};
/** Validate the selected captured tileset and compose current conditional placements at native scale.
 * @param {RoomAsset} room Editable room records.
 * @param {RoomPreview} preview Captured tilesets and layouts.
 * @param {unknown} [layer] Background layer 1, 2, or both when omitted.
 * @param {Readonly<Record<string, number>>} [story] Story-variable overrides.
 * @returns {{rgba: Uint8Array, width: number, height: number, tileset: string, activePieces: number[], limitation: string}} Native-scale preview.
 */
export declare function renderRoomAsset(room: RoomAsset, preview: RoomPreview, { layer, story }?: {
    layer?: unknown;
    story?: Readonly<Record<string, number>>;
}): {
    rgba: Uint8Array<ArrayBuffer>;
    width: number;
    height: number;
    tileset: string;
    activePieces: number[];
    limitation: string;
};
export {};
//# sourceMappingURL=som-room-assets.d.ts.map