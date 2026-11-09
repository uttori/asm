import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, ArchitectureInstructionSpecification, DecodedInstruction } from "@uttori/asm-core";
import type { CpuDefinition } from "./instructions/schema.js";
/** Fixed-width NMOS specifications share the encoder's exact opcode table, including aliases. */
export declare function cpu6502Specifications(cpu: CpuDefinition): readonly ArchitectureInstructionSpecification[];
/** NMOS/Ricoh decoder. BRK owns its opcode; its skipped signature byte remains independently preserved data. */
export declare class Cpu6502Decoder implements ArchitectureDecoder {
    #private;
    readonly cpu: CpuDefinition;
    constructor(cpu?: CpuDefinition);
    /**
     * Decodes one instruction at `context.offset`.
     * @param context Byte source, offset, and 16-bit logical PC.
     * @returns Decoded instruction, or an error for an invalid PC, missing/truncated bytes, or an opcode absent from this CPU's table.
     */
    decode(context: ArchitectureDecodeContext): ArchitectureDecodeResult;
}
/** Uppercase, reassemblable ca65 text. Duplicate unofficial encodings remain explicit bytes rather than canonicalizing. */
export declare function formatCpu6502Instruction(instruction: DecodedInstruction, 
/** Trusted address expression with the same numeric value; encoded operand width remains forced. */
addressExpression?: string): string;
//# sourceMappingURL=decoder.d.ts.map