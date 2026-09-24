export { pngImporter } from "./png.js";
export {
  withImageEncoders,
  encodeBgScreenMap,
  decodeBgScreenMap,
  encodeMode7MapLayout,
} from "./image-conversion.js";

/** Indexed pixels retain their original palette order and duplicate entries. */
export interface IndexedImage {
  readonly kind: "indexed-image";
  readonly width: number;
  readonly height: number;
  readonly indexes: Uint8Array;
  readonly palette: readonly (readonly [number, number, number, number])[];
  readonly sourceBitDepth: 1 | 2 | 4 | 8;
}

/** Truecolor channels are byte-exact, including RGB hidden by alpha zero. */
export interface RgbaImage {
  readonly kind: "rgba-image";
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}
