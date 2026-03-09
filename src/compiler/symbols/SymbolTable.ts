import type { Assembler } from "../../assembler.js";

export class SymbolTable {
  constructor(private readonly assembler: Assembler) {}

  defineLabel(label: string): void {
    this.assembler.setLabel(label);
  }

  getLabelValue(label: string, requireStatic: boolean = false): number {
    return this.assembler.getLabelValue(label, requireStatic);
  }
}
