export type OperandSyntax = {
    raw: string;
    trimmed: string;
    normalizedUpper: string;
    immediate: boolean;
    indirect: boolean;
    indexRegister?: "x" | "y" | "s";
};
export declare function parseOperandSyntax(operand: string): OperandSyntax;
//# sourceMappingURL=operand-syntax.d.ts.map