import type { IndexedImage, RgbaImage } from "./image.js";
import { ASSET_LIMITS } from "./limits.js";
import type { AssetDocument, AssetEncoder, AssetInput, AssetOutput } from "./registry.js";
import {
  decodeBgMap,
  decodeBgr555,
  decodeMode7Tiles,
  decodePlanarTiles,
  encodeBgr555,
  encodeBgMap,
  encodeMode7Map,
  encodeMode7Tiles,
  encodePlanarTiles,
  type BgMapEntry,
  type Bgr555Color,
  type PlanarDepth,
  type Tile,
} from "./snes.js";
import { integer } from "./validation.js";

/** Imported PNG pixel models accepted by image encoders. */
type ImageModel = IndexedImage | RgbaImage;
/** BGR555 expansion table used when quantizing truecolor sources. */
type Expansion = "bit-replicate" | "scale-floor";
/** Opaque RGBA tuple used while resolving external palettes. */
type PaletteColor = readonly [number, number, number, number];
/** Tile iteration order when slicing a raster into 8×8 cells. */
type TileOrder = "row-major" | "column-major" | "blocks";
/** BG map storage order for emitted tilemap bytes. */
type MapLayout = "row-major" | "screen-blocks";

/** Validated tile slicing options after defaults are applied. */
interface NormalizedLayout {
  readonly tileOrder: TileOrder;
  readonly blockSize?: readonly [2, 2];
  readonly blockOrder?: "row-major" | "column-major";
  readonly blockRows?: "top-to-bottom" | "bottom-to-top";
  readonly withinBlock?: readonly number[];
}

/** BG map word fields applied to every emitted cell. */
interface MapOptions {
  readonly layout: MapLayout;
  readonly startTileIndex: number;
  readonly paletteBank: number;
  readonly priority: number;
  readonly horizontalFlip: boolean;
  readonly verticalFlip: boolean;
}

/** Normalized encoder options for palette, layout and tilemap emission. */
interface ImageOptions {
  readonly palette: string;
  readonly paletteExpansion: Expansion;
  readonly layout: NormalizedLayout;
  readonly tilemap: MapOptions;
}

/** Narrow untrusted option objects before field reads. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Accept only SNES planar bit depths supported by tile encoders. */
const isPlanarDepth = (value: number): value is PlanarDepth =>
  value === 2 || value === 3 || value === 4 || value === 8;

/** Accept indexed PNG source bit depths that map to planar depths. */
const isSourceBitDepth = (value: unknown): value is IndexedImage["sourceBitDepth"] =>
  value === 1 || value === 2 || value === 4 || value === 8;

/** Recognize four-channel RGBA tuples with byte-wide channels. */
const isRgbaTuple = (value: unknown): value is readonly [number, number, number, number] =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every(
    (channel): channel is number =>
      typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255,
  );

/** Read and bound-check one integer option field. */
const readInteger = (value: unknown, label: string, minimum: number, maximum: number): number => {
  if (typeof value !== "number") {
    throw new RangeError(`${label} must be a number.`);
  }
  return integer(value, label, minimum, maximum);
};

