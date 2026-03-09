import type { Assembler } from "../../assembler.js";

export class ControlFlowManager {
  constructor(private readonly assembler: Assembler) {}

  executeDirective(rawCommand: string, directive: string, args: string[]): boolean {
    switch (directive.toLowerCase()) {
      case "if":
      case "elseif":
      case "else":
      case "endif":
      case "while":
      case "endwhile":
      case "for":
      case "endfor":
        // Keep pass-sensitive behavior identical by delegating to legacy dispatcher.
        this.assembler.processCommand(rawCommand);
        return true;
      default:
        void args;
        return false;
    }
  }
}
