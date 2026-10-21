import {
  runTypedEncoderEntry,
  type ArchitectureEncoderContext,
  type InstructionDescriptor,
} from "@uttori/asm-core";

import { superFxCatalog } from "../tooling/instruction-catalog.js";
import { parseSuperFxOperands } from "./superfx-syntax.js";
import { TypedSuperFx } from "./typed-superfx.js";

/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export class ArchSuperFX {
  private readonly typedEncoder: TypedSuperFx;

  constructor(
    readonly context: ArchitectureEncoderContext,
    readonly asarMoveShortAddress: () => boolean = () => false,
  ) {
    this.typedEncoder = new TypedSuperFx(this.asarMoveShortAddress);
  }

  private typedEntry(mnemonic: string, text: string, emit: true): boolean;
  private typedEntry(mnemonic: string, text: string, emit: false): number;
  /** Public word callers parse at entry and use the same typed encoder as registered sessions. */
  private typedEntry(mnemonic: string, text: string, emit: boolean): number | boolean {
    const instruction = { mnemonic, operands: parseSuperFxOperands(mnemonic, text) };
    if (emit) {
      return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, true);
    }
    return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, false);
  }

  /** Static catalog shared with typed instruction tooling. */
  getInstructionCatalog(): InstructionDescriptor[] {
    return superFxCatalog;
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
