import type { AddressToLineMapping } from "./addressToLine.js";
/** Fixed-size scalar replacement at a headerless output offset, with exact optimistic before bytes. */
export interface TypedSourcePatch {
    /** Byte offset in the output image targeted by the patch. */
    readonly offset: number;
    /** Bytes currently encoded at the patch offset before applying the edit. */
    readonly before: Uint8Array;
    /** Replacement bytes expected after the optimistic patch succeeds. */
    readonly after: Uint8Array;
}
/** Owned source replacement; the host checks before bytes again before applying it. */
export interface TypedSourceEdit {
    /** Source file path receiving the whole-file replacement. */
    readonly file: string;
    /** Full file contents before the structured edit is applied. */
    readonly before: Uint8Array;
    /** Full file contents after the structured edit is applied. */
    readonly after: Uint8Array;
}
/**
 * Plan literal typed-field edits using a fresh assembly snapshot. Expressions and repeated
 * macro/table emission reject rather than losing meaning or changing multiple physical owners.
 * Supports unsigned scalar widths 1..4 bytes; preserves comments, whitespace and unknown fields.
 */
export declare function planTypedSourceEdits(options: {
    readonly mapping: AddressToLineMapping;
    readonly snapshots: ReadonlyMap<string, Uint8Array>;
    readonly output: Uint8Array;
    readonly patches: readonly TypedSourcePatch[];
}): TypedSourceEdit[];
//# sourceMappingURL=source-field-edits.d.ts.map