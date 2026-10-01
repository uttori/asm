/**
 * Small, deliberately separate grammar for named records. Expressions remain
 * assembler expressions. This parser only recognizes their outer delimiters.
 * Do not use split(','): arrays and functions both contain their own commas.
 * @param {string} text Comma-separated fields or expressions.
 * @returns {string[]} Complete items with their nested expressions intact.
 */
export declare function splitInitializerList(text: string): string[];
/** Locate the record's physical opening brace, skipping index expressions and braced defines. */
export declare function structInitializerStart(text: string): number;
/**
 * Parse field names and scalar/array shapes without evaluating assembler expressions.
 * @param {string} text One brace-delimited record literal.
 * @returns {Map<string, string | string[]>} Unique names and unevaluated values.
 */
export declare function parseStructInitializer(text: string): Map<string, string | string[]>;
/** An unevaluated field with UTF-16 offsets into the original brace-delimited literal. */
export type StructInitializerEntry = {
    name: string;
    value: string | string[];
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
 * @param {string} text Buffered command including the current physical line.
 * @returns {boolean} Whether another physical line is needed to close the literal.
 */
export declare function isOpenStructInitializer(text: string): boolean;
//# sourceMappingURL=struct-initializer.d.ts.map