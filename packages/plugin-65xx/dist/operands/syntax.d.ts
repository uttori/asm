import { type OperandScalar, type ParsedInstructionOperands, type ParsedOperand } from "@uttori/asm-core";
/** Syntax-time policy for width inference. No instruction execution interprets source spelling. */
export interface ExpansionPlan {
    readonly scalar: OperandScalar;
    /** A failed whole-fragment binding affects only scalar components containing a template. */
    readonly unbound: boolean;
    /** Attribution spelling only; execution consumes scalar.expression. */
    readonly display: string;
    readonly index?: string;
    readonly immediate: boolean;
    readonly relative: boolean;
    readonly math?: OperandScalar;
    readonly probe?: OperandScalar;
    /** Byte count from lexical hex digits; decimal atoms otherwise retain the default absolute width. */
    readonly hexWidth?: number;
    readonly directHex: boolean;
    /** Pure expressions are read again at encoding; calls retain their classification result. */
    readonly native: boolean;
    readonly force?: 1 | 2 | 3;
}
/** Shared operand structure plus immutable target-specific width and evaluation policy. */
export interface Syntax65xx extends ParsedInstructionOperands {
    readonly policy65xx: {
        readonly kind: "65xx-v1";
        readonly mnemonic: string;
        readonly forcedWidth?: 1 | 2;
        readonly originalRegister?: "a" | "q";
        readonly whole: ExpansionPlan;
        readonly unboundOperands: readonly ParsedOperand[];
        readonly parts: readonly ExpansionPlan[];
        readonly inner?: ExpansionPlan;
        readonly hasOperand: boolean;
        readonly hexSpecialPage: boolean;
        /** Selected numeric spelling after addressing punctuation was parsed. */
        readonly scalarDisplay: string;
    };
}
/** Full 65xx grammar, including source-only policies needed to retain established effect ordering. */
export declare function parse65xxOperands(mnemonic: string, text: string): Syntax65xx;
/** Grammar identity checks keep foreign payloads out of the target's resolution code. */
export declare function syntax65xx(syntax: ParsedInstructionOperands): Syntax65xx;
/** Extract numeric syntax without reparsing addressing delimiters or register operands. */
export declare function operandScalar(operand: ParsedOperand | undefined): OperandScalar | undefined;
//# sourceMappingURL=syntax.d.ts.map