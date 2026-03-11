import type { Assembler } from "../../assembler.js";

export interface CompilationStateSnapshot {
  pass: number;
  snespos: number;
  realsnespos: number;
  startpos: number;
  realstartpos: number;
  mapper: string;
  currentFile: string;
  currentLine: number;
}

/**
 * Thin state boundary around the legacy assembler.
 * Keeps behavior intact while creating a dedicated compiler state seam.
 */
export class CompilationState {
  constructor(private readonly assembler: Assembler) {}

  snapshot(): CompilationStateSnapshot {
    return {
      pass: this.assembler.pass,
      snespos: this.assembler.snespos,
      realsnespos: this.assembler.realsnespos,
      startpos: this.assembler.startpos,
      realstartpos: this.assembler.realstartpos,
      mapper: this.assembler.mapper,
      currentFile: this.assembler.currentFile,
      currentLine: this.assembler.currentLine
    };
  }
}
