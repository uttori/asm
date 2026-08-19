/**
 * A half-open source range.
 */
export type SourceSpan = {
    /** Start offset, inclusive. */
    start: number;
    /** End offset, exclusive. */
    end: number;
    /** Optional 0-based line number. */
    line?: number;
    /** Optional 0-based start column. */
    columnStart?: number;
    /** Optional 0-based end column. */
    columnEnd?: number;
};
export type SourcePosition = {
    line: number;
    character: number;
};
export type SourceRange = {
    start: SourcePosition;
    end: SourcePosition;
};
/**
 * Creates a source span.
 * @param {number} start The inclusive starting offset.
 * @param {number} end The exclusive ending offset.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan} The source span.
 */
export declare function createSourceSpan(start: number, end: number, line?: number): SourceSpan;
/**
 * Returns a span covering an entire single-line string.
 * @param {string} text The source text.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan} The full-line span.
 */
export declare function createLineSpan(text: string, line?: number): SourceSpan;
/**
 * Shifts a span by a column offset.
 * @param {SourceSpan} span The span to shift.
 * @param {number} offset The offset delta.
 * @param {number} [line] Optional line override.
 * @returns {SourceSpan} The shifted span.
 */
export declare function shiftSourceSpan(span: SourceSpan, offset: number, line?: number | undefined): SourceSpan;
/**
 * Derives token spans by scanning a normalized line from left to right.
 * @param {string} text The source text to scan.
 * @param {string[]} tokens The already-tokenized command words.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan[]} The token spans in token order.
 */
export declare function deriveTokenSpans(text: string, tokens: readonly string[], line?: number): SourceSpan[];
/**
 * Converts a span into an explicit line/character range for editor tooling.
 * The current assembler spans are line-local and use zero-based columns.
 * @param {SourceSpan} span The span to convert.
 * @param {number} [fallbackLine] Optional line when the span omits one.
 * @returns {SourceRange} The normalized source range.
 */
export declare function sourceSpanToRange(span: SourceSpan, fallbackLine?: number): SourceRange;
//# sourceMappingURL=source-location.d.ts.map