export declare const hasOwn: <T extends object>(obj: T, key: PropertyKey) => key is keyof T;
export declare const ALT1 = 61;
export declare const ALT2 = 62;
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
export type ImpliedOpcode = "STOP" | "NOP" | "CACHE" | "LSR" | "ROL" | "LOOP" | "ALT1" | "ALT2" | "ALT3" | "PLOT" | "SWAP" | "COLOR" | "NOT" | "MERGE" | "SBK" | "SEX" | "ASR" | "ROR" | "LOB" | "FMULT" | "HIB" | "GETC" | "GETB";
export declare const IMPLIED_OPCODES: Record<ImpliedOpcode, number>;
export declare const PREFIXED_OPCODES: Record<string, {
    prefix: number;
    opcode: number;
}>;
export type ShortBranchOpcode = "BRA" | "BGE" | "BLT" | "BNE" | "BEQ" | "BPL" | "BMI" | "BCC" | "BCS" | "BVC" | "BVS";
export declare const SHORT_BRANCH_OPCODES: Record<ShortBranchOpcode, number>;
export type RegisterOpEncoding = {
    prefix?: number;
    base: number;
    min?: number;
    max?: number;
};
export declare const REGISTER_OPS: Record<string, RegisterOpEncoding>;
export declare const IMMEDIATE_OPS: Record<string, RegisterOpEncoding>;
export declare const INDIRECT_OPS: Record<string, RegisterOpEncoding>;
//# sourceMappingURL=superfx-encodings.d.ts.map