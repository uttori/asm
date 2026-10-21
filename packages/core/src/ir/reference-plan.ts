import { incrementInternalCounter } from "../internal-instrumentation.js";
import type { ExpressionNode } from "./expression-node.js";
import { instructionReferenceExpressions } from "./instruction-references.js";
import type { NormalizedCommand } from "./normalized-command.js";
import type { ParsedInstructionOperands } from "./parsed-operand.js";

/** An observation leaf, or a struct path whose container still resolves in the current stage. */
type ReferenceLeaf = Extract<
  ExpressionNode,
  { type: "identifier" | "defineReference" | "member" | "index" | "call" }
>;

const EMPTY_REFERENCES: readonly ReferenceLeaf[] = Object.freeze([]);

/** Constants can be rejected without allocating a plan or retaining an otherwise useless weak entry. */
function hasReferences(node: ExpressionNode): boolean {
  switch (node.type) {
    case "identifier":
    case "defineReference":
    case "member":
    case "index":
    case "call":
      return true;
    case "unary":
      return hasReferences(node.argument);
    case "binary":
      return hasReferences(node.left) || hasReferences(node.right);
    case "range":
      return hasReferences(node.start) || hasReferences(node.end);
    case "literal":
    case "string":
    case "relativeReference":
    case "error":
    case "sourceText":
    case "template":
    case "raw":
      break;
  }
  return false;
}

/**
 * Syntax-only reference walks owned by one assembler. Plans retain original occurrences, never
 * resolved names, scope, values, or recorded metadata; replay still observes the current stage.
 * Weak keys let includes and generated fragments be reclaimed with their owning syntax.
 */
export class ReferencePlanner {
  private readonly expressions = new WeakMap<ExpressionNode, readonly ReferenceLeaf[]>();
  private readonly instructions = new WeakMap<
    NormalizedCommand,
    {
      operands: ParsedInstructionOperands;
      source: NormalizedCommand["source"];
      parsed: NormalizedCommand["parsed"];
      keyword: string;
      expressions: readonly ExpressionNode[];
    }
  >();

  /** Flatten only reference-bearing work; literal-only syntax needs no allocation or cache entry. */
  expression(expression: ExpressionNode): readonly ReferenceLeaf[] {
    switch (expression.type) {
      case "literal":
      case "string":
      case "relativeReference":
      case "error":
      case "sourceText":
      case "template":
      case "raw":
        return EMPTY_REFERENCES;
      case "identifier":
      case "defineReference":
      case "member":
      case "index":
      case "call":
      case "unary":
      case "binary":
      case "range":
        break;
    }
    const cached = this.expressions.get(expression);
    if (cached) {
      return cached;
    }
    if (!hasReferences(expression)) {
      return EMPTY_REFERENCES;
    }
    incrementInternalCounter("referencePlanBuilds");
    const result: ReferenceLeaf[] = [];
    const visit = (node: ExpressionNode): void => {
      switch (node.type) {
        case "identifier":
        case "defineReference":
        case "member":
        case "index":
          // Struct paths retain their ordered, stage-dependent container-name resolution.
          result.push(node);
          return;
        case "call":
          result.push(node);
          for (const argument of node.arguments) {
            visit(argument);
          }
          return;
        case "unary":
          visit(node.argument);
          return;
        case "binary":
          visit(node.left);
          visit(node.right);
          return;
        case "range":
          visit(node.start);
          visit(node.end);
          return;
        case "literal":
        case "string":
        case "relativeReference":
        case "error":
        case "sourceText":
        case "template":
        case "raw":
          return;
      }
    };
    visit(expression);
    const plan = result.length ? result : EMPTY_REFERENCES;
    this.expressions.set(expression, plan);
    return plan;
  }

  /** Reuse physical projection only while both target grammar syntax and source occurrence match. */
  instruction(
    operands: ParsedInstructionOperands,
    command: NormalizedCommand,
  ): readonly ExpressionNode[] {
    const cached = this.instructions.get(command);
    if (
      cached?.operands === operands &&
      cached.source === command.source &&
      cached.parsed === command.parsed &&
      cached.keyword === command.keyword
    ) {
      return cached.expressions;
    }
    incrementInternalCounter("instructionReferencePlanBuilds");
    const projected = instructionReferenceExpressions(operands, command);
    const expressions = projected.length ? projected : EMPTY_REFERENCES;
    this.instructions.set(command, {
      operands,
      source: command.source,
      parsed: command.parsed,
      keyword: command.keyword,
      expressions,
    });
    return expressions;
  }
}
