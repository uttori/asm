import { InstructionResolutionFrame, } from "./ir/resolved-instruction.js";
/**
 * Adapt a public string-entry host after parsing. Both preparation and execution use fresh
 * frames and node evaluation; no legacy operand classifier participates in form selection.
 */
export function runTypedEncoderEntry(context, encoder, instruction, emit) {
    const stage = context.branches.enforceResolvedLabels() ? "emitProgram" : "resolveLayout";
    const evaluation = {
        evaluate: (expression) => context.operands.getnum(expression),
        reference: (expression, cursor = context.sizing.getCurrentAddress()) => {
            try {
                let value;
                if (expression.type === "relativeReference" && expression.stream === "relative") {
                    const spelling = (expression.direction === 1 ? "+" : "-").repeat(expression.count);
                    value =
                        expression.direction === 1
                            ? context.branches.findNextLabel(spelling, cursor)
                            : context.branches.findPreviousLabel(spelling, cursor);
                }
                else {
                    value = context.operands.getnum(expression);
                }
                return { kind: "resolved", value };
            }
            catch (cause) {
                return { kind: "error", error: cause instanceof Error ? cause : new Error(String(cause)) };
            }
        },
        error: (message) => context.diagnostics.error(message),
        currentAddress: () => context.sizing.getCurrentAddress(),
        stage: () => stage,
        stageIdentity: () => context,
    };
    let preparation;
    if (encoder.prepare) {
        const frame = new InstructionResolutionFrame(instruction, evaluation);
        try {
            encoder.prepare(frame);
            preparation = frame.snapshot();
        }
        finally {
            frame.close();
        }
    }
    const frame = new InstructionResolutionFrame(instruction, evaluation, preparation);
    try {
        return emit ? encoder.encode(frame, context) : encoder.estimate(frame);
    }
    finally {
        frame.close();
    }
}
//# sourceMappingURL=typed-encoder-entry.js.map