import { sourceSpanToRange, type SourceRange, type SourceSpan } from "./source-location.js";
import type { SourceOrigin } from "./source-provenance.js";

/** Severity level assigned to an assembler diagnostic for editors and build output. */
export type AssemblyDiagnosticSeverity = "error" | "warning" | "info";

/** Kind of symbol participating in definition or reference indexing. */
export type AssemblySymbolKind =
  | "label"
  | "define"
  | "macro"
  | "struct"
  | "structMember"
  | "function"
  | "namespace";

/** File, line, and optional span identifying a diagnostic or symbol occurrence. */
export type AssemblySourceLocation = {
  /** Shared expansion provenance, available without re-parsing source in tooling. */
  origin?: SourceOrigin;
  /** Absolute or workspace-relative path of the source file. */
  file: string;
  /** One-based line number within the file. */
  line: number;
  /** Optional precise character span within the line. */
  span?: SourceSpan;
  /** Optional LSP-style range derived from span and line. */
  range?: SourceRange;
};

/** Single analyzer message with stable code, severity, and anchored location. */
export type AssemblyDiagnostic = {
  /** Stable diagnostic code for filtering and documentation links. */
  code: string;
  /** Human-readable explanation suitable for editor hovers. */
  message: string;
  /** Severity controlling whether the message fails the build. */
  severity: AssemblyDiagnosticSeverity;
  /** Primary source location for the diagnostic. */
  location: AssemblySourceLocation;
  /** Optional pipeline stage name when multi-pass analysis produced the message. */
  stage?: string;
};

/** Symbol definition harvested during analysis for navigation and completion. */
export type AssemblySymbolDefinition = {
  /** Unlinked section location; consumers must not display this offset as a final ROM address. */
  relocatable?: import("./relocatable.js").SectionPosition;
  /** Declared symbol name as stored in the symbol table. */
  name: string;
  /** Symbol kind distinguishing labels, macros, structs, and related entities. */
  kind: AssemblySymbolKind;
  /** Source location of the defining occurrence. */
  location: AssemblySourceLocation;
  /** Optional numeric or textual value when the definition binds one. */
  value?: number | string;
  /** Optional enclosing struct or namespace container name. */
  containerName?: string;
};

/** Classification of how a symbol name is referenced in source text. */
export type AssemblySymbolReferenceKind =
  | "label"
  | "define"
  | "macro"
  | "function"
  | "include"
  | "instruction"
  | "unknown";

/** Reference to a symbol name at a specific source occurrence. */
export type AssemblySymbolReference = {
  /** Referenced symbol name before qualification. */
  name: string;
  /** Reference kind inferred from syntactic context. */
  kind: AssemblySymbolReferenceKind;
  /** Source location of the referencing token. */
  location: AssemblySourceLocation;
  /** Optional enclosing struct or namespace container name. */
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

/** Aggregated analysis artifacts returned from a single analyzer pass. */
export type AssemblyAnalysisResult = {
  /** Diagnostics emitted while analyzing the requested roots. */
  diagnostics: AssemblyDiagnostic[];
  /** Symbol definitions discovered in the analyzed graph. */
  symbols: AssemblySymbolDefinition[];
  /** Symbol references discovered in the analyzed graph. */
  references: AssemblySymbolReference[];
  /** Include edges connecting parent files to resolved includes. */
  includeEdges: AssemblyIncludeEdge[];
  /** Resolved binary/resource paths observed without treating them as assembly source. */
  assetDependencies?: Readonly<Record<string, "binary" | "resource">>;
};

/**
 * Error type that preserves assembler analysis metadata.
 */
export class AssemblyError extends Error {
  /** Stable diagnostic code mirrored in AssemblyDiagnostic records. */
  code: string;
  /** Severity used when converting the error into a diagnostic. */
  severity: AssemblyDiagnosticSeverity;
  /** Optional source location attached at throw site. */
  location?: AssemblySourceLocation;
  /** Optional pipeline stage recorded for the failure. */
  stage?: string;

  /**
   * Creates a new structured assembly error.
   * @param code Stable diagnostic code.
   * @param message Human-readable message.
   * @param [options] Optional metadata.
   * @param [options.severity] Optional diagnostic severity.
   * @param [options.location] Optional source location.
   * @param [options.stage] Optional pipeline stage.
   */
  constructor(
    code: string,
    message: string,
    options: {
      severity?: AssemblyDiagnosticSeverity;
      location?: AssemblySourceLocation;
      stage?: string;
    } = {},
  ) {
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
export function createAssemblySourceLocation(
  file: string,
  line: number,
  span?: SourceSpan,
  origin?: SourceOrigin,
): AssemblySourceLocation {
  return {
    ...(origin ? { origin } : {}),
    file,
    line,
    span,
    range: span ? sourceSpanToRange(span, line) : undefined,
  };
}

/** Error identity/messages are preserved while the deepest expansion occurrence survives unwinding. */
const errorSources = new WeakMap<object, AssemblySourceLocation>();
/** Retain the innermost source while allowing the original exception and cause chain to propagate. */
export function rememberErrorSource(error: unknown, location: AssemblySourceLocation): void {
  if (error instanceof Error && !errorSource(error)) {
    errorSources.set(error, location);
  }
}

/** Walks Error.cause links to recover the innermost remembered source location. */
function errorSource(error: unknown): AssemblySourceLocation | undefined {
  const visited = new Set<unknown>();
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
export function diagnosticFromError(
  error: unknown,
  fallbackLocation: AssemblySourceLocation,
  stage?: string,
): AssemblyDiagnostic {
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
