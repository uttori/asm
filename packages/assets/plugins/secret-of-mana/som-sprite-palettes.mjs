/** Shared ROM palette catalogue for graphics, frame atlases and editor previews. */

/** Expand one five-bit SNES channel using the same bit replication as the PNG exporter. */
function expandChannel(value) {
  return (value << 3) | (value >>> 2);
}

/** Validate one address-owned run of BGR555 words, regardless of its display shape. */
function paletteRecord(catalog, id) {
  if (catalog?.version !== 1 || !catalog.palettes || typeof id !== "string") {
    throw new Error("Palette catalogue requires version 1 palette records.");
  }
  const palette = catalog.palettes[id];
  if (!palette || palette.romAddress !== id || ![0, 1].includes(palette.firstIndex) ||
      !Array.isArray(palette.words) || palette.words.length < 1 || palette.words.length > 256 ||
      palette.words.some((word) => typeof word !== "string" || !/^[0-9A-Fa-f]{4}$/.test(word))) {
    throw new Error(`Unknown or invalid ROM palette ${id}.`);
  }
  return palette;
}

/**
 * Resolve the sixteen indexed PNG colors for one ROM palette span. Actor spans
 * store only opaque colors 1–15; boss spans also store a hidden color-zero word.
 */
export function spritePaletteColors(catalog, id) {
  const palette = paletteRecord(catalog, id);
  if (palette.words.length !== 16 - palette.firstIndex) {
    throw new Error(`Frame sprite palette ${id} needs sixteen display slots.`);
  }
  const colors = [[0, 0, 0, 0]];
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

/** Emit the catalogue's exact little-endian ROM words, including unused high bits. */
export function spritePaletteBytes(catalog, id) {
  const words = paletteRecord(catalog, id).words;
  const bytes = new Uint8Array(words.length * 2);
  for (const [index, raw] of words.entries()) {
    const word = Number.parseInt(raw, 16);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >>> 8;
  }
  return bytes;
}

/** Show stored colors as 8×8 swatches with a one-pixel grid and source grouping. */
export function spritePalettePreview(catalog, id) {
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
  if (palette.firstIndex === 1) colors.unshift([0, 0, 0, 0]);
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

/** Decode the catalogue as the source file of a ROM palette includeAsset. */
export function parseSpritePaletteCatalog(bytes) {
  let catalog;
  try {
    catalog = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error("Invalid sprite palette catalogue.", { cause: error });
  }
  if (catalog?.version !== 1 || !catalog.palettes || typeof catalog.palettes !== "object") {
    throw new Error("Sprite palette catalogue must contain version 1 palette records.");
  }
  return catalog;
}

/** Parse a palette sidecar named by includeAsset; every atlas shares this resource. */
export function readSpritePaletteCatalog(options, resources) {
  if (typeof options.palettes !== "string" || !options.palettes.endsWith(".json")) {
    throw new Error("Sprite frames require a shared palettes JSON resource.");
  }
  const resource = resources[options.palettes];
  if (!resource) throw new Error(`Missing sprite palette catalogue: ${options.palettes}.`);
  return parseSpritePaletteCatalog(resource.bytes);
}
