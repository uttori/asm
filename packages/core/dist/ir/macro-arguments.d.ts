/** Decoded argument and its original half-open UTF-16 range within the argument list. */
export type MacroInvocationArgument = {
    /** Trimmed argument with quotes stripped and escapes decoded. */
    value: string;
    /** Exact source slice between separators, before decoding. */
    text: string;
    /** Inclusive start offset in the argument list text. */
    start: number;
    /** Exclusive end offset, at the separator or end of text. */
    end: number;
};
/** Preserve quote stripping, escapes, empty middle arguments and the legacy omitted empty tail. */
export declare function parseMacroArguments(text: string): MacroInvocationArgument[];
//# sourceMappingURL=macro-arguments.d.ts.map