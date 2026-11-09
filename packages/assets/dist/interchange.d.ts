import { type AsepriteDocument } from "./aseprite-document.js";
import { type IndexedOwnership, type IndexedOwnerChange } from "./indexed-ownership.js";
import { type IndexedColor } from "./indexed-values.js";
/** Advertised support is the intersection of codec, adapter and host policy, never imported metadata. */
export interface InterchangeCapabilities {
    /** Whether native pixel buffers may change under policy. */
    readonly pixelEdits: boolean;
    /** Whether editable palette slots may change color in place. */
    readonly paletteEdits: boolean;
    /** Whether tilemap references are part of the interchange surface. */
    readonly tileReferences: boolean;
    /** Whether timeline preview metadata is available to the host. */
    readonly previewTimeline: boolean;
}
/** Intersect all participating contracts so a file cannot advertise an unavailable native edit. */
export declare function interchangeCapabilities(...profiles: readonly InterchangeCapabilities[]): InterchangeCapabilities;
/** Trusted tilemap presentation and logical authority. Imported IDs only resolve into these fixed inventories. */
export interface TilemapInterchangeBaseline {
    /** Baseline discriminator for tilemap interchange. */
    readonly kind: "tilemap";
    /** Decoded editor document trusted by the host baseline. */
    readonly document: AsepriteDocument;
    /** Fixed native owner and view inventories for reconciliation. */
    readonly ownership: IndexedOwnership;
    /** Palette slots whose colors edits may apply. */
    readonly editablePaletteSlots: readonly number[];
    /** Intersected capability profile for this baseline. */
    readonly capabilities: InterchangeCapabilities;
    /** Native cell transform vocabulary, supplied by the game adapter. */
    readonly nativeTransforms: readonly ("flipX" | "flipY" | "diagonal")[];
}
/** Pure native deltas. Occurrences, timing and file storage never become source edit authority. */
export interface InterchangeChanges {
    /** Reconciled native owner index replacements. */
    readonly pixels: readonly IndexedOwnerChange[];
    /** Same-slot palette color deltas within editable slots. */
    readonly colors: readonly {
        readonly index: number;
        readonly color: IndexedColor;
    }[];
}
/** Attach stable identities when building presentations; names and numeric storage indexes remain arbitrary. */
export declare const interchangeIdentity: Readonly<{
    view: (identity: string) => string;
    role: (identity: string) => string;
    tileset: (identity: string) => string;
    timeline: (identity: string) => string;
}>;
/** Normalize structure and reconcile deltas against the exported private authority without any source writes. */
export declare function inspectTilemapInterchange(baseline: TilemapInterchangeBaseline, after: AsepriteDocument): InterchangeChanges;
//# sourceMappingURL=interchange.d.ts.map