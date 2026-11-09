import type { AssetInput } from "../registry.js";
/** One authored 8×8 source rectangle inside a frame atlas. */
export interface FrameTilePlacement {
    /** Left edge in atlas pixels; the 8×8 rectangle must lie inside the atlas. */
    x: number;
    /** Top edge in atlas pixels; the 8×8 rectangle must lie inside the atlas. */
    y: number;
    /** Mirror the authored rectangle horizontally when reading native pixels; forbidden in native-strip storage. */
    flipX?: boolean;
    /** Mirror the authored rectangle vertically when reading native pixels; forbidden in native-strip storage. */
    flipY?: boolean;
}
/** Native-order strip that owns tile pixels independently of pose geometry. */
export interface FrameTileAtlas {
    /** Strip rectangle as `[x, y, width, height]` in atlas pixels; never overlaps a pose or another strip. */
    bounds: readonly [number, number, number, number];
    /** Tiles per strip row; tile `i` sits at column `i % columns`, row `floor(i / columns)`. */
    columns: number;
    /** Pixel pitch between adjacent tile origins; at least 8. */
    step: number;
    /** Unique segment tile indexes painted only in the strip because no pose displays them. */
    sourceOnly: number[];
}
/** One ROM graphics span and the editor rectangles that sample it. */
export interface FrameSegment {
    /** Authoritative rectangles in native tile order; each 4bpp tile occupies 32 ROM bytes. */
    tiles: FrameTilePlacement[];
    /** Zero-based source palette group in the layout's paletteRefs array. */
    palette: number;
    /** Six hexadecimal digits naming the first native byte, without a dollar or 0x prefix. */
    romAddress: string;
    /** Stable tile storage; required for every segment when the layout uses `native-strip` sources. */
    tileAtlas?: FrameTileAtlas;
}
/** Alternate catalogue palette for one source group. */
export interface FramePaletteVariant {
    /** Zero-based paletteRefs group the variant can replace. */
    group: number;
    /** Palette catalogue identifier; must resolve in the shared catalogue. */
    palette: string;
}
/** Pointer-bounded body record shared by one or more editor poses. */
export interface NativeFrameRecord {
    /** 24-bit ROM address of the record's first byte. */
    address: number;
    /** Exclusive 24-bit end address; `end - address` equals the byte length. */
    end: number;
    /** Original record bytes; absent for boss capture parts that use a separate codec. */
    bytes?: Uint8Array | number[];
}
/** Read-only tile that lives outside the atlas's owned graphics. */
export interface ExternalTileRef {
    /** Six uppercase hexadecimal digits naming the tile's first ROM byte. */
    romAddress: string;
    /** 64 row-major 4bpp palette indexes; all zeros marks a blank tile. */
    indexes: number[];
}
/** ROM address or `[segment, tile]` reference stored in a native block. */
export type TileReference = number | readonly [string, number];
/** One native sprite block before it is expanded into tile occurrences. */
export interface FrameBlock {
    /** Non-empty identifier unique within its pose. */
    id: string;
    /** Square edge in pixels: 8, 16, 32 or 64; native body blocks are always 16. */
    size: number;
    /** Row-major references, one per 8×8 cell; the length is `(size / 8) ** 2`. */
    tiles: TileReference[];
    /** Mirror the whole block horizontally. */
    flipX: boolean;
    /** Mirror the whole block vertically; native body blocks never set it. */
    flipY: boolean;
    /** Horizontal offset in pixels relative to the pose origin. */
    x: number;
    /** Vertical offset in pixels relative to the pose origin. */
    y: number;
    /** Native high-priority bit; must match the decoded body record when one is retained. */
    priority?: boolean;
    /** Display-only paletteRefs index for this block; overrides the pose and native segment defaults. */
    paletteGroup?: number;
}
/** One derived 8×8 occurrence. External blanks stay outside owned storage. */
export interface FramePlacement {
    /** `<block>:tile-<n>` identity derived from the owning block and cell index. */
    id: string;
    /** Owning block identifier. */
    block?: string;
    /** Row-major cell index within the owning block. */
    quadrant?: number;
    /** Horizontal offset in pixels relative to the pose origin. */
    x: number;
    /** Vertical offset in pixels relative to the pose origin. */
    y: number;
    /** Mirror the occurrence horizontally. */
    flipX?: boolean;
    /** Mirror the occurrence vertically. */
    flipY?: boolean;
    /** Owned segment name; absent when the occurrence is external. */
    segment?: string;
    /** Zero-based tile index within `segment`. */
    tile?: number;
    /** Read-only tile outside owned storage; exclusive with `segment`/`tile`. */
    external?: ExternalTileRef;
    /** Display group derived from its block; never changes the authoritative native tile indexes. */
    paletteGroup?: number;
}
/** One pose: editor bounds plus optional retained composition. */
export interface FrameRecord {
    /** Non-empty string or safe integer, unique within the layout. */
    id: string | number;
    /** Pose rectangle as `[x, y, width, height]` in atlas pixels. */
    bounds: [number, number, number, number];
    /** Editable native blocks; required when a native body record is retained. */
    blocks?: FrameBlock[];
    /** Derived occurrences; must equal the expansion of `blocks` when composition is retained. */
    placements?: FramePlacement[];
    /** Raw body record evidence; poses that share an address must carry identical records. */
    nativeFrame?: NativeFrameRecord;
    /** Retained castle-boss record identity; its different encoding is read-only through ordinary body-coordinate edits. */
    bossFrame?: NativeFrameRecord;
    /** Atlas-pixel position that placement offsets are relative to; required with retained composition. */
    origin?: [number, number];
    /** Optional paletteRefs index for displayed occurrences; native tile authorities keep their segment palette. */
    paletteGroup?: number;
}
/** Version 1 frame-atlas sidecar shared by inspection, encoding, and authoring. */
export interface FrameLayout {
    /** Sidecar format version. */
    version: 1;
    /** Exact PNG width in pixels. */
    width: number;
    /** Exact PNG height in pixels. */
    height: number;
    /** Graphics spans keyed by segment name; key order is the native segment order. */
    segments: Record<string, FrameSegment>;
    /** One to fifteen palette catalogue identifiers; group `g` occupies PNG indexes `g * 16` to `g * 16 + 15`. */
    paletteRefs: string[];
    /** Stable PNG index colors at adoption. Catalog colors may change without rewriting pixel sources. */
    indexPalette?: [number, number, number, number][];
    /** PNG index for diagnostic guide pixels; equals `paletteRefs.length * 16` and encodes as color zero. */
    guideIndex: number;
    /** Alternate catalogue palettes offered per source group. */
    paletteVariants?: FramePaletteVariant[];
    /** `native-strip` keeps tile pixels in per-segment strips; absent means tiles are sampled from poses. */
    tileSources?: "native-strip";
    /** Poses; required for whole-atlas validation. */
    frames?: FrameRecord[];
}
/** Scope passed to layout validation and atlas inspection. */
export interface FrameLayoutScope {
    /** Single segment to validate and extract; ignored when `whole` is true. */
    segmentName?: string;
    /** Validate every segment and frame record and extract every segment. */
    whole?: boolean;
}
/** Identified atlas source plus the compression declarations needed to retain native chunks. */
export interface SpriteAtlasSource {
    /** Stable atlas identifier used in diagnostics and edit ownership. */
    id: string;
    /** Indexed PNG holding the authored pixels. */
    source: AssetInput;
    /** Parsed frame-atlas sidecar for `source`. */
    layout: FrameLayout;
    /** Native conversion options keyed by segment name; present only for segments with native storage declarations. */
    nativeOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    /** Complete declared include resources, keyed by the names used in evaluated conversion options. */
    resources?: Readonly<Record<string, AssetInput>>;
}
//# sourceMappingURL=som-types.d.ts.map