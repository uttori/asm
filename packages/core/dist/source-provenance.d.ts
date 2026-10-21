import { type SourceRange, type SourceSpan } from "./source-location.js";
/** Physical source occurrence; lines and UTF-16 columns are zero-based. */
export type SourceOccurrence = {
    readonly file: string;
    readonly line: number;
    readonly span?: SourceSpan;
    /** When preprocessing trimmed a command, span offsets refer to this spelling. */
    readonly text?: string;
};
/** Relocate normalized offsets into a physical line only when the spelling has a unique match. */
export declare function sourceOccurrenceRange(location: SourceOccurrence, sourceLine?: string): SourceRange | undefined;
/** Argument spelling at the invocation, before binding defines or expanding the body. */
export type MacroArgumentOrigin = {
    readonly parameter?: string;
    readonly index: number;
    readonly text: string;
    readonly location: SourceOccurrence;
};
/** Persistent, acyclic expansion chain. Cached syntax never owns a live execution context. */
export type SourceOrigin = {
    readonly kind: "include";
    readonly location: SourceOccurrence;
    readonly file: string;
    readonly parent?: SourceOrigin;
} | {
    readonly kind: "macro";
    readonly name: string;
    readonly invocation: SourceOccurrence;
    readonly definition: SourceOccurrence;
    readonly template: SourceOccurrence;
    readonly arguments: readonly MacroArgumentOrigin[];
    /** Generated token runs identify all contributors after ordered substitution. */
    readonly fragment?: import("./ir/source-fragment.js").SourceFragment;
    /** Where the macro body was captured, independently of where it is invoked. */
    readonly definitionContext?: SourceOrigin;
    readonly parent?: SourceOrigin;
};
/** Shared tooling projection; consumers need no macro parser to explain an expanded location. */
export declare function sourceOriginLocations(origin?: SourceOrigin): {
    message: string;
    location: SourceOccurrence;
}[];
//# sourceMappingURL=source-provenance.d.ts.map