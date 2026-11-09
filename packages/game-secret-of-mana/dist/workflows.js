import { executeAssetOperation as execute, registerAssetAdapter, } from "@uttori/asm-workflows/asset-interchange";
import { executeAssetSourceOperation as convert, createAssetSourceConversionService as create, } from "@uttori/asm-workflows/asset-source";
import { somRoomSourceAdapter } from "./room-adapter.js";
import { somSourceConversionAdapter } from "./source-adapter.js";
import { somAssetSourceHost } from "./source-host.js";
import { somSpriteSourceAdapter } from "./sprite-adapter.js";
export { somSourceConversionAdapter, somSpriteSourceAdapter, somRoomSourceAdapter };
/** Explicit host contributions; native conversion and interchange retain separate services and authority. */
export const somAssetAdapters = Object.freeze([
    registerAssetAdapter(somSpriteSourceAdapter),
    registerAssetAdapter(somRoomSourceAdapter),
]);
/** Native conversion adapters for SoM sprite and room source files. */
export const somSourceAdapters = Object.freeze([
    somSourceConversionAdapter,
]);
/** SoM tools use this composed host; generic workflow code knows no game IDs. */
export const executeAssetOperation = (value, options = {}) => execute(value, {
    ...options,
    host: options.host ?? somAssetSourceHost,
    adapters: [...somAssetAdapters, ...(options.adapters ?? [])],
});
/** Convert SoM asset source through the bundled host and adapters. */
export const executeAssetSourceOperation = (value, options = {}) => convert(value, {
    ...options,
    host: options.host ?? somAssetSourceHost,
    adapters: [...somSourceAdapters, ...(options.adapters ?? [])],
});
/** Build a conversion service that uses the SoM host unless another is supplied. */
export const createAssetSourceConversionService = (host) => create(host ?? somAssetSourceHost, somSourceAdapters);
//# sourceMappingURL=workflows.js.map