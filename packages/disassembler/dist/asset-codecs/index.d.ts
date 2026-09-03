import { AssetCodecRegistry, type AssetCodec } from "../asset-codec.js";
export * from "./index-table.js";
export * from "./pointer-table.js";
export * from "./raw.js";
export * from "./scalar-array.js";
export * from "./struct-array.js";
export * from "./text.js";
/** Built-in target-neutral codecs in stable-id order. */
export declare const builtinAssetCodecs: readonly AssetCodec[];
/**
 * Creates a registry populated with every built-in target-neutral codec.
 * @returns {AssetCodecRegistry} New registry containing the built-in codecs.
 */
export declare const createBuiltinAssetCodecRegistry: () => AssetCodecRegistry;
//# sourceMappingURL=index.d.ts.map