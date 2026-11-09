import type { AssetInput } from "../registry.js";
/** Inclusive story-variable predicate shared by entities and layout pieces. */
interface RoomCondition {
    variable: number;
    minimum: number;
    maximum: number;
}
/** One object record in the room objects section. */
interface RoomEntity extends RoomCondition {
    flags: number;
    event: number;
    x: number;
    y: number;
    orientationAndLayer: number;
    entity: number;
    interaction: number;
}
/** Native conditional placement in 16-pixel metatile units; a layer transition retains its explicit marker. */
export interface RoomPiece extends RoomCondition {
    /** Optional FE/FF layer transition marker preceding this piece. */
    marker?: number;
    /** Active BG layer after applying any preceding marker. */
    layer: number;
    /** One-based layout id referenced by preview sidecars. */
    layout: number;
    /** Horizontal metatile origin in 16-pixel units. */
    x: number;
    /** Vertical metatile origin in 16-pixel units. */
    y: number;
}
/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references. */
export interface RoomAsset {
    /** Room record discriminator. */
    format: string;
    /** Room schema revision. */
    version: number;
    /** Native room id in 0..510. */
    id: number;
    /** Eight-byte header selecting preview tileset and loader context. */
    header: number[];
    /** Object records repacked into the objects ROM span. */
    entities: RoomEntity[];
    /** Conditional layout pieces repacked into the assembly span. */
    pieces: RoomPiece[];
    /** Packed trigger words for the triggers span. */
    triggers: number[];
    /** Fixed ROM ownership for each repackable section. */
    sections?: Record<string, {
        address: number;
        bytes: number;
    }>;
    /** Default story-variable values used when previewing. */
    previewStory?: Record<string, number>;
    /** Optional human label; not encoded into ROM. */
    name?: string;
}
/** Metatile grid captured for one layout id in a preview sidecar. */
interface RoomPreviewLayout {
    tiles: number[];
    width: number;
    height: number;
}
/** Planar graphics and palette words for one preview tileset key. */
interface RoomPreviewTileset {
    graphics: string;
    graphicsKnown: string;
    colors: number[];
    layerWords: number[][];
}
/** Captured tilesets and layouts used only by the room preview. */
export interface RoomPreview {
    /** Preview sidecar discriminator. */
    format: string;
    /** Preview schema revision. */
    version: number;
    /** Tileset records keyed by header-derived preview id. */
    tilesets: Record<string, RoomPreviewTileset>;
    /** Layout metatile grids keyed by layout id. */
    layouts: Record<string, RoomPreviewLayout>;
    /** Descriptive capture/initial-loader evidence; source write authority is resolved separately. */
    provenance?: unknown;
}
/**
 * One room owns three discontiguous sections; shared layouts, graphics and palettes remain references.
 * @param source JSON room records.
 * @returns Validated room.
 */
export declare function parseRoomAsset(source: AssetInput): RoomAsset;
/**
 * Parse a captured preview sidecar. Render still checks tileset and layout contents.
 * @param bytes JSON bytes for a `som.room.preview` document.
 * @returns Preview envelope with tileset and layout records.
 */
export declare function parseRoomPreview(bytes: Uint8Array): RoomPreview;
/**
 * Repack one fixed section. Changing record counts or adding layer markers requires relocation,
 * so length changes fail instead of silently overwriting an adjacent room's records.
 * @param room Editable room records.
 * @param section `objects`, `assembly`, or `triggers`.
 * @returns Native bytes for that fixed span.
 */
export declare function encodeRoomSection(room: RoomAsset, section: string): Uint8Array<ArrayBuffer>;
/**
 * Validate every section, so an invalid edit cannot hide behind a different include.
 * @param source Serialized editable room records.
 * @param options Selects one of the three fixed ROM spans.
 * @returns Validated native bytes for all spans.
 */
export declare function convertRoomAsset(source: AssetInput, options: Readonly<Record<string, unknown>>): {
    primaryOutput: string;
    outputs: Record<string, {
        bytes: Uint8Array;
    }>;
};
/**
 * Validate the selected captured tileset and compose current conditional placements at native scale.
 * @param room Editable room records.
 * @param preview Captured tilesets and layouts.
 * @param [layer] Background layer 1, 2, or both when omitted.
 * @param [story] Story-variable overrides.
 * @returns Native-scale preview.
 */
export declare function renderRoomAsset(room: RoomAsset, preview: RoomPreview, { layer, story }?: {
    layer?: unknown;
    story?: Readonly<Record<string, number>>;
}): {
    rgba: Uint8Array;
    width: number;
    height: number;
    tileset: string;
    activePieces: number[];
    limitation: string;
};
export {};
//# sourceMappingURL=som-room-assets.d.ts.map