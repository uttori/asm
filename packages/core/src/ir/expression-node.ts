import { createSourceSpan, type SourceSpan } from "../source-location.js";

type ExpressionNodeBase = {
  span?: SourceSpan;
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
  | RawExpressionNode;

export type IdentifierExpressionNode = ExpressionNodeBase & {
  type: "identifier";
  name: string;
};

export type LiteralExpressionNode = ExpressionNodeBase & {
  type: "literal";
  value: string;
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
function attachRootSpan(node: ExpressionNode, text: string): ExpressionNode {
  if (!node.span) {
    node.span = createSourceSpan(0, text.length);
  }
  return node;
}

/**
 * Parses a minimal expression node used by the early IR/tree stages.
 * @param {string} input The expression source text.
 * @returns {ExpressionNode} The parsed expression node.
 */
export function parseExpressionNode(input: string): ExpressionNode {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: "raw", value: "", span: createSourceSpan(0, 0) };
  }

  // Immediate addressing (`#label`, `#label>>8`) is not part of the
  // expression language; strip it so the inner expression still parses.
  if (trimmed.startsWith("#") && trimmed.length > 1) {
    return parseExpressionNode(trimmed.slice(1));
  }

  const rangeIndex = findTopLevelRange(trimmed);
  if (rangeIndex !== -1) {
    return attachRootSpan(
      {
        type: "range",
        start: parseExpressionNode(trimmed.slice(0, rangeIndex)),
        end: parseExpressionNode(trimmed.slice(rangeIndex + 2)),
      },
      trimmed,
    );
  }

  try {
    const tokens = tokenizeExpression(trimmed);
    const parser = new ExpressionParser(tokens);
    const expression = parser.parseExpression();
    if (!parser.isAtEnd()) {
      return { type: "raw", value: trimmed, span: createSourceSpan(0, trimmed.length) };
    }
    return attachRootSpan(expression, trimmed);
  } catch {
    return { type: "raw", value: trimmed, span: createSourceSpan(0, trimmed.length) };
  }
}

/**
 * Renders an expression node back into a source-like string.
 * @param {ExpressionNode} node The expression node to render.
 * @returns {string} The rendered expression text.
 */
export function renderExpressionNode(node: ExpressionNode): string {
  if (isReferenceExpressionNode(node)) {
    return renderReferenceExpressionNode(node);
  }

  switch (node.type) {
    case "literal":
      return node.value;
    case "string":
      return `${node.quote}${node.value}${node.quote}`;
    case "raw":
      return node.value;
    case "call":
      return `${node.callee.name}(${node.arguments.map(renderExpressionNode).join(", ")})`;
    case "unary":
      return `${node.operator}${renderExpressionNode(node.argument)}`;
    case "binary":
      return `${renderExpressionNode(node.left)} ${node.operator} ${renderExpressionNode(node.right)}`;
    case "range":
      return `${renderExpressionNode(node.start)}..${renderExpressionNode(node.end)}`;
    default:
      return "";
  }
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
      return true;
    case "member":
    case "index":
      return isReferenceExpressionNode(node.object);
    default:
      return false;
  }
}

type RenderReferenceExpressionOptions = {
  renderIndex?: (node: ExpressionNode) => string;
};

/**
 * Renders a reference-expression subtree back into a source-like string.
 * @param {ReferenceExpressionNode} node The reference node to render.
 * @param {RenderReferenceExpressionOptions} [options] Optional rendering overrides.
 * @returns {string} The rendered reference text.
 */
