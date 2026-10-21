import type { ParsedInstructionOperands, ParsedOperand, OperandScalar } from "@uttori/asm-core";
import { type ExpansionPlan } from "./operand-plans.js";
/** SPC punctuation and permissive literal readers are compiled once, before numeric execution. */
export interface SpcOperand {
    readonly shape?: ParsedOperand;
    readonly scalar: OperandScalar;
    readonly wholeScalar: OperandScalar;
    readonly plan: ExpansionPlan;
    readonly display: string;
    readonly wholeDisplay: string;
    readonly register: string;
    readonly hexDigits: number;
    readonly bareHex: boolean;
    /** Permissive whole-operand readers are syntax facts, preserving historical truncation. */
    readonly hexPrefix: number;
    readonly filteredHex: number;
    readonly decimalPrefix?: number;
    readonly containsDollar: boolean;
    readonly parenthesizedHex: boolean;
    readonly leadingHexDigits: number;
    /** Hexadecimal scalar inside address punctuation, distinct from the whole-operand prefix. */
    readonly baseHex: number;
    /** Combined bit-operand diagnostic tree, activated only after ordinary pairs fail. */
    readonly compound: OperandScalar;
    readonly bit?: number;
    readonly invert: boolean;
    readonly bitValue?: number;
}
/** Target grammar payload; mnemonic bits and operand bits retain their separate precedence. */
export interface SpcSyntax extends ParsedInstructionOperands {
    readonly spc700: {
        readonly kind: "spc700-v2";
        readonly mnemonic: string;
        readonly width?: number;
        readonly suffixError: boolean;
        readonly bitFamily?: string;
        readonly bit?: number;
        readonly parts: readonly SpcOperand[];
        readonly whole: ExpansionPlan;
    };
}
/** Numbered mnemonics and dotted selectors remain distinct so their precedence survives binding. */
export declare function parseSpcOperands(mnemonic: string, text: string): SpcSyntax;
/** Reject foreign grammar payloads without reinterpreting their source text. */
export declare function spcSyntax(value: ParsedInstructionOperands): SpcSyntax;
//# sourceMappingURL=spc700-syntax.d.ts.map