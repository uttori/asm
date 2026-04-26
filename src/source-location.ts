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

/**
 * Converts a span into an explicit line/character range for editor tooling.
 * The current assembler spans are line-local and use zero-based columns.
 * @param {SourceSpan} span The span to convert.
 * @param {number} [fallbackLine] Optional line when the span omits one.
 * @returns {SourceRange} The normalized source range.
 */
export function sourceSpanToRange(span: SourceSpan, fallbackLine = span.line ?? 0): SourceRange {
  const line = span.line ?? fallbackLine;
  const startCharacter = span.columnStart ?? span.start;
  const endCharacter = span.columnEnd ?? span.end;
  return {
    start: {
      line,
      character: startCharacter,
    },
    end: {
      line,
      character: endCharacter,
    },
  };
}
