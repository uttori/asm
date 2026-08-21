import { parseExpressionNode, type ExpressionNode } from "../ir/expression-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDirectiveContext } from "./types.js";

/** Hex (`$808000`) or decimal `incbin ->` seek targets. Labels take the other path. */
const NUMERIC_INCBIN_TARGET = /^\$[\da-f]+$|^-?\d+$/i;

type RangeEvaluator = (expression: string | ExpressionNode) => number;

/**
 * Resolves the `incsrc` / `include` filename from IR metadata, falling back to words.
 * @param {string[]} words Directive tokens.
 * @param {NormalizedCommand} [command] The normalized command, when the registry supplied one.
 * @param {"incsrc" | "include"} directive The keyword, used in the arity error.
 * @returns {string} The include target.
 * @throws {Error} If no filename is present.
 */
const resolveIncludeTarget = (
  words: readonly string[],
  command: NormalizedCommand | undefined,
  directive: "incsrc" | "include",
): string => {
  const target = command?.parsed.includeTarget?.target ?? words[1];
  if (!target) {
    throw new Error(`${directive} requires exactly one filename parameter`);
  }
  return target;
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
 * Parses `start..end` (preferred) or deprecated `start-end` hyphen ranges.
 * @param {string} rangeStr Range text after the filename colon.
 * @param {RangeEvaluator} evaluate Bound evaluator for start/end expressions.
 * @param {number} fileLength Source length, used when the end bound is `0`.
 * @returns {{ startOffset: number; endOffset: number }} Inclusive start and exclusive end.
 * @throws {Error} If the range is malformed. Hyphen ranges with parentheses keep asar's `Emismatched_parentheses` id.
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
    if (rangeStr.includes("(") || rangeStr.includes(")")) {
      throw new Error("Emismatched_parentheses: Mismatched parentheses.");
    }
    const parts = rangeStr.split("-");
    if (parts.length !== 2 || parts[0].trim() === "" || parts[1].trim() === "") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    return applyEofEnd(evaluate(parts[0].trim()), evaluate(parts[1].trim()), fileLength);
  }

  throw new Error(`Invalid range specification: ${rangeStr}`);
};

/**
 * Rejects inverted or out-of-range incbin slices.
 * @param {number} startOffset Inclusive start.
 * @param {number} endOffset Exclusive end.
 * @param {number} fileLength Source length.
 * @param {string} filename Path used in the error.
 * @throws {Error} If either bound is outside the file.
 */
const assertIncbinBounds = (
  startOffset: number,
  endOffset: number,
  fileLength: number,
  filename: string,
): void => {
  if (startOffset < 0 || startOffset > endOffset || startOffset > fileLength) {
    throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
  }
  if (endOffset > fileLength) {
    throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
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
  { session, includeSource, operandResolver, runtime }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  const { sourceWords, targetLocation } = splitIncbinArrow(words);
  const { filename, rangeStr } = parseIncbinFilenameAndRange(sourceWords.join(" "));

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

  assertIncbinBounds(startOffset, endOffset, fileData.length, filename);
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
  { includeSource }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.assembleFile(resolveIncludeTarget(words, command, "incsrc"));
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
  { includeSource }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.includeFile(resolveIncludeTarget(words, command, "include"));
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
  registry.register("incsrc", context, handleIncsrc);
  registry.register("include", context, handleInclude);
  registry.register("includeonce", context, ({ includeSource }) => {
    includeSource.guardCurrentFile();
  });
  registry.register("incbin", context, handleIncbin);
};
