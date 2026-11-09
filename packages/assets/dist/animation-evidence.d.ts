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
    readonly ticksPerSecond: {
        readonly numerator: bigint;
        readonly denominator: bigint;
    };
    /** Native origin position in presentation pixels; independent of each pose's packed source-atlas origin. */
    readonly pivot: {
        readonly x: number;
        readonly y: number;
    };
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
    readonly frames: readonly {
        readonly pose: string;
        readonly durationMs: number;
    }[];
}
/** Split gaps and quantize measured holds, retaining exact provenance and refusing zero/oversized frames. */
export declare function quantizeAnimationEvidence(sequences: readonly KnownAnimationSequence[]): QuantizedAnimationRun[];
//# sourceMappingURL=animation-evidence.d.ts.map