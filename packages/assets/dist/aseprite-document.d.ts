import { type IndexedColor } from "./indexed-values.js";
/** Format metadata is descriptive. Import authority belongs exclusively to the host's private baseline. */
export interface AsepriteMetadata {
    userData?: string;
}
/** Flat normal/tilemap layers. Names, visibility and edit locks do not establish native authority. */
export type AsepriteLayer = AsepriteMetadata & {
    readonly name: string;
    readonly flags: number;
    readonly uuid?: string;
} & ({
    readonly kind: "raster";
} | {
    readonly kind: "tilemap";
    readonly tileset: number;
});
/** Embedded indexed storage in vertical tile order. Base index only changes the editor's numbering. */
export interface AsepriteTileset extends AsepriteMetadata {
    readonly id: number;
    readonly name: string;
    readonly flags: number;
    readonly baseIndex: number;
    readonly tileWidth: number;
    readonly tileHeight: number;
    readonly tileCount: number;
    readonly indexes: Uint8Array;
    readonly tileData: readonly (string | undefined)[];
}
/** Pixel offsets and z-index belong to the occurrence, including when its payload is linked. */
interface CelPosition extends AsepriteMetadata {
    readonly layer: number;
    readonly x: number;
    readonly y: number;
    readonly zIndex: number;
}
/** Linked cels share one decoded payload; they never allocate a copied image for each timeline frame. */
export type AsepriteCel = CelPosition & ({
    readonly kind: "raster";
    readonly width: number;
    readonly height: number;
    readonly indexes: Uint8Array;
} | {
    readonly kind: "linked";
    readonly frame: number;
} | {
    readonly kind: "tilemap";
    readonly columns: number;
    readonly rows: number;
    readonly bits: 8 | 16 | 32;
    readonly idMask: number;
    readonly flipXMask: number;
    readonly flipYMask: number;
    readonly diagonalMask: number;
    readonly cells: Uint32Array;
});
/** One global duration in milliseconds. Separate layer clocks are not part of this file profile. */
export interface AsepriteFrame {
    readonly durationMs: number;
    readonly cels: readonly AsepriteCel[];
}
/** Inclusive timeline range with native Aseprite playback direction and repeat count. */
export interface AsepriteTag extends AsepriteMetadata {
    readonly name: string;
    readonly from: number;
    readonly to: number;
    readonly direction: number;
    readonly repeat: number;
}
/** Indexed file structure, independent of game grammar, native tile IDs and editable ownership. */
export interface AsepriteDocument extends AsepriteMetadata {
    readonly width: number;
    readonly height: number;
    readonly palette: readonly IndexedColor[];
    readonly transparentIndex: number;
    readonly exportId?: string;
    readonly layers: readonly AsepriteLayer[];
    readonly tilesets: readonly AsepriteTileset[];
    readonly frames: readonly AsepriteFrame[];
    readonly tags: readonly AsepriteTag[];
}
type CelPayload = Exclude<AsepriteCel, {
    kind: "linked";
}>;
/** Resolve links once with a bounded iterative walk. Forward links, missing targets and cycles are explicit. */
export declare function resolveAsepriteCels(document: AsepriteDocument): ReadonlyMap<AsepriteCel, CelPayload>;
/** Validate structure and all allocation/work counts. Equal copied payloads count separately; links count once. */
export declare function validateAsepriteDocument(document: AsepriteDocument): void;
/** Parse indexed structure without consulting native ownership. Runtime cancellation is checked between chunks. */
export declare function decodeAsepriteDocument(bytes: Uint8Array, signal?: AbortSignal): Promise<AsepriteDocument>;
/** Encode deterministic structure with embedded tile storage and stable metadata attachment order. */
export declare function encodeAsepriteDocument(document: AsepriteDocument, signal?: AbortSignal): Promise<Uint8Array>;
export {};
//# sourceMappingURL=aseprite-document.d.ts.map