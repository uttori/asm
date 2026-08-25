import type { InstructionAddressingMode, InstructionDescriptor } from "@uttori/asm-core";

/**
 * Builds an implied/accumulator single-byte instruction descriptor.
 * @param {string} mnemonic The mnemonic.
 * @param {string} summary The hover summary.
 * @param {number} [opcode] The opcode byte when known.
 * @param {number} [size] Encoded size in bytes.
 * @returns {InstructionDescriptor} The descriptor.
 */
function implied(
  mnemonic: string,
  summary: string,
  opcode?: number,
  size = 1,
): InstructionDescriptor {
  return { mnemonic, summary, modes: [{ mode: "implied", syntax: "", opcode, size }] };
}

/**
 * Builds a relative branch instruction descriptor.
 * @param {string} mnemonic The mnemonic.
 * @param {string} summary The hover summary.
 * @param {number} opcode The opcode byte.
 * @param {number} [size] The instruction size in bytes.
 * @returns {InstructionDescriptor} The descriptor.
 */
function branch(
  mnemonic: string,
  summary: string,
  opcode: number,
  size = 2,
): InstructionDescriptor {
  return { mnemonic, summary, modes: [{ mode: "relative", syntax: "label", opcode, size }] };
}

/**
 * Builds an instruction descriptor with explicit addressing modes.
 * @param {string} mnemonic The mnemonic.
 * @param {string} summary The hover summary.
 * @param {InstructionAddressingMode[]} modes The supported addressing modes.
 * @returns {InstructionDescriptor} The descriptor.
 */
function instruction(
  mnemonic: string,
  summary: string,
  modes: InstructionAddressingMode[],
): InstructionDescriptor {
  return { mnemonic, summary, modes };
}

/** Common addressing-mode forms shared by the load/store/ALU family on 65816. */
const aluModes: InstructionAddressingMode[] = [
  { mode: "immediate", syntax: "#const" },
  { mode: "direct", syntax: "dp" },
  { mode: "directIndexedX", syntax: "dp,x" },
  { mode: "directIndirect", syntax: "(dp)" },
  { mode: "directIndirectLong", syntax: "[dp]" },
  { mode: "directIndexedXIndirect", syntax: "(dp,x)" },
  { mode: "directIndirectIndexedY", syntax: "(dp),y" },
  { mode: "directIndirectLongIndexedY", syntax: "[dp],y" },
  { mode: "absolute", syntax: "addr" },
  { mode: "absoluteIndexedX", syntax: "addr,x" },
  { mode: "absoluteIndexedY", syntax: "addr,y" },
  { mode: "absoluteLong", syntax: "long" },
  { mode: "absoluteLongIndexedX", syntax: "long,x" },
  { mode: "stackRelative", syntax: "sr,s" },
  { mode: "stackRelativeIndirectIndexedY", syntax: "(sr,s),y" },
];

/** Addressing modes for read-modify-write shift/rotate instructions. */
const shiftModes: InstructionAddressingMode[] = [
  { mode: "accumulator", syntax: "a", size: 1 },
  { mode: "direct", syntax: "dp" },
  { mode: "directIndexedX", syntax: "dp,x" },
  { mode: "absolute", syntax: "addr" },
  { mode: "absoluteIndexedX", syntax: "addr,x" },
];

/**
 * The 65816 instruction catalog. Summaries are concise descriptions of effect;
 * mode lists capture the addressing forms the assembler accepts so editors can
 * offer hover, completion, and signature help.
 */
