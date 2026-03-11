import fs from "node:fs";
import path from "node:path";

import { toCompilerDiagnostic, type CompilerDiagnostic, DiagnosticError } from "../compiler/diagnostics/Diagnostic.js";
import { CompilationBackend } from "../compiler/backend/CompilationBackend.js";
import { executeParsedCommands } from "./execute-ir.js";
import type { ParsedCommand } from "./ir.js";
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

const INCLUDE_DIRECTIVES = new Set(["incsrc", "include"]);

/**
 * Resolve an include path against current dir and includePaths. Returns absolute path or null.
 * @param requestedPath
 * @param currentFileDir
 * @param includePaths
 */
function resolveIncludePath(
  requestedPath: string,
  currentFileDir: string,
  includePaths: string[]
): string | null {
  const unquoted = requestedPath.replace(/^["']|["']$/g, "").trim();
  const searchDirs = [currentFileDir, ...includePaths];
  for (const dir of searchDirs) {
    const candidate = path.resolve(dir, unquoted);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Replace incsrc/include directives with the parsed commands from the included file (recursive).
 * @param commands
 * @param currentFileDir
 * @param includePaths
 * @param visited
 */
function expandIncludes(
  commands: ParsedCommand[],
  currentFileDir: string,
  includePaths: string[],
  visited: Set<string>
): ParsedCommand[] {
  const out: ParsedCommand[] = [];
  for (const cmd of commands) {
    if (cmd.kind !== "directive" || !INCLUDE_DIRECTIVES.has(cmd.directive.toLowerCase())) {
      out.push(cmd);
      continue;
    }
    const pathArg = (cmd.arguments[0] ?? cmd.argumentsRaw).trim().replace(/^["']|["']$/g, "");
    const resolved = resolveIncludePath(pathArg, currentFileDir, includePaths);
    if (!resolved) {
      throw new Error(`Include not found: ${pathArg} (from ${currentFileDir})`);
    }
    const absResolved = path.resolve(resolved);
    if (visited.has(absResolved)) {
      throw new Error(`Include cycle: ${absResolved}`);
    }
    visited.add(absResolved);
    const content = fs.readFileSync(resolved, "utf8");
    const tokenized = tokenizeSource(content);
    const parsed = parseTokenizedCommands(tokenized);
    const includedDir = path.dirname(resolved);
    const expanded = expandIncludes(parsed, includedDir, includePaths, visited);
    visited.delete(absResolved);
    out.push(...expanded);
  }
  return out;
}

export const compileSourceWithParser = (
  source: string,
  options: CompileWithParserOptions = {}
): Uint8Array => {
  const backend = new CompilationBackend(options.targetRom);

  if (options.sourcePath) {
    backend.setCurrentFile(options.sourcePath);
  }
  if (options.includePaths?.length) {
    backend.setIncludePaths(options.includePaths);
  }

  const tokenizedCommands = tokenizeSource(source);
  let parsedCommands = parseTokenizedCommands(tokenizedCommands);

  const currentFileDir = options.sourcePath ? path.dirname(path.resolve(options.sourcePath)) : ".";
  const includePaths = options.includePaths ?? [];
  parsedCommands = expandIncludes(parsedCommands, currentFileDir, includePaths, new Set());

  const diagnostics: CompilerDiagnostic[] = [];
  const collectDiagnostic = (diagnostic: CompilerDiagnostic): void => {
    diagnostics.push(diagnostic);
    if (options.onDiagnostic) {
      options.onDiagnostic(diagnostic);
    }
  };

  try {
    for (const pass of [0, 1, 2]) {
      backend.setPass(pass);
      executeParsedCommands(backend, parsedCommands, {
        onDiagnostic: collectDiagnostic,
        nativeSemanticSlices: options.nativeSemanticSlices ?? false
      });
      backend.finishPass();
    }
  } catch (error: unknown) {
    if (options.diagnosticsMode === "structured") {
      const diagnostic = diagnostics.at(-1) || toCompilerDiagnostic(error, {
        code: "PARSER_COMPILE_ERROR",
        severity: "error",
        file: backend.currentFile,
        line: backend.currentLine,
        pass: backend.pass
      });
      throw new DiagnosticError(diagnostic);
    }
    throw error;
  }

  return backend.getBinaryOutput();
};
