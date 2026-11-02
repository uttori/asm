import type { RelocationEncoding } from "../relocatable.js";
import type { LinkExpression } from "./link-expression.js";
import type { OperandScalar } from "./parsed-operand.js";
import type { InstructionResolutionFrame, TypedEncoderContext } from "./resolved-instruction.js";
import type { SyntaxValue } from "./source-syntax.js";
/** Shared section-relative sizing/emission path. Targets own form selection and field semantics. */
export declare class RelocatableInstruction {
    readonly frame: InstructionResolutionFrame;
    readonly context?: TypedEncoderContext | undefined;
    private readonly parts;
    private size;
    constructor(frame: InstructionResolutionFrame, context?: TypedEncoderContext | undefined);
    /** Opcode bytes are completely known before placement; symbolic opcode/register choices are rejected. */
    opcode(...values: number[]): this;
    /** Retain an operand's pure expression and its target-owned encoding contract. */
    field(value: OperandScalar | LinkExpression, encoding: RelocationEncoding): this;
    /** Relative PC anchors are assigned after the entire instruction size is known. */
    finish(form: string, state?: SyntaxValue): number;
}
//# sourceMappingURL=relocatable-instruction.d.ts.map