import { recordExpressionParse } from "../internal-instrumentation.js";
import { createSourceSpan, createTextSpan, type SourceSpan } from "../source-location.js";
import { parseDefineTemplate, type DefineTemplate } from "./define-template.js";
import { isSourceTextArgument } from "./expression-call-contracts.js";
import { binaryPrecedence } from "./expression-operators.js";
import {
  getRawExpressionOutcome,
  setRawExpressionOutcome,
  type ExpressionParseOutcome,
  type ExpressionParseSite,
} from "./expression-parse-state.js";

type ExpressionNodeBase = {
  span?: SourceSpan;
  /** Explicit grouping is a rounding boundary even when the group has one literal. */
  parenthesized?: boolean;
};

export type ExpressionNode =
  | IdentifierExpressionNode
  | LiteralExpressionNode
  | StringExpressionNode
  | DefineReferenceExpressionNode
  | MemberExpressionNode
  | IndexExpressionNode
  | CallExpressionNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | RangeExpressionNode
  | RelativeReferenceExpressionNode
  | SourceTextExpressionNode
  | TemplateExpressionNode
  | ErrorExpressionNode
  | RawExpressionNode;

export type IdentifierExpressionNode = ExpressionNodeBase & {
  type: "identifier";
  name: string;
};

export type LiteralExpressionNode = ExpressionNodeBase & {
  type: "literal";
  value: string;
  /** Parsed numeric value; lexical spelling remains authoritative for width intent. */
  numericValue?: number;
};

export type StringExpressionNode = ExpressionNodeBase & {
  type: "string";
  value: string;
  quote: '"' | "'";
};

export type DefineReferenceExpressionNode = ExpressionNodeBase & {
  type: "defineReference";
  name?: string;
  content?: string;
  braced: boolean;
};

export type ReferenceExpressionNode =
  | IdentifierExpressionNode
  | RelativeReferenceExpressionNode
  | DefineReferenceExpressionNode
  | MemberExpressionNode
  | IndexExpressionNode;

export type MemberExpressionNode = ExpressionNodeBase & {
  type: "member";
  object: ReferenceExpressionNode;
  property: IdentifierExpressionNode;
};

export type IndexExpressionNode = ExpressionNodeBase & {
  type: "index";
  object: ReferenceExpressionNode;
  index: ExpressionNode;
};

export type CallExpressionNode = ExpressionNodeBase & {
  type: "call";
  callee: IdentifierExpressionNode;
  arguments: ExpressionNode[];
};

export type UnaryOperator = "<:" | "<" | ">" | "^" | "~" | "-" | "+";

export type UnaryExpressionNode = ExpressionNodeBase & {
  type: "unary";
  operator: UnaryOperator;
  argument: ExpressionNode;
};

export type BinaryOperator =
  | "**"
  | "*"
  | "/"
  | "%"
  | "+"
  | "-"
  | "<<"
  | ">>"
  | "&"
  | "|"
  | "^"
  | "<"
  | ">"
  | "<="
  | ">="
  | "=="
  | "="
  | "!="
  | "&&"
  | "||";

export type BinaryExpressionNode = ExpressionNodeBase & {
  type: "binary";
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
};

export type RangeExpressionNode = ExpressionNodeBase & {
  type: "range";
  start: ExpressionNode;
  end: ExpressionNode;
};

/** Relative references retain direction, depth and stream instead of a lookup string. */
export type RelativeReferenceExpressionNode = ExpressionNodeBase & {
  type: "relativeReference";
  direction: 1 | -1;
  count: number;
  stream: "relative" | "unnamed" | "macro";
  text: string;
};

/** A function's source-valued slot; its text is data and must never be evaluated as a label. */
export type SourceTextExpressionNode = ExpressionNodeBase & {
  type: "sourceText";
  text: string;
  value: string;
};

/** Unbound macro syntax is valid input whose activation belongs to ordered expansion. */
export type TemplateExpressionNode = ExpressionNodeBase & {
  type: "template";
  form: "parameter" | "variadic" | "source";
  /** Ordered define sites for a fragment whose substitution can create expression grammar. */
  defines?: DefineTemplate;
  text: string;
  name?: string;
  index?: ExpressionNode;
};

/** A portable parser diagnostic, reported only when this occurrence is selected for evaluation. */
export type ErrorExpressionNode = ExpressionNodeBase & {
  type: "error";
  value: string;
  outcome: Exclude<ExpressionParseOutcome, { kind: "native" }>;
  message: string;
  code?: "MATH_INVALID_INPUT" | "MATH_MISMATCHED_PARENTHESES";
};

export type RawExpressionNode = ExpressionNodeBase & {
  type: "raw";
  value: string;
};

/**
 * Ensures the root expression node keeps at least a coarse span.
 * @param {ExpressionNode} node The parsed expression node.
 * @param {string} text The source text that produced the node.
 * @returns {ExpressionNode} The same node with a root span.
 */
