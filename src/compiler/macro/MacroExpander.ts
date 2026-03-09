import type { Assembler } from "../../assembler.js";

export class MacroExpander {
  constructor(private readonly assembler: Assembler) {}

  executeInvocation(invocation: string): void {
    this.assembler.callMacro(invocation);
  }
}
