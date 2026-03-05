import type { TokenizedCommand, TokenizedWord } from "./ir.js";

const splitWordsWithSpans = (input: string): TokenizedWord[] => {
  const words: TokenizedWord[] = [];
  let inQuote = false;
  let start = -1;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const isWhitespace = /\s/.test(char);

    if (char === "\"") {
      inQuote = !inQuote;
      if (start === -1) {
        start = i;
      }
      continue;
    }

    if (!inQuote && isWhitespace) {
      if (start !== -1) {
        words.push({
          value: input.slice(start, i),
          span: {
            line: 0,
            column: start,
            endColumn: i - 1
          }
        });
        start = -1;
      }
      continue;
    }

    if (start === -1) {
      start = i;
    }
  }

  if (start !== -1) {
    words.push({
      value: input.slice(start),
      span: {
        line: 0,
        column: start,
        endColumn: input.length - 1
      }
    });
  }

  return words;
};

const removeInlineComment = (line: string): string => {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && char === ";") {
      return line.slice(0, i).trim();
    }
  }
  return line.trim();
};

const splitCommandChain = (line: string): string[] => line.split(/\s:\s/);

/**
 * Tokenize source into preprocessed commands while preserving line origin.
 * Mirrors legacy assembleblock preprocessing:
 * - quote-aware inline comment removal
 * - continuation by trailing "\" and trailing ","
 * - command chaining by " : "
 * - line comments by ";"
 * - whitespace-aware word splitting
 * @param {string} source - The source code to tokenize.
 * @returns {TokenizedCommand[]} An array of tokenized commands.
 */
export const tokenizeSource = (source: string): TokenizedCommand[] => {
  const lines = source.split("\n");
  const tokenizedCommands: TokenizedCommand[] = [];
  let commandBuffer = "";
  let commandBufferStartLine = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex].trim();
    if (!line) {
      continue;
    }

    // Keep this legacy directive comment intact.
    if (!line.startsWith(";`+")) {
      line = removeInlineComment(line);
      if (!line) {
        continue;
      }
    }

    if (!commandBuffer) {
      commandBufferStartLine = lineIndex;
    }

    if (line.endsWith("\\")) {
      commandBuffer += line.slice(0, -1);
      continue;
    }

    if (line.endsWith(",")) {
      commandBuffer += line;
      continue;
    }

    const combined = `${commandBuffer}${line}`;
    commandBuffer = "";
    const splitCommands = splitCommandChain(combined);

    for (const commandPart of splitCommands) {
      const raw = commandPart.trim();
      if (!raw) {
        continue;
      }
      const words = splitWordsWithSpans(raw).map((word) => ({
        ...word,
        span: {
          ...word.span,
          line: commandBufferStartLine
        }
      }));
      tokenizedCommands.push({
        raw,
        sourceLine: commandBufferStartLine,
        words
      });
    }
  }

  return tokenizedCommands;
};
