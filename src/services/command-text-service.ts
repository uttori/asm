export type PreprocessBlockCommandsResult = {
  commands: string[];
  commandBuffer: string;
};

/**
 * Removes inline comments from a command line while preserving semicolons
 * inside double-quoted text.
 * @param {string} line The raw command line.
 * @returns {string} The comment-stripped command line.
 */
export const removeInlineComment = (line: string): string => {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      inQuote = !inQuote;
    } else if (!inQuote && ch === ";") {
      return line.substring(0, i).trim();
    }
  }
  return line.trim();
};

/**
 * Normalizes a multi-line command block by trimming lines, removing comments,
 * and carrying line-continuation state across calls.
 * @param {string} block Raw block text.
 * @param {string} [commandBuffer] Existing continuation buffer.
 * @returns {PreprocessBlockCommandsResult} Parsed commands and next buffer value.
 */
export const preprocessBlockCommands = (block: string, commandBuffer = ""): PreprocessBlockCommandsResult => {
  const lines = block.split("\n");
  const processedLines: string[] = [];
  let nextCommandBuffer = commandBuffer;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Preserve the special test directive comment so downstream handling can
    // detect and execute fixture setup behavior.
    if (line.startsWith(";`+")) {
      processedLines.push(line);
      continue;
    }

    line = removeInlineComment(line).trim();
    if (!line) continue;

    if (line.endsWith("\\")) {
      nextCommandBuffer += line.slice(0, -1);
    } else if (line.endsWith(",")) {
      nextCommandBuffer += line;
    } else {
      processedLines.push(nextCommandBuffer + line);
      nextCommandBuffer = "";
    }
  }

  return {
    commands: processedLines,
    commandBuffer: nextCommandBuffer,
  };
};

/**
 * Splits inline `:` command chains into individual commands.
 * @param {string[]} commands Command lines to split.
 * @returns {string[]} Flattened command list.
 */
export const splitInlineCommands = (commands: string[]): string[] => {
  const output: string[] = [];
  for (const command of commands) {
    const split = command.split(/\s:\s/).map((entry) => entry.trim()).filter(Boolean);
    if (split.length === 0) {
      continue;
    }
    for (const entry of split) {
      const relativeLabelMatch = entry.match(/^([+-]+:)\s+(.+)$/);
      if (relativeLabelMatch) {
        output.push(relativeLabelMatch[1].trim(), relativeLabelMatch[2].trim());
        continue;
      }
      output.push(entry);
    }
  }
  return output;
};

/**
 * Splits a command string into words while preserving quoted segments.
 * @param {string} command The normalized command string.
 * @returns {string[]} Tokenized command words.
 */
export const splitCommandIntoWords = (command: string): string[] => {
  const words: string[] = [];
  let currentWord = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < command.trim().length; i++) {
    const char = command.trim()[i];
    if ((char === "\"" || char === "'") && (i === 0 || command.trim()[i - 1] !== "\\")) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
        currentWord += char;
      } else if (char === quoteChar) {
        inQuotes = false;
        currentWord += char;
      } else {
        currentWord += char;
      }
    } else if (/\s/.test(char) && !inQuotes) {
      if (currentWord) {
        words.push(currentWord);
        currentWord = "";
      }
    } else {
      currentWord += char;
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  return words;
};

/**
 * Splits comma-separated values while respecting quoted text and parenthesized
 * function arguments.
 * @param {string} input Comma-delimited expression text.
 * @returns {string[]} Split values.
 */
export const splitRespectingFunctions = (input: string): string[] => {
  const result: string[] = [];
  let current = "";
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === "\"" || char === "'") && (i === 0 || input[i - 1] !== "\\")) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
    }
    if (!inQuotes) {
      if (char === "(") {
        parenDepth++;
      } else if (char === ")") {
        parenDepth--;
      } else if (char === "," && parenDepth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (current) {
    result.push(current.trim());
  }

  return result;
};

/**
 * Extracts the variable name from a define statement.
 * @param {string} line The line to extract the variable name from.
 * @returns {string | undefined} The variable name or null if the line is not a define statement.
 */
export const getDefineVariable = (line: string): string | null => {
  const match = line.trim().match(/^!([A-Z_a-z]\w*)\s*=/);
  return match ? match[1] : undefined;
};


/**
 * Checks whether a character can start a label identifier segment.
 * @param {string} char The single character to test.
 * @returns {boolean} `true` when the character can start an identifier.
 */
export function isLabelIdentifierStart(char: string): boolean {
  const code = char.charCodeAt(0);
  return char === "_" || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Checks whether a character can appear after the first character of a label identifier segment.
 * @param {string} char The single character to test.
 * @returns {boolean} `true` when the character can continue an identifier.
 */
export function isLabelIdentifierPart(char: string): boolean {
  const code = char.charCodeAt(0);
  return char === "_" || (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Checks whether a token is a plain label/struct reference rather than an
 * arithmetic expression. This intentionally accepts dotted names and one
 * optional numeric index segment, but rejects operators such as `-` or `+`.
 * Purely numeric tokens are also treated as lookup candidates to preserve
 * legacy label-resolution behavior for values like `1`.
 * @param {string} input The token to classify.
 * @returns {boolean} `true` when the token is a bare label-style reference.
 */
export function isBareLabelReference(input: string): boolean {
  if (!input) {
    return false;
  }

  let numericOnly = true;
  for (const char of input) {
    if (char < "0" || char > "9") {
      numericOnly = false;
      break;
    }
  }
  if (numericOnly) {
    return true;
  }

  let index = 0;
  while (input[index] === ".") {
    index += 1;
  }

  if (index >= input.length || !isLabelIdentifierStart(input[index])) {
    return false;
  }

  const consumeIdentifier = (): boolean => {
    if (index >= input.length || !isLabelIdentifierStart(input[index])) {
      return false;
    }
    index += 1;
    while (index < input.length && isLabelIdentifierPart(input[index])) {
      index += 1;
    }
    return true;
  };

  if (!consumeIdentifier()) {
    return false;
  }

  while (index < input.length && input[index] === ".") {
    index += 1;
    if (!consumeIdentifier()) {
      return false;
    }
  }

  if (index < input.length && input[index] === "[") {
    index += 1;
    const digitStart = index;
    while (index < input.length && input[index] >= "0" && input[index] <= "9") {
      index += 1;
    }
    if (digitStart === index || input[index] !== "]") {
      return false;
    }
    index += 1;

    while (index < input.length && input[index] === ".") {
      index += 1;
      if (!consumeIdentifier()) {
        return false;
      }
    }
  }

  return index === input.length;
}

/**
 * Self-contained command text helpers exposed as a static-style module object.
 */
export const CommandTextService = {
  getDefineVariable,
  isBareLabelReference,
  isLabelIdentifierPart,
  isLabelIdentifierStart,
  preprocessBlockCommands,
  removeInlineComment,
  splitCommandIntoWords,
  splitInlineCommands,
  splitRespectingFunctions,
} as const;
