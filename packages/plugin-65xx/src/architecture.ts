import {
  runTypedEncoderEntry,
  type ArchitectureEncoderContext,
  type InstructionDescriptor,
} from "@uttori/asm-core";

import type { CpuDefinition, InstructionForm } from "./instructions/schema.js";
import { parse65xxOperands } from "./operands/syntax.js";
import { TypedArch65xx } from "./typed-architecture.js";

/**
 * Compatibility entry point for callers supplying word arrays.
 * Registered architectures use TypedArch65xx directly; this facade parses at its public
 * boundary and delegates every form selection and byte write to that same implementation.
 */
export class Arch65xx {
  private readonly encoder: TypedArch65xx;
  readonly forms: readonly InstructionForm[];
  readonly catalog: InstructionDescriptor[];
  readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;

  constructor(
    readonly context: ArchitectureEncoderContext,
    readonly cpu: CpuDefinition,
  ) {
    this.encoder = new TypedArch65xx(cpu);
    this.forms = this.encoder.forms;
    this.catalog = this.encoder.catalog;
    this.formsByMnemonic = this.encoder.formsByMnemonic;
  }

  getInstructionCatalog(): InstructionDescriptor[] {
    return this.catalog;
  }

  estimateSize(words: readonly string[]): number {
    if (!words.length) {
      return 0;
    }
    return this.run(words[0], words.slice(1).join(" "), false);
  }

  encode(words: readonly string[]): boolean {
    if (!words.length) {
      return true;
    }
    return this.run(words[0], words.slice(1).join(" "), true);
  }

  private run(mnemonic: string, text: string, emit: true): boolean;
  private run(mnemonic: string, text: string, emit: false): number;
  /** Parse at the public boundary; typed preparation owns all value and width decisions. */
  private run(mnemonic: string, text: string, emit: boolean): number | boolean {
    const instruction = { mnemonic, operands: parse65xxOperands(mnemonic, text) };
    if (emit) {
      return runTypedEncoderEntry(this.context, this.encoder, instruction, true);
    }
    return runTypedEncoderEntry(this.context, this.encoder, instruction, false);
  }
}

/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling. The live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export function materializeOpcodeForm(
  form: InstructionForm,
  operandBytes: readonly number[] = [],
): Uint8Array {
  const expected = form.operands.reduce((size, operand) => size + operand.width, 0);
  if (operandBytes.length !== expected) {
    throw new Error(
      `${form.mnemonic} ${form.mode} expects ${expected} encoded operand byte(s), got ${operandBytes.length}.`,
    );
  }
  for (const byte of operandBytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new RangeError(`Encoded operand byte ${byte} is outside the byte range.`);
    }
  }
  return Uint8Array.from([...form.encoding, ...operandBytes]);
}
