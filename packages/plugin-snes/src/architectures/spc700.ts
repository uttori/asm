import {
  runTypedEncoderEntry,
  type ArchitectureEncoderContext,
  type InstructionDescriptor,
} from "@uttori/asm-core";

import { spc700Catalog } from "../tooling/instruction-catalog.js";
import { parseSpcOperands } from "./spc700-syntax.js";
import { TypedSpc700 } from "./typed-spc700.js";

/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export class ArchSPC700 {
  private readonly typedEncoder: TypedSpc700;

  constructor(readonly context: ArchitectureEncoderContext) {
    this.typedEncoder = new TypedSpc700();
  }

  private typedEntry(mnemonic: string, text: string, emit: true): boolean;
  private typedEntry(mnemonic: string, text: string, emit: false): number;
  /** Public word callers parse at entry and use the same typed encoder as registered sessions. */
  private typedEntry(mnemonic: string, text: string, emit: boolean): number | boolean {
    const instruction = { mnemonic, operands: parseSpcOperands(mnemonic, text) };
    if (emit) {
      return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, true);
    }
    return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, false);
  }

  /** Static catalog shared with typed instruction tooling. */
  getInstructionCatalog(): InstructionDescriptor[] {
    return spc700Catalog;
  }

  /** Parse a source instruction and reserve the byte count selected by the typed encoder. */
  estimateSize(words: readonly string[]): number {
    if (!words.length) {
      return 0;
    }
    return this.typedEntry(words[0], words.slice(1).join(" "), false);
  }

  /** Parse a source instruction and emit through the same target contract as assembler sessions. */
  encode(words: readonly string[]): boolean {
    if (!words.length) {
      return false;
    }
    return this.typedEntry(words[0], words.slice(1).join(" "), true);
  }
}
