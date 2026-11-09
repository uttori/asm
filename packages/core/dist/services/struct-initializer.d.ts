import { type ExpressionNode } from "../ir/expression-node.js";
/**
 * Small, deliberately separate grammar for named records. Expressions remain
 * assembler expressions. This parser only recognizes their outer delimiters.
 * Do not use split(','): arrays and functions both contain their own commas.
 * @param text Comma-separated fields or expressions.
 * @returns Complete items with their nested expressions intact.
 */
export declare function splitInitializerList(text: string): string[];
/** Locate the record's physical opening brace, skipping index expressions and braced defines. */
export declare function structInitializerStart(text: string): number;
/**
 * Parse field names and scalar/array shapes without evaluating assembler expressions.
 * @param text One brace-delimited record literal.
 * @returns Unique names and unevaluated values.
 */
export declare function parseStructInitializer(text: string): Map<string, StructInitializerValue | StructInitializerValue[]>;
/** One scalar expression; spelling is retained only for diagnostics and field attribution. */
export type StructInitializerValue = {
    /** Original field value spelling for diagnostics. */
    text: string;
    /** Parsed initializer expression evaluated during struct emission. */
    expression: ExpressionNode;
};
/** An unevaluated field with UTF-16 offsets into the original brace-delimited literal. */
export type StructInitializerEntry = {
    /** Field path name including dotted struct members. */
    name: string;
    /** Scalar or array initializer values for the field. */
    value: StructInitializerValue | StructInitializerValue[];
    /** Start of the field identifier, including dotted field paths. */
    start: number;
    /** Scalar/array element offsets, in the same order as their expressions. */
    expressions: {
        text: string;
        start: number;
    }[];
};
/** Parse the same record grammar as emission while retaining exact editor locations. */
export declare function parseStructInitializerEntries(text: string): StructInitializerEntry[];
/**
 * Only named record statements gain implicit brace continuation, not legacy source.
 * @param text Buffered command including the current physical line.
 * @returns Whether another physical line is needed to close the literal.
 */
export declare function isOpenStructInitializer(text: string): boolean;
//# sourceMappingURL=struct-initializer.d.ts.map