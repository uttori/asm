import { type OperandScalar } from "@uttori/asm-core";
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
/** Split only physical operand separators; punctuation inside expressions stays in its tree. */
export declare function operandParts(text: string): {
    text: string;
    start: number;
}[];
/** Preserve lexical width independently of the numeric expression and later generated values. */
export declare function operandScalarSyntax(text: string, start: number, force?: 1 | 2 | 3): OperandScalar;
/** Compile the established lexical width and evaluation schedule before entering any assembly stage. */
export declare function expansionPlan(input: string, start: number): ExpansionPlan;
/**
 * Share immutable syntax for repeated instruction text within one plugin environment.
 * The bounded cache owns no symbols, values or source-file coordinates; all spans are operand-local.
 */
export declare function cachedOperandGrammar<T extends import("@uttori/asm-core").ParsedInstructionOperands>(parse: (mnemonic: string, text: string) => T): (mnemonic: string, text: string) => T;
//# sourceMappingURL=operand-plans.d.ts.map