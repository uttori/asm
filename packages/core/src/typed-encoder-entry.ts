import type { ArchitectureEncoderContext } from "./architecture-types.js";
import {
  InstructionResolutionFrame,
  type ParsedInstruction,
  type TypedArchitectureEncoder,
} from "./ir/resolved-instruction.js";

export function runTypedEncoderEntry(
  context: ArchitectureEncoderContext,
  encoder: TypedArchitectureEncoder,
  instruction: ParsedInstruction,
  emit: true,
): boolean;
export function runTypedEncoderEntry(
  context: ArchitectureEncoderContext,
  encoder: TypedArchitectureEncoder,
  instruction: ParsedInstruction,
  emit: false,
): number;
/**
 * Adapt a public string-entry host after parsing. Both preparation and execution use fresh
 * frames and node evaluation; no legacy operand classifier participates in form selection.
 */
export function runTypedEncoderEntry(
  context: ArchitectureEncoderContext,
  encoder: TypedArchitectureEncoder,
  instruction: ParsedInstruction,
  emit: boolean,
): number | boolean {
  const stage = context.branches.enforceResolvedLabels() ? "emitProgram" : "resolveLayout";
  const evaluation = {
    evaluate: (expression: import("./ir/expression-node.js").ExpressionNode) =>
      context.operands.getnum(expression),
    reference: (
      expression: import("./ir/expression-node.js").ReferenceExpressionNode,
      cursor = context.sizing.getCurrentAddress(),
    ): import("./ir/reference-path.js").ReferenceResolution => {
      try {
        let value: number;
        if (expression.type === "relativeReference" && expression.stream === "relative") {
          const spelling = (expression.direction === 1 ? "+" : "-").repeat(expression.count);
          value =
            expression.direction === 1
              ? context.branches.findNextLabel(spelling, cursor)
              : context.branches.findPreviousLabel(spelling, cursor);
        } else {
          value = context.operands.getnum(expression);
        }
        return { kind: "resolved", value };
      } catch (cause) {
        return { kind: "error", error: cause instanceof Error ? cause : new Error(String(cause)) };
      }
    },
    error: (message: string) => context.diagnostics.error(message),
    currentAddress: () => context.sizing.getCurrentAddress(),
    stage: () => stage,
    stageIdentity: () => context,
  } as const;
  let preparation: import("./ir/resolved-instruction.js").ResolvedInstruction | undefined;
  if (encoder.prepare) {
    const frame = new InstructionResolutionFrame(instruction, evaluation);
    try {
      encoder.prepare(frame);
      preparation = frame.snapshot();
    } finally {
      frame.close();
    }
  }
  const frame = new InstructionResolutionFrame(instruction, evaluation, preparation);
  try {
    return emit ? encoder.encode(frame, context) : encoder.estimate(frame);
  } finally {
    frame.close();
  }
}