export function renderReferenceExpressionNode(
  node: ReferenceExpressionNode,
  options: RenderReferenceExpressionOptions = {},
): string {
  switch (node.type) {
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

  const node = parseExpressionNode(source);
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

/**
 * Splits function-call arguments without breaking nested calls or quoted strings.
 * @param {string} input The function argument list.
 * @returns {string[]} The split argument expressions.
 */
type Token =
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
  | { type: "rbracket" };

const binaryPrecedence: Record<BinaryOperator, number> = {
  "||": 0,
  "&&": 1,
  "==": 2,
  "=": 2,
  "!=": 2,
  "<": 2,
  ">": 2,
  "<=": 2,
  ">=": 2,
  "|": 3,
  "^": 3,
  "&": 3,
  "<<": 3,
  ">>": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "%": 5,
  "**": 6,
};

const unaryOperators = new Set<UnaryOperator>(["<:", "<", ">", "^", "~", "-", "+"]);
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
function tokenizeExpression(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "dot" });
      index++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket" });
      index++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket" });
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      const { value, nextIndex, quote } = readQuotedString(input, index);
      tokens.push({ type: "string", value, quote });
      index = nextIndex;
      continue;
    }

    const operator =
      (input.startsWith("<:", index) ? "<:" : undefined) ??
      binaryOperators.find((candidate) => input.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      index += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input, index);
      tokens.push(token);
      index = nextIndex;
      continue;
    }

    if (char === "@" || /[A-Z_a-z]/.test(char)) {
      const { value, nextIndex } = readIdentifier(input, index);
      tokens.push({ type: "identifier", value });
      index = nextIndex;
      continue;
    }
    if (char === "$") {
      const match = input.slice(index).match(/^\$[\dA-Fa-f]+/);
      if (!match) {
        throw new Error("Invalid hex literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (char === "%") {
      const match = input.slice(index).match(/^%[01]+/);
      if (!match) {
        throw new Error("Invalid binary literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (/\d/.test(char)) {
      // oxlint-disable-next-line security/detect-unsafe-regex -- The match is anchored at the lexer cursor.
      const match = input.slice(index).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
      if (!match) {
        throw new Error("Invalid numeric literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }

    throw new Error(`Unexpected token '${char}'`);
  }

  return tokens;
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
  const quote = input[start] as '"' | "'";
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
  throw new Error("Unterminated string literal");
}

/**
 * Reads an identifier from the source text.
 * @param {string} input The source text.
 * @param {number} start The starting offset.
 * @returns {{ value: string; nextIndex: number }} The identifier value and next index.
 */
function readIdentifier(input: string, start: number): { value: string; nextIndex: number } {
  let index = start;
  // If the identifier starts with an @, skip it
  if (input[index] === "@") {
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
    throw new Error("Unterminated braced define reference");
  }

  const { value, nextIndex } = readIdentifier(input, start + 1);
  if (!value) {
    throw new Error("Expected define reference name");
  }
  return {
    token: { type: "defineReference", name: value, braced: false },
    nextIndex,
  };
}

class ExpressionParser {
  index = 0;

  constructor(readonly tokens: Token[]) {}

  /**
   * Parses expression.
   * @param {number} [minPrecedence] The minimum binary-operator precedence.
   * @returns {ExpressionNode} The result.
   */
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
      const nextMinPrecedence = token.value === "**" ? precedence : precedence + 1;
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

  /**
   * Checks whether at end.
   * @returns {boolean} The result.
   */
  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  /**
   * Parses prefix.
   * @returns {ExpressionNode} The result.
   */
  parsePrefix(): ExpressionNode {
    const token = this.peek();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    if (token.type === "operator" && unaryOperators.has(token.value as UnaryOperator)) {
      this.consume();
      return {
        type: "unary",
        operator: token.value as UnaryOperator,
        argument: this.parsePrefix(),
      };
    }
    return this.parsePostfix(this.parsePrimary());
  }

  /**
   * Parses primary.
   * @returns {ExpressionNode} The result.
   */
  parsePrimary(): ExpressionNode {
    if (this.peek()?.type === "dot") {
      let name = "";
      while (this.match({ type: "dot" })) {
        name += ".";
      }
      const token = this.consume();
      if (token?.type === "identifier") {
        return { type: "identifier", name: name + token.value };
      }
      if (token?.type === "literal" && /^\d+$/.test(token.value)) {
        return { type: "identifier", name: name + token.value };
      }
      throw new Error("Expected label name after '.'");
    }
    const token = this.consume();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    switch (token.type) {
      case "literal":
        return { type: "literal", value: token.value };
      case "string":
        return { type: "string", value: token.value, quote: token.quote };
      case "defineReference":
        return token.braced
          ? { type: "defineReference", content: token.content, braced: true }
          : { type: "defineReference", name: token.name, braced: false };
      case "identifier":
        return { type: "identifier", name: token.value };
      case "lparen": {
        const expression = this.parseExpression();
        this.expect("rparen");
        return expression;
      }
      default:
        throw new Error(`Unexpected token ${token.type}`);
    }
  }

  /**
   * Parses postfix.
   * @param {ExpressionNode} expression The expression.
   * @returns {ExpressionNode} The result.
   */
  parsePostfix(expression: ExpressionNode): ExpressionNode {
    let current = expression;
    while (true) {
      if (this.match({ type: "lparen" })) {
        if (current.type !== "identifier") {
          throw new Error("Only identifier call expressions are currently supported");
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
          throw new Error("Member access requires a reference expression");
        }
        const property = this.consume();
        if (!property || property.type !== "identifier") {
          throw new Error("Expected member name after '.'");
        }
        current = {
          type: "member",
          object: current,
          property: { type: "identifier", name: property.value },
        };
        continue;
      }
      if (this.match({ type: "lbracket" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new Error("Index access requires a reference expression");
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

  /**
   * Parses call arguments.
   * @returns {ExpressionNode[]} The result.
   */
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
      throw new Error(`Expected token ${type}`);
    }
  }

  /**
   * Matches a value.
   * @param {Pick<Token, "type">} expected The expected.
   * @returns {boolean} The result.
   */
  match(expected: Pick<Token, "type">): boolean {
    const token = this.peek();
    if (token && token.type === expected.type) {
      this.index++;
      return true;
    }
    return false;
  }

  /**
   * Consumes a value.
   * @returns {Token | undefined} The result.
   */
  consume(): Token | undefined {
    const token = this.tokens[this.index];
    this.index++;
    return token;
  }

  /**
   * Gets the next a value.
   * @returns {Token | undefined} The result.
   */
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
