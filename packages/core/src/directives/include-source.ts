import { parseExpressionAtSite, type ExpressionNode } from "../ir/expression-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import {
  syntaxBoolean,
  syntaxExpression,
  syntaxOptional,
  syntaxRecord,
  syntaxString,
  syntaxUnion,
} from "../ir/syntax-codec.js";
import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDefineEngine, IncludeDirectiveContext } from "./types.js";

const IDENTITY_INCLUDE_DEFINES: IncludeDefineEngine = {
  resolveDefinesInStringLiteral: (content) => content,
  resolveRegularDefines: (content) => content,
};

/** Hex (`$808000`) or decimal `incbin ->` seek targets. Labels take the other path. */
const NUMERIC_INCBIN_TARGET = /^\$[\da-f]+$|^-?\d+$/i;

/** Parse source includes once; quoted path contents remain source-valued define templates. */
const parseIncludeTarget = (words: readonly string[], directive: string) => {
  const target = words.slice(1).join(" ").trim();
  if (!target) {
    throw new Error(`${directive} requires exactly one filename parameter`);
  }
  const quote = target[0];
  const quoted = target.length >= 2 && ['"', "'", "`"].includes(quote) && target.endsWith(quote);
  return { path: quoted ? target.slice(1, -1) : target, quote: quoted ? quote : "" };
};

/** Bind filename templates when the include executes, without interpreting them as expressions. */
const resolveIncludeTarget = (
  { path, quote }: ReturnType<typeof parseIncludeTarget>,
  expander: IncludeDefineEngine,
): string =>
  quote
    ? `${quote}${expander.resolveDefinesInStringLiteral(path)}${quote}`
    : expander.resolveRegularDefines(path);

/**
 * Splits `incbin` tokens into the source operand and optional `->` seek target.
 * @param words Directive tokens.
 * @returns Source tokens and seek target.
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
 * Quoted paths keep colons inside the quotes (`"C:\data.bin"`). The range colon is the one after the closer.
 * @param filenameWithRange Joined source operand.
 * @returns Path and optional range text.
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
 * @param startOffset Inclusive start.
 * @param endOffset Exclusive end, or `0` for EOF.
 * @param fileLength Source length.
 * @returns Normalized bounds.
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
 * @param input Range text.
 * @returns Index of the hyphen, or `-1`.
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
 * @param text Math text after stripping one wrapping `(...)`.
 * @throws {Error} If parentheses are unbalanced.
 */
