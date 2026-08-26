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
  /**
   * Cheap-local label prefix (ca65 `@name`). Empty disables the form.
   * Cheap locals attach to the current global parent like a single-dot sublabel.
   */
  readonly cheapLocalPrefix: string;
  /**
   * When true, non-exported labels are qualified by the current object file so
   * separately compiled banks can share a session without colliding.
   */
  readonly fileLocalSymbols: boolean;
}

export const ASAR_SYNTAX_PROFILE: SyntaxProfile = Object.freeze({
  id: "asar",
  preserveLeadingWhitespace: false,
  splitColonStatements: true,
  splitRelativeLabelStatements: true,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze(["@"]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false,
});

export const NATIVE_SYNTAX_PROFILE: SyntaxProfile = Object.freeze({
  id: "native",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze([]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false,
});

export const CA65_SYNTAX_PROFILE: SyntaxProfile = Object.freeze({
  id: "ca65",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: false,
  directivePrefixes: Object.freeze(["."]),
  cheapLocalPrefix: "@",
  fileLocalSymbols: true,
});
