import AudioWAV from "@uttori/data-tools/audio/audio-wav";
import { decodeBrrPcm, encodeBrrPcm } from "./brr-codec.js";
export { decodeBrrPcm, encodeBrrPcm } from "./brr-codec.js";
const MAX_WAVE_BYTES = 16 * 1024 * 1024;
const MAX_SAMPLES = 1024 * 1024;
const u16le = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const u32le = (bytes, offset) => (bytes[offset] +
    bytes[offset + 1] * 256 +
    bytes[offset + 2] * 65536 +
    bytes[offset + 3] * 16777216) >>>
    0;
const ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
/** Scan RIFF extents strictly before passing individual chunks to AudioWAV's model decoders.
 * @param {Uint8Array} bytes Borrowed complete WAVE container.
 * @returns {ReadonlyMap<string, RiffChunk>} The required and optional first-release chunks.
 */
function scanWave(bytes) {
    if (bytes.length < 12 ||
        bytes.length > MAX_WAVE_BYTES ||
        ascii(bytes, 0, 4) !== "RIFF" ||
        ascii(bytes, 8, 4) !== "WAVE" ||
        u32le(bytes, 4) + 8 !== bytes.length) {
        throw new Error("Expected a bounded little-endian RIFF/WAVE file with an exact declared size.");
    }
    AudioWAV.decodeHeader(bytes.subarray(0, 12));
    const chunks = new Map();
    let offset = 12;
    while (offset < bytes.length) {
        if (offset + 8 > bytes.length) {
            throw new Error("Truncated WAVE chunk header.");
        }
        const name = ascii(bytes, offset, 4);
        const size = u32le(bytes, offset + 4);
        const end = offset + 8 + size;
        const next = end + (size & 1);
        if (!Number.isSafeInteger(next) || next > bytes.length) {
            throw new Error(`Truncated WAVE ${name} chunk or RIFF pad byte.`);
        }
        if (["fmt ", "data", "smpl"].includes(name)) {
            if (chunks.has(name)) {
                throw new Error(`Duplicate WAVE ${name} chunk.`);
            }
            chunks.set(name, { bytes: bytes.subarray(offset, end), size });
        }
        offset = next;
    }
    if (!chunks.has("fmt ") || !chunks.has("data")) {
        throw new Error("WAVE requires one fmt and one data chunk.");
    }
    return chunks;
}
/** Browser-safe RIFF PCM8/PCM16 importer using published AudioWAV chunk models. */
export const waveImporter = Object.freeze({
    id: "uttori.import.wave",
    version: "1.0.0",
    mediaTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
    import: (input) => {
        const chunks = scanWave(input.bytes);
        const formatChunk = chunks.get("fmt ");
        const dataChunk = chunks.get("data");
        if (formatChunk.size !== 16 &&
            !(formatChunk.size === 18 && u16le(formatChunk.bytes, 24) === 0)) {
            throw new Error("WAVE PCM fmt requires 16 bytes or an empty two-byte extension.");
        }
        const format = AudioWAV.decodeFMT(formatChunk.bytes);
        if (format.audioFormatValue !== 1 ||
            format.channels !== 1 ||
            (format.bitsPerSample !== 8 && format.bitsPerSample !== 16)) {
            throw new Error(`Unsupported WAVE format: code ${format.audioFormatValue}, ${format.channels} channels, ${format.bitsPerSample} bits; expected mono PCM8/PCM16.`);
        }
        const bytesPerSample = format.bitsPerSample / 8;
        if (!Number.isSafeInteger(format.sampleRate) ||
            format.sampleRate < 1 ||
            format.sampleRate > 384000 ||
            format.blockAlign !== bytesPerSample ||
            format.byteRate !== format.sampleRate * bytesPerSample ||
            dataChunk.size % bytesPerSample !== 0 ||
            dataChunk.size / bytesPerSample > MAX_SAMPLES) {
            throw new Error("WAVE sample rate, alignment, byte rate, or data length is invalid.");
        }
        const sampleCount = dataChunk.size / bytesPerSample;
        const samples = new Int16Array(sampleCount);
        const data = dataChunk.bytes.subarray(8);
        for (let index = 0; index < sampleCount; index++) {
            if (format.bitsPerSample === 8) {
                samples[index] = (data[index] - 128) << 8;
            }
            else {
                const unsigned = u16le(data, index * 2);
                samples[index] = unsigned >= 32768 ? unsigned - 65536 : unsigned;
            }
        }
        let loop;
        const sampleChunk = chunks.get("smpl");
        if (sampleChunk) {
            if (sampleChunk.size < 36) {
                throw new Error("WAVE smpl chunk is truncated.");
            }
            const loopCount = u32le(sampleChunk.bytes, 8 + 28);
            const extraBytes = u32le(sampleChunk.bytes, 8 + 32);
            if (loopCount > 1 || 36 + loopCount * 24 + extraBytes !== sampleChunk.size) {
                throw new Error("WAVE smpl requires at most one complete forward loop.");
            }
            const smpl = AudioWAV.decodeSMPL(sampleChunk.bytes);
            if (smpl.sampleLoopsCount !== loopCount) {
                throw new Error("WAVE smpl loop count mismatch.");
            }
            if (loopCount === 1) {
                const sourceLoop = smpl.sampleLoops[0];
                if (sourceLoop.type !== 0 ||
                    sourceLoop.count !== 0 ||
                    sourceLoop.start >= sampleCount ||
                    sourceLoop.end < sourceLoop.start ||
                    sourceLoop.end >= sampleCount) {
                    throw new Error("Unsupported or out-of-range WAVE smpl loop.");
                }
                // RIFF's final loop frame is played; our normalized end is exclusive.
                loop = { start: sourceLoop.start, end: sourceLoop.end + 1 };
            }
        }
        const value = {
            kind: "pcm-audio",
            sampleRate: format.sampleRate,
            sourceBitDepth: format.bitsPerSample,
            samples,
            loop,
        };
        return {
            kind: value.kind,
            value,
            metadata: {
                sampleRate: value.sampleRate,
                sourceBitDepth: value.sourceBitDepth,
                sourceLoop: loop,
            },
        };
    },
});
/** Write review PCM16 WAVE without Node Buffer or a guessed BRR playback rate.
 * @param {Int16Array} samples Decoded signed PCM16 samples.
 * @param {number} sampleRate Explicit review playback rate in Hz.
 * @returns {Uint8Array} Headered mono PCM16 RIFF/WAVE bytes.
 */
