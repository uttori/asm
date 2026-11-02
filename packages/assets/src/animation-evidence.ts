import { ASSET_LIMITS } from "./limits.js";
import { integer } from "./validation.js";

/** Evidence provenance travels with observations; pose names alone never determine playback order. */
export interface AnimationProvenance {
  /** Durable evidence record identity. */
  readonly id: string;
  /** Whether timing came from observation or a verified definition. */
  readonly kind: "observation" | "verified-definition";
  /** Locator for the evidence bundle or capture. */
  readonly source: string;
}

/** A known half-open hold in exact rational-clock ticks. Unknown final holds are omitted. */
export interface KnownPoseInterval {
  /** Pose name held during the half-open tick interval. */
  readonly pose: string;
  /** Inclusive start tick on the sequence rational clock. */
  readonly start: bigint;
  /** Exclusive end tick on the sequence rational clock. */
  readonly end: bigint;
}

/** Common pivot and ordered intervals are supplied by a game evidence provider, independent of file codecs. */
export interface KnownAnimationSequence {
  /** Sequence identity referenced by quantized runs. */
  readonly id: string;
  /** Evidence backing the interval list. */
  readonly provenance: AnimationProvenance;
  /** Rational clock rate converting ticks to wall time. */
  readonly ticksPerSecond: { readonly numerator: bigint; readonly denominator: bigint };
  /** Native origin position in presentation pixels; independent of each pose's packed source-atlas origin. */
  readonly pivot: { readonly x: number; readonly y: number };
  /** Ordered non-overlapping pose holds in tick time. */
  readonly intervals: readonly KnownPoseInterval[];
}

/** A contiguous observed run becomes its own tagged range; gaps do not create guessed hold frames. */
export interface QuantizedAnimationRun {
  /** Run identity within one quantization pass. */
  readonly id: string;
  /** Parent sequence id from the known evidence. */
  readonly sequence: string;
  /** Copied provenance retained on the run. */
  readonly provenance: AnimationProvenance;
  /** Presentation pivot copied from the sequence. */
  readonly pivot: KnownAnimationSequence["pivot"];
  /** Quantized holds with millisecond durations. */
  readonly frames: readonly { readonly pose: string; readonly durationMs: number }[];
}

/** Round cumulative boundaries, rather than individual holds, so fractional frame times cannot drift. */
/** Convert rational-clock ticks to rounded milliseconds without per-hold drift. */
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
