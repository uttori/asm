export type OperandSyntax = {
    raw: string;
    trimmed: string;
    normalizedUpper: string;
    immediate: boolean;
    indirect: boolean;
    /** Unvalidated trailing index token. Architectures decide which names are registers. */
    indexRegister?: string;
    /** Byte width explicitly spelled by a bare hexadecimal operand, when present. */
    explicitWidth?: number;
    /** True when the source begins with a numeric literal or numeric prefix. */
    numericSpelling: boolean;
};
export declare function parseOperandSyntax(operand: string): OperandSyntax;
//# sourceMappingURL=operand-syntax.d.ts.map