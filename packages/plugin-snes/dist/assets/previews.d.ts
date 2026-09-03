import type { AssetPreviewRenderer, AssetPreviewRegistry } from "@uttori/asm-disassembler";
/** Stable id of the deterministic SNES SVG preview renderer. */
export declare const SNES_SVG_ASSET_PREVIEW_ID = "snes.preview.svg";
/** Deterministic, bounded SVG diagnostics for every built-in SNES media codec. */
export declare const snesSvgAssetPreviewRenderer: AssetPreviewRenderer;
/**
 * Registers SNES preview renderers after the host has composed its asset registries.
 * @param {AssetPreviewRegistry} registry Preview registry to extend.
 * @returns {AssetPreviewRegistry} The same registry for fluent composition.
 */
export declare const registerSnesAssetPreviewRenderers: (registry: AssetPreviewRegistry) => AssetPreviewRegistry;
//# sourceMappingURL=previews.d.ts.map