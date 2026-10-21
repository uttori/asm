import type { ExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";
import type { ParsedInstructionOperands } from "./parsed-operand.js";
/**
 * Project scalar syntax onto its physical occurrence without reparsing or evaluating it.
 * Registers and addressing punctuation are excluded by the target grammar. Generated syntax
 * whose spelling no longer matches its source retains coarse provenance instead of guessed ranges.
 */
export declare function instructionReferenceExpressions(syntax: ParsedInstructionOperands, command: NormalizedCommand): ExpressionNode[];
//# sourceMappingURL=instruction-references.d.ts.map