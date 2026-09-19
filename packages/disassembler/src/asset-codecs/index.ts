import { AssetCodecRegistry, type AssetCodec } from "../asset-codec.js";
import { indexTableAssetCodec } from "./index-table.js";
import { pointerTableAssetCodec } from "./pointer-table.js";
import { rawAssetCodec } from "./raw.js";
import { scalarArrayAssetCodec } from "./scalar-array.js";
import { structArrayAssetCodec } from "./struct-array.js";
import { textAssetCodec } from "./text.js";

export * from "./index-table.js";
export * from "./pointer-table.js";
export * from "./raw.js";
export * from "./scalar-array.js";
export * from "./struct-array.js";
export * from "./text.js";

/** Built-in target-neutral codecs in stable-id order. */
export const builtinAssetCodecs: readonly AssetCodec[] = Object.freeze(
  [
    indexTableAssetCodec,
    pointerTableAssetCodec,
    rawAssetCodec,
    scalarArrayAssetCodec,
    structArrayAssetCodec,
    textAssetCodec,
  ].sort((left, right) => left.id.localeCompare(right.id)),
);

/**
 * Creates a registry populated with every built-in target-neutral codec.
 * @returns {AssetCodecRegistry} New registry containing the built-in codecs.
 */
export const createBuiltinAssetCodecRegistry = (): AssetCodecRegistry => {
  const registry = new AssetCodecRegistry();
  for (const codec of builtinAssetCodecs) {
    registry.register(codec);
  }
  return registry;
};
