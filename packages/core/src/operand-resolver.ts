import { parseDirectiveExpression } from "./ir/directive-arguments.js";
import {
  isReferenceExpressionNode,
  renderExpressionNode,
  type ExpressionNode,
  type ReferenceExpressionNode,
} from "./ir/expression-node.js";
import type { ReferenceResolution } from "./ir/reference-path.js";

/** Borrowed session bindings; parsed syntax never stores resolved addresses or pass-local values. */
export type OperandResolverDependencies = {
  resolveReference(input: ReferenceExpressionNode): ReferenceResolution;
  evaluateMath(input: ExpressionNode): number;
  shouldDeferExpressionEvaluation(): boolean;
  getCurrentAddress(): number;
};

/** Numeric operand evaluation. Target grammars own addressing forms and lexical width intent. */
export class OperandResolver {
  private readonly parsedInputs = new Map<string, ExpressionNode>();

  constructor(readonly deps: OperandResolverDependencies) {}

  /** Release public-entry syntax when an assembly snapshot ends. */
  clearParsedOperands(): void {
    this.parsedInputs.clear();
  }

  /** Public string callers enter the same grammar used by numeric source directives. */
  getnum(input: string | ExpressionNode): number {
    if (typeof input !== "string") {
      return this.getnumFromNode(input);
    }
    const text = input.trim().replace(/^#\s*/, "");
    let node = this.parsedInputs.get(text);
    if (!node) {
      node = parseDirectiveExpression(text);
      this.parsedInputs.set(text, node);
    }
    return this.getnumFromNode(node);
  }

  /** Resolve the current occurrence, preserving deferred failures during definition/layout stages. */
  getnumFromNode(operand: ExpressionNode): number {
    if (operand.type === "raw") {
      throw new Error("Raw expression nodes are not executable; parse source before evaluation.");
    }
    if (operand.type === "literal" && Number.isInteger(operand.numericValue)) {
      return operand.numericValue!;
    }
    if (isReferenceExpressionNode(operand)) {
      const result = this.deps.resolveReference(operand);
      if (result.kind === "resolved") {
        return result.value;
      }
      if (result.kind === "missing") {
        if (result.deferred) {
          return 0;
        }
        throw new Error(`Error: Label '${result.name}' not found.`);
      }
      if (this.deps.shouldDeferExpressionEvaluation()) {
        return 0;
      }
      throw result.error;
    }
    if (operand.type === "range") {
      throw new Error(
        `Range expression is not a numeric operand: ${renderExpressionNode(operand)}`,
      );
    }
    try {
      return this.deps.evaluateMath(operand);
    } catch (error) {
      if (this.deps.shouldDeferExpressionEvaluation()) {
        return 0;
      }
      throw error;
    }
  }

  /** Current logical byte address, without target-specific mapping. */
  getCurrentAddress(): number {
    return this.deps.getCurrentAddress();
  }
}
