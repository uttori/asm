import { decodeBrrBlocks } from "./snes.js";
/**
 * SNES BRR integer predictor, matching the truncation order in the SoM reference decoder.
 * @param nibble Signed four-bit residual.
 * @param range Shift from the BRR header.
 * @param filter Predictor selected by the BRR header.
 * @param state Two prior decoded samples.
 * @returns Decoded signed PCM16 sample.
 */
function decodeNibble(nibble, range, filter, state) {
    let value = range <= 12 ? (nibble << range) >> 1 : nibble & ~0x7ff;
    const previous = state.previous;
    const halfPrevious2 = state.previous2 >> 1;
    if (filter === 1) {
        value += (previous >> 1) + (-previous >> 5);
    }
    if (filter === 2) {
        value += previous - halfPrevious2 + (halfPrevious2 >> 4) + ((previous * -3) >> 6);
    }
    if (filter === 3) {
        value += previous - halfPrevious2 + ((previous * -13) >> 7) + ((halfPrevious2 * 3) >> 4);
    }
    value = Math.max(-32768, Math.min(32767, value));
    return (value << 17) >> 16;
}
/**
 * Decode BRR PCM while preserving predictor history across an optional loop replay.
 * @param bytes Complete encoded BRR blocks ending in END.
 * @param loopOffset Optional loop start in BRR bytes, aligned to nine.
 * @param repeatCount Number of extra loop passes to decode for seam review.
 * @returns Integer PCM samples at the caller's explicit playback rate.
 */
export function decodeBrrPcm(bytes, loopOffset, repeatCount = 0) {
    if (bytes.length === 0 || bytes.length % 9 !== 0) {
        throw new Error("BRR stream requires complete nine-byte blocks.");
    }
    if (!Number.isSafeInteger(repeatCount) || repeatCount < 0 || repeatCount > 16) {
        throw new RangeError("BRR repeat count must be 0..16.");
    }
    const blocks = decodeBrrBlocks(bytes);
    if (blocks.some((block, index) => block.end !== Number(index === blocks.length - 1))) {
        throw new Error("BRR END flag must occur on the final block only.");
    }
    if (loopOffset !== undefined &&
        (!Number.isSafeInteger(loopOffset) ||
            loopOffset < 0 ||
            loopOffset >= bytes.length ||
            loopOffset % 9 !== 0 ||
            blocks.at(-1)?.loop !== 1)) {
        throw new Error("BRR loop offset or LOOP flag is invalid.");
    }
    if (loopOffset === undefined && repeatCount > 0) {
        throw new Error("BRR replay requires a loop offset.");
    }
    const output = [];
    let state = { previous: 0, previous2: 0 };
    const play = (startBlock) => {
        for (let index = startBlock; index < blocks.length; index++) {
            const block = blocks[index];
            for (const nibble of block.nibbles) {
                const sample = decodeNibble(nibble, block.range, block.filter, state);
                output.push(sample);
                state = { previous: sample, previous2: state.previous };
            }
        }
    };
    play(0);
    if (loopOffset !== undefined) {
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            play(loopOffset / 9);
        }
    }
    return Int16Array.from(output);
}
/**
 * Evaluate one filter/range with exact integer decoding and stable nibble tie-breaking.
 * @param source Original PCM samples.
 * @param start First sample of this block.
 * @param range Candidate shift.
 * @param filter Candidate predictor.
 * @param initial Predictor history entering this block.
 * @returns Candidate bytes, exit history, and squared error.
 */
function candidateBlock(source, start, range, filter, initial) {
    let state = initial;
    let squaredError = 0;
    const nibbles = [];
    for (let sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
        const target = source[start + sampleIndex];
        let bestNibble = -8;
        let bestSample = 0;
        let bestError = Number.POSITIVE_INFINITY;
        for (let nibble = -8; nibble <= 7; nibble++) {
            const decoded = decodeNibble(nibble, range, filter, state);
            const error = (target - decoded) ** 2;
            if (error < bestError || (error === bestError && Math.abs(nibble) < Math.abs(bestNibble))) {
                bestNibble = nibble;
                bestSample = decoded;
                bestError = error;
            }
        }
        nibbles.push(bestNibble);
        squaredError += bestError;
        state = { previous: bestSample, previous2: state.previous };
    }
    return { range, filter, nibbles, state, squaredError };
}
/**
 * Encode whole 16-sample PCM blocks with deterministic range/filter selection.
 * @param samples Signed PCM16 samples, already padded if requested.
 * @param loop Whether the final END block also carries LOOP.
 * @returns Headerless BRR data; sample rate and loop offset stay in metadata.
 */
export function encodeBrrPcm(samples, loop) {
    if (samples.length === 0 || samples.length % 16 !== 0) {
        throw new Error("BRR encoding requires at least one whole 16-sample block.");
    }
    const bytes = new Uint8Array((samples.length / 16) * 9);
    let state = { previous: 0, previous2: 0 };
    for (let start = 0; start < samples.length; start += 16) {
        let best;
        for (let filter = 0; filter < 4; filter++) {
            for (let range = 0; range <= 12; range++) {
                const candidate = candidateBlock(samples, start, range, filter, state);
                if (!best || candidate.squaredError < best.squaredError) {
                    best = candidate;
                }
            }
        }
        if (!best) {
            throw new Error("BRR encoder could not select a block.");
        }
        const offset = (start / 16) * 9;
        const final = start + 16 === samples.length;
        bytes[offset] =
            (best.range << 4) | (best.filter << 2) | (Number(final && loop) << 1) | Number(final);
        for (let index = 0; index < 16; index += 2) {
            bytes[offset + 1 + index / 2] =
                ((best.nibbles[index] & 15) << 4) | (best.nibbles[index + 1] & 15);
        }
        state = best.state;
    }
    return bytes;
}
//# sourceMappingURL=brr-codec.js.map