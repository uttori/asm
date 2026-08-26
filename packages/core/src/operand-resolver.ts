import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode } from "./ir/expression-node.js";
import {
  isReferenceExpressionNode,
  renderExpressionNode,
  renderReferenceExpressionNode,
} from "./ir/expression-node.js";
import { parseOperandSyntax } from "./operand-syntax.js";

export type OperandResolverDependencies = {
  resolveDefines(input: string): string;
  isStructReference(input: string): boolean;
  resolveStructLabel(input: string): number;
  tryResolveLabel(input: string, requireStatic: boolean): number | undefined;
  resolveLabel(input: string, requireStatic: boolean): number;
  evaluateMath(input: string | ExpressionNode): number;
  shouldDeferExpressionEvaluation(): boolean;
  getCurrentAddress(): number;
  requireStaticLabelLookup(): boolean;
};

let debug = (..._: unknown[]) => {};
/* c8 ignore next */
try {
  const { default: d } = await import("debug");
  debug = d("OperandResolver");
} catch {}

export class OperandResolver {
  constructor(readonly deps: OperandResolverDependencies) {}

  /**
   * Normalizes numeric base member.
   * @param {string} operand The operand.
   * @returns {string} The result.
   */
  normalizeNumericBaseMember(operand: string): string {
    // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored alternatives have distinct prefixes.
    const match = operand.trim().match(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i);
    if (!match) {
      return operand;
    }

    const [, immediatePrefix, literal, indexSuffix = ""] = match;
    return `${immediatePrefix}${literal}${indexSuffix}`;
  }

  /**
   * Splits math operand suffix.
   * @param {string} operand The operand.
   * @returns {{ expression: string; suffix: string }} The result.
   */
  splitMathOperandSuffix(operand: string): { expression: string; suffix: string } {
    const trimmed = operand.trim();
    const indexedMatch = trimmed.match(/^(.+?)(\s*,\s*[sxy])$/i);
    // `(dp,x)` / `[dp]` end in `)`, so they do not match. `(bank&$FF0000)+$03,x`
    // does, and must drop `,x` before math eval or the leftover comma errors.
    if (!indexedMatch) {
      return { expression: trimmed, suffix: "" };
    }

    return {
      expression: indexedMatch[1].trim(),
      suffix: indexedMatch[2],
    };
  }

  /**
   * Checks whether numeric token.
   * @param {string} token The token.
   * @returns {boolean} The result.
   */
  isNumericToken(token: string): boolean {
    return /^-?\d+$/.test(token) || /^\$[\dA-Fa-f]+$/.test(token) || /^%[01]+$/.test(token);
  }

  /**
   * Resolves arithmetic token.
   * @param {string} token The token.
   * @returns {number} The result.
   */
  resolveArithmeticToken(token: string): number {
    if (this.isNumericToken(token)) {
      return this.getnum(token);
    }

    if (token.includes(".") && this.deps.isStructReference(token)) {
      return this.deps.resolveStructLabel(token);
    }

    return this.deps.resolveLabel(token, false);
  }

  /**
   * Attempts to resolve simple arithmetic.
   * @param {string} operand The operand.
   * @returns {number | null} The result.
   */
  tryResolveSimpleArithmetic(operand: string): number | null {
    const tokenPattern = "([.A-Z_a-z][\\w.]*|-?\\d+|\\$[\\dA-Fa-f]+|%[01]+)";
    const match = operand.match(
      new RegExp(`^${tokenPattern}\\s*(<<|>>|[+\\-])\\s*${tokenPattern}$`),
    );
    if (!match) {
      return null;
    }

    const [, leftToken, operator, rightToken] = match;
    if (this.isNumericToken(leftToken) && this.isNumericToken(rightToken)) {
      return null;
    }
    const leftValue = this.resolveArithmeticToken(leftToken);
    const rightValue = this.resolveArithmeticToken(rightToken);

    switch (operator) {
      case "+":
        return leftValue + rightValue;
      case "-":
        return leftValue - rightValue;
      case "<<":
        return leftValue << rightValue;
      case ">>":
        return leftValue >> rightValue;
      default:
        return null;
    }
  }