function attachRootSpan(
  node: ExpressionNode,
  text: string,
  source?: ExpressionSource,
): ExpressionNode {
  node.span ??= source
    ? createTextSpan(
        source.text,
        source.offset,
        source.offset + text.length,
        source.line,
        source.lineStarts,
      )
    : createSourceSpan(0, text.length);
  return node;
}

/**
 * Parses portable expression syntax without resolving values or activating diagnostics.
 * @param {string} input The expression source text.
 * @returns {ExpressionNode} The parsed expression node.
 */
export function parseExpressionNode(input: string, source?: ExpressionSource): ExpressionNode {
  return parseExpressionAtSite(input, "public", source);
}

/** Internal adapter retains the public node-only API while labeling the real parser caller. */
export function parseExpressionAtSite(
  input: string,
  site: ExpressionParseSite,
  source?: ExpressionSource,
): ExpressionNode {
  return parseExpressionResult(input, site, source).node;
}

/** Internal outcome separates grammar coverage from legacy acceptance and evaluation errors. */
export type ExpressionParseResult = { node: ExpressionNode; outcome: ExpressionParseOutcome };

/**
 * Parse with bounded coverage evidence. Each entry counts once, including recursive
 * immediate/range slices and compatibility probes; cache misses are a separate metric. Malformed
 * and unknown syntax retain diagnostic nodes; valid unbound fragments retain their template sites.
 */
export function parseExpressionResult(
  input: string,
  site: ExpressionParseSite = "public",
  source?: ExpressionSource,
): ExpressionParseResult {
  const result = parseExpressionInput(input, site, source);
  recordExpressionParse(site, result.outcome);
  return result;
}

/** Known parser failures carry stable reasons rather than source-bearing error messages. */
class ExpressionSyntaxError extends Error {
  constructor(
    readonly outcome: Exclude<ExpressionParseOutcome, { kind: "native" }>,
    readonly diagnostic?: { message: string; code?: ErrorExpressionNode["code"] },
  ) {
    super(outcome.reason);
  }
}

/** Store diagnostics as syntax; parsing does not run the former scanner to discover an error. */
function errorParseResult(
  text: string,
  outcome: Exclude<ExpressionParseOutcome, { kind: "native" }>,
  source?: ExpressionSource,
  diagnostic?: { message: string; code?: ErrorExpressionNode["code"] },
): ExpressionParseResult {
  // A define may supply delimiters or an operator. Preserve its lexical template until
  // binding; malformed define syntax itself remains a portable diagnostic.
  if (text.includes("!")) {
    const defines = parseDefineTemplate(text);
    if (
      defines.parts.some((part) => part.kind === "define") &&
      !defines.parts.some((part) => part.kind === "error")
    ) {
      return {
        node: attachRootSpan({ type: "template", form: "source", text, defines }, text, source),
        outcome: { kind: "native" },
      };
    }
  }
  const node = attachRootSpan(
    {
      type: "error",
      value: text,
      outcome,
      ...(diagnostic ?? { message: `Invalid number: ${text}` }),
    },
    text,
    source,
  );
  setRawExpressionOutcome(node, outcome);
  return { node, outcome };
}

/** Literal interpretation is shared by parsed and externally constructed syntax. */
export function parseLiteralValue(value: string): number {
  if (/^\$[\dA-Fa-f]+$/.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^0x[\da-f]+$/i.test(value)) {
    return Number.parseInt(value.slice(2), 16);
  }
  if (/^%[01]+$/.test(value)) {
    return Number.parseInt(value.slice(1), 2);
  }
  // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored numeric spelling has one optional decimal separator.
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  throw new Error(`Unsupported literal expression: ${value}`);
}

/** Parser implementation; instrumentation is owned by its entry wrapper. */
function parseExpressionInput(
  input: string,
  site: ExpressionParseSite,
  source?: ExpressionSource,
): ExpressionParseResult {
  const trimmed = input.trim();
  if (source) {
    source = { ...source, offset: source.offset + input.length - input.trimStart().length };
  }
  if (!trimmed) {
    return errorParseResult(trimmed, { kind: "invalid", reason: "empty" }, source, {
      code: "MATH_INVALID_INPUT",
      message: "Invalid input: empty expression.",
    });
  }

  // Immediate addressing belongs to the operand grammar. Preserve the inner source offset.
  if (trimmed.startsWith("#") && trimmed.length > 1) {
    return parseExpressionResult(
      trimmed.slice(1),
      site,
      source && { ...source, offset: source.offset + 1 },
    );
  }

  const rangeIndex = findTopLevelRange(trimmed);
  if (rangeIndex !== -1) {
    const start = parseExpressionResult(trimmed.slice(0, rangeIndex), site, source);
    const end = parseExpressionResult(
      trimmed.slice(rangeIndex + 2),
      site,
      source && { ...source, offset: source.offset + rangeIndex + 2 },
    );
    // A range containing a diagnostic reports the first invalid side.
    const outcome = start.outcome.kind === "native" ? end.outcome : start.outcome;
    return {
      node: attachRootSpan({ type: "range", start: start.node, end: end.node }, trimmed, source),
      outcome,
    };
  }

  try {
    const parser = new ExpressionParser(tokenizeExpression(trimmed, source, site), trimmed);
    const expression = parser.parseExpression();
    if (!parser.isAtEnd()) {
      const offset = parser.peek()?.offset ?? trimmed.length;
      const rest = trimmed.slice(offset);
      const diagnostic = rest.startsWith(",")
        ? { code: "MATH_INVALID_INPUT" as const, message: `Invalid input: ${rest}` }
        : { code: "MATH_MISMATCHED_PARENTHESES" as const, message: "Mismatched parentheses." };
      return errorParseResult(
        trimmed,
        { kind: "invalid", reason: "trailing-tokens" },
        source,
        diagnostic,
      );
    }
    return { node: attachRootSpan(expression, trimmed, source), outcome: { kind: "native" } };
  } catch (error) {
    const failure =
      error instanceof ExpressionSyntaxError
        ? error.outcome
        : ({ kind: "unsupported", reason: "unclassified" } as const);
    const diagnostic =
      error instanceof ExpressionSyntaxError && error.diagnostic
        ? error.diagnostic
        : { message: `Invalid number: ${trimmed}` };
    return errorParseResult(trimmed, failure, source, diagnostic);
  }
}

