import { type CpuDefinition, type InstructionForm } from "./schema.js";
export declare const nmos6502DecodeTable: readonly InstructionForm[];
export declare const nmos6502Forms: readonly InstructionForm[];
export declare const nmos6502xForms: readonly InstructionForm[];
export declare const nmos6502Cpu: CpuDefinition;
export declare const nmos6502xCpu: CpuDefinition;
export declare function getOpcodeForm(opcode: number): InstructionForm;
export declare function getCpuDecodeTable(cpu: CpuDefinition): readonly InstructionForm[];
export declare function getCpuAssemblyForms(cpu: CpuDefinition): readonly InstructionForm[];
//# sourceMappingURL=opcodes.d.ts.map