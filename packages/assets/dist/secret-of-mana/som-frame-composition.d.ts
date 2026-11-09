import type { ExternalTileRef, FrameLayout, FramePlacement, FrameRecord } from "./som-types.js";
/**
 * Resolve the adapter's ROM/expanded-slot references, then use the portable grid expander.
 * Existing external references are an explicit read-only inventory, never guessed pixels.
 * @param layout Frame atlas sidecar.
 * @param frame Pose whose blocks expand into occurrences.
 * @returns Derived 8×8 occurrences.
 */
export declare function deriveFramePlacements(layout: FrameLayout, frame: FrameRecord): ({
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
} & (({
    segment: string;
    tile: number;
    external?: undefined;
} | {
    segment?: undefined;
    tile?: undefined;
    external: ExternalTileRef;
}) & Pick<FramePlacement, "paletteGroup">))[];
/**
 * Check raw body evidence against editable blocks before interpreting any derived geometry.
 * @param frame Pose that may carry a native body record.
 * @returns Nothing; invalid records throw.
 */
export declare function validateNativeFrame(frame: FrameRecord): void;
/**
 * Validate optional v1 composition as one coherent model; legacy assembly-only layouts remain valid.
 * @param layout Frame atlas sidecar.
 * @param frame Pose to check.
 * @returns Derived placements when the pose retains composition.
 */
export declare function validateFrameComposition(layout: FrameLayout, frame: FrameRecord): ({
    id: string;
    block: string;
    quadrant: number;
    x: number;
    y: number;
    flipX: boolean | undefined;
    flipY: boolean | undefined;
} & (({
    segment: string;
    tile: number;
    external?: undefined;
} | {
    segment?: undefined;
    tile?: undefined;
    external: ExternalTileRef;
}) & Pick<FramePlacement, "paletteGroup">))[] | undefined;
//# sourceMappingURL=som-frame-composition.d.ts.map