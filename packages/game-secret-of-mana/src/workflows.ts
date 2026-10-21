import {
  executeAssetOperation as execute,
  registerAssetAdapter,
  type AssetOperationOptions,
  type AssetSourceHost,
} from "@uttori/asm-workflows/asset-interchange";
import {
  executeAssetSourceOperation as convert,
  createAssetSourceConversionService as create,
  type AssetSourceConversionAdapter,
} from "@uttori/asm-workflows/asset-source";

import { somRoomSourceAdapter } from "./room-adapter.js";
import { somSourceConversionAdapter } from "./source-adapter.js";
import { somAssetSourceHost } from "./source-host.js";
import { somSpriteSourceAdapter } from "./sprite-adapter.js";
export { somSourceConversionAdapter, somSpriteSourceAdapter, somRoomSourceAdapter };
export type { SomSpriteSelection } from "./sprite-adapter.js";
export type { SomRoomSelection } from "./room-adapter.js";
/** Explicit host contributions; native conversion and interchange retain separate services and authority. */
export const somAssetAdapters = Object.freeze([
  registerAssetAdapter(somSpriteSourceAdapter),
  registerAssetAdapter(somRoomSourceAdapter),
]);
export const somSourceAdapters: readonly AssetSourceConversionAdapter[] = Object.freeze([
  somSourceConversionAdapter,
]);
/** SoM tools use this composed host; generic workflow code knows no game IDs. */
export const executeAssetOperation = (value: unknown, options: AssetOperationOptions = {}) =>
  execute(value, {
    ...options,
    host: options.host ?? somAssetSourceHost,
    adapters: [...somAssetAdapters, ...(options.adapters ?? [])],
  });
export const executeAssetSourceOperation = (
  value: unknown,
  options: Parameters<typeof convert>[1] = {},
) =>
  convert(value, {
    ...options,
    host: options.host ?? somAssetSourceHost,
    adapters: [...somSourceAdapters, ...(options.adapters ?? [])],
  });
export const createAssetSourceConversionService = (host?: AssetSourceHost) =>
  create(host ?? somAssetSourceHost, somSourceAdapters);
