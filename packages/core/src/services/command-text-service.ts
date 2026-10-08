import { isOpenStructInitializer } from "./struct-initializer.js";

/** A preprocessed command tagged with its original 0-based source line. */
export type SourcedCommand = {
  /** Normalized command text. */
  text: string;
  /** Zero-based line number in the source block. */
  line: number;
};

export type PreprocessBlockCommandsResult = {
  commands: string[];
  sourcedCommands: SourcedCommand[];
  commandBuffer: string;
};

/** A quote is escaped only by an odd run of preceding backslashes.
 * @param {string} text Source line.
 * @param {number} index Quote index.
 * @returns {boolean} Whether the quote is escaped.
 */
const isEscapedAt = (text: string, index: number): boolean => {
  let slashes = 0;
  for (let at = index - 1; at >= 0 && text[at] === "\\"; at--) {
    slashes++;
  }
  return slashes % 2 === 1;
};

/** Only structured records and explicit asset calls acquire implicit physical-line continuation. */
export function isStructuredCommandStart(text: string): boolean {
  return /^(?:datastruct\b|\[|includeasset\s*\()/i.test(text.trimStart());
}

/** Keep a parenthesized include buffered until its outer call closes; quoted filenames never affect depth. */
export function isOpenStructuredCommand(text: string): boolean {
  if (!/^includeasset\s*\(/i.test(text.trimStart())) {
    return isOpenStructInitializer(text);
  }
  let depth = 0;
  let quote = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if ((char === '"' || char === "'") && !isEscapedAt(text, index)) {
      if (quote === char) {
        quote = "";
      } else if (!quote) {
        quote = char;
      }
    } else if (!quote && char === "(") {
      depth++;
    } else if (!quote && char === ")") {
      depth--;
    }
  }
  return depth > 0;
}

/**
 * Removes inline comments from a command line while preserving semicolons
 * inside double-quoted text.
 * @param {string} line The raw command line.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {string} The comment-stripped command line.
 */
export const removeInlineComment = (
  line: string,
  syntaxProfile: SyntaxProfile = ASAR_SYNTAX_PROFILE,
): string => {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && !isEscapedAt(line, i)) {
      if (quote === ch) {
        quote = "";
      } else if (quote === "") {
        quote = ch;
      }
    } else if (quote === "" && ch === ";") {
      const uncommented = line.substring(0, i);
      return syntaxProfile.preserveLeadingWhitespace ? uncommented.trimEnd() : uncommented.trim();
    }
  }
  return syntaxProfile.preserveLeadingWhitespace ? line.trimEnd() : line.trim();
};

/**
 * Normalizes a multi-line command block by trimming lines, removing comments,
 * and carrying line-continuation state across calls.
 * @param {string} block Raw block text.
 * @param {string} [commandBuffer] Existing continuation buffer.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {PreprocessBlockCommandsResult} Parsed commands and next buffer value.
 */
export const preprocessBlockCommands = (
  block: string,
  commandBuffer = "",
  syntaxProfile: SyntaxProfile = ASAR_SYNTAX_PROFILE,
): PreprocessBlockCommandsResult => {
  const lines = block.split("\n");
  const sourcedCommands: SourcedCommand[] = [];
  let nextCommandBuffer = commandBuffer;
  let bufferStartLine: number | undefined;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex];
    const structuredContinuation = isStructuredCommandStart(nextCommandBuffer);
    line = syntaxProfile.preserveLeadingWhitespace ? line.trimEnd() : line.trim();
    if (!line.trim()) {
      if (structuredContinuation) {
        nextCommandBuffer += "\n";
      }
      continue;
    }

    // Preserve the special test directive comment so downstream handling can
    // detect and execute fixture setup behavior.
    if (!structuredContinuation && line.trimStart().startsWith(";`+")) {
      sourcedCommands.push({ text: line, line: lineIndex });
      continue;
    }

    line = removeInlineComment(line, syntaxProfile);
    if (!line.trim()) {
      if (structuredContinuation) {
        nextCommandBuffer += "\n";
      }
      continue;
    }

    // Structured statements retain physical whitespace for field attribution and
    // semantic cursor targeting, including blank/comment-only continuation lines.
    const structured = structuredContinuation || isStructuredCommandStart(line);
    if (structured) {
      line = removeInlineComment(lines[lineIndex], {
        ...syntaxProfile,
        preserveLeadingWhitespace: true,
      });
    }

    // Explicit backslash continuation predates structured calls; consume its marker before testing the buffered grammar.
    if (line.endsWith("\\")) {
      if (nextCommandBuffer === "") {
        bufferStartLine = lineIndex;
      }
      nextCommandBuffer += line.slice(0, -1);
      if (structured) {
        nextCommandBuffer += "\n";
      }
    } else if (isOpenStructuredCommand(nextCommandBuffer + line)) {
      if (nextCommandBuffer === "") {
        bufferStartLine = lineIndex;
      }
      nextCommandBuffer += `${line}\n`;
    } else if (line.endsWith(",")) {
      if (nextCommandBuffer === "") {
        bufferStartLine = lineIndex;
      }
      nextCommandBuffer += line;
    } else {
      sourcedCommands.push({
        text: nextCommandBuffer + line,
        line: nextCommandBuffer === "" ? lineIndex : (bufferStartLine ?? lineIndex),
      });
      nextCommandBuffer = "";
      bufferStartLine = undefined;
    }
  }

  return {
    commands: sourcedCommands.map((command) => command.text),
    sourcedCommands,
    commandBuffer: nextCommandBuffer,
  };
};

