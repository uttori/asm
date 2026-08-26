export interface SyntaxProfile {
    readonly id: string;
    /** Preserve leading whitespace so column-sensitive dialects can inspect it later. */
    readonly preserveLeadingWhitespace: boolean;
    /** Split Asar-style ` : ` statement chains outside quotes. */
    readonly splitColonStatements: boolean;
    /** Split `+: instruction` and `-: instruction` into separate statements. */
    readonly splitRelativeLabelStatements: boolean;
    /** Treat a leading `.` token as an implicit label when it has no colon. */
    readonly leadingDotLabels: boolean;
    /** Prefixes accepted before a registered directive keyword. */
    readonly directivePrefixes: readonly string[];
}
export declare const ASAR_SYNTAX_PROFILE: SyntaxProfile;
export declare const NATIVE_SYNTAX_PROFILE: SyntaxProfile;
export declare const CA65_SYNTAX_PROFILE: SyntaxProfile;
//# sourceMappingURL=syntax-profile.d.ts.map