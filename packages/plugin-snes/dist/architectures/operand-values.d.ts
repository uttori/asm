import { type InstructionResolutionFrame } from "@uttori/asm-core";
import type { ExpansionPlan } from "./operand-plans.js";
/** Numeric width facts copied into a frame snapshot, never retained by immutable syntax. */
export interface OperandExpansion {
    length: number;
    generated: boolean;
    value: number;
    flattened: boolean;
}
/** Speculative width reads swallow errors, as unresolved operands must survive definition collection. */
export declare function expandOperandPlan(plan: ExpansionPlan, frame: InstructionResolutionFrame): OperandExpansion;
/** The final reader diagnoses noncanonical generated values without executing generated hexadecimal text. */
export declare function generatedValue(value: number): number;
/** Validate portable frame data before reusing observations from the preparation phase. */
export declare function isOperandExpansion(value: unknown): value is OperandExpansion;
/** Store width observations as four scalars per operand; scalar syntax remains on the immutable AST. */
export declare function chooseOperandPreparation(frame: InstructionResolutionFrame, form: string, parts: readonly OperandExpansion[]): void;
/** Absent preparation is valid for direct encoder invocations; malformed snapshots are rejected. */
export declare function preparedParts(frame: InstructionResolutionFrame): readonly OperandExpansion[] | undefined;
//# sourceMappingURL=operand-values.d.ts.map