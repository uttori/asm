import type { IndexedColor } from "./indexed-values.js";

/** Editor metadata is descriptive. Native authority belongs to external source bindings. */
export interface IndexedDocumentMetadata {
  userData?: string;
}

/** Flat normal/tilemap layers. Names, visibility and edit locks do not establish native authority. */
export type IndexedDocumentLayer = IndexedDocumentMetadata & {
  readonly name: string;
  /** Editor visibility/lock flags in the shared indexed profile; these never grant native ownership. */
  readonly flags: number;
  readonly uuid?: string;
} & ({ readonly kind: "raster" } | { readonly kind: "tilemap"; readonly tileset: number });

/** Embedded indexed storage in vertical tile order. Base index only changes the editor's numbering. */
export interface IndexedDocumentTileset extends IndexedDocumentMetadata {
  /** Container-local identifier. Native tile identity comes from the external owner mapping. */
  readonly id: number;
  readonly name: string;
  readonly flags: number;
  readonly baseIndex: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly tileCount: number;
  readonly indexes: Uint8Array;
  /** Optional per-tile metadata in the same order as the tile pixel storage. */
  readonly tileData: readonly (string | undefined)[];
}

/** Pixel offsets and z-index belong to the occurrence, including when its payload is linked. */
interface CelPosition extends IndexedDocumentMetadata {
  readonly layer: number;
  /** Signed canvas offsets in pixels. */
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
}

/** Linked cels share one decoded payload; they never allocate a copied image for each timeline frame. */
export type IndexedDocumentCel = CelPosition &
  (
    | {
        readonly kind: "raster";
        readonly width: number;
        readonly height: number;
        readonly indexes: Uint8Array;
      }
    | { readonly kind: "linked"; readonly frame: number }
    | {
        readonly kind: "tilemap";
        readonly columns: number;
        readonly rows: number;
        readonly bits: 8 | 16 | 32;
        readonly idMask: number;
        readonly flipXMask: number;
        readonly flipYMask: number;
        readonly diagonalMask: number;
        readonly cells: Uint32Array;
      }
  );

/** One global duration in milliseconds. Separate layer clocks are not part of this file profile. */
export interface IndexedDocumentFrame {
  readonly durationMs: number;
  readonly cels: readonly IndexedDocumentCel[];
}

/** Inclusive timeline range with indexed playback direction and repeat count. */
export interface IndexedDocumentTag extends IndexedDocumentMetadata {
  readonly name: string;
  readonly from: number;
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
  readonly height: number;
  readonly palette: readonly IndexedColor[];
  /** Reserved palette slot; this is an index identity rather than a color comparison. */
  readonly transparentIndex: number;
  /** Optional embedded asset identity, checked against the authoritative source binding when required. */
  readonly exportId?: string;
  readonly layers: readonly IndexedDocumentLayer[];
  readonly tilesets: readonly IndexedDocumentTileset[];
  readonly frames: readonly IndexedDocumentFrame[];
  readonly tags: readonly IndexedDocumentTag[];
}
