/** Shared ROM palette catalogue for graphics, frame atlases and editor previews. */

import type { AssetInput } from "../registry.js";

/** One address-owned run of BGR555 words. */
export interface SpritePaletteRecord {
  romAddress: string;
  firstIndex: 0 | 1;
  words: string[];
  previewColumns?: number;
  users?: {
    atlas: string;
    segments: string[];
    role: string;
  }[];
}

/** Version 1 catalogue shared by frame atlases and palette includes. */
export interface SpritePaletteCatalog {
  version: 1;
  palettes: Record<string, SpritePaletteRecord>;
}

/** Expand one five-bit SNES channel using the same bit replication as the PNG exporter.
 * @param {number} value Five-bit channel.
 * @returns {number} Eight-bit channel.
 */
function expandChannel(value: number) {
  return (value << 3) | (value >>> 2);
}

/** Version 1 catalogues store palette records on an object.
 * @param {unknown} value Parsed catalogue JSON.
 * @returns {boolean} Whether version and the palette map are present.
 */
function isSpritePaletteCatalog(value: unknown): value is SpritePaletteCatalog {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("version" in value) || !("palettes" in value)) {
    return false;
  }
  const palettes = value.palettes;
  return value.version === 1 && typeof palettes === "object" && palettes !== null;
}

/**
 * Validate one address-owned run of BGR555 words, regardless of its display shape.
 * @param {unknown} catalog Shared palette catalogue.
 * @param {unknown} id Six-digit ROM address.
 * @returns {SpritePaletteRecord} The address-owned record.
 */
function paletteRecord(catalog: unknown, id: unknown): SpritePaletteRecord {
  if (!isSpritePaletteCatalog(catalog) || typeof id !== "string") {
    throw new Error("Palette catalogue requires version 1 palette records.");
  }
  const palette = Object.hasOwn(catalog.palettes, id) ? catalog.palettes[id] : undefined;
  if (
    !palette ||
    palette.romAddress !== id ||
    ![0, 1].includes(palette.firstIndex) ||
    !Array.isArray(palette.words) ||
    palette.words.length < 1 ||
    palette.words.length > 256 ||
    palette.words.some((word) => typeof word !== "string" || !/^[\dA-Fa-f]{4}$/.test(word))
  ) {
    throw new Error(`Unknown or invalid ROM palette ${id}.`);
  }
  return palette;
}

/**
 * Resolve the sixteen indexed PNG colors for one ROM palette span. Actor spans
 * store only opaque colors 1–15; boss spans also store a hidden color-zero word.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @returns {Array<[number, number, number, number]>} Sixteen RGBA8 display colors.
 */
export function spritePaletteColors(catalog: SpritePaletteCatalog, id: string) {
  const palette = paletteRecord(catalog, id);
  if (palette.words.length !== 16 - palette.firstIndex) {
    throw new Error(`Frame sprite palette ${id} needs sixteen display slots.`);
  }
  const colors: [number, number, number, number][] = [[0, 0, 0, 0]];
  for (let index = 1; index < 16; index++) {
    const raw = palette.words[index - palette.firstIndex];
    const word = Number.parseInt(raw, 16);
    colors.push([
      expandChannel(word & 31),
      expandChannel((word >>> 5) & 31),
      expandChannel((word >>> 10) & 31),
      255,
    ]);
  }
  return colors;
}

/** Emit the catalogue's exact little-endian ROM words, including unused high bits.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @param {object} range Optional zero-based word slice; omitted count emits the remaining words.
 * @returns {Uint8Array} Little-endian BGR555 words. Invalid or empty slices throw.
 */
export function spritePaletteBytes(
  catalog: SpritePaletteCatalog,
  id: string,
  { wordOffset = 0, wordCount }: { wordOffset?: number; wordCount?: number } = {},
) {
  const record = paletteRecord(catalog, id);
  const count = wordCount ?? record.words.length - wordOffset;
  if (
    !Number.isSafeInteger(wordOffset) ||
    !Number.isSafeInteger(count) ||
    wordOffset < 0 ||
    count < 1 ||
    wordOffset + count > record.words.length
  ) {
    throw new Error(`Invalid ROM palette word slice ${id}.`);
  }
  const words = record.words.slice(wordOffset, wordOffset + count);
  const bytes = new Uint8Array(words.length * 2);
  for (const [index, raw] of words.entries()) {
    const word = Number.parseInt(raw, 16);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >>> 8;
  }
  return bytes;
}

