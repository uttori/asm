import type { Assembler } from "../../assembler.js";

export class PassManager {
  constructor(private readonly assembler: Assembler) {}

  setPass(pass: number): void {
    this.assembler.setPass(pass);
  }

  finishPass(): void {
    this.assembler.finishPass();
  }
}
