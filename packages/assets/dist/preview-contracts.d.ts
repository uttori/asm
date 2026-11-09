import type { AssetInput } from "./registry.js";
/** Inputs are already resolved and size checked in the language server. */
export interface AssetPreviewInput {
    /** Primary asset bytes already read and size-checked by the host. */
    readonly source: AssetInput;
    /** Named companion inputs resolved relative to the preview request. */
    readonly resources: Readonly<Record<string, AssetInput>>;
    /** Registered preview format id selecting the adapter. */
    readonly format: string;
    /** Format-specific options validated by the host before conversion. */
    readonly options: Readonly<Record<string, unknown>>;
    /** Optional named output slot when a format exposes several products. */
    readonly output?: string;
}
/** Small wire result. Encoded audio is returned only for explicit playback. */
export interface AssetPreviewResult {
    /** Wire payload category returned to the language server. */
    readonly kind: "image" | "audio" | "binary";
    /** Byte length of the primary source input. */
    readonly sourceBytes: number;
    /** Byte length of the dominant encoded artifact when present. */
    readonly encodedBytes: number;
    /** Preview format id that produced this result. */
    readonly format: string;
    /** Named output slot echoed from the request. */
    readonly output: string;
    /** Optional structured metadata safe for UI display. */
    readonly metadata?: Readonly<Record<string, unknown>>;
    /** Optional small PNG thumbnail as base64. */
    readonly thumbnailPngBase64?: string;
    /** Optional composed PNG preview as base64. */
    readonly composedPngBase64?: string;
    /** Optional storage-oriented PNG as base64. */
    readonly storagePngBase64?: string;
    /** Optional audio waveform PNG as base64. */
    readonly waveformPngBase64?: string;
    /** Optional source WAV bytes as base64 for explicit playback. */
    readonly sourceWavBase64?: string;
    /** Optional decoded WAV bytes as base64 for explicit playback. */
    readonly decodedWavBase64?: string;
}
/** A registered bounded converter receives resolved bytes, never workspace paths or publication authority. */
export interface AssetPreviewAdapter {
    /** Preview format ids handled by this adapter. */
    readonly formats: readonly string[];
    /** Produce a bounded preview from resolved bytes; never reads workspace paths. */
    convert(input: AssetPreviewInput): AssetPreviewResult;
}
//# sourceMappingURL=preview-contracts.d.ts.map