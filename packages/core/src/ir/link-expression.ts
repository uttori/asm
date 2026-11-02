import type { BinaryOperator, ExpressionNode, ReferenceExpressionNode } from "./expression-node.js";

/** Link-time integer syntax. It contains no source templates, session objects, or effectful calls. */
export type LinkExpression =
  | { readonly kind: "constant"; readonly value: number }
  | { readonly kind: "symbol"; readonly name: string; readonly module?: string }
  | {
      readonly kind: "section";
      readonly module: string;
      readonly section: string;
      readonly offset: number;
    }
  | {
      readonly kind: "unary";
      readonly operator: "-" | "~" | "low" | "high" | "bank";
      readonly argument: LinkExpression;
    }
  | {
      readonly kind: "binary";
      readonly operator: BinaryOperator;
      readonly left: LinkExpression;
      readonly right: LinkExpression;
    };

/** Assembly-owned name/template binding; only literal evaluation may borrow the numeric evaluator. */
export interface LinkExpressionContext {
  /** Lowers a symbol, member, index or relative reference to a link-time term. */
  reference(expression: ReferenceExpressionNode): LinkExpression;
  /** Term for the current location, used by `*` and `pc()`. */
  current(): LinkExpression;
  /** Evaluates a literal or string leaf to its numeric value. */
  literal(expression: ExpressionNode): number;
  /** Substitutes a define or template node; returning undefined or the same node rejects it as unbound. */
  bind?(expression: ExpressionNode): ExpressionNode;
  /** Expand pure source functions or resolve assembly-owned metadata; unknown/effectful calls stay rejected. */
  call?(
    expression: Extract<ExpressionNode, { type: "call" }>,
    compile: (node: ExpressionNode) => LinkExpression,
  ): LinkExpression | undefined;
}

