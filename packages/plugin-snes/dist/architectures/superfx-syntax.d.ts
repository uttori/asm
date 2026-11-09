import type { ParsedInstructionOperands, OperandScalar } from "@uttori/asm-core";
import { type ExpansionPlan } from "./operand-plans.js";
/** Source-only register recognition and numeric slots; no execution method parses these spellings. */
export interface SuperFxOperand {
    /** Hardware register index when the part names `r0`–`r15`, otherwise null. */
    readonly register: number | null;
    /** Register inside `(rN)` indirect form; null for non-indirect parts. */
    readonly indirectRegister: number | null;
    /** True when the part begins with `#` immediate syntax. */
    readonly immediate: boolean;
    /** True when the part is wrapped in parentheses as an indirect address. */
    readonly indirect: boolean;
    /** Exactly two hex digits denote an encoded displacement; other forms denote a target. */
    readonly rawOffset: boolean;
    /** Evaluated expression scalar for the stripped operand body. */
    readonly scalar: OperandScalar;
    /** Source text of the operand body after prefix stripping. */
    readonly display: string;
    /** Width and evaluation schedule compiled from the authored part text. */
    readonly expansion: ExpansionPlan;
}
/** Portable target grammar and ordered numeric observation plans. */
export interface SuperFxSyntax extends ParsedInstructionOperands {
    /** Parsed Super FX operand bundle carried through preparation and encoding. */
    readonly superfx: {
        /** Discriminator for portable Super FX operand payloads. */
        readonly kind: "superfx-v2";
        /** Uppercased mnemonic after alias normalization. */
        readonly mnemonic: string;
        /** Comma-separated operand parts in source order. */
        readonly parts: readonly SuperFxOperand[];
        /** Whole-operand expansion plan spanning the full text. */
        readonly whole: ExpansionPlan;
    };
}
/** Compile register, address-unit and branch-spelling distinctions once at the source boundary. */
export declare function parseSuperFxOperands(mnemonic: string, text: string): SuperFxSyntax;
/** Syntax tags are checked at the public typed boundary, including after portable copies. */
export declare function superFxSyntax(value: ParsedInstructionOperands): SuperFxSyntax;
//# sourceMappingURL=superfx-syntax.d.ts.map