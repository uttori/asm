import { type AsepriteDocument } from "./aseprite-document.js";
import { type IndexedOwnership, type IndexedOwnerChange } from "./indexed-ownership.js";
import { type IndexedColor } from "./indexed-values.js";
/** Advertised support is the intersection of codec, adapter and host policy, never imported metadata. */
export interface InterchangeCapabilities {
    readonly pixelEdits: boolean;
    readonly paletteEdits: boolean;
    readonly tileReferences: boolean;
    readonly previewTimeline: boolean;
}
/** Intersect all participating contracts so a file cannot advertise an unavailable native edit. */
export declare function interchangeCapabilities(...profiles: readonly InterchangeCapabilities[]): InterchangeCapabilities;
/** Trusted tilemap presentation and logical authority. Imported IDs only resolve into these fixed inventories. */
export interface TilemapInterchangeBaseline {
    readonly kind: "tilemap";
    readonly document: AsepriteDocument;
    readonly ownership: IndexedOwnership;
    readonly editablePaletteSlots: readonly number[];
    readonly capabilities: InterchangeCapabilities;
    /** Native cell transform vocabulary, supplied by the game adapter. */
    readonly nativeTransforms: readonly ("flipX" | "flipY" | "diagonal")[];
}
/** Pure native deltas. Occurrences, timing and file storage never become source edit authority. */
export interface InterchangeChanges {
    readonly pixels: readonly IndexedOwnerChange[];
    readonly colors: readonly {
        readonly index: number;
        readonly color: IndexedColor;
    }[];
}
/** Attach stable identities when building presentations; names and numeric storage indexes remain arbitrary. */
export declare const interchangeIdentity: Readonly<{
    view: (id: string) => string;
    role: (id: string) => string;
    tileset: (id: string) => string;
    timeline: (id: string) => string;
}>;
/** Normalize structure and reconcile deltas against the exported private authority without any source writes. */
export declare function inspectTilemapInterchange(baseline: TilemapInterchangeBaseline, after: AsepriteDocument): InterchangeChanges;
//# sourceMappingURL=interchange.d.ts.map