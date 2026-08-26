import { parseExpressionNode, type ExpressionNode } from "../ir/expression-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDefineEngine, IncludeDirectiveContext } from "./types.js";

const IDENTITY_INCLUDE_DEFINES: IncludeDefineEngine = {
  resolveDefinesInStringLiteral: (content) => content,
  resolveRegularDefines: (content) => content,
};

/** Hex (`$808000`) or decimal `incbin ->` seek targets. Labels take the other path. */
const NUMERIC_INCBIN_TARGET = /^\$[\da-f]+$|^-?\d+$/i;

type RangeEvaluator = (expression: string | ExpressionNode) => number;

/**
 * Expands `!defines` in an include/incbin path. Quoted paths use string-literal
 * rules (`\!` stays literal); unquoted paths use regular define replacement.
 * @param {string} target Raw filename token, possibly quoted.
 * @param {IncludeDefineEngine} defineEngine Define expander.
 * @returns {string} The path with defines resolved. Quotes are preserved when present.
 */
const expandIncludeFilename = (target: string, defineEngine: IncludeDefineEngine): string => {
  if (target.length >= 2) {
    const quote = target[0];
    const isQuoted = (quote === '"' || quote === "'" || quote === "`") && target.endsWith(quote);
    if (isQuoted) {
      return `${quote}${defineEngine.resolveDefinesInStringLiteral(target.slice(1, -1))}${quote}`;
    }
  }
  return defineEngine.resolveRegularDefines(target);
};

/**
 * Resolves the `incsrc` / `include` filename from IR metadata, falling back to words.
 * @param {string[]} words Directive tokens.
 * @param {NormalizedCommand} [command] The normalized command, when the registry supplied one.
 * @param {"incsrc" | "include"} directive The keyword, used in the arity error.
 * @param {IncludeDefineEngine} defineEngine Define expander for path tokens.
 * @returns {string} The include target.
 * @throws {Error} If no filename is present.
 */
const resolveIncludeTarget = (
  words: readonly string[],
  command: NormalizedCommand | undefined,
  directive: "incsrc" | "include",
  defineEngine: IncludeDefineEngine,
): string => {
  const target = command?.parsed.includeTarget?.target ?? words[1];
  if (!target) {
    throw new Error(`${directive} requires exactly one filename parameter`);
  }
  return expandIncludeFilename(target, defineEngine);
};

/**
 * Splits `incbin` tokens into the source operand and optional `->` seek target.
 * @param {string[]} words Directive tokens.
 * @returns {{ sourceWords: string[]; targetLocation: string | undefined }} Source tokens and seek target.
 * @throws {Error} If `->` is present without a following address or label.
 */
const splitIncbinArrow = (
  words: readonly string[],
): { sourceWords: readonly string[]; targetLocation: string | undefined } => {
  const arrowIndex = words.indexOf("->");
  if (arrowIndex === -1) {
    return { sourceWords: words.slice(1), targetLocation: undefined };
  }
  if (arrowIndex + 1 >= words.length) {
    throw new Error("incbin '->' syntax requires a target location.");
  }
  return {
    sourceWords: words.slice(1, arrowIndex),
    targetLocation: words[arrowIndex + 1],
  };
};

/**
 * Splits a (possibly quoted) `file` or `file:range` operand.
 * Quoted paths keep colons inside the quotes (`"C:\data.bin"`); the range colon is the one after the closer.
 * @param {string} filenameWithRange Joined source operand.
 * @returns {{ filename: string; rangeStr: string | undefined }} Path and optional range text.
 */
const parseIncbinFilenameAndRange = (
  filenameWithRange: string,
): { filename: string; rangeStr: string | undefined } => {
  const quote = filenameWithRange[0];
  if (quote === '"' || quote === "'" || quote === "`") {
    const endQuote = filenameWithRange.indexOf(quote, 1);
    if (endQuote !== -1) {
      const filename = filenameWithRange.slice(1, endQuote);
      const rest = filenameWithRange.slice(endQuote + 1);
      if (rest.startsWith(":")) {
        return { filename, rangeStr: rest.slice(1) };
      }
      return { filename, rangeStr: undefined };
    }
  }

  const colonIndex = filenameWithRange.indexOf(":");
  if (colonIndex === -1) {
    return { filename: filenameWithRange, rangeStr: undefined };
  }
  return {
    filename: filenameWithRange.slice(0, colonIndex),
    rangeStr: filenameWithRange.slice(colonIndex + 1),
  };
};

/**
 * Treats a range end of `0` as EOF, matching asar.
 * @param {number} startOffset Inclusive start.
 * @param {number} endOffset Exclusive end, or `0` for EOF.
 * @param {number} fileLength Source length.
 * @returns {{ startOffset: number; endOffset: number }} Normalized bounds.
 */
const applyEofEnd = (
  startOffset: number,
  endOffset: number,
  fileLength: number,
): { startOffset: number; endOffset: number } => {
  if (endOffset === 0) {
    return { startOffset, endOffset: fileLength };
  }
  return { startOffset, endOffset };
};

