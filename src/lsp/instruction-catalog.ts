import type { InstructionAddressingMode, InstructionDescriptor } from "../architecture-types.js";

/**
 * Builds an implied/accumulator single-byte instruction descriptor.
 * @param {string} mnemonic The mnemonic.
 * @param {string} summary The hover summary.
 * @param {number} [opcode] The opcode byte when known.
 * @returns {InstructionDescriptor} The descriptor.
 */
function implied(mnemonic: string, summary: string, opcode?: number): InstructionDescriptor {
  return { mnemonic, summary, modes: [{ mode: "implied", syntax: "", opcode, size: 1 }] };
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
 * The Super FX (GSU) instruction catalog. Coverage focuses on the mnemonics the
 * assembler accepts so editors can complete and document them.
 */
export const superFxCatalog: InstructionDescriptor[] = [
  implied("STOP", "Stop the GSU.", 0x00),
  implied("NOP", "No operation.", 0x01),
  implied("CACHE", "Set the cache base register.", 0x02),
  instruction("LSR", "Logical shift right.", [{ mode: "implied", syntax: "" }]),
  instruction("ROL", "Rotate left.", [{ mode: "implied", syntax: "" }]),
  instruction("ROR", "Rotate right.", [{ mode: "implied", syntax: "" }]),
  instruction("BRA", "Branch always.", [{ mode: "relative", syntax: "label" }]),
  instruction("BEQ", "Branch if equal.", [{ mode: "relative", syntax: "label" }]),
  instruction("BNE", "Branch if not equal.", [{ mode: "relative", syntax: "label" }]),
  instruction("TO", "Set the destination register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("FROM", "Set the source register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("WITH", "Set source and destination register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("ADD", "Add to the accumulator register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("SUB", "Subtract from the accumulator register.", [
    { mode: "register", syntax: "Rn" },
  ]),
  instruction("AND", "Bitwise AND.", [{ mode: "register", syntax: "Rn" }]),
  instruction("OR", "Bitwise OR.", [{ mode: "register", syntax: "Rn" }]),
  instruction("MULT", "Signed multiply.", [{ mode: "register", syntax: "Rn" }]),
  instruction("RPIX", "Read pixel.", [{ mode: "implied", syntax: "" }]),
  instruction("DIV2", "Divide by two.", [{ mode: "implied", syntax: "" }]),
];

/**
 * Returns the static instruction catalog for an architecture name.
 * @param {string} architecture The architecture name (e.g. "65816", "spc700", "superfx").
 * @returns {InstructionDescriptor[]} The matching catalog, or the 65816 catalog as a default.
 */
export function getCatalogForArchitecture(architecture: string): InstructionDescriptor[] {
  switch (architecture.toLowerCase()) {
    case "spc700":
    case "spc700-raw":
    case "spc700-inline":
      return spc700Catalog;
    case "superfx":
      return superFxCatalog;
    case "65816":
    default:
      return cpu65816Catalog;
  }
}
