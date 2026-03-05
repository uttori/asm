import type { Assembler } from "../assembler.js";
import type { ParsedCommand } from "./ir.js";

const executeOne = (assembler: Assembler, command: ParsedCommand): void => {
  assembler.setCurrentLine(command.sourceLine);

  switch (command.kind) {
    case "label":
      // Explicit label-kind support in the new pipeline; execution still
      // delegates to legacy command handling to preserve behavior.
      assembler.processCommand(command.raw);
      return;
    case "instruction":
      // Explicit instruction-kind support in the new pipeline; execution still
      // delegates to legacy command handling to preserve behavior.
      assembler.processCommand(command.raw);
      return;
    case "directive":
    case "macro-call":
    case "fallback":
      assembler.processCommand(command.raw);
      return;
    default:
      assembler.processCommand(command.raw);
  }
};

export const executeParsedCommands = (assembler: Assembler, parsedCommands: ParsedCommand[]): void => {
  for (const command of parsedCommands) {
    executeOne(assembler, command);
  }
};