export const cpu65816Catalog: InstructionDescriptor[] = [
  instruction("ADC", "Add with carry to the accumulator.", aluModes),
  instruction("AND", "Bitwise AND with the accumulator.", aluModes),
  instruction("ASL", "Arithmetic shift left.", shiftModes),
  branch("BCC", "Branch if carry clear.", 0x90),
  branch("BCS", "Branch if carry set.", 0xb0),
  branch("BEQ", "Branch if equal (zero set).", 0xf0),
  instruction("BIT", "Test bits against the accumulator.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" },
  ]),
  branch("BMI", "Branch if minus (negative set).", 0x30),
  branch("BNE", "Branch if not equal (zero clear).", 0xd0),
  branch("BPL", "Branch if plus (negative clear).", 0x10),
  branch("BRA", "Branch always.", 0x80),
  instruction("BRK", "Software break / interrupt.", [
    { mode: "stack", syntax: "", opcode: 0x00, size: 2 },
  ]),
  branch("BRL", "Branch always long (16-bit relative).", 0x82, 3),
  branch("BVC", "Branch if overflow clear.", 0x50),
  branch("BVS", "Branch if overflow set.", 0x70),
  implied("CLC", "Clear carry flag.", 0x18),
  implied("CLD", "Clear decimal flag.", 0xd8),
  implied("CLI", "Clear interrupt-disable flag.", 0x58),
  implied("CLV", "Clear overflow flag.", 0xb8),
  instruction("CMP", "Compare with the accumulator.", aluModes),
  instruction("COP", "Coprocessor enable interrupt.", [
    { mode: "stack", syntax: "#const", opcode: 0x02, size: 2 },
  ]),
  instruction("CPX", "Compare with the X register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "absolute", syntax: "addr" },
  ]),
  instruction("CPY", "Compare with the Y register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "absolute", syntax: "addr" },
  ]),
  instruction("DEC", "Decrement memory or the accumulator.", shiftModes),
  implied("DEX", "Decrement the X register.", 0xca),
  implied("DEY", "Decrement the Y register.", 0x88),
  instruction("EOR", "Bitwise exclusive-OR with the accumulator.", aluModes),
  instruction("INC", "Increment memory or the accumulator.", shiftModes),
  implied("INX", "Increment the X register.", 0xe8),
  implied("INY", "Increment the Y register.", 0xc8),
  instruction("JML", "Jump long (24-bit).", [
    { mode: "absoluteLong", syntax: "long", opcode: 0x5c, size: 4 },
    { mode: "absoluteIndirectLong", syntax: "[addr]", opcode: 0xdc, size: 3 },
  ]),
  instruction("JMP", "Jump.", [
    { mode: "absolute", syntax: "addr", opcode: 0x4c, size: 3 },
    { mode: "absoluteIndirect", syntax: "(addr)", opcode: 0x6c, size: 3 },
    { mode: "absoluteIndexedXIndirect", syntax: "(addr,x)", opcode: 0x7c, size: 3 },
  ]),
  instruction("JSL", "Jump to subroutine long.", [
    { mode: "absoluteLong", syntax: "long", opcode: 0x22, size: 4 },
  ]),
  instruction("JSR", "Jump to subroutine.", [
    { mode: "absolute", syntax: "addr", opcode: 0x20, size: 3 },
    { mode: "absoluteIndexedXIndirect", syntax: "(addr,x)", opcode: 0xfc, size: 3 },
  ]),
  instruction("LDA", "Load the accumulator.", aluModes),
  instruction("LDX", "Load the X register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedY", syntax: "dp,y" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedY", syntax: "addr,y" },
  ]),
  instruction("LDY", "Load the Y register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" },
  ]),
  instruction("LSR", "Logical shift right.", shiftModes),
  instruction("MVN", "Block move next (ascending).", [
    { mode: "blockMove", syntax: "destBank,srcBank", opcode: 0x54, size: 3 },
  ]),
  instruction("MVP", "Block move previous (descending).", [
    { mode: "blockMove", syntax: "destBank,srcBank", opcode: 0x44, size: 3 },
  ]),
  implied("NOP", "No operation.", 0xea),
  instruction("ORA", "Bitwise OR with the accumulator.", aluModes),
  instruction("PEA", "Push effective absolute address.", [
    { mode: "stack", syntax: "addr", opcode: 0xf4, size: 3 },
  ]),
  instruction("PEI", "Push effective indirect address.", [
    { mode: "stack", syntax: "(dp)", opcode: 0xd4, size: 2 },
  ]),
  instruction("PER", "Push effective PC-relative address.", [
    { mode: "stack", syntax: "label", opcode: 0x62, size: 3 },
  ]),
  implied("PHA", "Push the accumulator.", 0x48),
  implied("PHB", "Push the data bank register.", 0x8b),
  implied("PHD", "Push the direct page register.", 0x0b),
  implied("PHK", "Push the program bank register.", 0x4b),
  implied("PHP", "Push the processor status register.", 0x08),
  implied("PHX", "Push the X register.", 0xda),
  implied("PHY", "Push the Y register.", 0x5a),
  implied("PLA", "Pull the accumulator.", 0x68),
  implied("PLB", "Pull the data bank register.", 0xab),
  implied("PLD", "Pull the direct page register.", 0x2b),
  implied("PLP", "Pull the processor status register.", 0x28),
  implied("PLX", "Pull the X register.", 0xfa),
  implied("PLY", "Pull the Y register.", 0x7a),
  instruction("REP", "Reset status bits.", [
    { mode: "immediate", syntax: "#const", opcode: 0xc2, size: 2 },
  ]),
  instruction("ROL", "Rotate left through carry.", shiftModes),
  instruction("ROR", "Rotate right through carry.", shiftModes),
  implied("RTI", "Return from interrupt.", 0x40),
  implied("RTL", "Return from subroutine long.", 0x6b),
  implied("RTS", "Return from subroutine.", 0x60),
  instruction("SBC", "Subtract with borrow from the accumulator.", aluModes),
  implied("SEC", "Set carry flag.", 0x38),
  implied("SED", "Set decimal flag.", 0xf8),
  implied("SEI", "Set interrupt-disable flag.", 0x78),
  instruction("SEP", "Set status bits.", [
    { mode: "immediate", syntax: "#const", opcode: 0xe2, size: 2 },
  ]),
  instruction(
    "STA",
    "Store the accumulator.",
    aluModes.filter((mode) => mode.mode !== "immediate"),
  ),
  implied("STP", "Stop the processor.", 0xdb),
  instruction("STX", "Store the X register.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedY", syntax: "dp,y" },
    { mode: "absolute", syntax: "addr" },
  ]),
  instruction("STY", "Store the Y register.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
  ]),
  instruction("STZ", "Store zero to memory.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" },
  ]),
  implied("TAX", "Transfer accumulator to X.", 0xaa),
  implied("TAY", "Transfer accumulator to Y.", 0xa8),
  implied("TCD", "Transfer accumulator to direct page register.", 0x5b),
  implied("TCS", "Transfer accumulator to stack pointer.", 0x1b),
  implied("TDC", "Transfer direct page register to accumulator.", 0x7b),
  implied("TSC", "Transfer stack pointer to accumulator.", 0x3b),
  implied("TSX", "Transfer stack pointer to X.", 0xba),
  implied("TXA", "Transfer X to accumulator.", 0x8a),
  implied("TXS", "Transfer X to stack pointer.", 0x9a),
  implied("TXY", "Transfer X to Y.", 0x9b),
  implied("TYA", "Transfer Y to accumulator.", 0x98),
  implied("TYX", "Transfer Y to X.", 0xbb),
  implied("WAI", "Wait for interrupt.", 0xcb),
  instruction("WDM", "Reserved (William D. Mensch) opcode.", [
    { mode: "immediate", syntax: "#const", opcode: 0x42, size: 2 },
  ]),
  implied("XBA", "Exchange the bytes of the accumulator.", 0xeb),
  implied("XCE", "Exchange carry and emulation flags.", 0xfb),
];

