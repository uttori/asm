import type { KnownAnimationSequence } from "../animation-evidence.js";
import type { FrameRecord } from "./som-types.js";
/** Source-owned selection of known capture intervals; hashes identify evidence, never native pixel ownership. */
export interface SomObservationDeclaration {
    /** Observation sidecar discriminator. */
    readonly format: "som.sprite.observations";
    /** Sidecar schema revision. */
    readonly version: 1;
    /** Stable observation bundle identity. */
    readonly id: string;
    /** SHA-256 of the ROM bytes referenced by the capture. */
    readonly romSha256: string;
    /** SHA-256 of the proof bundle supporting the intervals. */
    readonly proofSha256: string;
    /** Capture locator or label for the observation session. */
    readonly capture: string;
    /** Presentation pivot in pixels for quantized animation runs. */
    readonly pivot: {
        readonly x: number;
        readonly y: number;
    };
    /** Palette bank snapshots referenced while observing. */
    readonly paletteBanks: readonly {
        readonly bank: number;
        readonly bytes: string;
    }[];
    /** Known pose intervals selected from the capture clock. */
    readonly ranges: readonly {
        readonly id: string;
        readonly start: bigint;
        readonly end: bigint;
    }[];
}
/** Read the versioned portable declaration; unsupported versions require a new explicit source declaration. */
export declare function readSomObservationDeclaration(value: unknown): SomObservationDeclaration;
/**
 * Adapt retained native display proof into known half-open pose holds. Only consecutive,
 * joined physical uploads establish continuity; unsupported display states remain gaps.
 * The final observation bounds the preceding hold and never creates a guessed terminal frame.
 */
export declare function resolveSomObservationEvidence(proofValue: unknown, declaration: SomObservationDeclaration, poses: readonly FrameRecord[]): {
    readonly sequences: readonly KnownAnimationSequence[];
    readonly gaps: readonly {
        readonly start: bigint;
        readonly reason: string;
    }[];
};
//# sourceMappingURL=som-observation-evidence.d.ts.map