import type { AddressToLineMapping } from "./addressToLine.js";
/** Fixed-size scalar replacement at a headerless output offset, with exact optimistic before bytes. */
export interface TypedSourcePatch {
    readonly offset: number;
    readonly before: Uint8Array;
    readonly after: Uint8Array;
}
/** Owned source replacement; the host checks before bytes again before applying it. */
export interface TypedSourceEdit {
    readonly file: string;
    readonly before: Uint8Array;
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