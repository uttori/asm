import type { SourceOccurrence } from "../source-provenance.js";
/** One literal run after binding; contributors survive concatenation and subsequent phases. */
export type SourceFragmentSegment = {
    /** Literal UTF-16 text for this segment. */
    readonly text: string;
    /** Provenance contributors covering this literal segment. */
    readonly origins: readonly SourceOccurrence[];
};
/** Immutable generated source indexed in UTF-16 units across ordered segments. */
export type SourceFragment = {
    /** Ordered literal segments concatenated to form generated source text. */
    readonly segments: readonly SourceFragmentSegment[];
};
/** A parsed replacement site; binding is deliberately separate from recognizing its grammar. */
export type FragmentReplacement = {
    /** Inclusive UTF-16 start offset in the host command text. */
    readonly start: number;
    /** Exclusive UTF-16 end offset in the host command text. */
    readonly end: number;
    /** Bound fragment inserted at the replacement site. */
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