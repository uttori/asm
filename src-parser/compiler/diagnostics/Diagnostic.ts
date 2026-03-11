export type DiagnosticSeverity = "error" | "warning" | "info";

export interface CompilerDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  line?: number;
  pass?: number;
  rawCommand?: string;
}

export class DiagnosticError extends Error {
  public readonly diagnostic: CompilerDiagnostic;

  constructor(diagnostic: CompilerDiagnostic) {
    super(diagnostic.message);
    this.name = "DiagnosticError";
    this.diagnostic = diagnostic;
  }
}

export const toCompilerDiagnostic = (
  error: unknown,
  fallback: Omit<CompilerDiagnostic, "message"> & { message?: string }
): CompilerDiagnostic => {
  if (error instanceof DiagnosticError) {
    return error.diagnostic;
  }

  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return {
    ...fallback,
    message: fallback.message || message
  };
};
