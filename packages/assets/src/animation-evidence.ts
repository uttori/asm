import { ASSET_LIMITS } from "./limits.js";
import { integer } from "./validation.js";

/** Evidence provenance travels with observations; pose names alone never determine playback order. */
export interface AnimationProvenance {
  readonly id: string;
  readonly kind: "observation" | "verified-definition";
  readonly source: string;
}

/** A known half-open hold in exact rational-clock ticks. Unknown final holds are omitted. */
export interface KnownPoseInterval {
  readonly pose: string;
  readonly start: bigint;
  readonly end: bigint;
}

/** Common pivot and ordered intervals are supplied by a game evidence provider, independent of file codecs. */
export interface KnownAnimationSequence {
  readonly id: string;
  readonly provenance: AnimationProvenance;
  readonly ticksPerSecond: { readonly numerator: bigint; readonly denominator: bigint };
  /** Native origin position in presentation pixels; independent of each pose's packed source-atlas origin. */
  readonly pivot: { readonly x: number; readonly y: number };
  readonly intervals: readonly KnownPoseInterval[];
}

/** A contiguous observed run becomes its own tagged range; gaps do not create guessed hold frames. */
export interface QuantizedAnimationRun {
  readonly id: string;
  readonly sequence: string;
  readonly provenance: AnimationProvenance;
  readonly pivot: KnownAnimationSequence["pivot"];
  readonly frames: readonly { readonly pose: string; readonly durationMs: number }[];
}

/** Round cumulative boundaries, rather than individual holds, so fractional frame times cannot drift. */
function milliseconds(ticks: bigint, rate: KnownAnimationSequence["ticksPerSecond"]): bigint {
  return (ticks * rate.denominator * 1000n + rate.numerator / 2n) / rate.numerator;
}

/** Split gaps and quantize measured holds, retaining exact provenance and refusing zero/oversized frames. */
export function quantizeAnimationEvidence(
  sequences: readonly KnownAnimationSequence[],
): QuantizedAnimationRun[] {
  integer(sequences.length, "Known animation sequences", 0, ASSET_LIMITS.frames);
  const result: QuantizedAnimationRun[] = [],
    seen = new Set<string>();
  let frames = 0;
  for (const sequence of sequences) {
    if (
      !sequence.id ||
      seen.has(sequence.id) ||
      !sequence.provenance.id ||
      !sequence.provenance.source ||
      !["observation", "verified-definition"].includes(sequence.provenance.kind)
    ) {
      throw new Error("Invalid animation evidence identity/provenance.");
    }
    seen.add(sequence.id);
    if (
      typeof sequence.ticksPerSecond.numerator !== "bigint" ||
      typeof sequence.ticksPerSecond.denominator !== "bigint" ||
      sequence.ticksPerSecond.numerator < 1n ||
      sequence.ticksPerSecond.denominator < 1n ||
      sequence.ticksPerSecond.numerator > BigInt(Number.MAX_SAFE_INTEGER) ||
      sequence.ticksPerSecond.denominator > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw new Error("Invalid rational animation clock.");
    }
    integer(sequence.pivot.x, "Animation pivot x", -(1 << 20), 1 << 20);
    integer(sequence.pivot.y, "Animation pivot y", -(1 << 20), 1 << 20);
    integer(
      sequence.intervals.length,
      "Known animation intervals",
      0,
      ASSET_LIMITS.frames - frames,
    );
    let previous: bigint | undefined,
      origin = 0n,
      run: { pose: string; durationMs: number }[] | undefined;
    let runIndex = 0;
    for (const interval of sequence.intervals) {
      if (
        !interval.pose ||
        typeof interval.start !== "bigint" ||
        typeof interval.end !== "bigint" ||
        interval.start < 0n ||
        interval.end <= interval.start ||
        interval.end > BigInt(Number.MAX_SAFE_INTEGER) ||
        (previous !== undefined && interval.start < previous)
      ) {
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
      const duration =
        milliseconds(interval.end - origin, sequence.ticksPerSecond) -
        milliseconds(interval.start - origin, sequence.ticksPerSecond);
      if (duration < 1n || duration > 65535n) {
        throw new Error(
          `Sequence ${sequence.id} pose ${interval.pose}: quantized hold is zero or exceeds 65535 milliseconds.`,
        );
      }
      run!.push({ pose: interval.pose, durationMs: Number(duration) });
      frames++;
      previous = interval.end;
    }
  }
  return result;
}