/**
 * Renders an expression node back into a source-like string.
 * Parsed trees retain their explicit rounding boundaries. Constructed trees that
 * require new groups to express precedence must mark those rounding boundaries
 * themselves; keep transformed trees as nodes when evaluating rounded arithmetic.
 * @param {ExpressionNode} node The expression node to render.
 * @returns {string} The rendered expression text.
 */
export function renderExpressionNode(node: ExpressionNode): string {
  const text = renderExpressionBody(node);
  return node.parenthesized ? `(${text})` : text;
}

/**
 * Render only the grouping required by the tree. Redundant groups are not added:
 * an explicit group also introduces a rounding boundary in native arithmetic.
 */
function renderExpressionChild(node: ExpressionNode, precedence: number, right = false): string {
  const text = renderExpressionNode(node);
  if (node.parenthesized) {
    return text;
  }
  if (node.type === "range") {
    return `(${text})`;
  }
  if (node.type === "binary") {
    const childPrecedence = binaryPrecedence[node.operator];
    // Equal-precedence operators associate left, including exponentiation.
    if (childPrecedence < precedence || (right && childPrecedence === precedence)) {
      return `(${text})`;
    }
  }
  return text;
}

/** Render the node body; the public renderer owns its explicit outer group. */
function renderExpressionBody(node: ExpressionNode): string {
  if (isReferenceExpressionNode(node)) {
    return renderReferenceExpressionNode(node);
  }

  switch (node.type) {
    case "literal":
      return node.value;
    case "string":
      return `${node.quote}${node.value}${node.quote}`;
    case "raw":
    case "error":
      return node.value;
    case "sourceText":
    case "template":
      return node.text;
    case "call":
      return `${node.callee.name}(${node.arguments.map(renderExpressionNode).join(", ")})`;
    case "unary":
      return `${node.operator}${renderExpressionChild(node.argument, binaryPrecedence["**"] + 1)}`;
    case "binary": {
      const precedence = binaryPrecedence[node.operator];
      return `${renderExpressionChild(node.left, precedence)} ${node.operator} ${renderExpressionChild(node.right, precedence, true)}`;
    }
    case "range":
      return `${renderExpressionNode(node.start)}..${renderExpressionNode(node.end)}`;
    default:
      return "";
  }
}

/**
 * Copy replacement syntax into an occurrence without mutating either input. Only
 * the root inherits the physical occurrence span: replacement-relative child
 * offsets do not identify characters in the invoking source. Explicit groups
 * on either root remain rounding boundaries.
 */
export function inheritExpressionOccurrence(
  replacement: ExpressionNode,
  occurrence: ExpressionNode,
): ExpressionNode {
  const result = detachExpressionSpans(replacement);
  if (occurrence.span) {
    result.span = { ...occurrence.span };
  }
  if (occurrence.parenthesized) {
    result.parenthesized = true;
  }
  return result;
}

/** Clone substituted syntax without retaining source offsets from another text. */
function detachExpressionSpans(node: IdentifierExpressionNode): IdentifierExpressionNode;
function detachExpressionSpans(node: ReferenceExpressionNode): ReferenceExpressionNode;
function detachExpressionSpans(node: ExpressionNode): ExpressionNode;
function detachExpressionSpans(node: ExpressionNode): ExpressionNode {
  const { span: _span, ...copy } = node;
  switch (copy.type) {
    case "binary":
      return {
        ...copy,
        left: detachExpressionSpans(copy.left),
        right: detachExpressionSpans(copy.right),
      };
    case "unary":
      return { ...copy, argument: detachExpressionSpans(copy.argument) };
    case "range":
      return {
        ...copy,
        start: detachExpressionSpans(copy.start),
        end: detachExpressionSpans(copy.end),
      };
    case "call":
      return {
        ...copy,
        callee: detachExpressionSpans(copy.callee),
        arguments: copy.arguments.map(detachExpressionSpans),
      };
    case "member":
      return {
        ...copy,
        object: detachExpressionSpans(copy.object),
        property: detachExpressionSpans(copy.property),
      };
    case "index":
      return {
        ...copy,
        object: detachExpressionSpans(copy.object),
        index: detachExpressionSpans(copy.index),
      };
    case "raw":
    case "error":
      setRawExpressionOutcome(copy, getRawExpressionOutcome(node));
      return copy;
    case "template":
      return { ...copy, ...(copy.index && { index: detachExpressionSpans(copy.index) }) };
    case "relativeReference":
    case "sourceText":
    case "identifier":
    case "defineReference":
    case "literal":
    case "string":
      return copy;
  }
  return copy;
}