/**
 * Splits a command on Asar's ` : ` statement separator, ignoring separators inside quotes.
 * `.split(/\s:\s/)` also splits inside `db "... : ..."` string operands (SMRPG
 * dialogue), turning the tail into a fake instruction such as `1.`.
 * @param {string} command A single command line.
 * @returns {string[]} Statement fragments.
 */
const splitOnInlineStatementSeparator = (command: string): string[] => {
  if (/^(?:datastruct\b|\[)/i.test(command.trimStart())) {
    return [command];
  }
  const parts: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if ((char === '"' || char === "'") && !isEscapedAt(command, i)) {
      if (quote === char) {
        quote = "";
      } else if (quote === "") {
        quote = char;
      }
      current += char;
      continue;
    }
    if (quote === "") {
      if (char === "(" || char === "[" || char === "{") {
        depth++;
      } else if (char === ")" || char === "]" || char === "}") {
        depth--;
      }
    }
    const next = command[i + 1];
    const afterIndex = i + 2;
    const after = afterIndex < command.length ? command[afterIndex] : undefined;
    if (quote === "" && depth === 0 && /\s/.test(char) && next === ":" && /\s/.test(after ?? "")) {
      const trimmed = current.trim();
      if (trimmed !== "") {
        parts.push(trimmed);
      }
      current = "";
      i += 2;
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed !== "") {
    parts.push(trimmed);
  }
  return parts;
};

/**
 * Splits inline `:` command chains into individual commands.
 * @param {string[]} commands Command lines to split.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {string[]} Flattened command list.
 */
export const splitInlineCommands = (
  commands: string[],
  syntaxProfile: SyntaxProfile = ASAR_SYNTAX_PROFILE,
): string[] => {
  const output: string[] = [];
  for (const command of commands) {
    const split = syntaxProfile.splitColonStatements
      ? splitOnInlineStatementSeparator(command)
      : [command];
    if (split.length === 0) {
      continue;
    }
    for (const entry of split) {
      const relativeLabelMatch = syntaxProfile.splitRelativeLabelStatements
        ? entry.match(/^([+-]+:)\s+(.+)$/)
        : null;
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
 * Splits sourced command lines, copying the original line onto every fragment.
 * @param {SourcedCommand[]} commands Sourced command lines to split.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {SourcedCommand[]} Flattened sourced command list.
 */
export const splitSourcedInlineCommands = (
  commands: SourcedCommand[],
  syntaxProfile: SyntaxProfile = ASAR_SYNTAX_PROFILE,
): SourcedCommand[] => {
  const output: SourcedCommand[] = [];
  for (const command of commands) {
    for (const text of splitInlineCommands([command.text], syntaxProfile)) {
      output.push({ text, line: command.line });
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
  // A call is one directive even when parentheses touch the keyword. Keep its
  // full payload for typed parsing, including spaces and nested object literals.
  const trimmed = command.trim();
  const label = /^([$.?A-Z_a-z][\w$.?]*:)\s+/.exec(trimmed);
  const labelPrefix = label?.[0] ?? "";
  const remainder = trimmed.slice(labelPrefix.length);
  if (/^includeasset\s*\(/i.test(remainder)) {
    return [...(label ? [label[1]] : []), "includeasset", remainder.slice("includeasset".length)];
  }
  const words: string[] = [];
  let currentWord = "";
  let inQuotes = false;
  let quoteChar = "";
  const trimmedCommand = command.trim();

  for (let i = 0; i < trimmedCommand.length; i++) {
    const char = trimmedCommand[i];
    if ((char === '"' || char === "'") && !isEscapedAt(trimmedCommand, i)) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      currentWord += char;
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
    if ((char === '"' || char === "'") && (i === 0 || input[i - 1] !== "\\")) {
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
 * @returns {string | undefined} The variable name or `undefined` if the line is not a define statement.
 */
export const getDefineVariable = (line: string): string | undefined => {
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
  return (
    char === "_" ||
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
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

  // CPU register names are operands, not labels. Collapsing `A` to `0` during
  // collectDefinitions made `ASL A` look like a 3-byte memory shift.
  if (/^(a|x|y|ya|sp|s|c|r\d{1,2})$/i.test(input)) {
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

import { ASAR_SYNTAX_PROFILE, type SyntaxProfile } from "../syntax-profile.js";
