import { type CpuDefinition, type InstructionForm } from "./schema.js";
/** Frozen 256-entry NMOS decode table (one form per opcode byte). */
export declare const nmos6502DecodeTable: readonly InstructionForm[];
/** Documented NMOS assembly forms, plus BRK signature extensions. */
export declare const nmos6502Forms: readonly InstructionForm[];
/** Documented + unofficial canonical forms (`65xx.6502x`). */
export declare const nmos6502xForms: readonly InstructionForm[];
export declare const nmos6502Cpu: CpuDefinition;
export declare const nmos6502xCpu: CpuDefinition;
/**
 * Looks up the NMOS decode-table form for a byte.
 *
 * @param {number} opcode Opcode 0–255.
 * @returns {InstructionForm} The form at that slot (always defined; unofficial included).
 */
export declare function getOpcodeForm(opcode: number): InstructionForm;
/**
 * Full decode table for a CPU: CMOS variants use generated tables;
 * NMOS uses {@link nmos6502DecodeTable} filtered by features.
 * @param {CpuDefinition} cpu The CPU definition.
 * @returns {readonly InstructionForm[]} The decode table.
 */
export declare function getCpuDecodeTable(cpu: CpuDefinition): readonly InstructionForm[];
/**
 * Forms the assembler will encode (canonical only). Decode tables keep
 * duplicate unofficial encodings; assembly does not.
 * @param {CpuDefinition} cpu The CPU definition.
 * @returns {readonly InstructionForm[]} The assembly forms.
 */
export declare function getCpuAssemblyForms(cpu: CpuDefinition): readonly InstructionForm[];
//# sourceMappingURL=opcodes.d.ts.map