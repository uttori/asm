import CRC32 from "@uttori/data-tools/data-hash-crc32";
import { deflate } from "pako";

import type { IndexedImage } from "./image.js";
import { validateIndexedPixels } from "./indexed-edit.js";
import { pngImporter } from "./png.js";
import { integer } from "./validation.js";

/** Indexed edits with explicit optional canvas replacement; palette slots keep their identity. */
export interface IndexedPngEdit {
  readonly palette?: IndexedImage["palette"];
  readonly indexes?: Uint8Array;
  /** Explicit new canvas dimensions; resizing requires a complete replacement index buffer. */
  readonly dimensions?: { readonly width: number; readonly height: number };
  /** Unsafe ancillary chunks retained only after format-specific validation by the caller. */
  readonly preserveChunks?: readonly string[];
}

/** Concatenate byte spans into an owned output buffer.
 * @param {readonly Uint8Array[]} parts Ordered chunks, including the PNG signature.
 * @returns {Uint8Array} Combined bytes without retaining input views.
 */
function join(parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/** Build a replacement chunk with the CRC of its type and payload.
 * @param {string} type Four-byte PNG chunk identifier.
 * @param {Uint8Array} data Unframed payload bytes.
 * @returns {Uint8Array} Length, identifier, payload and CRC in PNG byte order.
 */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(
    Uint8Array.from(type, (c) => c.charCodeAt(0)),
    4,
  );
  bytes.set(data, 8);
  view.setUint32(
    data.length + 8,
    Number.parseInt(CRC32.of(bytes.subarray(4, data.length + 8)), 16),
  );
  return bytes;
}

/**
 * Rewrite indexed pixels/palette without RGB conversion or index remapping. Palette-only
 * changes retain IDAT bytes (including Adam7). Pixel changes use deterministic unfiltered
 * packed rows. Unknown unsafe ancillary chunks are dropped unless explicitly validated
 * by the caller; safe-to-copy chunks survive. An unchanged edit returns an exact copy.
 * @param {Uint8Array} source Complete indexed PNG validated before rewriting.
 * @param {IndexedPngEdit} edit Pixel/canvas and same-slot palette replacements and validated ancillary chunk names.
 * @returns {Uint8Array} Owned PNG bytes with unchanged palette slot identities.
 */
export function rewriteIndexedPng(source: Uint8Array, edit: IndexedPngEdit): Uint8Array {
  const document = pngImporter.import({ bytes: source, mediaType: "image/png" });
  if (document.kind !== "indexed-image") {
    throw new Error("PNG editing requires indexed pixels.");
  }
  const image = document.value as IndexedImage;
  const palette = edit.palette ?? image.palette;
  const width = edit.dimensions?.width ?? image.width;
  const height = edit.dimensions?.height ?? image.height;
  const resized = width !== image.width || height !== image.height;
  if (resized && !edit.indexes) {
    throw new Error("Resizing requires replacement indexed pixels.");
  }
  const indexes = edit.indexes ?? image.indexes;
  if (palette.length !== image.palette.length) {
    throw new Error("Palette edit must preserve slot count.");
  }
  if (!(indexes instanceof Uint8Array) || indexes.length !== width * height) {
    throw new Error("PNG edit must preserve pixel dimensions.");
  }
  validateIndexedPixels({ width, height, indexes });
  for (const color of palette) {
    if (!Array.isArray(color) || color.length !== 4) {
      throw new Error("Palette entries require RGBA8.");
    }
    color.forEach((value) => integer(value, "Palette component", 0, 255));
  }
  for (const index of indexes) {
    integer(index, "PNG pixel index", 0, palette.length - 1);
  }
  const pixelsChanged = resized || indexes.some((value, index) => value !== image.indexes[index]);
  const paletteChanged = palette.some((color, index) =>
    color.some((value, c) => value !== image.palette[index][c]),
  );
  if (!pixelsChanged && !paletteChanged) {
    return Uint8Array.from(source);
  }
  const retained = new Set(edit.preserveChunks ?? []);
  for (const type of retained) {
    if (!/^[a-z][A-Za-z][A-Z][A-Za-z]$/.test(type)) {
      throw new Error(`Invalid ancillary chunk ${type}.`);
    }
  }
  const plte = Uint8Array.from(palette.flatMap((color) => color.slice(0, 3)));
  const alpha = Uint8Array.from(palette.map((color) => color[3]));
  let compressed: Uint8Array | undefined;
  if (pixelsChanged) {
    const stride = Math.ceil((width * image.sourceBitDepth) / 8);
    const rows = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = x * image.sourceBitDepth;
        rows[y * (stride + 1) + 1 + Math.floor(bit / 8)] |=
          indexes[y * width + x] << (8 - image.sourceBitDepth - (bit % 8));
      }
    }
    compressed = deflate(rows);
  }
  const parts = [source.subarray(0, 8)];
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  let wrotePixels = false;
  for (let offset = 8; offset < source.length;) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    const type = String.fromCharCode(...source.subarray(offset + 4, offset + 8));
    if (type === "IHDR" && pixelsChanged) {
      const header = Uint8Array.from(source.subarray(offset + 8, end - 4));
      new DataView(header.buffer).setUint32(0, width);
      new DataView(header.buffer).setUint32(4, height);
      header[12] = 0;
      parts.push(chunk(type, header));
    } else if (type === "PLTE" && paletteChanged) {
      parts.push(chunk(type, plte), chunk("tRNS", alpha));
    } else if (type === "tRNS" && paletteChanged) {
      // Replaced next to PLTE so a source without tRNS can also gain transparency.
    } else if (type === "IDAT" && compressed) {
      if (!wrotePixels) {
        parts.push(chunk(type, compressed));
      }
      wrotePixels = true;
    } else if (
      ["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(type) ||
      (source[offset + 7] & 32) !== 0 ||
      retained.has(type)
    ) {
      parts.push(source.subarray(offset, end));
    }
    offset = end;
  }
  return join(parts);
}

/** Create an editable indexed PNG without quantization or palette reordering.
 * @param {Pick<IndexedImage, "width" | "height" | "indexes" | "palette">} image Exact pixels and RGBA palette slots; duplicate colors remain distinct slots.
 * @returns {Uint8Array} Owned PNG with eight-bit indexes, validated by the ordinary PNG importer.
 */
export function createIndexedPng(
  image: Pick<IndexedImage, "width" | "height" | "indexes" | "palette">,
): Uint8Array {
  validateIndexedPixels(image);
  integer(image.palette.length, "Palette slots", 1, 256);
  for (const color of image.palette) {
    if (color.length !== 4) {
      throw new Error("Palette entries require RGBA8.");
    }
    color.forEach((value) => integer(value, "Palette component", 0, 255));
  }
  for (const index of image.indexes) {
    integer(index, "Pixel index", 0, image.palette.length - 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  header[8] = 8;
  header[9] = 3;
  const rows = new Uint8Array((image.width + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    rows.set(
      image.indexes.subarray(y * image.width, (y + 1) * image.width),
      y * (image.width + 1) + 1,
    );
  }
  return join([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", header),
    chunk("PLTE", Uint8Array.from(image.palette.flatMap((color) => color.slice(0, 3)))),
    chunk("tRNS", Uint8Array.from(image.palette.map((color) => color[3]))),
    chunk("IDAT", deflate(rows)),
    chunk("IEND", new Uint8Array()),
  ]);
}
