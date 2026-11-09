/**
 * Type-safe `Object.hasOwn` helper for opcode lookup tables.
 * @param obj Object to test.
 * @param key Property key candidate.
 * @returns True when `key` is an own property of `obj`.
 */
export const hasOwn = (obj, key) => Object.hasOwn(obj, key);
/** GSU ALT1 prefix opcode byte (`0x3D`). */
export const ALT1 = 0x3d;
/** GSU ALT2 prefix opcode byte (`0x3E`). */
export const ALT2 = 0x3e;
/** GSU ALT3 prefix opcode byte (`0x3F`). */
export const ALT3 = 0x3f;
/** Primary opcode byte for each implied GSU mnemonic. */
export const IMPLIED_OPCODES = {
    STOP: 0x00,
    NOP: 0x01,
    CACHE: 0x02,
    LSR: 0x03,
    ROL: 0x04,
    LOOP: 0x3c,
    ALT1: ALT1,
    ALT2: ALT2,
    ALT3: ALT3,
    PLOT: 0x4c,
    SWAP: 0x4d,
    COLOR: 0x4e,
    NOT: 0x4f,
    MERGE: 0x70,
    SBK: 0x90,
    SEX: 0x95,
    ASR: 0x96,
    ROR: 0x97,
    LOB: 0x9e,
    FMULT: 0x9f,
    HIB: 0xc0,
    GETC: 0xdf,
    GETB: 0xef,
};
/** Two-byte GSU forms that share an ALT prefix plus a trailing opcode. */
export const PREFIXED_OPCODES = {
    RPIX: { prefix: ALT1, opcode: 0x4c },
    CMODE: { prefix: ALT1, opcode: 0x4e },
    DIV2: { prefix: ALT1, opcode: 0x96 },
    LMULT: { prefix: ALT1, opcode: 0x9f },
    GETBH: { prefix: ALT1, opcode: 0xef },
    RAMB: { prefix: ALT2, opcode: 0xdf },
    GETBL: { prefix: ALT2, opcode: 0xef },
    ROMB: { prefix: ALT3, opcode: 0xdf },
    GETBS: { prefix: ALT3, opcode: 0xef },
};
/** Branch opcode byte for each short GSU conditional mnemonic. */
export const SHORT_BRANCH_OPCODES = {
    BRA: 0x05,
    BGE: 0x06,
    BLT: 0x07,
    BNE: 0x08,
    BEQ: 0x09,
    BPL: 0x0a,
    BMI: 0x0b,
    BCC: 0x0c,
    BCS: 0x0d,
    BVC: 0x0e,
    BVS: 0x0f,
};
/** Register-operand GSU mnemonics mapped to their opcode bases and ALT variants. */
export const REGISTER_OPS = {
    TO: { base: 0x10 },
    WITH: { base: 0x20 },
    ADD: { base: 0x50 },
    SUB: { base: 0x60 },
    AND: { base: 0x70, min: 1, max: 15 },
    MULT: { base: 0x80 },
    JMP: { base: 0x90, min: 8, max: 13 },
    FROM: { base: 0xb0 },
    OR: { base: 0xc0, min: 1, max: 15 },
    INC: { base: 0xd0, min: 0, max: 14 },
    DEC: { base: 0xe0, min: 0, max: 14 },
    ADC: { prefix: ALT1, base: 0x50 },
    SBC: { prefix: ALT1, base: 0x60 },
    BIC: { prefix: ALT1, base: 0x70, min: 1, max: 15 },
    UMULT: { prefix: ALT1, base: 0x80 },
    LJMP: { prefix: ALT1, base: 0x90, min: 8, max: 13 },
    XOR: { prefix: ALT1, base: 0xc0, min: 1, max: 15 },
    CMP: { prefix: ALT3, base: 0x60 },
};
/** Immediate-nibble GSU forms under ALT2/ALT3 prefix groups. */
export const IMMEDIATE_OPS = {
    LINK: { base: 0x90, min: 1, max: 4 },
    ADD: { prefix: ALT2, base: 0x50 },
    SUB: { prefix: ALT2, base: 0x60 },
    AND: { prefix: ALT2, base: 0x70, min: 1, max: 15 },
    MULT: { prefix: ALT2, base: 0x80 },
    OR: { prefix: ALT2, base: 0xc0, min: 1, max: 15 },
    ADC: { prefix: ALT3, base: 0x50 },
    BIC: { prefix: ALT3, base: 0x70, min: 1, max: 15 },
    UMULT: { prefix: ALT3, base: 0x80 },
    XOR: { prefix: ALT3, base: 0xc0, min: 1, max: 15 },
};
/** Indirect RAM pointer opcodes limited to registers R0–R11. */
export const INDIRECT_OPS = {
    STW: { base: 0x30, min: 0, max: 11 },
    LDW: { base: 0x40, min: 0, max: 11 },
    STB: { prefix: ALT1, base: 0x30, min: 0, max: 11 },
    LDB: { prefix: ALT1, base: 0x40, min: 0, max: 11 },
};
//# sourceMappingURL=superfx-encodings.js.map