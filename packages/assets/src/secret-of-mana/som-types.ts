import type { AssetInput } from "../registry.js";

/** One authored 8×8 source rectangle inside a frame atlas. */
export interface FrameTilePlacement {
  x: number;
  y: number;
  flipX?: boolean;
  flipY?: boolean;
}

/** Native-order strip that owns tile pixels independently of pose geometry. */
export interface FrameTileAtlas {
  bounds: readonly [number, number, number, number];
  columns: number;
  step: number;
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
  tileAtlas?: FrameTileAtlas;
}

/** Alternate catalogue palette for one source group. */
export interface FramePaletteVariant {
  group: number;
  palette: string;
}

/** Pointer-bounded body record shared by one or more editor poses. */
export interface NativeFrameRecord {
  address: number;
  end: number;
  bytes?: Uint8Array | number[];
}

/** Read-only tile that lives outside the atlas's owned graphics. */
export interface ExternalTileRef {
  romAddress: string;
  indexes: number[];
}

/** ROM address or `[segment, tile]` reference stored in a native block. */
export type TileReference = number | readonly [string, number];

/** One native sprite block before it is expanded into tile occurrences. */
export interface FrameBlock {
  id: string;
  size: number;
  tiles: TileReference[];
  flipX: boolean;
  flipY: boolean;
  x: number;
  y: number;
  priority?: boolean;
}

/** One derived 8×8 occurrence. External blanks stay outside owned storage. */
export interface FramePlacement {
  id: string;
  block?: string;
  quadrant?: number;
  x: number;
  y: number;
  flipX?: boolean;
  flipY?: boolean;
  segment?: string;
  tile?: number;
  external?: ExternalTileRef;
}

/** One pose: editor bounds plus optional retained composition. */
export interface FrameRecord {
  id: string | number;
  bounds: [number, number, number, number];
  blocks?: FrameBlock[];
  placements?: FramePlacement[];
  nativeFrame?: NativeFrameRecord;
  /** Retained castle-boss record identity; its different encoding is read-only through ordinary body-coordinate edits. */
  bossFrame?: NativeFrameRecord;
  origin?: [number, number];
}

/** Version 1 frame-atlas sidecar shared by inspection, encoding, and authoring. */
export interface FrameLayout {
  version: 1;
  width: number;
  height: number;
  segments: Record<string, FrameSegment>;
  paletteRefs: string[];
  /** Stable PNG index colors at adoption. Catalog colors may change without rewriting pixel sources. */
  indexPalette?: [number, number, number, number][];
  guideIndex: number;
  paletteVariants?: FramePaletteVariant[];
  tileSources?: "native-strip";
  frames?: FrameRecord[];
}

/** Scope passed to layout validation and atlas inspection. */
export interface FrameLayoutScope {
  segmentName?: string;
  whole?: boolean;
}

/** Identified atlas source plus the compression declarations needed to retain native chunks. */
export interface SpriteAtlasSource {
  id: string;
  source: AssetInput;
  layout: FrameLayout;
  nativeOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Complete declared include resources, keyed by the names used in evaluated conversion options. */
  resources?: Readonly<Record<string, AssetInput>>;
}
