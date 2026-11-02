import {
  isReferenceExpressionNode,
  parseExpressionNode,
  type ExpressionNode,
  type OperandScalar,
  type ParsedInstructionOperands,
  type ParsedOperand,
} from "@uttori/asm-core";
import { parseInstructionOperands } from "@uttori/asm-core/plugin";

/** Syntax-time policy for width inference. No instruction execution interprets source spelling. */
export interface ExpansionPlan {
  /** Primary operand expression classified for width inference. */
  readonly scalar: OperandScalar;
  /** A failed whole-fragment binding affects only scalar components containing a template. */
  readonly unbound: boolean;
  /** Attribution spelling only; execution consumes scalar.expression. */
  readonly display: string;
  /** Optional index-register spelling (`x` or `y`) attached to the operand. */
  readonly index?: string;
  /** True when the operand is an immediate (`#`) form. */
  readonly immediate: boolean;
  /** True when the operand is a branch-relative displacement. */
  readonly relative: boolean;
  /** Optional arithmetic overlay evaluated after the scalar. */
  readonly math?: OperandScalar;
  /** Optional width-probe expression that does not contribute emitted bytes. */
  readonly probe?: OperandScalar;
  /** Byte count from lexical hex digits; decimal atoms otherwise retain the default absolute width. */
  readonly hexWidth?: number;
  /** True when hex digits were written without `$` or `0x`. */
  readonly directHex: boolean;
  /** Pure expressions are read again at encoding; calls retain their classification result. */
  readonly native: boolean;
  /** Explicit byte width forced by a size suffix. */
  readonly force?: 1 | 2 | 3;
}
/** Shared operand structure plus immutable target-specific width and evaluation policy. */
export interface Syntax65xx extends ParsedInstructionOperands {
  /** Immutable 65xx width and evaluation policy attached to the parsed operands. */
  readonly policy65xx: {
    readonly kind: "65xx-v1";
    readonly mnemonic: string;
    readonly forcedWidth?: 1 | 2;
    readonly originalRegister?: "a" | "q";
    readonly whole: ExpansionPlan;
    readonly unboundOperands: readonly ParsedOperand[];
    readonly parts: readonly ExpansionPlan[];
    readonly inner?: ExpansionPlan;
    readonly hasOperand: boolean;
    readonly hexSpecialPage: boolean;
    /** Selected numeric spelling after addressing punctuation was parsed. */
    readonly scalarDisplay: string;
  };
}
const grammar = {
  registers: ["a", "q"],
  indexRegisters: ["x", "y", "z", "s"],
  commaIndex: true,
  ca65Widths: true,
};

/** Split only physical operand separators; punctuation inside expressions stays in its tree. */
function parts(text: string): { text: string; start: number }[] {
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
function scalar(text: string, start: number, force?: 1 | 2 | 3): OperandScalar {
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
function plan(input: string, start: number): ExpansionPlan {
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
  const numeric = scalar(expressionText, start + text.indexOf(expressionText), force);
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
    const candidate = scalar(probeText, start + text.indexOf(probeText));
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
/** Full 65xx grammar, including source-only policies needed to retain established effect ordering. */
export function parse65xxOperands(mnemonic: string, text: string): Syntax65xx {
  const common = parseInstructionOperands(mnemonic, text, grammar);
  const parsedMnemonic = /^([A-Z][\dA-Z]{2,4})(?:\.([BW]))?$/.exec(mnemonic.trim().toUpperCase());
  let forcedWidth: 1 | 2 | undefined;
  if (parsedMnemonic?.[2] === "B") {
    forcedWidth = 1;
  } else if (parsedMnemonic?.[2] === "W") {
    forcedWidth = 2;
  }
  const whole = plan(text, 0);
  const split = parts(text);
  // Keep unresolved structure for width/error precedence. Successful binding still reparses
  // the complete generated fragment because it may introduce commas or addressing wrappers.
  const unboundOperands =
    common.operands[0]?.kind === "template"
      ? common.operands[0].structure.operands
      : common.operands;
  const first = unboundOperands.at(0);
  let inner: ExpansionPlan | undefined;
  if (first?.kind === "memory" && !("kind" in first.address)) {
    const span = first.address.span;
    inner = plan(text.slice(span.start, span.end), span.start);
  }
  const register = text.trim().toLowerCase();
  const originalRegister = register === "a" || register === "q" ? register : undefined;
  const selected = operandScalar(first);
  const scalarDisplay =
    whole.native || !selected ? whole.display : text.slice(selected.span.start, selected.span.end);
  return {
    ...common,
    policy65xx: {
      kind: "65xx-v1",
      mnemonic: parsedMnemonic?.[1] ?? mnemonic.trim().toUpperCase(),
      ...(forcedWidth ? { forcedWidth } : {}),
      ...(originalRegister ? { originalRegister } : {}),
      whole,
      unboundOperands,
      scalarDisplay,
      parts: split.map((p) => plan(p.text, p.start)),
      ...(inner ? { inner } : {}),
      hasOperand: text.trim().length > 0,
      hexSpecialPage: /^(?:\$ff[\da-f]{2}|0xff[\da-f]{2})$/i.test(text.trim()),
    },
  };
}

/** Grammar identity checks keep foreign payloads out of the target's resolution code. */
export function syntax65xx(syntax: ParsedInstructionOperands): Syntax65xx {
  if (!has65xxPolicy(syntax)) {
    throw new Error("65xx encoder requires its registered operand grammar.");
  }
  return syntax;
}
/** Extract numeric syntax without reparsing addressing delimiters or register operands. */
export function operandScalar(operand: ParsedOperand | undefined): OperandScalar | undefined {
  if (operand?.kind === "immediate") {
    return operand.value;
  }
  if (operand?.kind === "memory" && !("kind" in operand.address)) {
    return operand.address;
  }
  return undefined;
}

/** The grammar tag survives portable syntax copies and distinguishes target-owned payloads. */
function has65xxPolicy(syntax: ParsedInstructionOperands): syntax is Syntax65xx {
  return (
    "policy65xx" in syntax &&
    typeof syntax.policy65xx === "object" &&
    syntax.policy65xx !== null &&
    "kind" in syntax.policy65xx &&
    syntax.policy65xx.kind === "65xx-v1"
  );
}
