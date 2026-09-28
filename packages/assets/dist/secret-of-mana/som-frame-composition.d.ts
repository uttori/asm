import type { ExternalTileRef, FrameLayout, FrameRecord } from "./som-types.js";
/**
 * Resolve the adapter's ROM/expanded-slot references, then use the portable grid expander.
 * Existing external references are an explicit read-only inventory, never guessed pixels.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {FrameRecord} frame Pose whose blocks expand into occurrences.
 * @returns {object[]} Derived 8×8 occurrences.
 */
export declare function deriveFramePlacements(layout: FrameLayout, frame: FrameRecord): ({
    segment: string;
    tile: number;
    external?: undefined;
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
} | {
    segment?: undefined;
    tile?: undefined;
    external: ExternalTileRef;
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
})[];
/** Check raw body evidence against editable blocks before interpreting any derived geometry.
 * @param {FrameRecord} frame Pose that may carry a native body record.
 * @returns {void} Nothing; invalid records throw.
 */
export declare function validateNativeFrame(frame: FrameRecord): void;
/** Validate optional v1 composition as one coherent model; legacy assembly-only layouts remain valid.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {FrameRecord} frame Pose to check.
 * @returns {object[] | undefined} Derived placements when the pose retains composition.
 */
export declare function validateFrameComposition(layout: FrameLayout, frame: FrameRecord): ({
    segment: string;
    tile: number;
    external?: undefined;
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
} | {
    segment?: undefined;
    tile?: undefined;
    external: ExternalTileRef;
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
})[] | undefined;
//# sourceMappingURL=som-frame-composition.d.ts.map