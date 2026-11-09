import { ASSET_LIMITS } from "./limits.js";
import { integer } from "./validation.js";
/** Round cumulative boundaries, rather than individual holds, so fractional frame times cannot drift. */
/** Convert rational-clock ticks to rounded milliseconds without per-hold drift. */
function milliseconds(ticks, rate) {
    return (ticks * rate.denominator * 1000n + rate.numerator / 2n) / rate.numerator;
}
/** Split gaps and quantize measured holds, retaining exact provenance and refusing zero/oversized frames. */
export function quantizeAnimationEvidence(sequences) {
    integer(sequences.length, "Known animation sequences", 0, ASSET_LIMITS.frames);
    const result = [], seen = new Set();
    let frames = 0;
    for (const sequence of sequences) {
        if (!sequence.id ||
            seen.has(sequence.id) ||
            !sequence.provenance.id ||
            !sequence.provenance.source ||
            !["observation", "verified-definition"].includes(sequence.provenance.kind)) {
            throw new Error("Invalid animation evidence identity/provenance.");
        }
        seen.add(sequence.id);
        if (typeof sequence.ticksPerSecond.numerator !== "bigint" ||
            typeof sequence.ticksPerSecond.denominator !== "bigint" ||
            sequence.ticksPerSecond.numerator < 1n ||
            sequence.ticksPerSecond.denominator < 1n ||
            sequence.ticksPerSecond.numerator > BigInt(Number.MAX_SAFE_INTEGER) ||
            sequence.ticksPerSecond.denominator > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("Invalid rational animation clock.");
        }
        integer(sequence.pivot.x, "Animation pivot x", -(1 << 20), 1 << 20);
        integer(sequence.pivot.y, "Animation pivot y", -(1 << 20), 1 << 20);
        integer(sequence.intervals.length, "Known animation intervals", 0, ASSET_LIMITS.frames - frames);
        let previous, origin = 0n, run;
        let runIndex = 0;
        for (const interval of sequence.intervals) {
            if (!interval.pose ||
                typeof interval.start !== "bigint" ||
                typeof interval.end !== "bigint" ||
                interval.start < 0n ||
                interval.end <= interval.start ||
                interval.end > BigInt(Number.MAX_SAFE_INTEGER) ||
                (previous !== undefined && interval.start < previous)) {
                throw new Error("Invalid, unordered or overlapping known animation interval.");
            }
            if (previous !== interval.start) {
                origin = interval.start;
                run = [];
                result.push({
                    id: JSON.stringify([sequence.id, runIndex++]),
                    sequence: sequence.id,
                    provenance: { ...sequence.provenance },
                    pivot: { ...sequence.pivot },
                    frames: run,
                });
            }
            const duration = milliseconds(interval.end - origin, sequence.ticksPerSecond) -
                milliseconds(interval.start - origin, sequence.ticksPerSecond);
            if (duration < 1n || duration > 65535n) {
                throw new Error(`Sequence ${sequence.id} pose ${interval.pose}: quantized hold is zero or exceeds 65535 milliseconds.`);
            }
            run.push({ pose: interval.pose, durationMs: Number(duration) });
            frames++;
            previous = interval.end;
        }
    }
    return result;
}
//# sourceMappingURL=animation-evidence.js.map