  /**
   * Determines value length.
   * @param {string | number} value The value.
   * @returns {number} The result.
   */
  determineValueLength(value: string | number): number {
    debug("determineValueLength", value);
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid value type for length determination: ${typeof value}`);
    }
    if (Number.isNaN(value)) {
      throw new Error(`Invalid value for length determination: ${value}`);
    }
    if (typeof value === "string" && value.trim() === "") {
      return 1;
    }
    let hexString: string;
    if (typeof value === "number") {
      hexString = value.toString(16).toUpperCase();
    } else if (value.startsWith("$")) {
      hexString = value.substring(1);
    } else {
      hexString = value;
    }

    return Math.max(1, Math.ceil(hexString.length / 2));
  }

  /**
   * Checks whether math expression.
   * @param {string} expression The expression.
   * @returns {boolean} The result.
   */
  isMathExpression(expression: string): boolean {
    if (!expression || typeof expression !== "string") {
      return false;
    }
    if (/^[A-Z_a-z]\w*\s*\(/.test(expression.trim())) {
      return true;
    }
    return (
      expression.includes("+") ||
      expression.includes("-") ||
      expression.includes("*") ||
      expression.includes("/") ||
      expression.includes("&") ||
      expression.includes("|") ||
      expression.includes("^") ||
      expression.includes("<<") ||
      expression.includes(">>")
    );
  }

  /**
   * Attempts to resolve label in operand.
   * @param {string} operand The operand.
   * @returns {string} The result.
   */
  tryResolveLabelInOperand(operand: string): string {
    debug("tryResolveLabelInOperand", operand);

    if (operand.startsWith("#")) {
      const inner = operand.substring(1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        const labelValue = this.deps.tryResolveLabel(inner, false);
        if (labelValue !== undefined) {
          return "#$" + labelValue.toString(16).toUpperCase();
        }
      }
      return operand;
    }

    if (operand.startsWith("[") && operand.endsWith("]")) {
      const inner = operand.substring(1, operand.length - 1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        const labelValue = this.deps.tryResolveLabel(inner, false);
        if (labelValue !== undefined) {
          return "[$" + labelValue.toString(16).toUpperCase() + "]";
        }
      }
      return operand;
    }

    if (operand.includes(",")) {
      const lastCommaIndex = operand.lastIndexOf(",");
      const basePart = operand.substring(0, lastCommaIndex).trim();
      const indexPart = operand.substring(lastCommaIndex).trim();

      if (!basePart.match(/^[\d$%(]/)) {
        const labelValue = this.deps.tryResolveLabel(basePart, false);
        if (labelValue !== undefined) {
          return "$" + labelValue.toString(16).toUpperCase() + indexPart;
        }
      }
      return operand;
    }

    if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
      const labelValue = this.deps.tryResolveLabel(operand, false);
      if (labelValue !== undefined) {
        return "$" + labelValue.toString(16).toUpperCase();
      }
    }

    return operand;
  }

  /**
   * Gets num.
   * @param {string | ExpressionNode} operand The operand.
   * @returns {number} The result.
   */
  getnum(operand: string | ExpressionNode): number {
    debug("getnum", operand);
    if (typeof operand !== "string") {
      return this.getnumFromNode(operand);
    }
    operand = operand.trim();
    operand = this.normalizeNumericBaseMember(operand);

    if (/^-?\d+$/.test(operand)) {
      return parseInt(operand, 10);
    }
    if (/^\$[\dA-Fa-f]+$/.test(operand)) {
      return parseInt(operand.substring(1), 16);
    }
    if (/^%[01]+$/.test(operand)) {
      return parseInt(operand.substring(1), 2);
    }

    operand = this.deps.resolveDefines(operand);

    if (operand.startsWith("#")) {
      operand = operand.substring(1).trim();
    }

    operand = this.normalizeNumericBaseMember(operand);

    if (/^[A-Z_a-z]\w*\s*\(/.test(operand)) {
      try {
        return this.deps.evaluateMath(operand);
      } catch (error) {
        if (this.deps.shouldDeferExpressionEvaluation()) {
          debug("function expression deferred until final pass", { operand, error });
          return 0;
        }
        throw error;
      }
    }

    const simpleArithmetic = this.tryResolveSimpleArithmetic(operand);
    if (simpleArithmetic !== null) {
      return simpleArithmetic;
    }

    if (!operand.match(/^[\d$%]/)) {
      if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
        if (this.deps.isStructReference(operand)) {
          return this.deps.resolveStructLabel(operand);
        }
        // Compound struct references also appear inside arithmetic
        // expressions such as `obj_start+obj[19].base`. Let those fall
        // through to math evaluation instead of treating the whole string as
        // a single unresolved label token.
        if (!this.isMathExpression(operand)) {
          return this.deps.resolveLabel(operand, false);
        }
      }
      if (/^\w+$/.test(operand) && this.deps.isStructReference(operand)) {
        return this.deps.resolveStructLabel(operand);
      }
      if (/^\w+$/.test(operand)) {
        return this.deps.resolveLabel(operand, false);
      }
    }

    try {
      return this.deps.evaluateMath(operand);
    } catch (error: unknown) {
      if (this.deps.shouldDeferExpressionEvaluation()) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        debug("expression deferred until final pass", { operand, error: errorMessage });
        return 0;
      }
      throw error;
    }
  }

  /**
   * Gets num from node.
   * @param {ExpressionNode} operand The operand.
   * @returns {number} The result.
   */
  getnumFromNode(operand: ExpressionNode): number {
    if (isReferenceExpressionNode(operand)) {
      if (operand.type === "defineReference") {
        return this.getnum(this.deps.resolveDefines(renderExpressionNode(operand)));
      }
      const reference = renderReferenceExpressionNode(operand, {
        renderIndex: (node) => this.getnum(node).toString(),
      });
      return this.resolveReferenceValue(reference);
    }

    switch (operand.type) {
      case "range":
        throw new Error(
          `Range expression is not a numeric operand: ${renderExpressionNode(operand)}`,
        );
      default:
        try {
          return this.deps.evaluateMath(operand);
        } catch (error: unknown) {
          if (this.deps.shouldDeferExpressionEvaluation()) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            debug("expression node deferred until final pass", { operand, error: errorMessage });
            return 0;
          }
          throw error;
        }
    }
  }

  /**
   * Resolves reference value.
   * @param {string} reference The reference.
   * @returns {number} The result.
   */
  resolveReferenceValue(reference: string): number {
    if (reference.indexOf(".") !== -1 || reference.indexOf("[") !== -1) {
      if (this.deps.isStructReference(reference)) {
        return this.deps.resolveStructLabel(reference);
      }
      if (!this.isMathExpression(reference)) {
        return this.deps.resolveLabel(reference, false);
      }
    }
    if (/^\w+$/.test(reference)) {
      return this.deps.resolveLabel(reference, false);
    }
    return this.getnum(reference);
  }

  /**
   * Expands operand.
   * @param {string} operand The operand.
   * @returns {ExpandedOperand} The result.
   */
  expandOperand(operand: string): ExpandedOperand {
    debug("expandOperand", operand);
    const raw = operand.trim();
    const syntax = parseOperandSyntax(raw);
    if (!operand) {
      return { raw, expanded: "", length: 2, syntax };
    }

    let expanded = raw;
    let expectedLength = 2;

    if (/^\++$/.test(expanded) || /^-+$/.test(expanded) || expanded === "?+" || expanded === "?-") {
      return { raw, expanded, length: 2, syntax };
    }

    try {
      expanded = this.deps.resolveDefines(expanded);
    } catch (error) {
      debug("expandOperand not a define", error);
    }

    if (this.deps.isStructReference(expanded)) {
      expanded = `$${this.deps.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
    }

    expanded = this.normalizeNumericBaseMember(expanded);

    expanded = this.tryResolveLabelInOperand(expanded);

    if (expanded.startsWith("#")) {
      const inner = expanded.substring(1).trim();
      if (this.isMathExpression(inner)) {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug("failed to evaluate immediate expression", inner, error);
        }
      } else if (inner.startsWith("$")) {
        expectedLength = this.determineValueLength(inner.substring(1));
      } else {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug("failed to evaluate immediate expression", inner, error);
        }
      }
    } else if (expanded.includes(",")) {
      if (expanded.startsWith("$")) {
        const hexPart = expanded.substring(1, expanded.indexOf(","));
        expectedLength = this.determineValueLength(hexPart);
      }
    } else if (expanded.startsWith("[") && expanded.endsWith("]")) {
      expectedLength = 2;
    } else if (expanded.startsWith("$")) {
      expectedLength = this.determineValueLength(expanded.substring(1));
    } else {
      expectedLength = 2;
    }

    const isRelativeLabelPlaceholder = /^\++$/.test(expanded) || /^-+$/.test(expanded);
    if (!isRelativeLabelPlaceholder && this.isMathExpression(expanded)) {
      try {
        const { expression, suffix } = this.splitMathOperandSuffix(expanded);
        const resolvedValue = this.deps.resolveDefines(expression);
        const result = this.deps.evaluateMath(resolvedValue);
        if (!Number.isNaN(result)) {
          expanded = "$" + result.toString(16).toUpperCase() + suffix;
          expectedLength = this.determineValueLength(result);
        }
      } catch (error) {
        debug("math evaluation skipped for expression", expanded, error);
      }
    }

    return { raw, expanded, length: expectedLength, syntax };
  }

  /**
   * Lowers operand.
   * @param {string} operand The operand.
   * @returns {LoweredOperand} The result.
   */
  lowerOperand(operand: string): LoweredOperand {
    const raw = operand.trim();
    const expandedOperand = this.expandOperand(raw);
    const { expanded, length } = expandedOperand;
    const syntax = expandedOperand.syntax ?? parseOperandSyntax(raw);
    return {
      mode: "unknown",
      baseExpression: expanded,
      raw,
      expanded,
      length,
      indexRegister: syntax.indexRegister,
      immediate: syntax.immediate,
      indirect: syntax.indirect,
    };
  }

  /**
   * Returns the current logical address without applying architecture policy.
   * @returns {number} Current logical address.
   */
  getCurrentAddress(): number {
    return this.deps.getCurrentAddress();
  }
}