/**
 * Checks whether an expression belongs to the reference-expression subtree.
 * @param {ExpressionNode} node The expression node to inspect.
 * @returns {boolean} `true` when the node is a reference expression.
 */
export function isReferenceExpressionNode(node: ExpressionNode): node is ReferenceExpressionNode {
  switch (node.type) {
    case "identifier":
    case "defineReference":
    case "relativeReference":
      return true;
    case "member":
    case "index":
      return isReferenceExpressionNode(node.object);
    case "binary":
    case "call":
    case "literal":
    case "range":
    case "raw":
    case "string":
    case "unary":
    case "error":
    case "sourceText":
    case "template":
      break;
  }
  return false;
}

type RenderReferenceExpressionOptions = {
  renderIndex?: (node: ExpressionNode) => string;
};

/**
 * Renders a canonical lookup key. Root/object grouping is intentionally omitted
 * for symbol lookup; numeric index expressions keep their grouping. Use
 * renderExpressionNode when rendering a reference as a numeric expression.
 * @param {ReferenceExpressionNode} node The reference node to render.
 * @param {RenderReferenceExpressionOptions} [options] Optional rendering overrides.
 * @returns {string} The rendered reference text.
 */
export function renderReferenceExpressionNode(
  node: ReferenceExpressionNode,
  options: RenderReferenceExpressionOptions = {},
): string {
  switch (node.type) {
    case "relativeReference":
      return node.text;
    case "identifier":
      return node.name;
    case "defineReference":
      return node.braced ? `!{${node.content ?? ""}}` : `!${node.name ?? ""}`;
    case "member":
      return `${renderReferenceExpressionNode(node.object, options)}.${node.property.name}`;
    case "index": {
      const index = options.renderIndex
        ? options.renderIndex(node.index)
        : renderExpressionNode(node.index);
      return `${renderReferenceExpressionNode(node.object, options)}[${index}]`;
    }
    default:
      return "";
  }
}

/**
 * Parses a leading reference-expression prefix from a larger source string.
 * @param {string} input The source text to scan.
 * @returns {{ node: ReferenceExpressionNode; length: number } | undefined} The parsed node and consumed length.
 */
export function parseLeadingReferenceExpression(
  input: string,
): { node: ReferenceExpressionNode; length: number } | undefined {
  const prefixLength = scanReferenceExpressionPrefix(input);
  if (prefixLength === 0) {
    return undefined;
  }

  // Legacy trimming of trailing dots.
  let source = input.slice(0, prefixLength).trimEnd();
  if (source.endsWith(".")) {
    source = source.slice(0, -1).trimEnd();
  }

  const node = parseExpressionAtSite(source, "reference");
  if (!isReferenceExpressionNode(node)) {
    return undefined;
  }

  return {
    node,
    length: prefixLength,
  };
}

/**
 * Finds a top-level `..` range operator while respecting nested calls and quotes.
 * @param {string} input The expression source text.
 * @returns {number} The index of the operator or `-1`.
 */
function findTopLevelRange(input: string): number {
  let depth = 0;
  let bracketDepth = 0;
  let quote = "";
  for (let i = 0; i < input.length - 1; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (quote) {
      continue;
    }
    if (char === "(") {
      depth++;
      continue;
    }
    if (char === ")") {
      depth--;
      continue;
    }
    if (char === "[") {
      bracketDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth--;
      continue;
    }
    if (depth === 0 && bracketDepth === 0 && input.slice(i, i + 2) === "..") {
      // Leading `..ch8` is a nested sublabel, not a `start..end` range.
      if (i === 0) {
        continue;
      }
      return i;
    }
  }
  return -1;
}

/**
 * Scans the source text for a leading reference-expression prefix.
 * @param {string} input The source text to inspect.
 * @returns {number} The number of consumed characters.
 */
