import { AssetCodecRegistry, type AssetCodec } from "@uttori/asm-disassembler";

import { snesBrrAssetCodec } from "./brr.js";
import { snesPaletteAssetCodec } from "./palette.js";
import { snesBgTilemapAssetCodec, snesMode7TilemapAssetCodec } from "./tilemap.js";
import {
  snesMode7TileAssetCodec,
  snesTile2BppAssetCodec,
  snesTile3BppAssetCodec,
  snesTile4BppAssetCodec,
  snesTile8BppAssetCodec,
} from "./tiles.js";

export * from "./brr.js";
export * from "./palette.js";
export * from "./previews.js";
export * from "./tilemap.js";
export * from "./tiles.js";

/** Built-in SNES asset codecs in stable-id order. */
export const snesAssetCodecs: readonly AssetCodec[] = Object.freeze(
  [
    snesBrrAssetCodec,
    snesPaletteAssetCodec,
    snesBgTilemapAssetCodec,
    snesMode7TilemapAssetCodec,
    snesMode7TileAssetCodec,
    snesTile2BppAssetCodec,
    snesTile3BppAssetCodec,
    snesTile4BppAssetCodec,
    snesTile8BppAssetCodec,
  ].sort((left, right) => left.id.localeCompare(right.id)),
);

/**
 * Registers every SNES-specific codec in an existing asset registry.
 * @param {AssetCodecRegistry} registry Registry to extend.
 * @returns {AssetCodecRegistry} The same registry for fluent setup.
 */
export const registerSnesAssetCodecs = (registry: AssetCodecRegistry): AssetCodecRegistry => {
  for (const codec of snesAssetCodecs) {
    registry.register(codec);
  }
  return registry;
};
