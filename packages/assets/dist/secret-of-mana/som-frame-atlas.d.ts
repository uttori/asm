import type { IndexedImage } from "../image.js";
import type { IndexedPixels } from "../indexed-edit.js";
import type { AssetInput } from "../registry.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameLayout, FrameLayoutScope } from "./som-types.js";
/**
 * Validate one assembly segment, or all segments and editor metadata in whole-atlas mode.
 * @param layout Frame atlas sidecar.
 * @param [segmentName] Segment validated for assembly.
 * @param [whole] Validate every segment and frame record.
 * @returns The same layout after validation.
 */
export declare function validateFrameLayout(layout: FrameLayout, { segmentName, whole }?: FrameLayoutScope): FrameLayout;
/** Verified atlas image, layout binding and per-pose tile groups. */
export interface InspectedFrameAtlas {
    /** Decoded indexed PNG pixels for the atlas sheet. */
    image: IndexedImage;
    /** Frame layout metadata bound to catalogue palette words. */
    layout: FrameLayout;
    /** Pose-grouped 8×8 index tiles extracted from the sheet. */
    tiles: Map<string, IndexedPixels[]>;
}
/** Record an already verified PNG slot binding before making independent catalog color edits. */
export declare function bindFrameAtlasPalette(source: AssetInput, layout: FrameLayout, catalog: SpritePaletteCatalog): FrameLayout;
/**
 * Parse and validate the authored pixels once, keeping SoM palette/group policy in this adapter.
 * @param source Indexed PNG.
 * @param layout Frame atlas sidecar.
 * @param catalog Shared palette catalogue.
 * @param [options] Segment or whole-atlas scope.
 * @returns Validated image, layout, and extracted tiles.
 */
export declare function inspectFrameAtlas(source: AssetInput, layout: FrameLayout, catalog: SpritePaletteCatalog, options?: FrameLayoutScope): InspectedFrameAtlas;
/**
 * Encode the already inspected native indexes with the game's 4bpp storage codec.
 * @param inspected Validated atlas.
 * @param segmentName Segment to encode.
 * @returns Native 4bpp tile bytes.
 */
export declare function encodeInspectedFrameSegment(inspected: InspectedFrameAtlas, segmentName: string): Uint8Array<ArrayBufferLike>;
/**
 * Read mutually exclusive assembly selectors; omission selects the whole contiguous atlas.
 * @param options Resolved assembly options.
 * @returns Named segment, selected run, or whole-atlas selection.
 * Invalid types and simultaneous selectors throw before encoding or previewing.
 */
export declare function readFrameAtlasSelection(options: Readonly<Record<string, unknown>>): string | string[] | undefined;
/**
 * Resolve a nonempty selection in ROM order, rejecting gaps, overlaps and duplicate ownership.
 * Each native 4bpp tile occupies 32 bytes; the selected spans must form one continuous run.
 * @param layout Sidecar retaining physical segment identities.
 * @param [selection] Segment names; omission selects the entire atlas.
 * @returns Names in ascending ROM address order; malformed spans throw.
 */
export declare function frameAtlasSegmentOrder(layout: FrameLayout, selection?: readonly string[]): string[];
/**
 * Encode one continuous run from a whole-atlas inspection, preserving each segment's palette indexes.
 * @param inspected Whole-atlas inspection containing every selected segment.
 * @param [selection] Physical segment names; omission selects the entire atlas.
 * @returns Owned native tile bytes in ROM order; invalid ownership throws.
 */
export declare function encodeInspectedFrameSegments(inspected: InspectedFrameAtlas, selection?: readonly string[]): Uint8Array<ArrayBuffer>;
/**
 * Assembly entry point for a named segment or a continuous run of segments.
 * @param source Indexed PNG.
 * @param layout Frame atlas sidecar.
 * @param segmentName One segment, a contiguous selection,
 * or undefined for the entire atlas. Multiple spans are emitted in ROM address order.
 * @param catalog Shared palette catalogue.
 * @returns Native 4bpp tile bytes; gapped or overlapping selections throw.
 */
export declare function encodeFrameAtlas(source: AssetInput, layout: FrameLayout, segmentName: string | readonly string[] | undefined, catalog: SpritePaletteCatalog): Uint8Array<ArrayBufferLike>;
/**
 * Refresh every recorded occurrence and bottom strip from current authoritative pixels.
 * Composition is additive metadata from reviewed evidence; it cannot be inferred from RGB.
 * Returns owned indexes, retaining guides outside painted pixels and all source-only tiles.
 * @param inspected Whole-atlas inspection.
 * @returns Rebuilt atlas indexes.
 */
export declare function refreshFrameAtlas(inspected: InspectedFrameAtlas): IndexedPixels;
/**
 * Parse the declared layout resource. Validation occurs at the consumer's selected scope.
 * @param options Include options naming `layout`.
 * @param resources Declared sidecar files.
 * @returns Parsed layout sidecar.
 */
export declare function readFrameLayout(options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): FrameLayout;
//# sourceMappingURL=som-frame-atlas.d.ts.map