function scanReferenceExpressionPrefix(input: string): number {
  let index = 0;
  index = skipWhitespace(input, index);
  if (index >= input.length) {
    return 0;
  }

  const root = scanReferenceRoot(input, index);
  if (root === index) {
    return 0;
  }
  index = root;

  while (index < input.length) {
    const lookahead = skipWhitespace(input, index);
    if (input[lookahead] === ".") {
      let memberStart = lookahead + 1;
      memberStart = skipWhitespace(input, memberStart);
      const propertyEnd = readIdentifier(input, memberStart).nextIndex;
      if (propertyEnd === memberStart) {
        return memberStart;
      }
      index = propertyEnd;
      continue;
    }
    if (input[lookahead] === "[") {
      const bracketEnd = findMatchingBracket(input, lookahead);
      if (bracketEnd === -1) {
        return 0;
      }
      index = bracketEnd + 1;
      continue;
    }
    break;
  }

  return index;
}

/**
 * Scans the first segment of a reference expression.
 * @param {string} input The source text to inspect.
 * @param {number} start The starting offset.
 * @returns {number} The offset immediately after the root segment.
 */
function scanReferenceRoot(input: string, start: number): number {
  if (input[start] === "!") {
    try {
      return readDefineReference(input, start).nextIndex;
    } catch {
      return start;
    }
  }
  return readIdentifier(input, start).nextIndex;
}

/**
 * Finds the closing bracket for a bracketed source fragment.
 * @param {string} input The source text to inspect.
 * @param {number} start The opening bracket offset.
 * @returns {number} The closing bracket offset or `-1`.
 */
