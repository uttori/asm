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
/** Zero-based line and UTF-16 character position in a source file. */
export type SourcePosition = {
    /** Zero-based line index. */
    line: number;
    /** Zero-based UTF-16 character offset on the line. */
    character: number;
};
/** Inclusive start and exclusive end positions for editor ranges. */
export type SourceRange = {
    /** Inclusive range start in line/character space. */
    start: SourcePosition;
    /** Exclusive range end in line/character space. */
    end: SourcePosition;
};
/**
 * Creates a source span.
 * @param start The inclusive starting offset.
 * @param end The exclusive ending offset.
 * @param [line] Optional 0-based line number.
 * @returns The source span.
 */
export declare function createSourceSpan(start: number, end: number, line?: number): SourceSpan;
/**
 * Returns a span covering an entire single-line string.
 * @param text The source text.
 * @param [line] Optional 0-based line number.
 * @returns The full-line span.
 */
export declare function createLineSpan(text: string, line?: number): SourceSpan;
/** Map a token's UTF-16 offsets in a continued command to its physical source line and columns. */
export declare function createTextSpan(text: string, start: number, end: number, line: number, lineStarts?: number[]): SourceSpan;
/** Index physical lines once for large record literals; per-token prefix scans are quadratic. */
export declare function sourceLineStarts(text: string): number[];
/**
 * Shifts a span by a column offset.
 * @param span The span to shift.
 * @param offset The offset delta.
 * @param [line] Optional line override.
 * @returns The shifted span.
 */
export declare function shiftSourceSpan(span: SourceSpan, offset: number, line?: number | undefined): SourceSpan;
/**
 * Derives token spans by scanning a normalized line from left to right.
 * @param text The source text to scan.
 * @param tokens The already-tokenized command words.
 * @param [line] Optional 0-based line number.
 * @returns The token spans in token order.
 */
export declare function deriveTokenSpans(text: string, tokens: readonly string[], line?: number): SourceSpan[];
/**
 * Converts a span into an explicit line/character range for editor tooling.
 * The current assembler spans are line-local and use zero-based columns.
 * @param span The span to convert.
 * @param [fallbackLine] Optional line when the span omits one.
 * @returns The normalized source range.
 */
export declare function sourceSpanToRange(span: SourceSpan, fallbackLine?: number): SourceRange;
//# sourceMappingURL=source-location.d.ts.map