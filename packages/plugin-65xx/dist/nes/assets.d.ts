import type { AssetFormatContribution } from "@uttori/asm-core/plugin";
/** NES tiles contain eight low-plane rows followed by eight high-plane rows, MSB pixel first. */
export declare const NES_CHR_CODEC = "nes.chr.2bpp";
/** Explicit single-byte tile alphabet; no ASCII fallback or implicit control codes. */
export declare const NES_TEXT_CODEC = "nes.text.tiles";
/** Render complete native tiles in row-major order. Columns must divide the tile count exactly. */
export declare function nesChrPng(bytes: Uint8Array, columns?: number): Uint8Array;
/** Preserve PNG palette indexes exactly; RGB changes cannot silently remap the encoded tile values. */
export declare function encodeNesChrPng(bytes: Uint8Array): Uint8Array;
/** Options enumerate every accepted character and its byte; duplicate bytes make decoding ambiguous. */
export declare function nesTextMap(options: unknown): ReadonlyMap<string, number>;
/** Decode only proved glyphs. Control bytes and unknown tiles require separate source ranges. */
export declare function decodeNesText(bytes: Uint8Array, options: unknown): string;
/** Exact encoders available to NES assembly and source previews; source bytes are borrowed only during conversion. */
export declare const nesAssetFormats: readonly AssetFormatContribution[];
//# sourceMappingURL=assets.d.ts.map