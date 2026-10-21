/** Decoded argument and its original half-open UTF-16 range within the argument list. */
export type MacroInvocationArgument = {
    value: string;
    text: string;
    start: number;
    end: number;
};
/** Preserve quote stripping, escapes, empty middle arguments and the legacy omitted empty tail. */
export declare function parseMacroArguments(text: string): MacroInvocationArgument[];
//# sourceMappingURL=macro-arguments.d.ts.map