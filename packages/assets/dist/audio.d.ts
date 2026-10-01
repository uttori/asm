import type { AssetEncoder, AssetImporter } from "./registry.js";
export { decodeBrrPcm, encodeBrrPcm } from "./brr-codec.js";
/** Normalized mono samples use signed PCM16 without resampling or gain changes. */
export interface PcmAudio {
    readonly kind: "pcm-audio";
    readonly sampleRate: number;
    readonly sourceBitDepth: 8 | 16;
    readonly samples: Int16Array;
    /** Loop end is exclusive, unlike RIFF `smpl`'s inclusive end. */
    readonly loop?: Readonly<{
        start: number;
        end: number;
    }>;
}
/** Browser-safe RIFF PCM8/PCM16 importer using published AudioWAV chunk models. */
export declare const waveImporter: AssetImporter;
/** Write review PCM16 WAVE without Node Buffer or a guessed BRR playback rate.
 * @param {Int16Array} samples Decoded signed PCM16 samples.
 * @param {number} sampleRate Explicit review playback rate in Hz.
 * @returns {Uint8Array} Headered mono PCM16 RIFF/WAVE bytes.
 */
export declare function writePcmWave(samples: Int16Array, sampleRate: number): Uint8Array;
/** Validated block/padding and forward-loop policy, with an exclusive sample-frame end. */
export interface AudioOptions {
    readonly padding: "reject" | "zero";
    readonly loop: false | Readonly<{
        start: number;
        end: number;
    }>;
}
/** Resolve source loops without encoding, so preserved native streams can validate the same policy. */
export declare const resolveBrrAudioOptions: (raw: Readonly<Record<string, unknown>>, source: PcmAudio) => AudioOptions;
/** Extend the native `snes.brr` ID with its deliberate PCM-to-BRR lossy path.
 * @param {readonly AssetEncoder[]} native Native block model encoders.
 * @returns {readonly AssetEncoder[]} Combined format registrations.
 */
export declare function withAudioEncoder(native: readonly AssetEncoder[]): readonly AssetEncoder[];
//# sourceMappingURL=audio.d.ts.map