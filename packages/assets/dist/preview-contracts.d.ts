import type { AssetInput } from "./registry.js";
/** Inputs are already resolved and size checked in the language server. */
export interface AssetPreviewInput {
    readonly source: AssetInput;
    readonly resources: Readonly<Record<string, AssetInput>>;
    readonly format: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly output?: string;
}
/** Small wire result. Encoded audio is returned only for explicit playback. */
export interface AssetPreviewResult {
    readonly kind: "image" | "audio" | "binary";
    readonly sourceBytes: number;
    readonly encodedBytes: number;
    readonly format: string;
    readonly output: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly thumbnailPngBase64?: string;
    readonly composedPngBase64?: string;
    readonly storagePngBase64?: string;
    readonly waveformPngBase64?: string;
    readonly sourceWavBase64?: string;
    readonly decodedWavBase64?: string;
}
/** A registered bounded converter receives resolved bytes, never workspace paths or publication authority. */
export interface AssetPreviewAdapter {
    readonly formats: readonly string[];
    convert(input: AssetPreviewInput): AssetPreviewResult;
}
//# sourceMappingURL=preview-contracts.d.ts.map