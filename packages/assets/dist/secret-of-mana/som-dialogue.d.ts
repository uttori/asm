import type { AssetInput, AssetOutput } from "../registry.js";
import { type SomDialogueCommandSlot } from "./som-dialogue-command.js";
/** The USA decoder indexes 61 little-endian pairs, including the overlapping short/long codes. */
export declare const SOM_DIALOGUE_PAIR_COUNT = 61;
/** Two native font codes per entry; neither byte is an event command or another DTE token. */
export type SomDialogueDictionary = readonly (readonly [number, number])[];
/** Validate a complete dictionary before decoding; unresolved font codes remain escaped. */
export declare function readSomDialogueDictionary(bytes: Uint8Array): SomDialogueDictionary;
/** Expand text only. Controls below 60 and the decoder's underflowing 5F case are rejected. */
export declare function expandSomDialogue(bytes: Uint8Array, dictionary: SomDialogueDictionary): Uint8Array;
/** Decode a bounded literal/DTE span without merging event commands into the visible text. */
export declare function decodeSomDialogue(bytes: Uint8Array, dictionary: SomDialogueDictionary): string;
/** Geometry belongs to one text invocation; dynamic substitutions can change its initial column. */
export interface SomDialogueLineGeometry {
    /** Native capacity in glyph columns, from 1 to 32; these captures use 28 and 32. */
    readonly lineColumns?: number;
    /** Already printed columns before this span, defaulting to zero when capacity is supplied. */
    readonly initialColumn?: number;
}
/** Original aliases survive unchanged text. An exact byte budget preserves all following ROM identities. */
export interface SomDialogueEncodeOptions extends SomDialogueLineGeometry {
    /** Unchanged text returns a copy of these bytes, retaining noncanonical DTE aliases. */
    readonly original?: Uint8Array;
    /** Exact native span size; omitted selects the shortest deterministic encoding. */
    readonly byteLength?: number;
}
/**
 * Encode with a deterministic mix of literal and dual-tile bytes. An exact budget can deliberately
 * leave pairs literal; shortest-first greedy packing cannot solve every fixed-address edit.
 * Throws when no encoding fits, rather than padding text or moving pointers implicitly.
 */
export declare function encodeSomDialogue(text: string, dictionary: SomDialogueDictionary, options?: SomDialogueEncodeOptions): Uint8Array;
/** One consumed native text line; explicit LF and capacity exhaustion both advance the line. */
export interface SomDialoguePreviewLine {
    readonly text: string;
    /** Native font codes, including unresolved symbols without inventing Unicode mappings. */
    readonly glyphs: readonly number[];
    readonly initialColumn: number;
    readonly ending: "line-break" | "capacity" | "end";
}
/** Preview native hard wrapping and report compressed pairs whose second glyph is discarded. */
export declare function previewSomDialogue(bytes: Uint8Array, dictionary: SomDialogueDictionary, options: SomDialogueLineGeometry & {
    readonly lineColumns: number;
}): {
    lines: SomDialoguePreviewLine[];
    dropped: {
        byteOffset: number;
        glyph: number;
    }[];
    pixelWidth: number;
    glyphHeight: number;
};
/** Alternating raw/command slots and editable text retain original field offsets and byte counts. */
export interface SomDialogueScriptLayout {
    readonly format: "som-dialogue-script";
    readonly version: 1;
    /** ROM dictionary bytes pin the language/version used to pack this script. */
    readonly dictionaryHex: string;
    /** Raw commands and text spans alternate; native bytes define immutable field sizes. */
    readonly segments: readonly ({
        readonly kind: "raw" | "text";
        readonly nativeHex: string;
        /** Only independently reviewed raw boundaries admit named, optionally editable commands. */
        readonly commands?: readonly SomDialogueCommandSlot[];
    } & SomDialogueLineGeometry)[];
}
/** Validate the versioned sidecar and every text span, including unused source chunks. */
export declare function readSomDialogueScriptLayout(value: unknown): SomDialogueScriptLayout;
/** Export printable text with reviewed command tokens and opaque markers; only a final marker's LF is cosmetic. */
export declare function exportSomDialogueScript(layout: SomDialogueScriptLayout): string;
/** Byte offsets connect original owners to explicitly planned relocation references. */
export interface SomDialoguePackedSegment {
    readonly kind: "raw" | "text";
    readonly originalOffset: number;
    readonly originalLength: number;
    readonly offset: number;
    readonly length: number;
    /** Exact unchanged bytes permit interior references to retain their displacement. */
    readonly preserved: boolean;
}
/**
 * Pack a script without selecting ROM storage. Variable text sizes are opt-in for a separate
 * relocation planner; the asset converter always keeps fixed budgets. Commands retain their
 * admitted family, width and order. The returned map does not imply that an edited text's
 * interior references can be relocated safely.
 */
export declare function packSomDialogueScript(source: Uint8Array, layout: SomDialogueScriptLayout, sizing?: "fixed" | "variable"): {
    bytes: Uint8Array<ArrayBuffer>;
    segments: SomDialoguePackedSegment[];
    nativePreserved: boolean;
    fixedFieldOffsets: boolean;
};
/** Build a fixed-address include; variable sizing is available only through explicit relocation planning. */
export declare function convertSomDialogueScript(source: AssetInput, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): {
    primaryOutput: string;
    outputs: {
        script: AssetOutput;
    };
};
//# sourceMappingURL=som-dialogue.d.ts.map