/**
 * Type-safe `Object.hasOwn` helper for opcode lookup tables.
 * @param obj Object to test.
 * @param key Property key candidate.
 * @returns True when `key` is an own property of `obj`.
 */
export declare const hasOwn: <T extends object>(obj: T, key: PropertyKey) => key is keyof T;
/** GSU ALT1 prefix opcode byte (`0x3D`). */
export declare const ALT1 = 61;
/** GSU ALT2 prefix opcode byte (`0x3E`). */
export declare const ALT2 = 62;
/** GSU ALT3 prefix opcode byte (`0x3F`). */
export declare const ALT3 = 63;
/**
 * Super FX (GSU) encoding notes
 *
 * Most ALU ops overlay the same 50-CF group. ALT prefixes pick the variant:
 *   none  Rn     ADD/SUB/AND/MULT/OR
 *   3D    ALT1   ADC/SBC/BIC/UMULT/XOR, plus STB/LDB, RPIX, CMODE, DIV2, LMULT
 *   3E    ALT2   ADD/SUB/AND/MULT/OR #n, SM/SMS, RAMB
 *   3F    ALT3   ADC/BIC/UMULT/XOR #n, CMP Rn, ROMB
 *
 * AND R0 / OR R0 are MERGE / HIB, so AND/OR/BIC/XOR require R1-R15.
 * LDB/STB/LDW/STW occupy 30-3B / 40-4B, so pointer registers are R0-R11.
 */
/** Mnemonics encoded as a single implied opcode byte. */
export type ImpliedOpcode = "STOP" | "NOP" | "CACHE" | "LSR" | "ROL" | "LOOP" | "ALT1" | "ALT2" | "ALT3" | "PLOT" | "SWAP" | "COLOR" | "NOT" | "MERGE" | "SBK" | "SEX" | "ASR" | "ROR" | "LOB" | "FMULT" | "HIB" | "GETC" | "GETB";
/** Primary opcode byte for each implied GSU mnemonic. */
export declare const IMPLIED_OPCODES: Record<ImpliedOpcode, number>;
/** Two-byte GSU forms that share an ALT prefix plus a trailing opcode. */
export declare const PREFIXED_OPCODES: Record<string, {
    prefix: number;
    opcode: number;
}>;
/** Short conditional branch mnemonics encoded with a signed displacement byte. */
export type ShortBranchOpcode = "BRA" | "BGE" | "BLT" | "BNE" | "BEQ" | "BPL" | "BMI" | "BCC" | "BCS" | "BVC" | "BVS";
/** Branch opcode byte for each short GSU conditional mnemonic. */
export declare const SHORT_BRANCH_OPCODES: Record<ShortBranchOpcode, number>;
/** Register-indexed opcode layout with optional ALT prefix and inclusive bounds. */
export type RegisterOpEncoding = {
    /** Optional ALT prefix emitted before the register-indexed opcode. */
    prefix?: number;
    /** Opcode base added to the hardware register index. */
    base: number;
    /** Lowest allowed register index, default 0. */
    min?: number;
    /** Highest allowed register index, default 15. */
    max?: number;
};
/** Register-operand GSU mnemonics mapped to their opcode bases and ALT variants. */
export declare const REGISTER_OPS: Record<string, RegisterOpEncoding>;
/** Immediate-nibble GSU forms under ALT2/ALT3 prefix groups. */
export declare const IMMEDIATE_OPS: Record<string, RegisterOpEncoding>;
/** Indirect RAM pointer opcodes limited to registers R0–R11. */
export declare const INDIRECT_OPS: Record<string, RegisterOpEncoding>;
//# sourceMappingURL=superfx-encodings.d.ts.map