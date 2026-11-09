import { type OperandScalar } from "@uttori/asm-core";
/** Syntax-time policy for width inference. No instruction execution interprets source spelling. */
export interface ExpansionPlan {
    /** Primary expression scalar whose span anchors diagnostics and evaluation. */
    readonly scalar: OperandScalar;
    /** A failed whole-fragment binding affects only scalar components containing a template. */
    readonly unbound: boolean;
    /** Attribution spelling only; execution consumes scalar.expression. */
    readonly display: string;
    /** Trailing index register letter when parsed from `,x` / `,y` / `,s` suffix syntax. */
    readonly index?: string;
    /** True when the operand text begins with `#` immediate syntax. */
    readonly immediate: boolean;
    /** True when the text matches a PC-relative branch spelling. */
    readonly relative: boolean;
    /** Optional whole-fragment math scalar evaluated during classification. */
    readonly math?: OperandScalar;
    /** Optional reference probe scalar used to infer width before the final read. */
    readonly probe?: OperandScalar;
    /** Byte count from lexical hex digits; decimal atoms otherwise retain the default absolute width. */
    readonly hexWidth?: number;
    /** True when the body begins with `$` hex literal syntax. */
    readonly directHex: boolean;
    /** Pure expressions are read again at encoding; calls retain their classification result. */
    readonly native: boolean;
    /** Forced byte width from `z:`/`a:`/`f:` address-size prefixes when present. */
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