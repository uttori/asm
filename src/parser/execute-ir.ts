import type { Assembler } from "../assembler.js";
import { ControlFlowManager } from "../compiler/control/ControlFlowManager.js";
import { CodeEmitter } from "../compiler/emit/CodeEmitter.js";
import { MacroExpander } from "../compiler/macro/MacroExpander.js";
import { SymbolTable } from "../compiler/symbols/SymbolTable.js";
import { toCompilerDiagnostic, type CompilerDiagnostic } from "../compiler/diagnostics/Diagnostic.js";
import type { ParsedCommand } from "./ir.js";

const DATA_DIRECTIVES = new Set(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"]);
const SIMPLE_LABEL_PATTERN = /^[A-Z_a-z]\w*$/;

export interface ExecuteParsedCommandOptions {
  onDiagnostic?: (diagnostic: CompilerDiagnostic) => void;
  nativeSemanticSlices?: boolean;
}

const executeOne = (
  assembler: Assembler,
  command: ParsedCommand,
  symbolTable: SymbolTable,
  codeEmitter: CodeEmitter,
  controlFlowManager: ControlFlowManager,
  macroExpander: MacroExpander,
  options: ExecuteParsedCommandOptions
): void => {
  assembler.setCurrentLine(command.sourceLine);

  try {
    switch (command.kind) {
      case "label":
        // First parser-native semantic slice: labels.
        if (options.nativeSemanticSlices && command.labelKind === "declaration" && SIMPLE_LABEL_PATTERN.test(command.labelName)) {
          symbolTable.defineLabel(command.labelName);
          return;
        }
        assembler.processCommand(command.raw);
        return;
      case "instruction":
        assembler.processCommand(command.raw);
        return;
      case "directive":
        if (controlFlowManager.executeDirective(command.raw, command.directive, command.arguments)) {
          return;
        }
        if (options.nativeSemanticSlices && DATA_DIRECTIVES.has(command.directive.toLowerCase())) {
          const raw = command.argumentsRaw.trim();
          codeEmitter.writeDataDirective(command.directive, raw ? [raw] : []);
          return;
        }
        assembler.processCommand(command.raw);
        return;
      case "macro-call":
        macroExpander.executeInvocation(command.raw);
        return;
      case "fallback":
        assembler.processCommand(command.raw);
        return;
    }
  } catch (error: unknown) {
    if (options.onDiagnostic) {
      options.onDiagnostic(toCompilerDiagnostic(error, {
        code: "PARSER_EXECUTION_ERROR",
        severity: "error",
        file: assembler.currentFile,
        line: command.sourceLine,
        pass: assembler.pass,
        rawCommand: command.raw
      }));
    }
    throw error;
  }
};

export const executeParsedCommands = (
  assembler: Assembler,
  parsedCommands: ParsedCommand[],
  options: ExecuteParsedCommandOptions = {}
): void => {
  const symbolTable = new SymbolTable(assembler);
  const codeEmitter = new CodeEmitter(assembler);
  const controlFlowManager = new ControlFlowManager(assembler);
  const macroExpander = new MacroExpander(assembler);

  for (const command of parsedCommands) {
    executeOne(assembler, command, symbolTable, codeEmitter, controlFlowManager, macroExpander, options);
  }
};
