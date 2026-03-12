import type { ExpandedOperand } from "./architecture-types.js";

export type OperandResolverDependencies = {
  resolveDefines(input: string): string;
  resolveStructLabel(input: string): number;
  resolveLabel(input: string, requireStatic: boolean): number;
  hasLabel(input: string): boolean;
  evaluateMath(input: string): number;
  getPass(): number;
  requireStaticLabelLookup(): boolean;
};

let debug = (..._: unknown[]) => {};
/* c8 ignore next */
try {
  const { default: d } = await import("debug");
  debug = d("OperandResolver");
} catch {}

export class OperandResolver {
  constructor(private readonly deps: OperandResolverDependencies) {}

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

  getnum(operand: string): number {
    debug("getnum", operand);
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
}
