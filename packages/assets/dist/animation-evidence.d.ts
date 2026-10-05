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
    readonly ticksPerSecond: {
        readonly numerator: bigint;
        readonly denominator: bigint;
    };
    /** Native origin position in presentation pixels; independent of each pose's packed source-atlas origin. */
    readonly pivot: {
        readonly x: number;
        readonly y: number;
    };
    readonly intervals: readonly KnownPoseInterval[];
}
/** A contiguous observed run becomes its own tagged range; gaps do not create guessed hold frames. */
export interface QuantizedAnimationRun {
    readonly id: string;
    readonly sequence: string;
    readonly provenance: AnimationProvenance;
    readonly pivot: KnownAnimationSequence["pivot"];
    readonly frames: readonly {
        readonly pose: string;
        readonly durationMs: number;
    }[];
}
/** Split gaps and quantize measured holds, retaining exact provenance and refusing zero/oversized frames. */
export declare function quantizeAnimationEvidence(sequences: readonly KnownAnimationSequence[]): QuantizedAnimationRun[];
//# sourceMappingURL=animation-evidence.d.ts.map