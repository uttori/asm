/**
 * Small, deliberately separate grammar for named records. Expressions remain
 * assembler expressions. This parser only recognizes their outer delimiters.
 * Do not use split(','): arrays and functions both contain their own commas.
 * @param {string} text Comma-separated fields or expressions.
 * @returns {string[]} Complete items with their nested expressions intact.
 */
export declare function splitInitializerList(text: string): string[];
/**
 * Parse field names and scalar/array shapes without evaluating assembler expressions.
 * @param {string} text One brace-delimited record literal.
 * @returns {Map<string, string | string[]>} Unique names and unevaluated values.
 */
export declare function parseStructInitializer(text: string): Map<string, string | string[]>;
/**
 * Only named record statements gain implicit brace continuation, not legacy source.
 * @param {string} text Buffered command including the current physical line.
 * @returns {boolean} Whether another physical line is needed to close the literal.
 */
export declare function isOpenStructInitializer(text: string): boolean;
//# sourceMappingURL=struct-initializer.d.ts.map