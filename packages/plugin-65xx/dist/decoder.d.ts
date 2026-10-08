import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, ArchitectureInstructionSpecification, DecodedInstruction } from "@uttori/asm-core";
import type { CpuDefinition } from "./instructions/schema.js";
/** Fixed-width NMOS specifications share the encoder's exact opcode table, including aliases. */
export declare function cpu6502Specifications(cpu: CpuDefinition): readonly ArchitectureInstructionSpecification[];
/** NMOS/Ricoh decoder. BRK owns its opcode; its skipped signature byte remains independently preserved data. */
export declare class Cpu6502Decoder implements ArchitectureDecoder {
    #private;
    readonly cpu: CpuDefinition;
    constructor(cpu?: CpuDefinition);
    decode(context: ArchitectureDecodeContext): ArchitectureDecodeResult;
}
/** Reassemblable ca65 text. Duplicate unofficial encodings remain explicit bytes rather than canonicalizing. */
export declare function formatCpu6502Instruction(instruction: DecodedInstruction, 
/** Trusted address expression with the same numeric value; encoded operand width remains forced. */
addressExpression?: string): string;
//# sourceMappingURL=decoder.d.ts.map