/** Overlapping display views must agree on each physical ROM word; neither can silently win. */
export function validateSpritePaletteAliases(catalog: SpritePaletteCatalog): void {
  const words = new Map<number, string>();
  for (const id of Object.keys(catalog.palettes)) {
    const record = paletteRecord(catalog, id),
      start = Number.parseInt(id, 16);
    for (const [index, raw] of record.words.entries()) {
      const address = start + index * 2,
        word = raw.toUpperCase();
      if (words.has(address) && words.get(address) !== word) {
        throw new Error(
          `Conflicting palette aliases at ROM ${address.toString(16).toUpperCase()}.`,
        );
      }
      words.set(address, word);
    }
  }
}

/** Show stored colors as 8×8 swatches with a one-pixel grid and source grouping.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @returns {{rgba: Uint8Array, width: number, height: number}} Swatch image.
 */
export function spritePalettePreview(catalog: SpritePaletteCatalog, id: string) {
  const palette = paletteRecord(catalog, id);
  const colors = palette.words.map((raw) => {
    const word = Number.parseInt(raw, 16);
    return [
      expandChannel(word & 31),
      expandChannel((word >>> 5) & 31),
      expandChannel((word >>> 10) & 31),
      255,
    ];
  });
  if (palette.firstIndex === 1) {
    colors.unshift([0, 0, 0, 0]);
  }
  const columns = palette.previewColumns ?? Math.min(4, colors.length);
  if (!Number.isSafeInteger(columns) || columns < 1 || columns > 16) {
    throw new Error(`ROM palette ${id} has invalid preview columns.`);
  }
  const rows = Math.ceil(colors.length / columns);
  const width = columns * 9 + 1;
  const height = rows * 9 + 1;
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgba.set([64, 64, 64, 255], pixel * 4);
  }
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    const [red, green, blue, alpha] = colors[colorIndex];
    const left = 1 + (colorIndex % columns) * 9;
    const top = 1 + Math.floor(colorIndex / columns) * 9;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const offset = ((top + y) * width + left + x) * 4;
        rgba.set([red, green, blue, alpha], offset);
      }
    }
  }
  return { rgba, width, height };
}

/** Decode the catalogue as the source file of a ROM palette includeAsset.
 * @param {Uint8Array} bytes UTF-8 JSON catalogue.
 * @returns {SpritePaletteCatalog} Parsed version 1 catalogue.
 */
export function parseSpritePaletteCatalog(bytes: Uint8Array): SpritePaletteCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error("Invalid sprite palette catalogue.", { cause: error });
  }
  if (!isSpritePaletteCatalog(parsed)) {
    throw new Error("Sprite palette catalogue must contain version 1 palette records.");
  }
  validateSpritePaletteAliases(parsed);
  return parsed;
}

/** Parse a palette sidecar named by includeAsset; every atlas shares this resource.
 * @param {Readonly<Record<string, unknown>>} options Include options naming `palettes`.
 * @param {Readonly<Record<string, AssetInput>>} resources Declared sidecar files.
 * @returns {SpritePaletteCatalog} Parsed shared catalogue.
 */
export function readSpritePaletteCatalog(
  options: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>>,
) {
  if (typeof options.palettes !== "string" || !options.palettes.endsWith(".json")) {
    throw new Error("Sprite frames require a shared palettes JSON resource.");
  }
  const resource = Object.hasOwn(resources, options.palettes)
    ? resources[options.palettes]
    : undefined;
  if (!resource) {
    throw new Error(`Missing sprite palette catalogue: ${options.palettes}.`);
  }
  return parseSpritePaletteCatalog(resource.bytes);
}
