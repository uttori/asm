import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./ir/expression-node.js";
import { isReferenceExpressionNode, renderExpressionNode, renderReferenceExpressionNode } from "./ir/expression-node.js";

export type OperandResolverDependencies = {
  resolveDefines(input: string): string;
  resolveStructLabel(input: string): number;
  resolveLabel(input: string, requireStatic: boolean): number;
  hasLabel(input: string): boolean;
  evaluateMath(input: string | ExpressionNode): number;
  getPass(): number;
  requireStaticLabelLookup(): boolean;
};

let debug = (..._: unknown[]) => {};
/* c8 ignore next */
try {
  const { default: d } = await import("debug");
  debug = d("OperandResolver");
} catch {}

/**
 *
 * @param {ExpressionNode} expression The expression to convert to a string.
 * @returns {string} The string representation of the expression.
 */
function expressionNodeToString(expression: ExpressionNode): string {
  return renderExpressionNode(expression);
}

export class OperandResolver {
  constructor(readonly deps: OperandResolverDependencies) {}

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

    const hexString = typeof value === "number"
      ? value.toString(16).toUpperCase()
      : (value.startsWith("$") ? value.substring(1) : value);

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
    return expression.includes("+") ||
      expression.includes("-") ||
      expression.includes("*") ||
      expression.includes("/") ||
      expression.includes("&") ||
      expression.includes("|") ||
      expression.includes("^") ||
      expression.includes("<<") ||
      expression.includes(">>");
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
      } catch (error) {
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

    if (/^[A-Z_a-z]\w*\s*\(/.test(operand)) {
      try {
        return this.deps.evaluateMath(operand);
      } catch (error) {
        if (this.deps.getPass() < 2) {
          debug("function expression deferred until final pass", { operand, error });
          return 0;
        }
        throw error;
      }
    }

    if (!operand.match(/^[\d$%]/)) {
      if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
        try {
          return this.deps.resolveStructLabel(operand);
        } catch {
          return this.deps.resolveLabel(operand, false);
        }
      }
      if (/^\w+$/.test(operand)) {
        return this.deps.resolveLabel(operand, false);
      }
    }

    try {
      return this.deps.evaluateMath(operand);
    } catch (error) {
      if (this.deps.getPass() < 2) {
        debug("expression deferred until final pass", { operand, error });
        return 0;
      }
      throw error;
    }
  }

  getnumFromNode(operand: ExpressionNode): number {
    if (isReferenceExpressionNode(operand)) {
      if (operand.type === "defineReference") {
        return this.getnum(this.deps.resolveDefines(expressionNodeToString(operand)));
      }
      return this.resolveReferenceValue(this.renderReference(operand));
    }

    switch (operand.type) {
      case "range":
        throw new Error(`Range expression is not a numeric operand: ${expressionNodeToString(operand)}`);
      default:
        try {
          return this.deps.evaluateMath(operand);
        } catch (error) {
          if (this.deps.getPass() < 2) {
            debug("expression node deferred until final pass", { operand, error });
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
        return this.deps.resolveLabel(reference, false);
      }
    }
    return this.deps.resolveLabel(reference, false);
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

    if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
      forceTwoBytes = true;
    }

    expanded = this.tryResolveLabelInOperand(expanded);

    if (expanded.startsWith("#")) {
      const inner = expanded.substring(1).trim();
      if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
        forceTwoBytes = true;
      }
      if (inner.startsWith("$")) {
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
        const resolvedValue = this.deps.resolveDefines(expanded);
        const result = this.deps.evaluateMath(resolvedValue);
        if (!Number.isNaN(result)) {
          expanded = "$" + result.toString(16).toUpperCase();
          expectedLength = this.determineValueLength(result, forceTwoBytes);
        }
      } catch (error) {
        debug("math evaluation skipped for expression", expanded, error);
      }
    }

    if (forceTwoBytes) {
      expectedLength = 2;
    }

    return { expanded, length: expectedLength };
  }

  lowerOperand(operand: string): LoweredOperand {
    const raw = operand.trim();
    const { expanded, length } = this.expandOperand(raw);
    const lowered = expanded.toLowerCase();
    const indexMatch = expanded.match(/,\s*([sxy])$/i);
    const indexRegister = indexMatch ? indexMatch[1].toLowerCase() as "x" | "y" | "s" : undefined;
    const normalizedExpanded = expanded.trim();
    const normalizedUpper = normalizedExpanded.toUpperCase();
    const explicitDirectPage = /^\$[\da-f]{1,2}$/i.test(raw);
    const explicitDirectPageIndexedX = /^\$[\da-f]{1,2},x$/i.test(raw);
    let mode: LoweredOperand["mode"] = "unknown";
    let baseExpression = expanded;
    let registerName: string | undefined;

    const registerOperandMatch = normalizedUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/);
    const registerIndirectMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)$/);
    const registerIndirectAutoIncrementMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)\+$/);
    const directPageIndexedXIndirectMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\+\s*X\s*\)$/i);
    const directPageIndirectIndexedYMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\)\s*\+\s*Y$/i);
    const bitAddressMatch = normalizedExpanded.match(/^(\$[\da-f]+)\.([0-7])$/i);

    if (registerOperandMatch) {
      mode = "register";
      registerName = registerOperandMatch[1].toLowerCase();
      baseExpression = normalizedExpanded;
    } else if (registerIndirectAutoIncrementMatch) {
      mode = "registerIndirectAutoIncrement";
      registerName = registerIndirectAutoIncrementMatch[1].toLowerCase();
      baseExpression = registerIndirectAutoIncrementMatch[1];
    } else if (registerIndirectMatch) {
      mode = "registerIndirect";
      registerName = registerIndirectMatch[1].toLowerCase();
      baseExpression = registerIndirectMatch[1];
    } else if (directPageIndexedXIndirectMatch) {
      mode = "directPageIndexedXIndirect";
      baseExpression = directPageIndexedXIndirectMatch[1].trim();
    } else if (directPageIndirectIndexedYMatch) {
      mode = "directPageIndirectIndexedY";
      baseExpression = directPageIndirectIndexedYMatch[1].trim();
    } else if (bitAddressMatch) {
      mode = bitAddressMatch[1].length <= 3 ? "directPageBit" : "absoluteBit";
      baseExpression = bitAddressMatch[1].toUpperCase();
    }

    if (mode === "unknown" && expanded.startsWith("#")) {
      mode = "immediate";
      baseExpression = expanded.slice(1).trim();
    } else if (mode === "unknown" && /^\$[\da-f]{6},x$/i.test(expanded)) {
      mode = "absoluteLongIndexedX";
      baseExpression = expanded.slice(0, -2).trim();
    } else if (mode === "unknown" && /^\$[\da-f]{4},x$/i.test(expanded)) {
      mode = "absoluteIndexedX";
      baseExpression = expanded.slice(0, -2).trim();
    } else if (mode === "unknown" && /^\$[\da-f]{4},y$/i.test(expanded)) {
      mode = "absoluteIndexedY";
      baseExpression = expanded.slice(0, -2).trim();
    } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith(",x)")) {
      mode = "indexedIndirectX";
      baseExpression = expanded.slice(1, -3).trim();
    } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith(")")) {
      mode = "directPageIndirect";
      baseExpression = expanded.slice(1, -1).trim();
    } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith(",s),y")) {
      mode = "stackRelativeIndexedIndirectY";
      baseExpression = expanded.slice(1, -6).trim();
    } else if (mode === "unknown" && lowered.endsWith(",s")) {
      mode = "stackRelative";
      baseExpression = expanded.slice(0, -2).trim();
    } else if (mode === "unknown" && lowered.startsWith("[") && lowered.endsWith("],y")) {
      mode = "indirectLongIndexedY";
      baseExpression = expanded.slice(1, -3).trim();
    } else if (mode === "unknown" && lowered.startsWith("[") && lowered.endsWith("]")) {
      mode = "indirectLong";
      baseExpression = expanded.slice(1, -1).trim();
    } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith("),y")) {
      mode = "indirectIndexedY";
      baseExpression = expanded.slice(1, -3).trim();
    } else if (mode === "unknown" && lowered.endsWith(",x")) {
      mode = "directPageIndexedX";
      baseExpression = expanded.slice(0, -2).trim();
    } else if (mode === "unknown" && /^\$[\da-f]{6}$/i.test(expanded)) {
      mode = "absoluteLong";
      baseExpression = expanded;
    } else if (mode === "unknown" && /^\$[\da-f]{4}$/i.test(expanded)) {
      mode = "absolute";
      baseExpression = expanded;
    }
    return {
      mode,
      baseExpression,
      registerName,
      explicitDirectPage,
      explicitDirectPageIndexedX,
      raw,
      expanded,
      length,
      indexRegister,
      immediate: expanded.startsWith("#"),
      indirect: expanded.startsWith("(") || expanded.startsWith("["),
    };
  }
}