/**
 * Finds the first `-` at parenthesis/quote depth 0 (asar `strqpchr`).
 * @param {string} input Range text.
 * @returns {number} Index of the hyphen, or `-1`.
 */
const findTopLevelHyphen = (input: string): number => {
  let depth = 0;
  let quote = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      if (quote === char) {
        quote = "";
      } else if (quote === "") {
        quote = char;
      }
      continue;
    }
    if (quote !== "") {
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      continue;
    }
    if (depth === 0 && char === "-") {
      return i;
    }
  }
  return -1;
};

/**
 * Asar `getnum64` rejects leftover/unbalanced parens as `Emismatched_parentheses`.
 * @param {string} text Math text after stripping one wrapping `(...)`.
 * @throws {Error} If parentheses are unbalanced.
 */
const assertIncbinMathParensBalanced = (text: string): void => {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        throw new Error("Emismatched_parentheses: Mismatched parentheses.");
      }
    }
  }
  if (depth !== 0) {
    throw new Error("Emismatched_parentheses: Mismatched parentheses.");
  }
};

/**
 * Parses unprefixed hex the way asar `strtoul(..., 16)` does.
 * @param {string} text Remaining range text.
 * @returns {{ value: number; rest: string }} Consumed value and leftover.
 */
const parseIncbinUnprefixedHex = (text: string): { value: number; rest: string } => {
  const match = text.match(/^([\dA-Fa-f]*)/);
  const digits = match?.[1] ?? "";
  let value = 0;
  if (digits !== "") {
    value = Number.parseInt(digits, 16);
  }
  return { value, rest: text.slice(digits.length) };
};

/**
 * Deprecated `start-end` split matching asar: `(math)-($hex)`, `0-(math)`, `(math)-` (EOF).
 * If start begins with `(`, the hyphen is the first `-` after the matching `)`
 * (paren/quote-aware, so inner minuses in `($010000-DATA)&$00FFFF` stay in the
 * bound). One wrapping `(...)` is stripped from each bound; empty end is `0` (EOF).
 * @param {string} rangeStr Range text after the filename colon.
 * @returns {{ start: string | number; end: string | number }} Hex literals or math text to evaluate.
 * @throws {Error} If the hyphen form is structurally invalid.
 */
