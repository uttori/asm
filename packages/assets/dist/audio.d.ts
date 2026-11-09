import type { AssetEncoder, AssetImporter } from "./registry.js";
export { decodeBrrPcm, encodeBrrPcm } from "./brr-codec.js";
/** Normalized mono samples use signed PCM16 without resampling or gain changes. */
export interface PcmAudio {
    /** Model discriminator for PCM importers and encoders. */
    readonly kind: "pcm-audio";
    /** Sample rate in hertz without resampling. */
    readonly sampleRate: number;
    /** Original WAV sample width before normalization. */
    readonly sourceBitDepth: 8 | 16;
    /** Mono PCM16 samples in capture order. */
    readonly samples: Int16Array;
    /** Loop end is exclusive, unlike RIFF `smpl`'s inclusive end. */
    readonly loop?: Readonly<{
        start: number;
        end: number;
    }>;
}
/**
 * Rebuild a PCM model from an importer or encoder document value.
 * @param value Untrusted document payload.
 * @returns Owned field snapshot; the sample buffer is the validated array.
 */
export declare function readPcmAudio(value: unknown): PcmAudio;
/** Browser-safe RIFF PCM8/PCM16 importer using published AudioWAV chunk models. */
export declare const waveImporter: AssetImporter;
/**
 * Write review PCM16 WAVE without Node Buffer or a guessed BRR playback rate.
 * @param samples Decoded signed PCM16 samples.
 * @param sampleRate Explicit review playback rate in Hz.
 * @returns Headered mono PCM16 RIFF/WAVE bytes.
 */
export declare function writePcmWave(samples: Int16Array, sampleRate: number): Uint8Array;
/** Validated block/padding and forward-loop policy, with an exclusive sample-frame end. */
export interface AudioOptions {
    /** How trailing partial BRR blocks are handled on encode. */
    readonly padding: "reject" | "zero";
    /** Forward loop range with exclusive end sample index, or disabled. */
    readonly loop: false | Readonly<{
        start: number;
        end: number;
    }>;
}
/** Resolve source loops without encoding, so preserved native streams can validate the same policy. */
export declare const resolveBrrAudioOptions: (raw: Readonly<Record<string, unknown>>, source: PcmAudio) => AudioOptions;
/**
 * Extend the native `snes.brr` ID with its deliberate PCM-to-BRR lossy path.
 * @param native Native block model encoders.
 * @returns Combined format registrations.
 */
export declare function withAudioEncoder(native: readonly AssetEncoder[]): readonly AssetEncoder[];
//# sourceMappingURL=audio.d.ts.map