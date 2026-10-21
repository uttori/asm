import {
  isReferenceExpressionNode,
  parseExpressionNode,
  type ExpressionNode,
  type OperandScalar,
} from "@uttori/asm-core";

/** Syntax-time policy for width inference. No instruction execution interprets source spelling. */
export interface ExpansionPlan {
  readonly scalar: OperandScalar;
  /** A failed whole-fragment binding affects only scalar components containing a template. */
  readonly unbound: boolean;
  /** Attribution spelling only; execution consumes scalar.expression. */
  readonly display: string;
  readonly index?: string;
  readonly immediate: boolean;
  readonly relative: boolean;
  readonly math?: OperandScalar;
  readonly probe?: OperandScalar;
  /** Byte count from lexical hex digits; decimal atoms otherwise retain the default absolute width. */
  readonly hexWidth?: number;
  readonly directHex: boolean;
  /** Pure expressions are read again at encoding; calls retain their classification result. */
  readonly native: boolean;
  readonly force?: 1 | 2 | 3;
}
/** Split only physical operand separators; punctuation inside expressions stays in its tree. */
export function operandParts(text: string): { text: string; start: number }[] {
  const result: { text: string; start: number }[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const append = (end: number) => {
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) {
      result.push({ text: trimmed, start: start + raw.length - raw.trimStart().length });
    }
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i++;
      } else if (ch === quote) {
        quote = "";
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
    } else if (ch === ")" || ch === "]") {
      depth--;
    } else if (ch === "," && depth === 0) {
      append(i);
      start = i + 1;
    }
  }
  append(text.length);
  return result;
}
/** Calls prevent reuse across classification and encoding, including calls inside reference indexes. */
function containsCall(node: ExpressionNode): boolean {
  if (node.type === "call") {
    return true;
  }
  if (node.type === "binary") {
    return containsCall(node.left) || containsCall(node.right);
  }
  if (node.type === "unary") {
    return containsCall(node.argument);
  }
  if (node.type === "index") {
    return containsCall(node.object) || containsCall(node.index);
  }
  if (node.type === "member") {
    return containsCall(node.object);
  }
  return false;
}
/** Preserve lexical width independently of the numeric expression and later generated values. */
export function operandScalarSyntax(text: string, start: number, force?: 1 | 2 | 3): OperandScalar {
  const expression = parseExpressionNode(text);
  let spelling: OperandScalar["width"]["spelling"] = "expression";
  let literalBytes: number | undefined;
  if (expression.type === "literal" && !expression.parenthesized) {
    if (text.startsWith("$")) {
      spelling = "hex";
      literalBytes = Math.max(1, Math.ceil((text.length - 1) / 2));
    } else if (text.startsWith("%")) {
      spelling = "binary";
      literalBytes = Math.max(1, Math.ceil((text.length - 1) / 8));
    } else if (!text.startsWith("0x")) {
      spelling = "decimal";
    }
  } else if (isReferenceExpressionNode(expression)) {
    spelling = "symbol";
  }
  return {
    expression,
    span: { start, end: start + text.length },
    width: {
      spelling,
      grouped: expression.parenthesized === true,
      ...(literalBytes ? { literalBytes } : {}),
      ...(force ? { forcedBytes: force } : {}),
    },
  };
}
/** Compile the established lexical width and evaluation schedule before entering any assembly stage. */
export function expansionPlan(input: string, start: number): ExpansionPlan {
  let text = input.trim();
  const prefix = /^([afz]):\s*/i.exec(text);
  let force: 1 | 2 | 3 | undefined;
  if (prefix) {
    if (prefix[1].toLowerCase() === "z") {
      force = 1;
    } else if (prefix[1].toLowerCase() === "a") {
      force = 2;
    } else {
      force = 3;
    }
    text = text.slice(prefix[0].length);
    start += prefix[0].length;
  }
  // Numeric .base members are identity projections, not symbolic field lookups.
  // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored alternatives have distinct prefixes.
  text = text.replace(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i, "$1$2$3");
  const immediate = text.startsWith("#");
  const body = immediate ? text.slice(1).trim() : text;
  const suffix = !immediate ? /^(.*),\s*([sxy])$/i.exec(body) : null;
  const expressionText = suffix ? suffix[1].trim() : body;
  const numeric = operandScalarSyntax(expressionText, start + text.indexOf(expressionText), force);
  const mathematicalScalar = numeric;
  const relative = /^(?:\?[+-]|:?\++|:?-+)$/.test(text);
  const mathematical = /^[A-Z_a-z]\w*\s*\(/.test(body) || /[&*+/^|-]|<<|>>/.test(body);
  let probeText = body;
  if (text.startsWith("[") && text.endsWith("]")) {
    probeText = text.slice(1, -1).trim();
  } else if (!immediate && text.includes(",")) {
    probeText = text.slice(0, text.lastIndexOf(",")).trim();
  }
  let probe: OperandScalar | undefined;
  if (!/^[\d$%(]/.test(probeText) && !probeText.includes(",")) {
    const candidate = operandScalarSyntax(probeText, start + text.indexOf(probeText));
    if (
      isReferenceExpressionNode(candidate.expression) &&
      candidate.expression.type !== "relativeReference"
    ) {
      probe = candidate;
    }
  }
  let hexWidth: number | undefined;
  if (body.startsWith("$")) {
    const atom = body.slice(1).split(",")[0];
    hexWidth = Math.max(1, Math.ceil(atom.length / 2));
  }
  const groupedAtom =
    numeric.expression.parenthesized &&
    (isReferenceExpressionNode(numeric.expression) ||
      (numeric.expression.type === "literal" && numeric.expression.value.includes(".")));
  const native =
    !relative &&
    !/^[([]/.test(text) &&
    !/^[aq]$/i.test(text) &&
    numeric.expression.type !== "error" &&
    numeric.expression.type !== "range" &&
    numeric.expression.type !== "template" &&
    !containsCall(numeric.expression) &&
    !groupedAtom;
  // Numeric grouped dotted atoms historically resolve as label names; mathematical
  // grouping retains its separate tree and rounding semantics.
  let numericScalar = numeric;
  if (groupedAtom && expressionText.includes(".") && !mathematical) {
    numericScalar = { ...numeric, expression: { type: "identifier", name: expressionText } };
  }
  return {
    scalar: numericScalar,
    unbound: /![\w{]|<[^>]+>|\\[A-Z_a-z]/.test(input),
    display: expressionText,
    ...(suffix ? { index: suffix[2].toLowerCase() } : {}),
    immediate,
    relative,
    directHex: body.startsWith("$"),
    native,
    ...(force ? { force } : {}),
    ...(hexWidth ? { hexWidth } : {}),
    ...(probe ? { probe } : {}),
    ...(mathematical && !relative ? { math: mathematicalScalar } : {}),
  };
}

/**
 * Share immutable syntax for repeated instruction text within one plugin environment.
 * The bounded cache owns no symbols, values or source-file coordinates; all spans are operand-local.
 */
export function cachedOperandGrammar<
  T extends import("@uttori/asm-core").ParsedInstructionOperands,
>(parse: (mnemonic: string, text: string) => T): (mnemonic: string, text: string) => T {
  const cache = new Map<string, T>();
  return (mnemonic, text) => {
    const key = JSON.stringify([mnemonic, text]);
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }
    const syntax = parse(mnemonic, text);
    freeze(syntax);
    // FIFO retention bounds uncommon generated forms without retaining an assembly session.
    if (cache.size === 256) {
      cache.delete(cache.keys().next().value!);
    }
    cache.set(key, syntax);
    return syntax;
  };
}

/** Freeze only freshly parsed data; shared syntax must never retain execution mutations. */
function freeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    freeze(child);
  }
}