/** Link arithmetic uses safe integers and truncating division; overflow is always an error. */
export function linkInteger(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Link expression requires a safe integer: ${value}`);
  }
  return value;
}

/** Create an owned scalar, rejecting fractional/non-finite values at the assembly boundary. */
export function linkConstant(value: number): LinkExpression {
  return { kind: "constant", value: linkInteger(value) };
}

/** Fold only placement-independent operations; addresses remain symbolic until the linker assigns them. */
export function linkBinary(
  operator: BinaryOperator,
  left: LinkExpression,
  right: LinkExpression,
): LinkExpression {
  if (
    operator === "-" &&
    left.kind === "section" &&
    right.kind === "section" &&
    left.module === right.module &&
    left.section === right.section
  ) {
    return linkConstant(left.offset - right.offset);
  }
  if (left.kind !== "constant" || right.kind !== "constant") {
    return { kind: "binary", operator, left, right };
  }
  const a = left.value;
  const b = right.value;
  let value: number;
  switch (operator) {
    case "+":
      value = a + b;
      break;
    case "-":
      value = a - b;
      break;
    case "*":
      value = a * b;
      break;
    case "/":
    case "%":
      if (b === 0) {
        throw new Error("Division by zero in link expression.");
      }
      value = operator === "/" ? Math.trunc(a / b) : a % b;
      break;
    case "**":
      value = a ** b;
      break;
    case "<<":
    case ">>":
      if (b < 0 || b > 52) {
        throw new Error("Link expression shift must be in 0..52.");
      }
      value = Number(operator === "<<" ? BigInt(a) << BigInt(b) : BigInt(a) >> BigInt(b));
      break;
    case "&":
      value = Number(BigInt(a) & BigInt(b));
      break;
    case "|":
      value = Number(BigInt(a) | BigInt(b));
      break;
    case "^":
      value = Number(BigInt(a) ^ BigInt(b));
      break;
    case "<":
      value = Number(a < b);
      break;
    case ">":
      value = Number(a > b);
      break;
    case "<=":
      value = Number(a <= b);
      break;
    case ">=":
      value = Number(a >= b);
      break;
    case "=":
    case "==":
      value = Number(a === b);
      break;
    case "!=":
      value = Number(a !== b);
      break;
    case "&&":
      value = Number(a !== 0 && b !== 0);
      break;
    case "||":
      value = Number(a !== 0 || b !== 0);
      break;
  }
  return linkConstant(value);
}

/** Extraction is explicit, so masking a bank byte cannot be confused with a checked near address. */
export function linkUnary(
  operator: "-" | "~" | "low" | "high" | "bank",
  argument: LinkExpression,
): LinkExpression {
  if (argument.kind !== "constant") {
    return { kind: "unary", operator, argument };
  }
  const value = argument.value;
  if (operator === "-") {
    return linkConstant(-value);
  }
  if (operator === "~") {
    return linkConstant(Number(~BigInt(value)));
  }
  let shift = 0;
  if (operator === "high") {
    shift = 8;
  }
  if (operator === "bank") {
    shift = 16;
  }
  return linkConstant(Number((BigInt(value) >> BigInt(shift)) & 255n));
}

/** Lower expanded assembly syntax into a pure, portable expression without looking up provisional addresses. */
export function compileLinkExpression(
  expression: ExpressionNode,
  context: LinkExpressionContext,
  depth = 0,
): LinkExpression {
  if (depth > 128) {
    throw new Error("Link expression nesting exceeds 128.");
  }
  const compile = (node: ExpressionNode): LinkExpression =>
    compileLinkExpression(node, context, depth + 1);
  switch (expression.type) {
    case "literal":
    case "string":
      return linkConstant(context.literal(expression));
    case "identifier":
      if (expression.name === "*") {
        return context.current();
      }
      return context.reference(expression);
    case "member":
    case "index":
    case "relativeReference":
      return context.reference(expression);
    case "template":
    case "defineReference": {
      const bound = context.bind?.(expression);
      if (!bound || bound === expression) {
        throw new Error("Unbound template in link expression.");
      }
      return compile(bound);
    }
    case "binary": {
      const left = compile(expression.left);
      // Short-circuit folding matches evaluation after linking and avoids observing unreachable arithmetic.
      if (left.kind === "constant") {
        if (expression.operator === "&&" && left.value === 0) {
          return linkConstant(0);
        }
        if (expression.operator === "||" && left.value !== 0) {
          return linkConstant(1);
        }
      }
      return linkBinary(expression.operator, left, compile(expression.right));
    }
    case "unary": {
      const argument = compile(expression.argument);
      if (expression.operator === "+") {
        return argument;
      }
      if (expression.operator === "<") {
        return linkUnary("low", argument);
      }
      if (expression.operator === ">") {
        return linkUnary("high", argument);
      }
      if (expression.operator === "^" || expression.operator === "<:") {
        return linkUnary("bank", argument);
      }
      return linkUnary(expression.operator, argument);
    }
    case "call": {
      const name = expression.callee.name.toLowerCase();
      if (name === "pc" && expression.arguments.length === 0) {
        return context.current();
      }
      const extraction: Partial<Record<string, "low" | "high" | "bank">> = {
        low: "low",
        lobyte: "low",
        high: "high",
        hibyte: "high",
        bank: "bank",
        bankbyte: "bank",
      };
      if (extraction[name] && expression.arguments.length === 1) {
        return linkUnary(extraction[name], compile(expression.arguments[0]));
      }
      if ((name === "loword" || name === "hiword") && expression.arguments.length === 1) {
        let value = compile(expression.arguments[0]);
        if (name === "hiword") {
          value = linkBinary(">>", value, linkConstant(16));
        }
        return linkBinary("&", value, linkConstant(65535));
      }
      const resolved = context.call?.(expression, compile);
      if (resolved) {
        return resolved;
      }
      throw new Error(
        `Function '${name}' is unavailable in a link expression; evaluate it at assembly time.`,
      );
    }
    case "error":
    case "range":
    case "raw":
    case "sourceText":
    default:
      throw new Error(`Expression '${expression.type}' cannot be retained for linking.`);
  }
}

/** Reject size/preprocessing dependencies instead of substituting a provisional zero for an address. */
export function requireLinkConstant(expression: LinkExpression, purpose: string): number {
  if (expression.kind !== "constant") {
    throw new Error(`${purpose} must be an assembly-time constant.`);
  }
  return expression.value;
}