/**
 * The SPC700 (sound CPU) instruction catalog. Summaries describe effects and
 * mode lists capture the operand forms accepted by the assembler.
 */
export const spc700Catalog: InstructionDescriptor[] = [
  instruction("MOV", "Move data between registers and memory.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
    { mode: "directRegister", syntax: "dp,A" },
    { mode: "absoluteRegister", syntax: "!addr,A" },
    { mode: "registerIndirect", syntax: "A,(X)" },
    { mode: "directDirect", syntax: "dp,dp" },
    { mode: "directImmediate", syntax: "dp,#const" },
  ]),
  instruction("ADC", "Add with carry.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
    { mode: "directDirect", syntax: "dp,dp" },
  ]),
  instruction("SBC", "Subtract with borrow.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
  ]),
  instruction("CMP", "Compare.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
  ]),
  instruction("AND", "Bitwise AND.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
  ]),
  instruction("OR", "Bitwise OR.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
  ]),
  instruction("EOR", "Bitwise exclusive-OR.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
  ]),
  instruction("INC", "Increment.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  instruction("DEC", "Decrement.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  instruction("ASL", "Arithmetic shift left.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  instruction("LSR", "Logical shift right.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  instruction("ROL", "Rotate left.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  instruction("ROR", "Rotate right.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" },
  ]),
  branch("BRA", "Branch always.", 0x2f),
  branch("BEQ", "Branch if equal.", 0xf0),
  branch("BNE", "Branch if not equal.", 0xd0),
  branch("BCS", "Branch if carry set.", 0xb0),
  branch("BCC", "Branch if carry clear.", 0x90),
  branch("BVS", "Branch if overflow set.", 0x70),
  branch("BVC", "Branch if overflow clear.", 0x50),
  branch("BMI", "Branch if minus.", 0x30),
  branch("BPL", "Branch if plus.", 0x10),
  instruction("CBNE", "Compare and branch if not equal.", [
    { mode: "directRelative", syntax: "dp,label" },
  ]),
  instruction("DBNZ", "Decrement and branch if not zero.", [
    { mode: "directRelative", syntax: "dp,label" },
  ]),
  instruction("JMP", "Jump.", [
    { mode: "absolute", syntax: "!addr" },
    { mode: "absoluteIndexedXIndirect", syntax: "[!addr+X]" },
  ]),
  instruction("CALL", "Call subroutine.", [
    { mode: "absolute", syntax: "!addr", opcode: 0x3f, size: 3 },
  ]),
  implied("RET", "Return from subroutine.", 0x6f),
  implied("RETI", "Return from interrupt.", 0x7f),
  implied("NOP", "No operation.", 0x00),
  implied("CLRC", "Clear carry.", 0x60),
  implied("SETC", "Set carry.", 0x80),
  implied("CLRP", "Clear direct page flag.", 0x20),
  implied("SETP", "Set direct page flag.", 0x40),
  implied("EI", "Enable interrupts.", 0xa0),
  implied("DI", "Disable interrupts.", 0xc0),
  implied("STOP", "Stop the processor.", 0xff),
  instruction("PUSH", "Push a register to the stack.", [{ mode: "register", syntax: "A" }]),
  instruction("POP", "Pop a register from the stack.", [{ mode: "register", syntax: "A" }]),
];

