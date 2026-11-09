import { clonePluginSyntax } from "../plugin/syntax-snapshot.js";
import { createTextSpan } from "../source-location.js";
import { compactExpressionSpans, locateContinuedExpression } from "./expression-occurrence.js";
/**
 * Project scalar syntax onto its physical occurrence without reparsing or evaluating it.
 * Registers and addressing punctuation are excluded by the target grammar. Generated syntax
 * whose spelling no longer matches its source retains coarse provenance instead of guessed ranges.
 */
export function instructionReferenceExpressions(syntax, command) {
    if (syntax.operands.length === 0) {
        return [];
    }
    const text = command.parsed.opcodeOperands?.operandText ?? "";
    const physical = command.source.physical?.text ?? command.source.raw;
    const mnemonic = command.source.tokenSpans.at(0);
    const offset = mnemonic?.end ?? physical.indexOf(command.keyword) + command.keyword.length;
    const at = physical.indexOf(text, offset);
    const positions = at < 0 ? locateContinuedExpression(text, physical, offset) : undefined;
    const result = [];
    const add = (scalar) => {
        const semantic = scalar.referenceExpression ?? scalar.expression;
        // Literal operands cannot contribute a symbol occurrence. Avoid copying their spans
        // on every assembly pass, especially register/immediate-heavy coprocessor programs.
        if (semantic.type === "literal" ||
            semantic.type === "string" ||
            semantic.type === "relativeReference") {
            return;
        }
        // Occurrence projection owns this copy; cached semantic nodes must stay location-neutral.
        const expression = clonePluginSyntax(semantic);
        compactExpressionSpans(expression, (span) => {
            const start = scalar.span.start + span.start;
            const end = scalar.span.start + span.end;
            if (at >= 0) {
                return createTextSpan(physical, at + start, at + end, command.source.line);
            }
            const first = positions?.[start];
            const last = positions?.[end - 1];
            if (first !== undefined && last !== undefined) {
                return createTextSpan(physical, first, last + 1, command.source.line);
            }
            return { start: span.start, end: span.end };
        });
        result.push(expression);
    };
    const operands = syntax.operands.flatMap((operand) => operand.kind === "template" ? operand.structure.operands : [operand]);
    for (const operand of operands) {
        if (operand.kind === "immediate") {
            add(operand.value);
        }
        if (operand.kind === "memory") {
            if (!("kind" in operand.address)) {
                add(operand.address);
            }
            if (operand.bit) {
                add(operand.bit.selector);
            }
        }
    }
    return result;
}
//# sourceMappingURL=instruction-references.js.map