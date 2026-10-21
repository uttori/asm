import type { SourceOccurrence } from "../source-provenance.js";
/** One literal run after binding; contributors survive concatenation and subsequent phases. */
export type SourceFragmentSegment = {
    readonly text: string;
    readonly origins: readonly SourceOccurrence[];
};
/** Immutable generated source. Offsets index the concatenation of its segments in UTF-16 units. */
export type SourceFragment = {
    readonly segments: readonly SourceFragmentSegment[];
};
/** A parsed replacement site; binding is deliberately separate from recognizing its grammar. */
export type FragmentReplacement = {
    readonly start: number;
    readonly end: number;
    readonly value: SourceFragment;
};
/** Wrap physical text or a bound value without granting it execution capabilities. */
export declare function sourceFragment(text: string, origins?: readonly SourceOccurrence[]): SourceFragment;
/** Materialize only at a declared source-generation/parser boundary. */
export declare function fragmentText(fragment: SourceFragment): string;
/** Preserve each contributing occurrence when a later phase selects part of generated text. */
export declare function sliceSourceFragment(fragment: SourceFragment, start: number, end: number): SourceFragment;
/** Bind non-overlapping sites in source order; earlier-phase output may be parsed by a later phase. */
export declare function bindSourceFragment(fragment: SourceFragment, replacements: readonly FragmentReplacement[]): SourceFragment;
//# sourceMappingURL=source-fragment.d.ts.map