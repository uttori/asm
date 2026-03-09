import type { Assembler } from "../../assembler.js";

export class CodeEmitter {
  constructor(private readonly assembler: Assembler) {}

  writeByLength(length: number, value: number): void {
    this.assembler.writeDataByLength(length, value);
  }

  writeDataDirective(type: string, parameters: string[]): void {
    this.assembler.handleDataDirective(type, parameters);
  }

  writeBytes(start: number, value: number, length: number = 1): void {
    this.assembler.writeDataBytes(start, value, length);
  }
}
