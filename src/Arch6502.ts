import type {
  ArchitectureEncoder,
  ArchitectureEncoderContext,
  InstructionDescriptor,
  LoweredInstruction,
} from "./architecture-types.js";

const unsupported = (): never => {
  throw new Error("MOS 6502 encoding is not implemented; this architecture is a framework stub.");
};

/**
 * Deliberately non-functional architecture placeholder. It exercises target
 * and architecture composition without claiming 6502 instruction support.
 */
export class Arch6502 implements ArchitectureEncoder {
  constructor(readonly context: ArchitectureEncoderContext) {}

  getInstructionCatalog(): InstructionDescriptor[] {
    return [];
  }

  estimateSize(_words: readonly string[]): number {
    return unsupported();
  }

  encode(_words: readonly string[]): boolean {
    return unsupported();
  }

  estimateInstruction(_instruction: LoweredInstruction): number {
    return unsupported();
  }

  encodeInstruction(_instruction: LoweredInstruction): boolean {
    return unsupported();
  }
}