/** Require a strict boolean option value. */
const readBoolean = (value: unknown, name: string): boolean => {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be boolean.`);
  }
  return value;
};

/** Expand one five-bit channel using the selected profile table. */
const expand = (channel: number, profile: Expansion): number => {
  if (profile === "bit-replicate") {
    return (channel << 3) | (channel >> 2);
  }
  return Math.floor((channel * 255) / 31);
};

/**
 * Invert the selected 5-to-8-bit table exactly; channel rounding is forbidden.
 * @param channel Source RGB8 channel.
 * @param profile Declared expansion table.
 * @param label Diagnostic location.
 * @returns Exact five-bit channel.
 */
const reduce = (channel: number, profile: Expansion, label: string): number => {
  integer(channel, label, 0, 255);
  for (let value = 0; value < 32; value++) {
    if (expand(value, profile) === channel) {
      return value;
    }
  }
  throw new Error(`${label}=${channel} is not representable by ${profile} BGR555.`);
};

/** Stable string key for deduplicating palette colors during quantization. */
const colorKey = (color: ArrayLike<number>): string => Array.from(color).join(",");

/** Parse and default tile slicing layout options. */
const readLayout = (raw: unknown): NormalizedLayout => {
  if (raw === undefined) {
    return { tileOrder: "row-major" };
  }
  if (!isRecord(raw)) {
    throw new Error("layout must be an object.");
  }
  const tileOrder = raw.tileOrder ?? "row-major";
  if (tileOrder !== "row-major" && tileOrder !== "column-major" && tileOrder !== "blocks") {
    throw new Error("Invalid layout.tileOrder.");
  }
  if (tileOrder !== "blocks") {
    if (Object.keys(raw).some((key) => key !== "tileOrder")) {
      throw new Error("Block options require tileOrder: 'blocks'.");
    }
    return { tileOrder };
  }
  if (
    !Array.isArray(raw.blockSize) ||
    raw.blockSize.length !== 2 ||
    raw.blockSize[0] !== 2 ||
    raw.blockSize[1] !== 2
  ) {
    throw new Error("Block layout requires blockSize: [2, 2].");
  }
  const blockOrder = raw.blockOrder ?? "row-major";
  const blockRows = raw.blockRows ?? "top-to-bottom";
  if (
    (blockOrder !== "row-major" && blockOrder !== "column-major") ||
    (blockRows !== "top-to-bottom" && blockRows !== "bottom-to-top")
  ) {
    throw new Error("Invalid block traversal order.");
  }
  let withinBlock: number[];
  if (raw.withinBlock === "tl-bl-br-tr") {
    withinBlock = [0, 2, 3, 1];
  } else if (raw.withinBlock === "tl-tr-bl-br" || raw.withinBlock === undefined) {
    withinBlock = [0, 1, 2, 3];
  } else if (Array.isArray(raw.withinBlock)) {
    const names = ["tl", "tr", "bl", "br"];
    withinBlock = raw.withinBlock.map((name: unknown) => names.indexOf(String(name)));
  } else {
    throw new Error("Invalid withinBlock permutation.");
  }
  if (
    withinBlock.length !== 4 ||
    new Set(withinBlock).size !== 4 ||
    withinBlock.some((index) => index < 0)
  ) {
    throw new Error("withinBlock must contain each 2×2 quadrant once.");
  }
  if (
    Object.keys(raw).some(
      (key) => !["tileOrder", "blockSize", "blockOrder", "blockRows", "withinBlock"].includes(key),
    )
  ) {
    throw new Error("Unknown block layout option.");
  }
  return { tileOrder, blockSize: [2, 2], blockOrder, blockRows, withinBlock };
};

/** Normalize palette, layout and tilemap options for one encode pass. */
const readOptions = (raw: Readonly<Record<string, unknown>>, indexed: boolean): ImageOptions => {
  if (
    Object.keys(raw).some(
      (key) => !["palette", "paletteExpansion", "layout", "tilemap"].includes(key),
    )
  ) {
    throw new Error("Unknown image conversion option.");
  }
  let palette = raw.palette;
  if (palette === undefined && indexed) {
    palette = "embedded";
  }
  if (typeof palette !== "string" || palette.length === 0) {
    throw new Error("Truecolor PNG requires palette: 'auto' or an external palette resource.");
  }
  const paletteExpansion =
    raw.paletteExpansion === undefined ? "bit-replicate" : raw.paletteExpansion;
  if (paletteExpansion !== "bit-replicate" && paletteExpansion !== "scale-floor") {
    throw new Error("Invalid paletteExpansion profile.");
  }
  const map = raw.tilemap === undefined ? {} : raw.tilemap;
  if (
    !isRecord(map) ||
    Object.keys(map).some(
      (key) =>
        ![
          "layout",
          "startTileIndex",
          "paletteBank",
          "priority",
          "horizontalFlip",
          "verticalFlip",
        ].includes(key),
    )
  ) {
    throw new Error("Invalid tilemap options.");
  }
  const mapLayout = map.layout ?? "row-major";
  if (mapLayout !== "row-major" && mapLayout !== "screen-blocks") {
    throw new Error("Invalid tilemap.layout.");
  }
  return {
    palette,
    paletteExpansion,
    layout: readLayout(raw.layout),
    tilemap: {
      layout: mapLayout,
      startTileIndex: readInteger(map.startTileIndex ?? 0, "startTileIndex", 0, 1023),
      paletteBank: readInteger(map.paletteBank ?? 0, "paletteBank", 0, 7),
      priority: readInteger(map.priority ?? 0, "priority", 0, 1),
      horizontalFlip: readBoolean(map.horizontalFlip ?? false, "horizontalFlip"),
      verticalFlip: readBoolean(map.verticalFlip ?? false, "verticalFlip"),
    },
  };
};

/** Load an external JSON palette resource referenced by encode options. */
const externalPalette = (
  input: AssetInput,
): { colors: PaletteColor[]; transparentIndex: number } => {
  if (input.mediaType !== "application/json") {
    throw new Error("External palette resource must be application/json.");
  }
  if (input.bytes.length > 64 * 1024) {
    throw new Error("External palette JSON exceeds 64 KiB.");
  }
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.colors) ||
    value.colors.length === 0 ||
    value.colors.length > 256
  ) {
    throw new Error("External palette requires version 1 and 1–256 RGB8 colors.");
  }
  const transparentIndex = readInteger(
    value.transparentIndex,
    "transparentIndex",
    0,
    value.colors.length - 1,
  );
  const colors: PaletteColor[] = value.colors.map((color: unknown, index: number) => {
    if (!Array.isArray(color) || color.length !== 3) {
      throw new Error(`Palette color ${index} requires RGB8.`);
    }
    const rgb = color.map((channel, channelIndex) =>
      readInteger(channel, `Palette color ${index} channel ${channelIndex}`, 0, 255),
    );
    return [rgb[0], rgb[1], rgb[2], index === transparentIndex ? 0 : 255];
  });
  return { colors, transparentIndex };
};

/**
 * Choose a bijective indexed mapping or exact truecolor lookup without quantizing.
 * @param image Imported PNG model.
 * @param options Normalized conversion options.
 * @param resources Declared external palette bytes.
 * @param capacity Number of entries in one native palette bank.
 * @returns Native palette and pixel indexes.
 */
function selectPalette(
  image: ImageModel,
  options: ImageOptions,
  resources: Readonly<Record<string, AssetInput>>,
  capacity: number,
): { colors: PaletteColor[]; indexes: Uint8Array; sourceToNative?: number[] } {
  let colors: PaletteColor[];
  let indexes: Uint8Array;
  let sourceToNative: number[] | undefined;
  if (image.kind === "indexed-image") {
    if (options.palette === "auto") {
      throw new Error("Indexed PNG must preserve palette identity; auto is for truecolor input.");
    }
    if (options.palette === "embedded") {
      colors = image.palette.map((color) => [...color] as [number, number, number, number]);
      indexes = image.indexes.slice();
      sourceToNative = colors.map((_, index) => index);
    } else {
      const resource = Object.hasOwn(resources, options.palette)
        ? resources[options.palette]
        : undefined;
      if (!resource) {
        throw new Error(`Missing palette resource '${options.palette}'.`);
      }
      const external = externalPalette(resource);
      colors = external.colors;
      const used = new Set<number>();
      sourceToNative = image.palette.map((source, index) => {
        const match = colors.findIndex(
          (candidate, candidateIndex) =>
            !used.has(candidateIndex) && colorKey(candidate) === colorKey(source),
        );
        if (match < 0) {
          throw new Error(`External palette loses source entry ${index}.`);
        }
        used.add(match);
        return match;
      });
      indexes = Uint8Array.from(image.indexes, (index) => sourceToNative![index]);
      // Hardware transparency occupies index zero; swapping retains a reversible permutation.
      if (external.transparentIndex !== 0) {
        const zero = colors[0];
        colors[0] = colors[external.transparentIndex];
        colors[external.transparentIndex] = zero;
        const swap = (index: number): number => {
          if (index === 0) {
            return external.transparentIndex;
          }
          if (index === external.transparentIndex) {
            return 0;
          }
          return index;
        };
        indexes = Uint8Array.from(indexes, swap);
        sourceToNative = sourceToNative.map(swap);
      }
    }
  } else {
    if (options.palette === "embedded") {
      throw new Error("Truecolor PNG has no embedded indexed palette.");
    }
    if (options.palette === "auto") {
      colors = [[0, 0, 0, 0]];
      const byColor = new Map<string, number>();
      indexes = new Uint8Array(image.width * image.height);
      for (let pixel = 0; pixel < indexes.length; pixel++) {
        const rgba = image.rgba.subarray(pixel * 4, pixel * 4 + 4);
        if (rgba[3] !== 0 && rgba[3] !== 255) {
          throw new Error(`Pixel ${pixel} has partial alpha ${rgba[3]}.`);
        }
        if (rgba[3] === 0) {
          if (
            byColor.has("transparent") &&
            colorKey(colors[0].slice(0, 3)) !== colorKey(rgba.slice(0, 3))
          ) {
            throw new Error("Transparent pixels have differing hidden RGB values.");
          }
          colors[0] = [rgba[0], rgba[1], rgba[2], 0];
          byColor.set("transparent", 0);
          continue;
        }
        const key = colorKey(rgba.slice(0, 3));
        let index = byColor.get(key);
        if (index === undefined) {
          index = colors.length;
          colors.push([rgba[0], rgba[1], rgba[2], 255]);
          byColor.set(key, index);
        }
        indexes[pixel] = index;
      }
    } else {
      const resource = Object.hasOwn(resources, options.palette)
        ? resources[options.palette]
        : undefined;
      if (!resource) {
        throw new Error(`Missing palette resource '${options.palette}'.`);
      }
      const external = externalPalette(resource);
      colors = external.colors;
      if (external.transparentIndex !== 0) {
        const zero = colors[0];
        colors[0] = colors[external.transparentIndex];
        colors[external.transparentIndex] = zero;
      }
      const lookup = new Map<string, number>();
      colors.forEach((color, index) => {
        const key = colorKey(color);
        if (!lookup.has(key)) {
          lookup.set(key, index);
        }
      });
      indexes = new Uint8Array(image.width * image.height);
      for (let pixel = 0; pixel < indexes.length; pixel++) {
        const rgba = image.rgba.subarray(pixel * 4, pixel * 4 + 4);
        const index = lookup.get(colorKey(rgba));
        if (index === undefined) {
          throw new Error(`Pixel ${pixel} is absent from the exact external palette.`);
        }
        indexes[pixel] = index;
      }
    }
  }
  if (colors.length > capacity) {
    throw new Error(`Palette has ${colors.length} entries; one bank holds ${capacity}.`);
  }
  if (indexes.some((index) => index >= capacity)) {
    throw new Error(`Pixel index exceeds ${capacity}-color bank.`);
  }
  colors.forEach((color, index) => {
    if (color[3] !== 0 && color[3] !== 255) {
      throw new Error(`Palette entry ${index} has partial alpha.`);
    }
    if (index !== 0 && color[3] === 0 && indexes.includes(index)) {
      throw new Error(`Transparent palette entry ${index} would be rendered opaque.`);
    }
  });
  if (indexes.some((index) => index === 0 && colors[0][3] !== 0)) {
    throw new Error("Opaque index-zero pixels cannot be represented by SNES transparency.");
  }
  return { colors, indexes, sourceToNative };
}

/**
 * Enumerate storage tile coordinates while retaining the inverse logical map.
 * @param width Number of tile columns.
 * @param height Number of tile rows.
 * @param layout Storage traversal.
 * @returns Tile coordinates in encoded order.
 */
function tileCoordinates(
  width: number,
  height: number,
  layout: NormalizedLayout,
): readonly (readonly [number, number])[] {
  const result: [number, number][] = [];
  if (layout.tileOrder === "row-major") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.push([x, y]);
      }
    }
  } else if (layout.tileOrder === "column-major") {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        result.push([x, y]);
      }
    }
  } else {
    if (width % 2 || height % 2) {
      throw new Error("2×2 block layout requires complete tile blocks.");
    }
    const blockY = Array.from({ length: height / 2 }, (_, index) => index);
    if (layout.blockRows === "bottom-to-top") {
      blockY.reverse();
    }
    if (layout.blockOrder === "row-major") {
      for (const by of blockY) {
        for (let bx = 0; bx < width / 2; bx++) {
          for (const quadrant of layout.withinBlock!) {
            result.push([bx * 2 + (quadrant % 2), by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    } else {
      for (let bx = 0; bx < width / 2; bx++) {
        for (const by of blockY) {
          for (const quadrant of layout.withinBlock!) {
            result.push([bx * 2 + (quadrant % 2), by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    }
  }
  return result;
}

/** Compute linear index permutation for the selected BG map layout. */
function mapOrder(width: number, height: number, layout: MapLayout): number[] {
  if (layout === "row-major") {
    return Array.from({ length: width * height }, (_, index) => index);
  }
  if (![32, 64].includes(width) || ![32, 64].includes(height)) {
    throw new Error("BG screen-block tilemap requires 32×32, 64×32, 32×64, or 64×64 cells.");
  }
  const order: number[] = [];
  for (let by = 0; by < height; by += 32) {
    for (let bx = 0; bx < width; bx += 32) {
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          order.push((by + y) * width + bx + x);
        }
      }
    }
  }
  return order;
}

/**
 * Encode logical BG cells in hardware's 32×32 screen-block storage order.
 * @param logical Logical row-major entries; indexes may repeat.
 * @param width Width in map cells, 32 or 64.
 * @param height Height in map cells, 32 or 64.
 * @returns Owned native BG map words.
 */
export function encodeBgScreenMap(
  logical: readonly BgMapEntry[],
  width: number,
  height: number,
): Uint8Array {
  if (logical.length !== width * height) {
    throw new Error("BG screen map cell count is invalid.");
  }
  return encodeBgMap(mapOrder(width, height, "screen-blocks").map((index) => logical[index]));
}

/**
 * Reverse native screen-block storage into logical row-major BG cells.
 * @param bytes Native BG map words.
 * @param width Width in map cells, 32 or 64.
 * @param height Height in map cells, 32 or 64.
 * @returns Owned logical entries.
 */
export function decodeBgScreenMap(bytes: Uint8Array, width: number, height: number): BgMapEntry[] {
  const order = mapOrder(width, height, "screen-blocks");
  const encoded = decodeBgMap(bytes);
  if (encoded.length !== width * height) {
    throw new Error("BG screen map byte count is invalid.");
  }
  const logical = Array.from({ length: encoded.length }, () => ({
    tile: 0,
    palette: 0,
    priority: 0,
    horizontalFlip: 0,
    verticalFlip: 0,
  }));
  order.forEach((position, index) => {
    logical[position] = encoded[index];
  });
  return logical;
}

/**
 * Validate a complete 128×128 Mode 7 map or an explicit partial upload rectangle.
 * @param indexes Row-major tile indexes.
 * @param width Width in cells.
 * @param height Height in cells.
 * @param layout `"full"` for the hardware map, or `"partial"` for an upload rectangle.
 * @returns Owned native map bytes.
 */
export function encodeMode7MapLayout(
  indexes: readonly number[],
  width: number,
  height: number,
  layout: string,
): Uint8Array {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 128 ||
    height > 128 ||
    indexes.length !== width * height ||
    (layout === "full" && (width !== 128 || height !== 128)) ||
    (layout !== "full" && layout !== "partial")
  ) {
    throw new Error("Mode 7 map requires full 128×128 dimensions or a declared partial rectangle.");
  }
  return encodeMode7Map(indexes);
}

/** Validate and narrow an imported PNG document to a typed pixel model. */
function imageModel(document: AssetDocument): ImageModel {
  if (
    (document.kind !== "indexed-image" && document.kind !== "rgba-image") ||
    !isRecord(document.value)
  ) {
    throw new Error("Image encoder requires imported PNG pixels.");
  }
  const value = document.value;
  if (
    value.kind !== document.kind ||
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    !Number.isSafeInteger(value.width) ||
    !Number.isSafeInteger(value.height) ||
    value.width < 1 ||
    value.height < 1 ||
    value.width > ASSET_LIMITS.rasterPixels ||
    value.height > Math.floor(ASSET_LIMITS.rasterPixels / value.width)
  ) {
    throw new Error("Image model has invalid dimensions or kind.");
  }
  const pixels = value.width * value.height;
  if (document.kind === "indexed-image") {
    if (
      !(value.indexes instanceof Uint8Array) ||
      value.indexes.length !== pixels ||
      !Array.isArray(value.palette) ||
      value.palette.length < 1 ||
      value.palette.length > 256 ||
      !isSourceBitDepth(value.sourceBitDepth)
    ) {
      throw new Error("Indexed image model has invalid pixels, palette, or source depth.");
    }
    const palette: (readonly [number, number, number, number])[] = [];
    for (const [index, color] of value.palette.entries()) {
      if (!isRgbaTuple(color)) {
        throw new Error(`Indexed image palette entry ${index} is not RGBA8.`);
      }
      const entry: readonly [number, number, number, number] = [
        color[0],
        color[1],
        color[2],
        color[3],
      ];
      palette.push(entry);
    }
    return {
      kind: "indexed-image",
      width: value.width,
      height: value.height,
      indexes: value.indexes,
      palette,
      sourceBitDepth: value.sourceBitDepth,
    };
  }
  if (!(value.rgba instanceof Uint8Array) || value.rgba.length !== pixels * 4) {
    throw new Error("RGBA image model has invalid pixel bytes.");
  }
  return {
    kind: "rgba-image",
    width: value.width,
    height: value.height,
    rgba: value.rgba,
  };
}

/**
 * Build tiles, CGRAM, map, and composed preview from one exact palette/index decision.
 * @param document Imported PNG pixels.
 * @param rawOptions Requested palette and layout.
 * @param resources External palette files.
 * @param format Canonical SNES tile ID.
 * @returns Named native outputs.
 */
function encodeImage(
  document: AssetDocument,
  rawOptions: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>>,
  format: string,
): {
  outputs: Readonly<Record<string, AssetOutput>>;
  normalizedOptions: Readonly<Record<string, unknown>>;
} {
  const image = imageModel(document);
  if (image.width % 8 !== 0 || image.height % 8 !== 0) {
    throw new Error(`Image ${image.width}×${image.height} requires dimensions divisible by 8.`);
  }
  const mode7 = format === "snes.tile.mode7";
  const depth = mode7 ? 8 : Number(format.slice("snes.tile.".length, -3));
  const options = readOptions(rawOptions, image.kind === "indexed-image");
  const capacity = 2 ** depth;
  const selection = selectPalette(image, options, resources, capacity);
  const colors: Bgr555Color[] = selection.colors.map((color, index) => ({
    red: reduce(color[0], options.paletteExpansion, `Palette ${index} red`),
    green: reduce(color[1], options.paletteExpansion, `Palette ${index} green`),
    blue: reduce(color[2], options.paletteExpansion, `Palette ${index} blue`),
    unusedHighBit: 0,
  }));
  while (colors.length < capacity) {
    colors.push({ red: 0, green: 0, blue: 0, unusedHighBit: 0 });
  }
  const widthTiles = image.width / 8;
  const heightTiles = image.height / 8;
  const coordinates = tileCoordinates(widthTiles, heightTiles, options.layout);
  const indexByCoordinate = Array.from({ length: coordinates.length }, () => 0);
  const tiles: Tile[] = coordinates.map(([tx, ty], storageIndex) => {
    indexByCoordinate[ty * widthTiles + tx] = storageIndex;
    return Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_column, column) => {
        // Pre-invert map flips so the displayed image remains pixel-exact.
        const sourceX = options.tilemap.horizontalFlip ? 7 - column : column;
        const sourceY = options.tilemap.verticalFlip ? 7 - row : row;
        return selection.indexes[(ty * 8 + sourceY) * image.width + tx * 8 + sourceX];
      }),
    );
  });
  let tileBytes: Uint8Array;
  let decodedTiles: ReturnType<typeof decodeMode7Tiles>;
  if (mode7) {
    tileBytes = encodeMode7Tiles(tiles);
    decodedTiles = decodeMode7Tiles(tileBytes);
  } else if (isPlanarDepth(depth)) {
    tileBytes = encodePlanarTiles(tiles, depth);
    decodedTiles = decodePlanarTiles(tileBytes, depth);
  } else {
    throw new Error(`Unsupported planar tile format '${format}'.`);
  }
  const paletteBytes = encodeBgr555(colors);
  const decodedColors = decodeBgr555(paletteBytes);
  const preview = new Uint8Array(image.width * image.height * 4);
  for (let ty = 0; ty < heightTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      const storageIndex = indexByCoordinate[ty * widthTiles + tx];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const tileX = options.tilemap.horizontalFlip ? 7 - x : x;
          const tileY = options.tilemap.verticalFlip ? 7 - y : y;
          const index = decodedTiles[storageIndex][tileY][tileX];
          const destination = ((ty * 8 + y) * image.width + tx * 8 + x) * 4;
          const color = decodedColors[index];
          preview[destination] = expand(color.red, options.paletteExpansion);
          preview[destination + 1] = expand(color.green, options.paletteExpansion);
          preview[destination + 2] = expand(color.blue, options.paletteExpansion);
          preview[destination + 3] = selection.colors[index]?.[3] ?? 255;
          if (image.kind === "indexed-image") {
            const sourceIndex = image.indexes[destination / 4];
            if (selection.sourceToNative?.[sourceIndex] !== index) {
              throw new Error(
                `Indexed PNG pixel ${destination / 4} lost its original palette index.`,
              );
            }
          }
          const sourceRgba =
            image.kind === "rgba-image"
              ? image.rgba.subarray(destination, destination + 4)
              : image.palette[image.indexes[destination / 4]];
          for (let channel = 0; channel < 4; channel++) {
            if (preview[destination + channel] !== sourceRgba[channel]) {
              throw new Error(
                `Image pixel ${destination / 4} channel ${channel} cannot be reconstructed exactly.`,
              );
            }
          }
        }
      }
    }
  }
  const start = options.tilemap.startTileIndex;
  const limit = mode7 ? 256 : 1024;
  if (start + coordinates.length > limit) {
    throw new Error(`Tilemap exceeds ${limit} tile indexes.`);
  }
  if (
    mode7 &&
    (options.tilemap.paletteBank !== 0 ||
      options.tilemap.priority !== 0 ||
      options.tilemap.horizontalFlip ||
      options.tilemap.verticalFlip)
  ) {
    throw new Error("Mode 7 map has no palette bank, priority, or flip bits.");
  }
  if (mode7 && options.tilemap.layout === "screen-blocks") {
    throw new Error(
      "Mode 7 maps use row-major storage; full 128×128 maps are a separate contract.",
    );
  }
  const mapIndexes = mapOrder(widthTiles, heightTiles, options.tilemap.layout);
  const tilemapBytes = mode7
    ? encodeMode7Map(mapIndexes.map((position) => start + indexByCoordinate[position]))
    : encodeBgMap(
        mapIndexes.map((position) => ({
          tile: start + indexByCoordinate[position],
          palette: options.tilemap.paletteBank,
          priority: options.tilemap.priority,
          horizontalFlip: Number(options.tilemap.horizontalFlip),
          verticalFlip: Number(options.tilemap.verticalFlip),
        })),
      );
  const metadata = {
    width: image.width,
    height: image.height,
    widthTiles,
    heightTiles,
    tileIndexByCoordinate: indexByCoordinate,
    sourceToNativePaletteIndex: selection.sourceToNative,
    originalPaletteEntries: image.kind === "indexed-image" ? image.palette.length : undefined,
    paletteExpansion: options.paletteExpansion,
    layout: options.layout,
    tilemap: options.tilemap,
  };
  return {
    outputs: {
      tiles: { bytes: tileBytes, mediaType: "application/octet-stream", metadata },
      palette: { bytes: paletteBytes, mediaType: "application/octet-stream", metadata },
      tilemap: { bytes: tilemapBytes, mediaType: "application/octet-stream", metadata },
      preview: { bytes: preview, mediaType: "application/x-rgba", metadata },
    },
    normalizedOptions: {
      palette: options.palette,
      paletteExpansion: options.paletteExpansion,
      layout: options.layout,
      tilemap: options.tilemap,
    },
  };
}

/**
 * Compose PNG-aware tile encoders with native JSON encoders under the same IDs.
 * @param native Existing exact native model encoders.
 * @returns Combined format registrations.
 */
export function withImageEncoders(native: readonly AssetEncoder[]): readonly AssetEncoder[] {
  return native.map((encoder) => {
    if (!encoder.id.startsWith("snes.tile.")) {
      return encoder;
    }
    return Object.freeze({
      ...encoder,
      inputKinds: [...encoder.inputKinds, "indexed-image", "rgba-image"],
      encode: (
        document: AssetDocument,
        options: Readonly<Record<string, unknown>>,
        resources: Readonly<Record<string, AssetInput>>,
      ) => {
        if (document.kind !== "indexed-image" && document.kind !== "rgba-image") {
          return encoder.encode(document, options, resources);
        }
        const result = encodeImage(document, options, resources, encoder.id);
        return {
          ...result,
          fidelity: {
            kind: "exact" as const,
            verification: "PNG indexes, palette, and RGBA reconstruction",
          },
        };
      },
    });
  });
}