const parseDeprecatedHyphenIncbinRange = (
  rangeStr: string,
): { start: string | number; end: string | number } => {
  let rest = rangeStr;
  let start: string | number;
  if (rest.startsWith("(")) {
    const hyphen = findTopLevelHyphen(rest);
    if (hyphen < 1 || rest[hyphen - 1] !== ")") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const inner = rest.slice(1, hyphen - 1);
    assertIncbinMathParensBalanced(inner);
    start = inner;
    rest = rest.slice(hyphen);
  } else {
    const parsed = parseIncbinUnprefixedHex(rest);
    start = parsed.value;
    rest = parsed.rest;
  }

  if (!rest.startsWith("-")) {
    throw new Error(`Invalid range specification: ${rangeStr}`);
  }
  rest = rest.slice(1);

  let end: string | number;
  if (rest.startsWith("(")) {
    if (!rest.endsWith(")")) {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const inner = rest.slice(1, -1);
    assertIncbinMathParensBalanced(inner);
    end = inner;
  } else {
    const parsed = parseIncbinUnprefixedHex(rest);
    if (parsed.rest !== "") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    end = parsed.value;
  }

  return { start, end };
};

/**
 * Parses `start..end` (preferred) or deprecated `start-end` hyphen ranges.
 * @param {string} rangeStr Range text after the filename colon.
 * @param {RangeEvaluator} evaluate Bound evaluator for start/end expressions.
 * @param {number} fileLength Source length, used when the end bound is `0`.
 * @returns {{ startOffset: number; endOffset: number }} Inclusive start and exclusive end.
 * @throws {Error} If the range is malformed. Unbalanced hyphen math keeps asar's `Emismatched_parentheses` id.
 */
const evaluateIncbinRange = (
  rangeStr: string,
  evaluate: RangeEvaluator,
  fileLength: number,
): { startOffset: number; endOffset: number } => {
  if (rangeStr.includes("..")) {
    const parts = rangeStr.split("..");
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const rangeNode = parseExpressionNode(rangeStr);
    if (rangeNode.type !== "range") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    return applyEofEnd(evaluate(rangeNode.start), evaluate(rangeNode.end), fileLength);
  }

  if (rangeStr.includes("-")) {
    const bounds = parseDeprecatedHyphenIncbinRange(rangeStr);
    let startOffset: number;
    if (typeof bounds.start === "number") {
      startOffset = bounds.start;
    } else {
      startOffset = evaluate(bounds.start);
    }
    let endOffset: number;
    if (typeof bounds.end === "number") {
      endOffset = bounds.end;
    } else {
      endOffset = evaluate(bounds.end);
    }
    return applyEofEnd(startOffset, endOffset, fileLength);
  }

  throw new Error(`Invalid range specification: ${rangeStr}`);
};

/**
 * Rejects inverted or out-of-range incbin slices.
 * @param {number} startOffset Inclusive start.
 * @param {number} endOffset Exclusive end.
 * @param {number} fileLength Source length.
 * @param {string} filename Path used in the error.
 * @param {string} [rangeStr] Optional source range used to enrich the diagnostic.
 * @throws {Error} If either bound is outside the file.
 */
const assertIncbinBounds = (
  startOffset: number,
  endOffset: number,
  fileLength: number,
  filename: string,
  rangeStr?: string,
): void => {
  const rangeHint = rangeStr ? `, range ${rangeStr}` : "";
  if (startOffset < 0 || startOffset > endOffset || startOffset > fileLength) {
    throw new Error(
      `Start offset ${startOffset} out of bounds for file ${filename} (length ${fileLength}${rangeHint})`,
    );
  }
  if (endOffset > fileLength) {
    throw new Error(
      `End offset ${endOffset} out of bounds for file ${filename} (length ${fileLength}${rangeHint})`,
    );
  }
};

/**
 * Embeds a binary file at the current PC, optionally sliced and/or seeking via `->`.
 *
 * @example
 * incbin "data.bin"
 * incbin "data.bin":$10..$20
 * incbin "data.bin":1-4
 * incbin "data.bin" -> $808000
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command; `parsed.incbinRange` skips string re-parse when present.
 * @throws {Error} On missing file, bad range, missing `->` target, or unreadable contents.
 */
export const handleIncbin = (
  { session, includeSource, operandResolver, runtime, defineEngine }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  const { sourceWords, targetLocation } = splitIncbinArrow(words);
  const filenameWithRange = sourceWords.join(" ");
  const { filename: rawFilename, rangeStr } = parseIncbinFilenameAndRange(filenameWithRange);
  const expander = defineEngine ?? IDENTITY_INCLUDE_DEFINES;
  const quote = filenameWithRange[0];
  let filename = rawFilename;
  if (quote === '"' || quote === "'" || quote === "`") {
    filename = expander.resolveDefinesInStringLiteral(rawFilename);
  } else {
    filename = expander.resolveRegularDefines(rawFilename);
  }

  const fileData = includeSource.readFile(filename);
  if (!(fileData instanceof Uint8Array)) {
    throw new Error(`Failed to read file: ${filename}`);
  }

  let startOffset = 0;
  let endOffset = fileData.length;
  const parsedRange = command?.parsed.incbinRange;
  if (parsedRange) {
    ({ startOffset, endOffset } = applyEofEnd(
      session.evaluateRangeExpression(parsedRange.start),
      session.evaluateRangeExpression(parsedRange.end),
      fileData.length,
    ));
  } else if (rangeStr) {
    ({ startOffset, endOffset } = evaluateIncbinRange(
      rangeStr,
      (expression) => session.evaluateRangeExpression(expression),
      fileData.length,
    ));
  }

  assertIncbinBounds(startOffset, endOffset, fileData.length, filename, rangeStr);
  const incbinData = fileData.subarray(startOffset, endOffset);

  if (targetLocation !== undefined) {
    runtime.handlePushPC();
    let targetAddress: number;
    if (NUMERIC_INCBIN_TARGET.test(targetLocation)) {
      targetAddress = operandResolver.getnum(targetLocation);
    } else {
      targetAddress = session.symbolScope.getLabelValue(targetLocation, false);
    }
    session.setWritePosition(targetAddress);
  }

  for (let i = 0; i < incbinData.length; i++) {
    session.write1(incbinData[i]);
  }

  if (targetLocation !== undefined) {
    runtime.handlePullPC();
  }

  session.recordCurrentAddress();
};

/**
 * Assembles another source file inline (`incsrc`).
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export const handleIncsrc = (
  { includeSource, defineEngine }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.assembleFile(
    resolveIncludeTarget(words, command, "incsrc", defineEngine ?? IDENTITY_INCLUDE_DEFINES),
  );
};

/**
 * Includes and assembles another source file (`include`).
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export const handleInclude = (
  { includeSource, defineEngine }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.includeFile(
    resolveIncludeTarget(words, command, "include", defineEngine ?? IDENTITY_INCLUDE_DEFINES),
  );
};

/**
 * Registers source and binary include directives.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {IncludeDirectiveContext} context The include-capable directive context.
 */
export const registerIncludeSourceDirectives = (
  registry: DirectiveRegistry,
  context: IncludeDirectiveContext,
): void => {
  registry.registerLowered("incsrc", context, handleIncsrc);
  registry.registerLowered("include", context, handleInclude);
  registry.registerLowered("includeonce", context, ({ includeSource }) => {
    includeSource.guardCurrentFile();
  });
  registry.registerLowered("incbin", context, handleIncbin);
};
