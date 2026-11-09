import { type CpuDefinition, type InstructionForm } from "./schema.js";
/** Frozen 256-entry NMOS decode table (one form per opcode byte). */
export declare const nmos6502DecodeTable: readonly InstructionForm[];
/** Documented NMOS assembly forms, plus BRK signature extensions. */
export declare const nmos6502Forms: readonly InstructionForm[];
/** Documented + unofficial canonical forms (`65xx.6502x`). */
export declare const nmos6502xForms: readonly InstructionForm[];
/** Documented NMOS 6502 (`65xx.6502`); unofficial opcodes are neither assembled nor decoded. */
export declare const nmos6502Cpu: CpuDefinition;
/** NMOS 6502 with stable and unstable unofficial opcodes assemblable (`65xx.6502x`). */
export declare const nmos6502xCpu: CpuDefinition;
/** Ricoh NES CPU uses NMOS encodings, including unofficial opcodes, with decimal arithmetic disabled. */
export declare const ricoh2a03Cpu: CpuDefinition;
/**
 * Looks up the NMOS decode-table form for a byte.
 *
 * @param opcode Opcode 0–255.
 * @returns The form at that slot (always defined, unofficial included).
 */
export declare function getOpcodeForm(opcode: number): InstructionForm;
/**
 * Full decode table for a CPU: CMOS variants use generated tables.
 * NMOS uses {@link nmos6502DecodeTable} filtered by features.
 * @param cpu The CPU definition.
 * @returns The decode table.
 */
export declare function getCpuDecodeTable(cpu: CpuDefinition): readonly InstructionForm[];
/**
 * Forms the assembler will encode (canonical only). Decode tables keep
 * duplicate unofficial encodings. Assembly does not.
 * @param cpu The CPU definition.
 * @returns The assembly forms.
 */
export declare function getCpuAssemblyForms(cpu: CpuDefinition): readonly InstructionForm[];
//# sourceMappingURL=opcodes.d.ts.map