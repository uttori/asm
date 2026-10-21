import type { ParsedInstructionOperands, OperandScalar } from "@uttori/asm-core";
import { type ExpansionPlan } from "./operand-plans.js";
/** Source-only register recognition and numeric slots; no execution method parses these spellings. */
export interface SuperFxOperand {
    readonly register: number | null;
    readonly indirectRegister: number | null;
    readonly immediate: boolean;
    readonly indirect: boolean;
    /** Exactly two hex digits denote an encoded displacement; other forms denote a target. */
    readonly rawOffset: boolean;
    readonly scalar: OperandScalar;
    readonly display: string;
    readonly expansion: ExpansionPlan;
}
/** Portable target grammar and ordered numeric observation plans. */
export interface SuperFxSyntax extends ParsedInstructionOperands {
    readonly superfx: {
        readonly kind: "superfx-v2";
        readonly mnemonic: string;
        readonly parts: readonly SuperFxOperand[];
        readonly whole: ExpansionPlan;
    };
}
/** Compile register, address-unit and branch-spelling distinctions once at the source boundary. */
export declare function parseSuperFxOperands(mnemonic: string, text: string): SuperFxSyntax;
/** Syntax tags are checked at the public typed boundary, including after portable copies. */
export declare function superFxSyntax(value: ParsedInstructionOperands): SuperFxSyntax;
//# sourceMappingURL=superfx-syntax.d.ts.map