function findMatchingBracket(input: string, start: number): number {
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = "";
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if ((char === '"' || char === "'") && input[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (quote) {
      continue;
    }
    if (char === "[") {
      bracketDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth--;
      if (bracketDepth === 0 && parenDepth === 0) {
        return index;
      }
      continue;
    }
    if (char === "(") {
      parenDepth++;
      continue;
    }
    if (char === ")") {
      parenDepth--;
    }
  }
  return -1;
}

/**
 * Skips leading whitespace.
 * @param {string} input The source text.
 * @param {number} index The current offset.
 * @returns {number} The next non-whitespace offset.
 */
function skipWhitespace(input: string, index: number): number {
  let current = index;
  while (current < input.length && /\s/.test(input[current])) {
    current++;
  }
  return current;
}

/** Optional physical provenance for identifier references in a continued expression. */
export type ExpressionSource = {
  /** Original command, with physical newlines and indentation preserved. */
  text: string;
  /** UTF-16 offset where the input expression starts within text. */
  offset: number;
  /** Zero-based physical line where text starts. */
  line: number;
  /** Reused physical-line offsets for every value in one large record. */
  lineStarts?: number[];
};

type Token = { span?: SourceSpan; offset?: number } & (
  | { type: "expression"; node: ExpressionNode }
  | { type: "identifier"; value: string }
  | { type: "literal"; value: string }
  | { type: "string"; value: string; quote: '"' | "'" }
  | { type: "defineReference"; name?: string; content?: string; braced: boolean }
  | { type: "operator"; value: UnaryOperator | BinaryOperator }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" }
  | { type: "dot" }
  | { type: "lbracket" }
  | { type: "rbracket" }
);

function isUnaryOperator(value: string): value is UnaryOperator {
  return (
    value === "<:" ||
    value === "<" ||
    value === ">" ||
    value === "^" ||
    value === "~" ||
    value === "-" ||
    value === "+"
  );
}

function isQuote(value: string | undefined): value is '"' | "'" {
  return value === '"' || value === "'";
}
const binaryOperators = [
  "**",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "=",
  "!=",
  "&&",
  "||",
  "*",
  "/",
  "%",
  "+",
  "-",
  "&",
  "|",
  "^",
  "<",
  ">",
] as const;

/**
 * Tokenizes an expression string into a list of tokens.
 * @param {string} input The expression source text.
 * @returns {Token[]} The list of tokens.
 */
function tokenizeExpression(
  input: string,
  source?: ExpressionSource,
  site: ExpressionParseSite = "public",
): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  // Only editor callers request token spans; ordinary evaluation avoids the
  // allocation and retains the compact expression trees used by assembler passes.
  const provenance = (end: number): { span?: SourceSpan; offset: number } =>
    source
      ? {
          offset: index,
          span: createTextSpan(
            source.text,
            source.offset + index,
            source.offset + end,
            source.line,
            source.lineStarts,
          ),
        }
      : { offset: index };
  const astProvenance = (end: number): { span?: SourceSpan } => {
    const { offset: _offset, ...location } = provenance(end);
    return location;
  };

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const previousToken = tokens.at(-1);
    const startsOperand =
      !previousToken || ["operator", "lparen", "lbracket", "comma"].includes(previousToken.type);
    const relative = input.slice(index).match(/^([:?]?)(\++|-+)/);
    if (
      relative &&
      (relative[1] ||
        (startsOperand &&
          /^(?:\s*$|\s*[&)*,/<=>\]^|])/.test(input.slice(index + relative[0].length))))
    ) {
      let stream: RelativeReferenceExpressionNode["stream"] = "relative";
      if (relative[1] === ":") {
        stream = "unnamed";
      }
      if (relative[1] === "?") {
        stream = "macro";
      }
      const text = relative[0];
      tokens.push({
        type: "expression",
        node: {
          type: "relativeReference",
          text,
          stream,
          direction: relative[2][0] === "+" ? 1 : -1,
          count: relative[2].length,
          ...astProvenance(index + text.length),
        },
        offset: index,
      });
      index += text.length;
      continue;
    }
    const placeholder = startsOperand
      ? input.slice(index).match(/^<(?:([A-Z_a-z]\w*)|(?:\.{3}|…)\[([^\]]+)])>/)
      : null;
    if (placeholder) {
      const text = placeholder[0];
      const node: TemplateExpressionNode = {
        type: "template",
        form: placeholder[1] ? "parameter" : "variadic",
        text,
        ...astProvenance(index + text.length),
      };
      if (placeholder[1]) {
        node.name = placeholder[1];
      } else {
        node.index = parseExpressionAtSite(placeholder[2], site);
      }
      tokens.push({ type: "expression", node, offset: index });
      index += text.length;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen", offset: index });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen", offset: index });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", offset: index });
      index++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "dot", ...provenance(index + 1) });
      index++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket", offset: index });
      index++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket", offset: index });
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      const { value, nextIndex, quote } = readQuotedString(input, index);
      tokens.push({ type: "string", value, quote, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }

    // A binary prefix is legal only where an operand starts; after an operand '%' remains modulo.
    const previous = tokens.at(-1);
    const operandExpected =
      !previous ||
      previous.type === "operator" ||
      previous.type === "lparen" ||
      previous.type === "lbracket" ||
      previous.type === "comma";
    if (operandExpected && char === "%" && !/[01]/.test(input[index + 1] ?? "")) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "literal" },
        { message: "Invalid number: NaN" },
      );
    }
    if (char === "%" && operandExpected && /[01]/.test(input[index + 1] ?? "")) {
      const literal = input.slice(index).match(/^%[01]+/)![0];
      tokens.push({ type: "literal", value: literal, ...provenance(index + literal.length) });
      index += literal.length;
      continue;
    }
    // Define names retain '!'; numeric/group prefixes use the native bitwise-not operator.
    if (
      char === "!" &&
      !input.startsWith("!=", index) &&
      !/[A-Z_a-z{]/.test(input[index + 1] ?? "")
    ) {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    if (char === "~") {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    const operator =
      (input.startsWith("<:", index) ? "<:" : undefined) ??
      binaryOperators.find((candidate) => input.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", value: operator, offset: index });
      index += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input, index);
      tokens.push({ ...token, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }

    // Dotted local names may start with digits (for example .812A). Read the whole
    // identifier after a dot; decimal literals consume their fraction within the numeric token.
    if (
      char === "@" ||
      char === "?" ||
      /[A-Z_a-z]/.test(char) ||
      (previousToken?.type === "dot" && /\d/.test(char))
    ) {
      const { value, nextIndex } = readIdentifier(input, index);
      if (nextIndex === index + 1 && (char === "?" || char === "@")) {
        throw new ExpressionSyntaxError({ kind: "unsupported", reason: "token" });
      }
      const open = skipWhitespace(input, nextIndex);
      if (input[open] === "(" && previousToken?.type !== "dot") {
        const call = readCallSyntax(input, value, open, site, source);
        tokens.push({
          type: "expression",
          node: {
            type: "call",
            callee: { type: "identifier", name: value, ...astProvenance(nextIndex) },
            arguments: call.arguments,
            ...astProvenance(call.end),
          },
          offset: index,
        });
        index = call.end;
        continue;
      }
      tokens.push({ type: "identifier", value, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    if (char === "$") {
      const match = input.slice(index).match(/^\$[\dA-Fa-f]+/);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" },
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }
    if (char === "%") {
      const match = input.slice(index).match(/^%[01]+/);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" },
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }
    if (/\d/.test(char)) {
      if (/^0x/i.test(input.slice(index)) && !/[\dA-Fa-f]/.test(input[index + 2] ?? "")) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" },
        );
      }
      // oxlint-disable-next-line security/detect-unsafe-regex -- The match is anchored at the lexer cursor.
      const match = input.slice(index).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" },
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }

    throw new ExpressionSyntaxError({ kind: "unsupported", reason: "token" });
  }

  return tokens;
}

/** Find call argument extents without interpreting source-text slots or evaluating earlier arguments. */
function readCallSyntax(
  input: string,
  name: string,
  open: number,
  site: ExpressionParseSite,
  source?: ExpressionSource,
): { arguments: ExpressionNode[]; end: number } {
  const args: ExpressionNode[] = [];
  let start = open + 1;
  let depth = 0;
  let quote = "";
  const append = (end: number): void => {
    const raw = input.slice(start, end);
    const text = raw.trim();
    // The public dialect accepts omitted/trailing comma slots; they do not bind parameters.
    if (!text) {
      if (start > open + 1 && isSourceTextArgument(name, args.length)) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "operand" },
          { message: `Missing function argument for '${name}'.` },
        );
      }
      return;
    }
    if (/^function\b/.test(text)) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "operand" },
        { message: `Missing function argument for '${name}'.` },
      );
    }
    const offset = start + raw.length - raw.trimStart().length;
    const occurrence = source && { ...source, offset: source.offset + offset };
    if (isSourceTextArgument(name, args.length)) {
      let value = text;
      if (text.startsWith('"') || text.startsWith("'")) {
        const quoted = readQuotedString(text, 0);
        const trailing = text.slice(quoted.nextIndex).trimStart();
        if (trailing && /^["'A-Z_a-z]/.test(trailing)) {
          throw new ExpressionSyntaxError(
            { kind: "invalid", reason: "delimiter" },
            {
              message: `Expected ',' or ')' in function call arguments: ${input.slice(offset + quoted.nextIndex).trimStart()}`,
            },
          );
        }
      }
      if (
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))
      ) {
        value = text.slice(1, -1);
      }
      args.push(attachRootSpan({ type: "sourceText", text, value }, text, occurrence));
    } else {
      args.push(parseExpressionAtSite(text, site, occurrence));
    }
  };
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
    } else if (char === ")") {
      if (depth === 0) {
        append(index);
        return { arguments: args, end: index + 1 };
      }
      depth--;
    } else if (char === "," && depth === 0) {
      append(index);
      start = index + 1;
    }
  }
  let message = "Mismatched parentheses.";
  if (depth === 0 && input.slice(start).trim()) {
    message = "Expected ',' or ')' in function call arguments: ";
  }
  if (quote) {
    message = "Unterminated string literal in function call.";
  }
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "delimiter" }, { message });
}

