import type { IndexedColor } from "./indexed-values.js";

/** Editor metadata is descriptive. Native authority belongs to external source bindings. */
export interface IndexedDocumentMetadata {
  /** Opaque editor user data; never interpreted as native authority. */
  userData?: string;
}

/** Flat normal/tilemap layers. Names, visibility and edit locks do not establish native authority. */
export type IndexedDocumentLayer = IndexedDocumentMetadata & {
  /** Layer label in the indexed editor profile. */
  readonly name: string;
  /** Editor visibility/lock flags in the shared indexed profile; these never grant native ownership. */
  readonly flags: number;
  /** Optional stable layer identity from the source editor. */
  readonly uuid?: string;
} & ({ readonly kind: "raster" } | { readonly kind: "tilemap"; readonly tileset: number });

/** Embedded indexed storage in vertical tile order. Base index only changes the editor's numbering. */
export interface IndexedDocumentTileset extends IndexedDocumentMetadata {
  /** Container-local identifier. Native tile identity comes from the external owner mapping. */
  readonly id: number;
  /** Tileset label in the indexed editor profile. */
  readonly name: string;
  /** Editor visibility and lock flags for the tileset. */
  readonly flags: number;
  /** First tile index shown in the editor for this tileset. */
  readonly baseIndex: number;
  /** Width of each tile in pixels. */
  readonly tileWidth: number;
  /** Height of each tile in pixels. */
  readonly tileHeight: number;
  /** Number of tiles stored in `indexes`. */
  readonly tileCount: number;
  /** Row-major palette indexes for all tiles in vertical tile order. */
  readonly indexes: Uint8Array;
  /** Optional per-tile metadata in the same order as the tile pixel storage. */
  readonly tileData: readonly (string | undefined)[];
}

/** Pixel offsets and z-index belong to the occurrence, including when its payload is linked. */
interface CelPosition extends IndexedDocumentMetadata {
  /** Target layer index for this cel occurrence. */
  readonly layer: number;
  /** Signed canvas offsets in pixels. */
  readonly x: number;
  /** Signed vertical offset from the canvas origin in pixels. */
  readonly y: number;
  /** Draw order among cels on the same layer. */
  readonly zIndex: number;
}

/** Linked cels share one decoded payload; they never allocate a copied image for each timeline frame. */
export type IndexedDocumentCel = CelPosition &
  (
    | {
        readonly kind: "raster";
        /** Cel width in pixels for embedded raster payload. */
        readonly width: number;
        /** Cel height in pixels for embedded raster payload. */
        readonly height: number;
        /** Row-major palette indexes for the cel image. */
        readonly indexes: Uint8Array;
      }
    | { readonly kind: "linked"; readonly frame: number }
    | {
        readonly kind: "tilemap";
        /** Tilemap width in cells. */
        readonly columns: number;
        /** Tilemap height in cells. */
        readonly rows: number;
        /** Bit width of packed tile references in each cell. */
        readonly bits: 8 | 16 | 32;
        /** Bit mask extracting the tile id from a packed cell. */
        readonly idMask: number;
        /** Bit mask for horizontal flip in packed cells. */
        readonly flipXMask: number;
        /** Bit mask for vertical flip in packed cells. */
        readonly flipYMask: number;
        /** Bit mask for diagonal flip in packed cells. */
        readonly diagonalMask: number;
        /** Packed tile references in row-major order. */
        readonly cells: Uint32Array;
      }
  );

/** One global duration in milliseconds. Separate layer clocks are not part of this file profile. */
export interface IndexedDocumentFrame {
  /** Hold duration for this timeline frame in milliseconds. */
  readonly durationMs: number;
  /** Cels active on this timeline frame. */
  readonly cels: readonly IndexedDocumentCel[];
}

/** Inclusive timeline range with indexed playback direction and repeat count. */
export interface IndexedDocumentTag extends IndexedDocumentMetadata {
  /** Tag label used by the indexed editor. */
  readonly name: string;
  /** Inclusive first timeline frame index. */
  readonly from: number;
  /** Inclusive last timeline frame index. */
  readonly to: number;
  /** 0 forward, 1 reverse, 2 ping-pong, 3 reverse ping-pong. */
  readonly direction: number;
  /** Zero means unspecified/infinite; positive values are repeat counts. */
  readonly repeat: number;
}

/** Indexed file structure, independent of game grammar, native tile IDs and editable ownership. */
export interface IndexedDocument extends IndexedDocumentMetadata {
  /** Canvas dimensions in pixels, independent of the native tile inventory's storage dimensions. */
  readonly width: number;
  /** Canvas height in pixels. */
  readonly height: number;
  /** Global display palette; slot index is identity. */
  readonly palette: readonly IndexedColor[];
  /** Reserved palette slot; this is an index identity rather than a color comparison. */
  readonly transparentIndex: number;
  /** Optional embedded asset identity, checked against the authoritative source binding when required. */
  readonly exportId?: string;
  /** Flat layer stack in file order. */
  readonly layers: readonly IndexedDocumentLayer[];
  /** Embedded tilesets referenced by tilemap layers and cels. */
  readonly tilesets: readonly IndexedDocumentTileset[];
  /** Timeline frames with cel payloads or links. */
  readonly frames: readonly IndexedDocumentFrame[];
  /** Named playback ranges over the timeline. */
  readonly tags: readonly IndexedDocumentTag[];
}
