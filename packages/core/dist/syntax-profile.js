export const ASAR_SYNTAX_PROFILE = Object.freeze({
    id: "asar",
    preserveLeadingWhitespace: false,
    splitColonStatements: true,
    splitRelativeLabelStatements: true,
    leadingDotLabels: true,
    directivePrefixes: Object.freeze(["@"]),
    cheapLocalPrefix: "",
    fileLocalSymbols: false,
});
export const NATIVE_SYNTAX_PROFILE = Object.freeze({
    id: "native",
    preserveLeadingWhitespace: true,
    splitColonStatements: false,
    splitRelativeLabelStatements: false,
    leadingDotLabels: true,
    directivePrefixes: Object.freeze([]),
    cheapLocalPrefix: "",
    fileLocalSymbols: false,
});
export const CA65_SYNTAX_PROFILE = Object.freeze({
    id: "ca65",
    preserveLeadingWhitespace: true,
    splitColonStatements: false,
    splitRelativeLabelStatements: false,
    leadingDotLabels: false,
    directivePrefixes: Object.freeze(["."]),
    cheapLocalPrefix: "@",
    fileLocalSymbols: true,
});
//# sourceMappingURL=syntax-profile.js.map