/**
 * Reads a quoted string literal from the source text.
 * @param {string} input The source text.
 * @param {number} start The starting offset.
 * @returns {{ value: string; nextIndex: number; quote: "\"" | "'" }} The quoted string value and next index.
 */
function readQuotedString(
  input: string,
  start: number,
): { value: string; nextIndex: number; quote: '"' | "'" } {
  const quote = input[start];
  if (!isQuote(quote)) {
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
  }
  let value = "";
  let index = start + 1;
  while (index < input.length) {
    const char = input[index];
    if (char === quote && input[index - 1] !== "\\") {
      return { value, nextIndex: index + 1, quote };
    }
    value += char;
    index++;
  }
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
}

/**
 * Reads an identifier from the source text.
 * @param {string} input The source text.
 * @param {number} start The starting offset.
 * @returns {{ value: string; nextIndex: number }} The identifier value and next index.
 */
function readIdentifier(input: string, start: number): { value: string; nextIndex: number } {
  let index = start;
  // Macro-local sublabels keep their leading dots in the symbol key, just like ordinary .local names.
  if (input[index] === "?" && input[index + 1] === ".") {
    index++;
    while (input[index] === ".") {
      index++;
    }
  }
  // Scope markers are part of the identifier spelling.
  if (input[index] === "@" || input[index] === "?") {
    index++;
  }
  while (index < input.length && /\w/.test(input[index])) {
    index++;
  }
  return { value: input.slice(start, index), nextIndex: index };
}

/**
 * Reads a define reference from the source text.
 * Handles braced define references.
 * @param {string} input The source text.
 * @param {number} start The starting offset.
 * @returns {{ token: Extract<Token, { type: "defineReference" }>; nextIndex: number }} The define reference token and next index.
 */
function readDefineReference(
  input: string,
  start: number,
): { token: Extract<Token, { type: "defineReference" }>; nextIndex: number } {
  if (input[start + 1] === "{") {
    let index = start + 2;
    let braces = 1;
    let content = "";
    while (index < input.length) {
      const char = input[index];
      if (char === "{") {
        braces++;
      } else if (char === "}") {
        braces--;
        if (braces === 0) {
          return {
            token: { type: "defineReference", content, braced: true },
            nextIndex: index + 1,
          };
        }
      }
      content += char;
      index++;
    }
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "define" });
  }

  const { value, nextIndex } = readIdentifier(input, start + 1);
  if (!value) {
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "define" });
  }
  return {
    token: { type: "defineReference", name: value, braced: false },
    nextIndex,
  };
}

class ExpressionParser {
  index = 0;

  constructor(
    readonly tokens: Token[],
    readonly sourceText: string,
  ) {}

