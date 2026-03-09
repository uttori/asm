import path from "node:path";
import { Assembler } from "../assembler.js";
import { toCompilerDiagnostic, type CompilerDiagnostic, DiagnosticError } from "../compiler/diagnostics/Diagnostic.js";
import { ExpressionResolver } from "../compiler/expr/ExpressionResolver.js";
import { IncludeManager } from "../compiler/include/IncludeManager.js";
import { PassManager } from "../compiler/pass/PassManager.js";
import { CompilationState } from "../compiler/state/CompilationState.js";
import { executeParsedCommands } from "./execute-ir.js";
import { parseTokenizedCommands } from "./parser.js";
import { tokenizeSource } from "./tokenizer.js";

export interface CompileWithParserOptions {
  targetRom?: Uint8Array;
  sourcePath?: string;
  includePaths?: string[];
  checksumMode?: "asar" | "simple";
  diagnosticsMode?: "legacy" | "structured";
  onDiagnostic?: (diagnostic: CompilerDiagnostic) => void;
  nativeSemanticSlices?: boolean;
}

export const compileSourceWithParser = (
  source: string,
  options: CompileWithParserOptions = {}
): Uint8Array => {
  const assembler = new Assembler(options.targetRom);
  const includeManager = new IncludeManager(assembler);
  const passManager = new PassManager(assembler);
  const state = new CompilationState(assembler);
  const expressionResolver = new ExpressionResolver(assembler);

  // Keep expression service initialized and reachable for future phases.
  void expressionResolver;
  void state;

  if (options.checksumMode) {
    assembler.setChecksumMode(options.checksumMode);
  }

  if (options.includePaths?.length) {
    includeManager.setIncludePaths(options.includePaths);
  } else if (options.sourcePath) {
    const sourceDir = path.dirname(options.sourcePath);
    includeManager.setIncludePaths(["./", sourceDir]);
  }

  if (options.sourcePath) {
    includeManager.setCurrentFile(options.sourcePath);
  }

  const tokenizedCommands = tokenizeSource(source);
  const parsedCommands = parseTokenizedCommands(tokenizedCommands);

  const diagnostics: CompilerDiagnostic[] = [];
  const collectDiagnostic = (diagnostic: CompilerDiagnostic): void => {
    diagnostics.push(diagnostic);
    if (options.onDiagnostic) {
      options.onDiagnostic(diagnostic);
    }
  };

  try {
    for (const pass of [0, 1, 2]) {
      passManager.setPass(pass);
      executeParsedCommands(assembler, parsedCommands, {
        onDiagnostic: collectDiagnostic,
        nativeSemanticSlices: options.nativeSemanticSlices ?? false
      });
      passManager.finishPass();
    }
  } catch (error: unknown) {
    if (options.diagnosticsMode === "structured") {
      const diagnostic = diagnostics.at(-1) || toCompilerDiagnostic(error, {
        code: "PARSER_COMPILE_ERROR",
        severity: "error",
        file: assembler.currentFile,
        line: assembler.currentLine,
        pass: assembler.pass
      });
      throw new DiagnosticError(diagnostic);
    }
    throw error;
  }

  return assembler.getBinaryOutput();
};
