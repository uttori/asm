import { pngImporter, createIndexedPng, type IndexedImage } from "@uttori/asm-assets/image";
import {
  decodePlanarTiles,
  decodeMode7Tiles,
  decodeBgr555,
  decodeBgMap,
  decodeMode7Map,
  decodeBrrBlocks,
  type PlanarDepth,
} from "@uttori/asm-assets/snes";
import type { AssemblerEnvironment } from "@uttori/asm-core";
import type { AssetSource } from "@uttori/asm-core/plugin";

/** Versioned deterministic recipe. Paths returned by plugins must resolve inside owned inputs. */
export interface OwnedAssetRecipe {
  readonly format: string;
  readonly version: string;
  readonly mediaType: string;
  readonly output?: string;
  readonly options?: Readonly<Record<string, unknown>>;
  /** Indexed PNG imports must preserve these exact slot identities; edit palettes as separate owned assets. */
  readonly palette?: IndexedImage["palette"];
  readonly transforms?: readonly {
    readonly id: string;
    readonly version: string;
    readonly options?: Readonly<Record<string, unknown>>;
  }[];
}

/** Encode with the baseline's trusted plugin environment and verify every compression stage reversibly.
 * @param {Uint8Array} source Editable input bytes, borrowed only during this call.
 * @param {OwnedAssetRecipe} recipe Pinned codec versions and explicit selected output.
 * @param {AssemblerEnvironment} environment Trusted host-resolved plugin capabilities.
 * @param {(name: string) => AssetSource} resource Snapshotting reader restricted to the modification inputs directory.
 * @returns {Uint8Array} Owned encoded bytes; placement and fill are enforced separately by the ROM builder.
 */
export function encodeOwnedAsset(
  source: Uint8Array,
  recipe: OwnedAssetRecipe,
  environment: AssemblerEnvironment,
  resource: (name: string) => AssetSource,
): Uint8Array {
  const format = environment.getAssetFormat(recipe.format, "snes.sfc");
  if (!format || format.version !== recipe.version) {
    throw new Error(`Asset codec ${recipe.format}@${recipe.version} is unavailable or changed.`);
  }
  if (recipe.mediaType === "image/png") {
    if (recipe.options?.palette !== undefined && recipe.options.palette !== "embedded") {
      throw new Error(
        "Indexed ROM edits must use embedded palette slots; external remapping is not supported.",
      );
    }
    const document = pngImporter.import({ bytes: source, mediaType: recipe.mediaType });
    if (document.kind !== "indexed-image" || !recipe.palette) {
      throw new Error("ROM image edits require an indexed PNG and pinned palette slots.");
    }
    const image = document.value as IndexedImage;
    if (JSON.stringify(image.palette) !== JSON.stringify(recipe.palette)) {
      throw new Error(
        "PNG palette slots changed. Restore the extracted palette; shared palette changes need a separate owned palette edit.",
      );
    }
  }
  const resources = (names: readonly string[]) =>
    Object.fromEntries(names.map((name) => [name, resource(name)]));
  const options = recipe.options ?? {};
  const result = format.convert(
    { bytes: source.slice(), mediaType: recipe.mediaType },
    options,
    resources(format.resourcePaths?.(options) ?? []),
  );
  const selected = result.outputs[recipe.output ?? result.primaryOutput];
  if (!(selected?.bytes instanceof Uint8Array) || selected.bytes.length > 0x1000000) {
    throw new Error("Asset codec omitted the requested output or exceeded 16 MiB.");
  }
  let bytes = selected.bytes.slice();
  for (const step of recipe.transforms ?? []) {
    const transform = environment.getAssetTransform(step.id, "snes.sfc");
    if (!transform || transform.version !== step.version) {
      throw new Error(`Transform ${step.id}@${step.version} is unavailable or changed.`);
    }
    const opts = step.options ?? {};
    transform.validateOptions?.(opts);
    const files = resources(transform.resourcePaths?.(opts) ?? []);
    const encoded = transform.encode(bytes.slice(), opts, files);
    if (!(encoded instanceof Uint8Array) || encoded.length > 0x1000000) {
      throw new Error("Compressed asset exceeds 16 MiB.");
    }
    const decoded = transform.decode(encoded.slice(), opts, bytes.length, files);
    if (decoded.length !== bytes.length || decoded.some((value, index) => value !== bytes[index])) {
      throw new Error(`Transform ${step.id} failed exact decode verification.`);
    }
    bytes = encoded.slice();
  }
  return bytes;
}