  parseExpression(minPrecedence = 0): ExpressionNode {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();
      if (!token || token.type !== "operator" || !isBinaryOperator(token.value)) {
        break;
      }
      const precedence = binaryPrecedence[token.value];
      if (precedence < minPrecedence) {
        break;
      }
      this.consume();
      const nextMinPrecedence = precedence + 1;
      const next = this.peek();
      if (this.isAtEnd() || (next?.type === "identifier" && next.value === "function")) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "operand" },
          { message: `Missing right operand for operator '${token.value}'.` },
        );
      }
      const right = this.parseExpression(nextMinPrecedence);
      left = {
        type: "binary",
        operator: token.value,
        left,
        right,
      };
    }

    return left;
  }

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  parsePrefix(): ExpressionNode {
    const token = this.peek();
    if (!token) {
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "operand" });
    }
    if (token.type === "operator" && isUnaryOperator(token.value)) {
      this.consume();
      return {
        type: "unary",
        operator: token.value,
        argument: this.parsePrefix(),
      };
    }
    return this.parsePostfix(this.parsePrimary());
  }

  parsePrimary(): ExpressionNode {
    if (this.peek()?.type === "dot") {
      const firstSpan = this.peek()?.span;
      let name = "";
      while (this.match({ type: "dot" })) {
        name += ".";
      }
      const token = this.consume();
      if (token?.type === "identifier") {
        return {
          type: "identifier",
          name: name + token.value,
          ...(firstSpan && {
            span: createSourceSpan(firstSpan.start, token.span!.end, firstSpan.line),
          }),
        };
      }
      if (token?.type === "literal" && /^\d+$/.test(token.value)) {
        return {
          type: "identifier",
          name: name + token.value,
          ...(firstSpan && {
            span: createSourceSpan(firstSpan.start, token.span!.end, firstSpan.line),
          }),
        };
      }
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "member" });
    }
    const token = this.consume();
    if (!token) {
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "operand" });
    }
    switch (token.type) {
      case "expression":
        return token.node;
      case "literal": {
        const numericValue = parseLiteralValue(token.value);
        return {
          type: "literal",
          value: token.value,
          ...(Number.isFinite(numericValue) && { numericValue }),
          ...(token.span && { span: token.span }),
        };
      }
      case "string":
        return {
          type: "string",
          value: token.value,
          quote: token.quote,
          ...(token.span && { span: token.span }),
        };
      case "defineReference":
        return token.braced
          ? {
              type: "defineReference",
              content: token.content,
              braced: true,
              ...(token.span && { span: token.span }),
            }
          : {
              type: "defineReference",
              name: token.name,
              braced: false,
              ...(token.span && { span: token.span }),
            };
      case "identifier":
        return { type: "identifier", name: token.value, ...(token.span && { span: token.span }) };
      case "lparen": {
        const next = this.peek();
        if (next?.type === "identifier" && next.value === "function") {
          throw new ExpressionSyntaxError(
            { kind: "invalid", reason: "operand" },
            { message: "Empty parenthesized expression." },
          );
        }
        const expression = this.parseExpression();
        this.expect("rparen");
        return { ...expression, parenthesized: true };
      }
      case "comma":
      case "dot":
      case "lbracket":
      case "operator":
      case "rbracket":
      case "rparen":
        break;
    }
    throw new ExpressionSyntaxError(
      { kind: "invalid", reason: "operand" },
      { message: `Invalid number: ${this.sourceText.slice(token.offset ?? 0)}` },
    );
  }

  parsePostfix(expression: ExpressionNode): ExpressionNode {
    let current = expression;
    while (true) {
      if (this.match({ type: "lparen" })) {
        if (current.type !== "identifier") {
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
        }
        current = {
          type: "call",
          callee: current,
          arguments: this.parseCallArguments(),
        };
        continue;
      }
      if (this.match({ type: "dot" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
        }
        const property = this.consume();
        if (!property || property.type !== "identifier") {
          throw new ExpressionSyntaxError({ kind: "invalid", reason: "member" });
        }
        current = {
          type: "member",
          object: current,
          property: {
            type: "identifier",
            name: property.value,
            ...(property.span && { span: property.span }),
          },
        };
        continue;
      }
      if (this.match({ type: "lbracket" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
        }
        const indexExpression = this.parseExpression();
        this.expect("rbracket");
        current = {
          type: "index",
          object: current,
          index: indexExpression,
        };
        continue;
      }
      return current;
    }
  }

  parseCallArguments(): ExpressionNode[] {
    const args: ExpressionNode[] = [];
    if (this.match({ type: "rparen" })) {
      return args;
    }
    do {
      args.push(this.parseExpression());
    } while (this.match({ type: "comma" }));
    this.expect("rparen");
    return args;
  }

  /**
   * Expects a value.
   * @param {Token["type"]} type The type.
   */
  expect(type: Token["type"]): void {
    const token = this.consume();
    if (!token || token.type !== type) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "delimiter" },
        {
          message:
            type === "rbracket" ? "Mismatched brackets in struct index" : "Mismatched parentheses.",
        },
      );
    }
  }

  match(expected: Pick<Token, "type">): boolean {
    const token = this.peek();
    if (token && token.type === expected.type) {
      this.index++;
      return true;
    }
    return false;
  }

  consume(): Token | undefined {
    const token = this.tokens[this.index];
    this.index++;
    return token;
  }

  peek(): Token | undefined {
    return this.tokens[this.index];
  }
}

/**
 * Checks whether an operator is a binary operator.
 * @param {UnaryOperator | BinaryOperator} value The operator to check.
 * @returns {boolean} `true` when the operator is a binary operator.
 */
function isBinaryOperator(value: UnaryOperator | BinaryOperator): value is BinaryOperator {
  return value in binaryPrecedence;
}
