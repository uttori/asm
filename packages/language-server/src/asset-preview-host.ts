import { somPreviewAdapters } from "@uttori/asm-game-secret-of-mana/preview";

import {
  convertAssetPreview as convert,
  type AssetPreviewInput,
} from "./asset-preview-conversion.js";
export type { AssetPreviewInput, AssetPreviewResult } from "./asset-preview-conversion.js";
/** Bundled editor composition. Additional preview contributions need no provider or dispatcher branches. */
export const convertAssetPreview = (input: AssetPreviewInput) => convert(input, somPreviewAdapters);
export const supportsGameAssetPreview = (id: string): boolean =>
  somPreviewAdapters.some((adapter) => adapter.formats.includes(id));