/**
 * The Super FX (GSU) instruction catalog. Coverage matches the mnemonics the
 * assembler accepts so editors can complete and document them.
 */
const superFxRegister = { mode: "register", syntax: "Rn", size: 1 };
const superFxRegisterAlt = { mode: "register", syntax: "Rn", size: 2 };
const superFxImmediateAlt = { mode: "immediate", syntax: "#n", size: 2 };
const superFxIndirect = { mode: "registerIndirect", syntax: "(Rn)", size: 1 };
const superFxIndirectAlt = { mode: "registerIndirect", syntax: "(Rn)", size: 2 };

export const superFxCatalog: InstructionDescriptor[] = [
  implied("STOP", "Stop the GSU.", 0x00),
  implied("NOP", "No operation.", 0x01),
  implied("CACHE", "Set the cache base register.", 0x02),
  implied("LSR", "Logical shift right.", 0x03),
  implied("ROL", "Rotate left.", 0x04),
  implied("LOOP", "Decrement R13 and branch if non-zero.", 0x3c),
  implied("ALT1", "Set ALT1 prefix.", 0x3d),
  implied("ALT2", "Set ALT2 prefix.", 0x3e),
  implied("ALT3", "Set ALT1 and ALT2 prefixes.", 0x3f),
  implied("PLOT", "Plot a pixel.", 0x4c),
  implied("SWAP", "Swap high and low bytes of SReg.", 0x4d),
  implied("COLOR", "Set the plot color from SReg.", 0x4e),
  implied("NOT", "Bitwise NOT of SReg.", 0x4f),
  implied("MERGE", "Merge high bytes of R7 and R8.", 0x70),
  implied("SBK", "Store SReg back to the last RAM address.", 0x90),
  implied("SEX", "Sign-extend the low byte of SReg.", 0x95),
  implied("ASR", "Arithmetic shift right of SReg.", 0x96),
  implied("ROR", "Rotate SReg right through carry.", 0x97),
  implied("LOB", "Keep the low byte of SReg.", 0x9e),
  implied("FMULT", "Fractional signed multiply.", 0x9f),
  implied("HIB", "Keep the high byte of SReg.", 0xc0),
  implied("GETC", "Get byte from ROM into the plot color.", 0xdf),
  implied("GETB", "Get byte from ROM into SReg.", 0xef),
  implied("RPIX", "Read pixel.", 0x3d, 2),
  implied("CMODE", "Set plot color mode.", 0x3d, 2),
  implied("DIV2", "Arithmetic shift right and clear the least bit.", 0x3d, 2),
  implied("LMULT", "Signed 16×16 multiply.", 0x3d, 2),
  implied("GETBH", "Get ROM byte into the high byte of SReg.", 0x3d, 2),
  implied("RAMB", "Set the RAM bank from SReg.", 0x3e, 2),
  implied("GETBL", "Get ROM byte into the low byte of SReg.", 0x3e, 2),
  implied("ROMB", "Set the ROM bank from SReg.", 0x3f, 2),
  implied("GETBS", "Get ROM byte sign-extended into SReg.", 0x3f, 2),
  branch("BRA", "Branch always.", 0x05),
  branch("BGE", "Branch if greater or equal.", 0x06),
  branch("BLT", "Branch if less than.", 0x07),
  branch("BNE", "Branch if not equal.", 0x08),
  branch("BEQ", "Branch if equal.", 0x09),
  branch("BPL", "Branch if plus.", 0x0a),
  branch("BMI", "Branch if minus.", 0x0b),
  branch("BCC", "Branch if carry clear.", 0x0c),
  branch("BCS", "Branch if carry set.", 0x0d),
  branch("BVC", "Branch if overflow clear.", 0x0e),
  branch("BVS", "Branch if overflow set.", 0x0f),
  instruction("TO", "Set the destination register.", [{ ...superFxRegister, opcode: 0x10 }]),
  instruction("WITH", "Set source and destination register.", [
    { ...superFxRegister, opcode: 0x20 },
  ]),
  instruction("FROM", "Set the source register.", [{ ...superFxRegister, opcode: 0xb0 }]),
  instruction("ADD", "Add to SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("ADC", "Add to SReg with carry.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("SUB", "Subtract from SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("SBC", "Subtract from SReg with borrow.", [superFxRegisterAlt]),
  instruction("CMP", "Compare SReg with Rn.", [superFxRegisterAlt]),
  instruction("AND", "Bitwise AND with SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("BIC", "Bit clear SReg.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("OR", "Bitwise OR with SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("XOR", "Bitwise exclusive-OR with SReg.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("MULT", "Signed 8-bit multiply.", [superFxRegister, superFxImmediateAlt]),
  instruction("UMULT", "Unsigned 8-bit multiply.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("JMP", "Jump to address in Rn (R8-R13).", [superFxRegister]),
  instruction("LJMP", "Long jump via Rn (R8-R13).", [superFxRegisterAlt]),
  instruction("INC", "Increment Rn (R0-R14).", [superFxRegister]),
  instruction("DEC", "Decrement Rn (R0-R14).", [superFxRegister]),
  instruction("LINK", "Set R11 to PBR:PC+n.", [
    { mode: "immediate", syntax: "#n", opcode: 0x90, size: 1 },
  ]),
  instruction("STW", "Store word at (Rn).", [superFxIndirect]),
  instruction("LDW", "Load word from (Rn).", [superFxIndirect]),
  instruction("STB", "Store byte at (Rn).", [superFxIndirectAlt]),
  instruction("LDB", "Load byte from (Rn).", [superFxIndirectAlt]),
  instruction("IBT", "Load Rn with a signed byte.", [
    { mode: "registerImmediate", syntax: "Rn,#imm", opcode: 0xa0, size: 2 },
  ]),
  instruction("IWT", "Load Rn with a word.", [
    { mode: "registerImmediate", syntax: "Rn,#imm", opcode: 0xf0, size: 3 },
  ]),
  instruction("LM", "Load Rn from RAM.", [
    { mode: "registerIndirectAbsolute", syntax: "Rn,(addr)", size: 4 },
  ]),
  instruction("LMS", "Load Rn from short RAM.", [
    { mode: "registerIndirectShort", syntax: "Rn,(xx)", size: 3 },
  ]),
  instruction("SM", "Store Rn to RAM.", [
    { mode: "indirectAbsoluteRegister", syntax: "(addr),Rn", size: 4 },
  ]),
  instruction("SMS", "Store Rn to short RAM.", [
    { mode: "indirectShortRegister", syntax: "(xx),Rn", size: 3 },
  ]),
  instruction("LEA", "Load Rn with the effective address.", [
    { mode: "registerAbsolute", syntax: "Rn,addr", opcode: 0xf0, size: 3 },
  ]),
  instruction("MOVE", "Move register, immediate, or RAM data.", [
    { mode: "registerRegister", syntax: "Rn,Rm", size: 2 },
    { mode: "registerImmediate", syntax: "Rn,#imm" },
    { mode: "registerIndirectAbsolute", syntax: "Rn,(addr)" },
    { mode: "indirectAbsoluteRegister", syntax: "(addr),Rn" },
  ]),
  instruction("MOVES", "Move Rm to Rn and update flags.", [
    { mode: "registerRegister", syntax: "Rn,Rm", size: 2 },
  ]),
  instruction("MOVEB", "Move a byte through (Rn).", [
    { mode: "indirectRegister", syntax: "(Rn),Rm" },
    { mode: "registerIndirect", syntax: "Rn,(Rm)" },
  ]),
  instruction("MOVEW", "Move a word through (Rn).", [
    { mode: "indirectRegister", syntax: "(Rn),Rm" },
    { mode: "registerIndirect", syntax: "Rn,(Rm)" },
  ]),
];
