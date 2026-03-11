import type { Assembler } from "../../assembler.js";

export class IncludeManager {
  constructor(private readonly assembler: Assembler) {}

  setIncludePaths(paths: string[]): void {
    this.assembler.setIncludePaths(paths);
  }

  setCurrentFile(path: string): void {
    this.assembler.setCurrentFile(path);
  }

  readFile(path: string): string {
    return this.assembler.readFile(path);
  }
}
