import { AssetCodecRegistry, type AssetCodec } from "@uttori/asm-disassembler";
export * from "./brr.js";
export * from "./palette.js";
export * from "./previews.js";
export * from "./tilemap.js";
export * from "./tiles.js";
/** Built-in SNES asset codecs in stable-id order. */
export declare const snesAssetCodecs: readonly AssetCodec[];
/**
 * Registers every SNES-specific codec in an existing asset registry.
 * @param {AssetCodecRegistry} registry Registry to extend.
 * @returns {AssetCodecRegistry} The same registry for fluent setup.
 */
export declare const registerSnesAssetCodecs: (registry: AssetCodecRegistry) => AssetCodecRegistry;
//# sourceMappingURL=index.d.ts.map