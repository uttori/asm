import { sourceSpanToRange } from "./source-location.js";
/**
 * Error type that preserves assembler analysis metadata.
 */
export class AssemblyError extends Error {
    /** Stable diagnostic code mirrored in AssemblyDiagnostic records. */
    code;
    /** Severity used when converting the error into a diagnostic. */
    severity;
    /** Optional source location attached at throw site. */
    location;
    /** Optional pipeline stage recorded for the failure. */
    stage;
    /**
     * Creates a new structured assembly error.
     * @param code Stable diagnostic code.
     * @param message Human-readable message.
     * @param [options] Optional metadata.
     * @param [options.severity] Optional diagnostic severity.
     * @param [options.location] Optional source location.
     * @param [options.stage] Optional pipeline stage.
     */
    constructor(code, message, options = {}) {
        super(message);
        this.name = "AssemblyError";
        this.code = code;
        this.severity = options.severity ?? "error";
        this.location = options.location;
        this.stage = options.stage;
    }
}
/**
 * Creates a normalized source location object for diagnostics and tooling.
 * @param file Source file path.
 * @param line Zero-based source line.
 * @param [span] Optional precise source span.
 * @returns The normalized source location.
 */
export function createAssemblySourceLocation(file, line, span, origin) {
    return {
        ...(origin ? { origin } : {}),
        file,
        line,
        span,
        range: span ? sourceSpanToRange(span, line) : undefined,
    };
}
/** Error identity/messages are preserved while the deepest expansion occurrence survives unwinding. */
const errorSources = new WeakMap();
/** Retain the innermost source while allowing the original exception and cause chain to propagate. */
export function rememberErrorSource(error, location) {
    if (error instanceof Error && !errorSource(error)) {
        errorSources.set(error, location);
    }
}
/** Walks Error.cause links to recover the innermost remembered source location. */
function errorSource(error) {
    const visited = new Set();
    while (error instanceof Error && !visited.has(error)) {
        visited.add(error);
        const location = errorSources.get(error);
        if (location) {
            return location;
        }
        error = error.cause;
    }
    return undefined;
}
/**
 * Converts an unknown error into a structured diagnostic.
 * @param error The error to normalize.
 * @param fallbackLocation The fallback location when the error lacks one.
 * @param [stage] Optional stage name.
 * @returns The normalized diagnostic.
 */
export function diagnosticFromError(error, fallbackLocation, stage) {
    fallbackLocation = errorSource(error) ?? fallbackLocation;
    if (error instanceof AssemblyError) {
        return {
            code: error.code,
            message: error.message,
            severity: error.severity,
            location: error.location ?? fallbackLocation,
            stage: error.stage ?? stage,
        };
    }
    if (error instanceof Error) {
        return {
            code: "ASSEMBLY_ERROR",
            message: error.message,
            severity: "error",
            location: fallbackLocation,
            stage,
        };
    }
    return {
        code: "ASSEMBLY_ERROR",
        message: typeof error === "string" ? error : JSON.stringify(error),
        severity: "error",
        location: fallbackLocation,
        stage,
    };
}
//# sourceMappingURL=diagnostics.js.map