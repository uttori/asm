import type { AssetCodec } from "@uttori/asm-disassembler";
/** Stable id of the regular SNES BG tilemap codec. */
export declare const SNES_BG_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.bg";
/** Stable id of the byte-indexed SNES Mode 7 tilemap codec. */
export declare const SNES_MODE7_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.mode7";
/** 16-bit SNES BG entries: tile, palette, priority, and horizontal/vertical flips. */
export declare const snesBgTilemapAssetCodec: AssetCodec;
/** Row-major one-byte tile indexes used by the SNES Mode 7 tilemap. */
export declare const snesMode7TilemapAssetCodec: AssetCodec;
//# sourceMappingURL=tilemap.d.ts.map