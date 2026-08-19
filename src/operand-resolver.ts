import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./ir/expression-node.js";
import {
  isReferenceExpressionNode,
  renderExpressionNode,
  renderReferenceExpressionNode,
} from "./ir/expression-node.js";
import { classifyGenericOperand } from "./operand-classifiers.js";

export type OperandResolverDependencies = {
  resolveDefines(input: string): string;
  resolveStructLabel(input: string): number;
  resolveLabel(input: string, requireStatic: boolean): number;
  hasLabel(input: string): boolean;
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

  normalizeNumericBaseMember(operand: string): string {
    // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored alternatives have distinct prefixes.
    const match = operand.trim().match(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i);
    if (!match) {
      return operand;
    }

    const [, immediatePrefix, literal, indexSuffix = ""] = match;
    return `${immediatePrefix}${literal}${indexSuffix}`;
  }

  splitMathOperandSuffix(operand: string): { expression: string; suffix: string } {
    const trimmed = operand.trim();
    const indexedMatch = trimmed.match(/^(.+?)(\s*,\s*[sxy])$/i);
    if (!indexedMatch || trimmed.startsWith("(") || trimmed.startsWith("[")) {
      return { expression: trimmed, suffix: "" };
    }

    return {
      expression: indexedMatch[1].trim(),
      suffix: indexedMatch[2],
    };
  }

  isNumericToken(token: string): boolean {
    return /^-?\d+$/.test(token) || /^\$[\dA-Fa-f]+$/.test(token) || /^%[01]+$/.test(token);
  }

  isSameBankAddress(expanded: string): boolean {
    // oxlint-disable-next-line security/detect-unsafe-regex -- Hex width is bounded and the suffix is anchored.
    const match = expanded.trim().match(/^\$([\da-f]{5,6})(?:\s*,\s*[xy])?$/i);
    if (!match) {
      return false;
    }

    const value = parseInt(match[1], 16);
    const currentBank = (this.deps.getCurrentAddress() >>> 16) & 0xff;
    const targetBank = (value >>> 16) & 0xff;
    return currentBank === targetBank;
  }

  resolveArithmeticToken(token: string): number {
    if (this.isNumericToken(token)) {
      return this.getnum(token);
    }

    if (token.includes(".")) {
      try {
        const structValue = this.deps.resolveStructLabel(token);
        if (typeof structValue === "number" && !Number.isNaN(structValue)) {
          return structValue;
        }
      } catch {
        // Fall through to normal label resolution.
      }
      return this.deps.resolveLabel(token, false);
    }

    return this.deps.resolveLabel(token, false);
  }

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

  determineValueLength(value: string | number, forceTwoBytes?: boolean): number {
    debug("determineValueLength", value, forceTwoBytes);
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid value type for length determination: ${typeof value}`);
    }
    if (Number.isNaN(value)) {
      throw new Error(`Invalid value for length determination: ${value}`);
    }
    if (typeof value === "string" && value.trim() === "") {
      return 1;
    }
    if (forceTwoBytes) {
      return 2;
    }

    const hexString =
      typeof value === "number"
        ? value.toString(16).toUpperCase()
        : value.startsWith("$")
          ? value.substring(1)
          : value;

    if (hexString.length <= 2) {
      return 1;
    }
    if (hexString.length <= 4) {
      return 2;
    }
    return 3;
  }

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

  tryResolveLabelInOperand(operand: string): string {
    debug("tryResolveLabelInOperand", operand);

    if (operand.startsWith("#")) {
      const inner = operand.substring(1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.deps.resolveLabel(inner, false);
          if (labelValue !== 0 || this.deps.hasLabel(inner)) {
            return "#$" + labelValue.toString(16).toUpperCase();
          }
        } catch (error) {
          debug("label resolution failed for immediate", inner, error);
        }
      }
      return operand;
    }

    if (operand.startsWith("[") && operand.endsWith("]")) {
      const inner = operand.substring(1, operand.length - 1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.deps.resolveLabel(inner, false);
          if (labelValue !== 0 || this.deps.hasLabel(inner)) {
            return "[$" + labelValue.toString(16).toUpperCase() + "]";
          }
        } catch (error) {
          debug("label resolution failed for indirect", inner, error);
        }
      }
      return operand;
    }

    if (operand.includes(",")) {
      const lastCommaIndex = operand.lastIndexOf(",");
      const basePart = operand.substring(0, lastCommaIndex).trim();
      const indexPart = operand.substring(lastCommaIndex).trim();

      if (!basePart.match(/^[\d$%(]/)) {
        try {
          const labelValue = this.deps.resolveLabel(basePart, false);
          if (labelValue !== 0 || this.deps.hasLabel(basePart)) {
            return "$" + labelValue.toString(16).toUpperCase() + indexPart;
          }
        } catch (error) {
          debug("label resolution failed for indexed", basePart, error);
        }
      }
      return operand;
    }

    if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
      try {
        const labelValue = this.deps.resolveLabel(operand, false);
        if (labelValue !== 0 || this.deps.hasLabel(operand)) {
          return "$" + labelValue.toString(16).toUpperCase();
        }
      } catch (error: unknown) {
        debug("label resolution failed for direct", operand, error);
      }
    }

    return operand;
  }

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
        try {
          return this.deps.resolveStructLabel(operand);
        } catch {
          // Compound struct references also appear inside arithmetic
          // expressions such as `obj_start+obj[19].base`. Let those fall
          // through to math evaluation instead of treating the whole string as
          // a single unresolved label token.
          if (!this.isMathExpression(operand)) {
            return this.deps.resolveLabel(operand, false);
          }
        }
      }
      if (/^\w+$/.test(operand)) {
        try {
          return this.deps.resolveStructLabel(operand);
        } catch {
          // Bare struct identifiers such as `options` are valid base addresses
          // in indexed operands like `lda.w options,X`. Fall back to regular
          // label lookup when the token is not a struct name.
        }
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

  getnumFromNode(operand: ExpressionNode): number {
    if (isReferenceExpressionNode(operand)) {
      if (operand.type === "defineReference") {
        return this.getnum(this.deps.resolveDefines(renderExpressionNode(operand)));
      }
      return this.resolveReferenceValue(this.renderReference(operand));
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

  resolveReferenceValue(reference: string): number {
    if (reference.indexOf(".") !== -1 || reference.indexOf("[") !== -1) {
      try {
        return this.deps.resolveStructLabel(reference);
      } catch {
        if (!this.isMathExpression(reference)) {
          return this.deps.resolveLabel(reference, false);
        }
      }
    }
    if (/^\w+$/.test(reference)) {
      return this.deps.resolveLabel(reference, false);
    }
    return this.getnum(reference);
  }

  renderReference(expression: ReferenceExpressionNode): string {
    return renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.getnum(node).toString(),
    });
  }

  expandOperand(operand: string): ExpandedOperand {
    debug("expandOperand", operand);
    if (!operand) {
      return { expanded: "", length: 2 };
    }

    let expanded = operand.trim();
    let expectedLength = 2;
    let forceTwoBytes = false;

    if (/^\++$/.test(expanded) || /^-+$/.test(expanded) || expanded === "?+" || expanded === "?-") {
      return { expanded, length: 2 };
    }

    try {
      expanded = this.deps.resolveDefines(expanded);
    } catch (error) {
      debug("expandOperand not a define", error);
    }

    try {
      expanded = `$${this.deps.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
    } catch (error) {
      debug("expandOperand not a struct label", error);
    }

    expanded = this.normalizeNumericBaseMember(expanded);

    if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
      forceTwoBytes = true;
    }

    expanded = this.tryResolveLabelInOperand(expanded);

    if (expanded.startsWith("#")) {
      const inner = expanded.substring(1).trim();
      if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
        forceTwoBytes = true;
      }
      if (this.isMathExpression(inner)) {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value, forceTwoBytes);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug("failed to evaluate immediate expression", inner, error);
        }
      } else if (inner.startsWith("$")) {
        expectedLength = this.determineValueLength(inner.substring(1), forceTwoBytes);
      } else {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value, forceTwoBytes);
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
          expectedLength = this.determineValueLength(result, forceTwoBytes);
        }
      } catch (error) {
        debug("math evaluation skipped for expression", expanded, error);
      }
    }

    if (forceTwoBytes) {
      expectedLength = 2;
    }

    // Labels like `_048AD3,X` often resolve to a 24-bit numeric address, but
    // still target data in the current bank. Preserve the shorter absolute form
    // unless the source explicitly forced a long operand.
    if (expectedLength === 3 && this.isSameBankAddress(expanded)) {
      expectedLength = 2;
    }

    return { expanded, length: expectedLength };
  }

  lowerOperand(operand: string): LoweredOperand {
    const raw = operand.trim();
    const { expanded, length } = this.expandOperand(raw);
    return classifyGenericOperand({ raw, expanded, length });
  }
}
