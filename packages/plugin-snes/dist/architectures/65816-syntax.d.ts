import type { ParsedInstructionOperands, OperandScalar, ParsedOperand } from "@uttori/asm-core";
import { type ExpansionPlan } from "./operand-plans.js";
/** Lexical facts retained separately from stage-local values and processor flags. */
export interface Syntax65816 extends ParsedInstructionOperands {
    readonly cpu65816: {
        readonly kind: "cpu65816-v2";
        readonly mnemonic: string;
        readonly width?: number;
        readonly suffixError?: string;
        readonly whole: ExpansionPlan;
        readonly parts: readonly ExpansionPlan[];
        readonly scalar: OperandScalar;
        readonly wholeScalar: OperandScalar;
        readonly display: string;
        readonly original: string;
        readonly innerDisplay: string;
        readonly shape?: ParsedOperand;
        readonly hasOperand: boolean;
        /** Expressions follow M/X state; literal spellings retain their authored immediate width. */
        readonly stateImmediate: boolean;
        readonly numericSpelling: boolean;
        readonly explicitLong: boolean;
        /** Bank extraction retains the established word-sized immediate policy. */
        readonly bankWord: boolean;
        readonly indexedLabel: boolean;
        /** Generated labels may encode a program bank before their value resolves. */
        readonly hintedBank?: number;
        readonly hexDigits?: number;
        /** Decimal-prefix interpretation used by implied repeat pseudo instructions. */
        readonly impliedRepeat?: number;
    };
}
/** Parse all punctuation and compatibility policies before entering the instruction runtime. */
export declare function parse65816Operands(mnemonic: string, text: string): Syntax65816;
/** Reject foreign grammar payloads, including detached worker copies. */
export declare function syntax65816(value: ParsedInstructionOperands): Syntax65816;
//# sourceMappingURL=65816-syntax.d.ts.map