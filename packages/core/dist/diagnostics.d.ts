import { type SourceRange, type SourceSpan } from "./source-location.js";
export type AssemblyDiagnosticSeverity = "error" | "warning" | "info";
export type AssemblySymbolKind = "label" | "define" | "macro" | "struct" | "structMember" | "function" | "namespace";
export type AssemblySourceLocation = {
    file: string;
    line: number;
    span?: SourceSpan;
    range?: SourceRange;
};
export type AssemblyDiagnostic = {
    code: string;
    message: string;
    severity: AssemblyDiagnosticSeverity;
    location: AssemblySourceLocation;
    stage?: string;
};
export type AssemblySymbolDefinition = {
    name: string;
    kind: AssemblySymbolKind;
    location: AssemblySourceLocation;
    value?: number | string;
    containerName?: string;
};
export type AssemblySymbolReferenceKind = "label" | "define" | "macro" | "function" | "include" | "instruction" | "unknown";
export type AssemblySymbolReference = {
    name: string;
    kind: AssemblySymbolReferenceKind;
    location: AssemblySourceLocation;
    containerName?: string;
};
/**
 * A directed edge in the include graph describing one file pulling in another.
 */
export type AssemblyIncludeEdge = {
    /** The file that issued the include directive. */
    fromFile: string;
    /** The resolved path of the included file. */
    toFile: string;
    /** Optional span of the include target token in the parent file. */
    span?: SourceSpan;
    /** Optional source range of the include target token in the parent file. */
    range?: SourceRange;
};
export type AssemblyAnalysisResult = {
    diagnostics: AssemblyDiagnostic[];
    symbols: AssemblySymbolDefinition[];
    references: AssemblySymbolReference[];
    includeEdges: AssemblyIncludeEdge[];
};
/**
 * Error type that preserves assembler analysis metadata.
 */
export declare class AssemblyError extends Error {
    code: string;
    severity: AssemblyDiagnosticSeverity;
    location?: AssemblySourceLocation;
    stage?: string;
    /**
     * Creates a new structured assembly error.
     * @param {string} code Stable diagnostic code.
     * @param {string} message Human-readable message.
     * @param {{ severity?: AssemblyDiagnosticSeverity; location?: AssemblySourceLocation; stage?: string }} [options] Optional metadata.
     * @param {AssemblyDiagnosticSeverity} [options.severity] Optional diagnostic severity.
     * @param {AssemblySourceLocation} [options.location] Optional source location.
     * @param {string} [options.stage] Optional pipeline stage.
     */
    constructor(code: string, message: string, options?: {
        severity?: AssemblyDiagnosticSeverity;
        location?: AssemblySourceLocation;
        stage?: string;
    });
}
/**
 * Creates a normalized source location object for diagnostics and tooling.
 * @param {string} file Source file path.
 * @param {number} line Zero-based source line.
 * @param {SourceSpan} [span] Optional precise source span.
 * @returns {AssemblySourceLocation} The normalized source location.
 */
export declare function createAssemblySourceLocation(file: string, line: number, span?: SourceSpan): AssemblySourceLocation;
/**
 * Converts an unknown error into a structured diagnostic.
 * @param {unknown} error The error to normalize.
 * @param {AssemblySourceLocation} fallbackLocation The fallback location when the error lacks one.
 * @param {string} [stage] Optional stage name.
 * @returns {AssemblyDiagnostic} The normalized diagnostic.
 */
export declare function diagnosticFromError(error: unknown, fallbackLocation: AssemblySourceLocation, stage?: string): AssemblyDiagnostic;
//# sourceMappingURL=diagnostics.d.ts.map