export function writePcmWave(samples, sampleRate) {
    if (!Number.isSafeInteger(sampleRate) ||
        sampleRate < 1 ||
        sampleRate > 384000 ||
        samples.length > MAX_SAMPLES) {
        throw new RangeError("Invalid review WAVE sample rate or length.");
    }
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const writeAscii = (offset, value) => {
        for (let index = 0; index < value.length; index++) {
            bytes[offset + index] = value.charCodeAt(index);
        }
    };
    writeAscii(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    writeAscii(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, "data");
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
    return bytes;
}
/** Resolve source loops without encoding, so preserved native streams can validate the same policy. */
export const resolveBrrAudioOptions = (raw, source) => {
    if (Object.keys(raw).some((key) => key !== "padding" && key !== "loop")) {
        throw new Error("Unknown WAVE-to-BRR option.");
    }
    const padding = raw.padding === undefined ? "reject" : raw.padding;
    if (padding !== "reject" && padding !== "zero") {
        throw new Error("padding must be 'reject' or 'zero'.");
    }
    let requested = raw.loop;
    if (requested === undefined) {
        requested = source.loop ? "source" : false;
    }
    if (requested === false) {
        return { padding, loop: false };
    }
    if (requested === "source") {
        if (!source.loop) {
            throw new Error("WAVE has no source loop.");
        }
        requested = source.loop;
    }
    if (!requested ||
        typeof requested !== "object" ||
        Array.isArray(requested) ||
        !("start" in requested) ||
        !("end" in requested) ||
        typeof requested.start !== "number" ||
        typeof requested.end !== "number" ||
        Object.keys(requested).some((key) => key !== "start" && key !== "end")) {
        throw new Error("loop must be false, 'source', or { start, end } in sample frames.");
    }
    if (!Number.isSafeInteger(requested.start) ||
        !Number.isSafeInteger(requested.end) ||
        requested.start < 0 ||
        requested.start >= requested.end ||
        requested.end !== source.samples.length ||
        requested.start % 16 !== 0 ||
        requested.end % 16 !== 0) {
        throw new Error("BRR loop must start on a 16-sample boundary and end at the unpadded tail.");
    }
    return { padding, loop: { start: requested.start, end: requested.end } };
};
/** Extend the native `snes.brr` ID with its deliberate PCM-to-BRR lossy path.
 * @param {readonly AssetEncoder[]} native Native block model encoders.
 * @returns {readonly AssetEncoder[]} Combined format registrations.
 */
export function withAudioEncoder(native) {
    return native.map((encoder) => {
        if (encoder.id !== "snes.brr") {
            return encoder;
        }
        return Object.freeze({
            ...encoder,
            inputKinds: [...encoder.inputKinds, "pcm-audio"],
            encode: (document, rawOptions, resources) => {
                if (document.kind !== "pcm-audio") {
                    return encoder.encode(document, rawOptions, resources);
                }
                if (!document.value ||
                    typeof document.value !== "object" ||
                    !("samples" in document.value) ||
                    !(document.value.samples instanceof Int16Array) ||
                    !("sampleRate" in document.value) ||
                    typeof document.value.sampleRate !== "number" ||
                    !Number.isSafeInteger(document.value.sampleRate) ||
                    document.value.sampleRate < 1 ||
                    document.value.sampleRate > 384000 ||
                    !("sourceBitDepth" in document.value) ||
                    (document.value.sourceBitDepth !== 8 && document.value.sourceBitDepth !== 16)) {
                    throw new Error("PCM model requires bounded mono PCM16 samples and an explicit source rate/depth.");
                }
                const audio = document.value;
                const options = resolveBrrAudioOptions(rawOptions, audio);
                const originalCount = audio.samples.length;
                if (originalCount === 0) {
                    throw new Error("WAVE has no PCM samples.");
                }
                const paddingCount = (16 - (originalCount % 16)) % 16;
                if (paddingCount > 0 && options.padding === "reject") {
                    throw new Error(`WAVE has ${originalCount} samples; BRR requires complete 16-sample blocks.`);
                }
                const padded = new Int16Array(originalCount + paddingCount);
                padded.set(audio.samples);
                const loop = options.loop;
                const brr = encodeBrrPcm(padded, Boolean(loop));
                const loopOffset = loop ? (loop.start / 16) * 9 : undefined;
                const decoded = decodeBrrPcm(brr, loopOffset);
                let squared = 0;
                let signal = 0;
                let peakError = 0;
                for (let index = 0; index < originalCount; index++) {
                    const error = audio.samples[index] - decoded[index];
                    squared += error * error;
                    signal += audio.samples[index] * audio.samples[index];
                    peakError = Math.max(peakError, Math.abs(error));
                }
                const rmsError = Math.sqrt(squared / originalCount);
                const snrDb = squared > 0 && signal > 0 ? 10 * Math.log10(signal / squared) : undefined;
                let loopPeakError;
                if (loop) {
                    const repeated = decodeBrrPcm(brr, loopOffset, 1);
                    loopPeakError = 0;
                    for (let index = 0; index < loop.end - loop.start; index++) {
                        const replay = repeated[padded.length + index];
                        loopPeakError = Math.max(loopPeakError, Math.abs(replay - audio.samples[loop.start + index]));
                    }
                }
                const metadata = {
                    sampleRate: audio.sampleRate,
                    sourceBitDepth: audio.sourceBitDepth,
                    sourceSamples: originalCount,
                    paddedSamples: padded.length,
                    paddingSamples: paddingCount,
                    sourceLoop: audio.loop,
                    loop,
                    loopOffset,
                    peakError,
                    rmsError,
                    snrDb,
                    loopPeakError,
                    encoderPolicy: "greedy-integer-sse-v1",
                };
                return {
                    outputs: {
                        brr: { bytes: brr, mediaType: "application/octet-stream", metadata },
                        reviewWav: {
                            bytes: writePcmWave(decoded, audio.sampleRate),
                            mediaType: "audio/wav",
                            metadata,
                        },
                    },
                    fidelity: {
                        kind: "lossy-audio",
                        sampleRate: audio.sampleRate,
                        sourceSamples: originalCount,
                        paddedSamples: padded.length,
                        paddingSamples: paddingCount,
                        decodedSamples: decoded.length,
                        peakError,
                        rmsError,
                        snrDb,
                        loopPeakError,
                    },
                    normalizedOptions: { padding: options.padding, loop: loop ?? false },
                };
            },
        });
    });
}
//# sourceMappingURL=audio.js.map