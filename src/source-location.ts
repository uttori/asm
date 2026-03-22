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

/**
 * Creates a source span.
 * @param {number} start The inclusive starting offset.
 * @param {number} end The exclusive ending offset.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan} The source span.
 */
export function createSourceSpan(start: number, end: number, line?: number): SourceSpan {
  return {
    start,
    end,
    line,
    columnStart: start,
    columnEnd: end,
  };
}

/**
 * Returns a span covering an entire single-line string.
 * @param {string} text The source text.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan} The full-line span.
 */
export function createLineSpan(text: string, line?: number): SourceSpan {
  return createSourceSpan(0, text.length, line);
}

/**
 * Shifts a span by a column offset.
 * @param {SourceSpan} span The span to shift.
 * @param {number} offset The offset delta.
 * @param {number} [line] Optional line override.
 * @returns {SourceSpan} The shifted span.
 */
export function shiftSourceSpan(span: SourceSpan, offset: number, line = span.line): SourceSpan {
  return {
    start: span.start + offset,
    end: span.end + offset,
    line,
    columnStart: span.columnStart === undefined ? undefined : span.columnStart + offset,
    columnEnd: span.columnEnd === undefined ? undefined : span.columnEnd + offset,
  };
}

/**
 * Derives token spans by scanning a normalized line from left to right.
 * @param {string} text The source text to scan.
 * @param {string[]} tokens The already-tokenized command words.
 * @param {number} [line] Optional 0-based line number.
 * @returns {SourceSpan[]} The token spans in token order.
 */
export function deriveTokenSpans(text: string, tokens: string[], line?: number): SourceSpan[] {
  if (tokens.length === 0) {
    return [];
  }

  const spans: SourceSpan[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (!token) {
      spans.push(createSourceSpan(cursor, cursor, line));
      continue;
    }

    const tokenStart = text.indexOf(token, cursor);
    if (tokenStart === -1) {
      spans.push(createSourceSpan(cursor, cursor + token.length, line));
      cursor += token.length;
      continue;
    }

    const tokenEnd = tokenStart + token.length;
    spans.push(createSourceSpan(tokenStart, tokenEnd, line));
    cursor = tokenEnd;
  }

  return spans;
}