/** Native extraction is capability-limited: no arbitrary plugin decoder or palette guess is invented.
 * @param {Uint8Array} bytes Complete uncompressed native stream, excluding allocation padding.
 * @param {string} format Canonical native format ID.
 * @param {Uint8Array} paletteBytes Exact BGR555 palette required for a tile PNG; omitted for native JSON models.
 * @returns {object} Editable document bytes, extension and versioned recipe. Slot zero is SNES transparency.
 */
export function extractOwnedAsset(
  bytes: Uint8Array,
  format: string,
  paletteBytes?: Uint8Array,
): { bytes: Uint8Array; extension: string; recipe: OwnedAssetRecipe } {
  const tileDepth = /^snes\.tile\.([2-48])bpp$/.exec(format);
  if (tileDepth || format === "snes.tile.mode7") {
    if (!paletteBytes) {
      throw new Error("Tile extraction requires an explicit BGR555 palette range.");
    }
    const depth = Number(tileDepth?.[1] ?? 8) as PlanarDepth;
    const colors = decodeBgr555(paletteBytes);
    if (colors.length !== 2 ** depth) {
      throw new Error(`This tile format requires ${2 ** depth} palette slots.`);
    }
    const palette = colors.map(
      (color, index) =>
        [
          color.red * 8 + (color.red >> 2),
          color.green * 8 + (color.green >> 2),
          color.blue * 8 + (color.blue >> 2),
          index === 0 ? 0 : 255,
        ] as const,
    );
    const tiles = tileDepth ? decodePlanarTiles(bytes, depth) : decodeMode7Tiles(bytes);
    // Use a divisor of the tile count so row-major extraction never adds padding tiles.
    let columns = Math.min(32, tiles.length);
    while (columns > 1 && tiles.length % columns !== 0) {
      columns--;
    }
    const width = columns * 8;
    const height = (tiles.length / columns) * 8;
    const indexes = new Uint8Array(width * height);
    tiles.forEach((tile, index) =>
      tile.forEach((row, y) =>
        indexes.set(row, (Math.floor(index / columns) * 8 + y) * width + (index % columns) * 8),
      ),
    );
    return {
      bytes: createIndexedPng({ width, height, indexes, palette }),
      extension: "png",
      recipe: { format, version: "1.0.0", mediaType: "image/png", output: "tiles", palette },
    };
  }
  let model: object;
  if (format === "snes.palette.bgr555") {
    model = { kind: "snes-palette-bgr555", colors: decodeBgr555(bytes) };
  } else if (format === "snes.tilemap.bg") {
    model = { kind: "snes-bg-tilemap", entries: decodeBgMap(bytes) };
  } else if (format === "snes.tilemap.mode7") {
    model = { kind: "snes-mode7-tilemap", indexes: decodeMode7Map(bytes) };
  } else if (format === "snes.brr") {
    model = { kind: "snes-brr", blocks: decodeBrrBlocks(bytes) };
  } else if (format === "uttori.data.raw") {
    return {
      bytes: bytes.slice(),
      extension: "bin",
      recipe: { format, version: "1.0.0", mediaType: "application/octet-stream" },
    };
  } else {
    throw new Error(
      `No native extractor for ${format}. Supply an authored input and an explicit supported plugin recipe.`,
    );
  }
  return {
    bytes: new TextEncoder().encode(JSON.stringify(model, null, 2) + "\n"),
    extension: "json",
    recipe: { format, version: "1.0.0", mediaType: "application/json" },
  };
}

/** Infer only standard resource media types; unknown native/game files remain opaque bytes.
 * @param {string} name Owned resource filename.
 * @returns {string} Media type passed to the selected codec.
 */
export function ownedAssetMediaType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  return "application/octet-stream";
}