const assertIncbinMathParensBalanced = (text: string): void => {
  let depth = 0;
  for (const char of text) {
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
 * @param text Remaining range text.
 * @returns Consumed value and leftover.
 */
const parseIncbinUnprefixedHex = (text: string): { value: number; rest: string } => {
  const digits = text.match(/^[\dA-Fa-f]*/)![0];
  const value = digits === "" ? 0 : Number.parseInt(digits, 16);
  return { value, rest: text.slice(digits.length) };
};

/**
 * Deprecated `start-end` split matching asar: `(math)-($hex)`, `0-(math)`, `(math)-` (EOF).
 * If start begins with `(`, the hyphen is the first `-` after the matching `)`
 * (paren/quote-aware, so inner minuses in `($010000-DATA)&$00FFFF` stay in the
 * bound). One wrapping `(...)` is stripped from each bound. Empty end is `0` (EOF).
 * @param rangeStr Range text after the filename colon.
 * @returns Hex literals or math text to evaluate.
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

/** Builds an expression node for numeric literals or parsed include-range text. */
const rangeBoundNode = (value: string | number): ExpressionNode => {
  if (typeof value === "number") {
    return { type: "literal", value: String(value), numericValue: value };
  }
  return parseExpressionAtSite(value, "include");
};

/**
 * Parses `start..end` (preferred) or deprecated `start-end` hyphen ranges.
 * @param rangeStr Range text after the filename colon.
 * @returns Bounds evaluated after the binary is read.
 * @throws {Error} If the range is malformed. Unbalanced hyphen math keeps asar's `Emismatched_parentheses` id.
 */
const parseIncbinRange = (rangeStr: string): { start: ExpressionNode; end: ExpressionNode } => {
  if (rangeStr.includes("..")) {
    const parts = rangeStr.split("..");
    const node = parseExpressionAtSite(rangeStr, "include");
    if (parts.length !== 2 || !parts[0] || !parts[1] || node.type !== "range") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    return { start: node.start, end: node.end };
  }
  if (!rangeStr.includes("-")) {
    throw new Error(`Invalid range specification: ${rangeStr}`);
  }
  const bounds = parseDeprecatedHyphenIncbinRange(rangeStr);

  return { start: rangeBoundNode(bounds.start), end: rangeBoundNode(bounds.end) };
};

/** Binary paths are data; only ranges and numeric seek locations are numeric expressions. */
type IncbinPayload = {
  filename: string;
  quoted: boolean;
  range?: { start: ExpressionNode; end: ExpressionNode } | { error: string };
  rangeText?: string;
  target?: { address: ExpressionNode } | { label: string };
};

const incbinSyntax = syntaxRecord({
  filename: syntaxString,
  quoted: syntaxBoolean,
  range: syntaxOptional(
    syntaxUnion(
      syntaxRecord({ start: syntaxExpression, end: syntaxExpression }),
      syntaxRecord({ error: syntaxString }),
    ),
  ),
  rangeText: syntaxOptional(syntaxString),
  target: syntaxOptional(
    syntaxUnion(syntaxRecord({ address: syntaxExpression }), syntaxRecord({ label: syntaxString })),
  ),
});

/** Save malformed ranges until after the file read, preserving error/effect ordering. */
function parseIncbinPayload(words: readonly string[]): IncbinPayload {
  const { sourceWords, targetLocation } = splitIncbinArrow(words);
  const source = sourceWords.join(" ");
  const { filename, rangeStr } = parseIncbinFilenameAndRange(source);
  const payload: IncbinPayload = { filename, quoted: ['"', "'", "`"].includes(source[0]) };
  if (rangeStr) {
    payload.rangeText = rangeStr;
    try {
      payload.range = parseIncbinRange(rangeStr);
    } catch (cause) {
      payload.range = { error: cause instanceof Error ? cause.message : String(cause) };
    }
  }
  if (targetLocation !== undefined) {
    payload.target = NUMERIC_INCBIN_TARGET.test(targetLocation)
      ? { address: parseExpressionAtSite(targetLocation, "include") }
      : { label: targetLocation };
  }
  return payload;
}

/**
 * Rejects inverted or out-of-range incbin slices.
 * @param startOffset Inclusive start.
 * @param endOffset Exclusive end.
 * @param fileLength Source length.
 * @param filename Path used in the error.
 * @param [rangeStr] Optional source range used to enrich the diagnostic.
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
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command. Retained for public adapter compatibility.
 * @throws {Error} On missing file, bad range, missing `->` target, or unreadable contents.
 */
export const handleIncbin = (
  context: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  _command?: NormalizedCommand,
): void => executeIncbin(context, parseIncbinPayload(words));

/** Read, validate and emit a prepared binary slice in the established cursor order. */
function executeIncbin(
  { session, includeSource, operandResolver, runtime, defineEngine }: IncludeDirectiveContext,
  payload: IncbinPayload,
): void {
  const expander = defineEngine ?? IDENTITY_INCLUDE_DEFINES;
  const filename = payload.quoted
    ? expander.resolveDefinesInStringLiteral(payload.filename)
    : expander.resolveRegularDefines(payload.filename);
  const fileData = includeSource.readFile(filename);
  if (!(fileData instanceof Uint8Array)) {
    throw new Error(`Failed to read file: ${filename}`);
  }

  let startOffset = 0;
  let endOffset = fileData.length;
  if (payload.range) {
    if ("error" in payload.range) {
      throw new Error(payload.range.error);
    }
    ({ startOffset, endOffset } = applyEofEnd(
      session.evaluateRangeExpression(payload.range.start),
      session.evaluateRangeExpression(payload.range.end),
      fileData.length,
    ));
  }
  assertIncbinBounds(startOffset, endOffset, fileData.length, filename, payload.rangeText);
  const incbinData = fileData.subarray(startOffset, endOffset);

  if (payload.target) {
    runtime.handlePushPC();
    const targetAddress =
      "address" in payload.target
        ? operandResolver.getnum(payload.target.address)
        : session.symbolScope.getLabelValue(payload.target.label, false);
    session.setWritePosition(targetAddress);
  }

  includeSource.recordBinarySlice?.(filename, startOffset, endOffset, fileData);
  for (const byte of incbinData) {
    session.write1(byte);
  }

  if (payload.target) {
    runtime.handlePullPC();
  }

  session.recordCurrentAddress();
}

/**
 * Assembles another source file inline (`incsrc`).
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export const handleIncsrc = (
  { includeSource, defineEngine }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.assembleFile(
    resolveIncludeTarget(
      parseIncludeTarget(
        command
          ? ["incsrc", command.parsed.includeTarget?.target ?? words.slice(1).join(" ")]
          : words,
        "incsrc",
      ),
      defineEngine ?? IDENTITY_INCLUDE_DEFINES,
    ),
  );
};

/**
 * Includes and assembles another source file (`include`).
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export const handleInclude = (
  { includeSource, defineEngine }: IncludeDirectiveContext,
  words: readonly string[],
  _raw = "",
  command?: NormalizedCommand,
): void => {
  includeSource.includeFile(
    resolveIncludeTarget(
      parseIncludeTarget(
        command
          ? ["include", command.parsed.includeTarget?.target ?? words.slice(1).join(" ")]
          : words,
        "include",
      ),
      defineEngine ?? IDENTITY_INCLUDE_DEFINES,
    ),
  );
};

/**
 * Registers source and binary include directives.
 * @param registry The directive registry.
 * @param context The include-capable directive context.
 */
export const registerIncludeSourceDirectives = (
  registry: DirectiveRegistry,
  context: IncludeDirectiveContext,
): void => {
  for (const directive of ["incsrc", "include"] as const) {
    registry.registerImmutableTyped(
      directive,
      ({ words }) => parseIncludeTarget(words, directive),
      syntaxRecord({ path: syntaxString, quote: syntaxString }),
      ({ path, quote }) => {
        const expander = context.defineEngine ?? IDENTITY_INCLUDE_DEFINES;
        const filename = resolveIncludeTarget({ path, quote }, expander);
        if (directive === "incsrc") {
          context.includeSource.assembleFile(filename);
        } else {
          context.includeSource.includeFile(filename);
        }
      },
    );
  }
  registry.registerImmutableTyped(
    "includeonce",
    () => ({}),
    syntaxRecord({}),
    () => context.includeSource.guardCurrentFile(),
  );
  registry.registerImmutableTyped(
    "incbin",
    ({ words }) => parseIncbinPayload(words),
    incbinSyntax,
    (payload) => executeIncbin(context, payload),
  );
};
