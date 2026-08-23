import {
  createEncoderRuntime,
  type ArchitectureEncoder,
  type ArchitectureEncoderContext,
  type EncoderRuntime,
  type InstructionDescriptor,
  type LoweredInstruction,
  type LoweredOperand,
} from "./architecture-types.js";
import { spc700Catalog } from "./lsp/instruction-catalog.js";

let debug = (..._: unknown[]) => {};
try {
  const { default: d } = await import("debug");
  debug = d("ArchSPC700");
} catch {}

const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
  Object.hasOwn(obj, key);

/**
 * Infers the encoded address width from the source spelling of an operand.
 * This intentionally prefers "$12" vs. "$1234" over the resolved numeric value
 * so symbolic operands do not get shortened to direct-page just because their
 * final address currently fits in one byte.
 * @param {string} operand the operand
 * @returns {number} The address size.
 */
function getAddressSize(operand: string): number {
  const match = operand.match(/^\$([\dA-Fa-f]+)/);
  if (!match) {
    return 2;
  }
  const hexpart = match[1];
  if (hexpart.length <= 2) {
    return 1;
  }
  return 2;
}

const IMPLIED_SPC_OPCODES: Record<string, true> = {
  NOP: true,
  BRK: true,
  RET: true,
  RETI: true,
  CLRP: true,
  SETP: true,
  CLRC: true,
  SETC: true,
  EI: true,
  DI: true,
  CLRV: true,
  NOTC: true,
  SLEEP: true,
  STOP: true,
  XCN: true,
};

const SHIFT_INC_DEC_OPCODES: Record<string, true> = {
  ASL: true,
  LSR: true,
  ROL: true,
  ROR: true,
  INC: true,
  DEC: true,
};

const MOV_ONE_BYTE_PAIRS = new Set([
  "X,A",
  "A,X",
  "X,SP",
  "SP,X",
  "A,Y",
  "Y,A",
  "(X+),A",
  "A,(X+)",
  "(X),A",
  "A,(X)",
]);

/**
 * Opcode plus a dp (1) or abs (2) operand.
 * @param {string} operand Address operand spelling.
 * @returns {number} Encoded size in bytes.
 */
function spcOpcodePlusAddressSize(operand: string): number {
  if (getAddressSize(operand) === 1) {
    return 2;
  }
  return 3;
}

/**
 * True when both MOV operands are a 1-byte register/(X) form.
 * @param {string} left Left operand.
 * @param {string} right Right operand.
 * @returns {boolean} True for 1-byte MOV pairs.
 */
function isMovRegisterPair(left: string, right: string): boolean {
  const combined = `${left.trim()},${right.trim()}`.toUpperCase().replace(/\s+/g, "");
  return MOV_ONE_BYTE_PAIRS.has(combined);
}

/**
 * Checks if the operand is something like "A", "(X)", etc.
 * @param {string} op the operand
 * @param {LoweredOperand} lowered the lowered operand metadata
 * @returns {boolean} True if the operand is an accumulator, false otherwise.
 */
function isAccumulator(op: string, lowered?: LoweredOperand): boolean {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "A") {
    return true;
  }
  return op.toUpperCase() === "A";
}
/**
 *
 * @param {string} op the operand
 * @param {LoweredOperand} lowered the lowered operand metadata
 * @returns {boolean} True if the operand is a register X, false otherwise.
 */
function isRegisterX(op: string, lowered?: LoweredOperand): boolean {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op.toUpperCase() === "X";
}
/**
 *
 * @param {string} op the operand
 * @param {LoweredOperand} lowered the lowered operand metadata
 * @returns {boolean} True if the operand is a register Y, false otherwise.
 */
function isRegisterY(op: string, lowered?: LoweredOperand): boolean {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op.toUpperCase() === "Y";
}
/**
 *
 * @param {string} op the operand
 * @param {LoweredOperand} lowered the lowered operand metadata
 * @returns {boolean} True if the operand is a parenthesis X, false otherwise.
 */
function isParenX(op: string, lowered?: LoweredOperand): boolean {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op.trim().toUpperCase() === "(X)";
}
/**
 *
 * @param {string} op the operand
 * @param {LoweredOperand} lowered the lowered operand metadata
 * @returns {boolean} True if the operand is a parenthesis Y, false otherwise.
 */
function isParenY(op: string, lowered?: LoweredOperand): boolean {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op.trim().toUpperCase() === "(Y)";
}

/**
 * Holds separate opcode sets for each of the "memory" instructions (ADC, AND, EOR, OR, SBC, CMP).
 * The format generally is:
 *
 * {
 *   a_indirectX: 0x86,   // e.g. ADC A,(X)
 *   a_indirectDpX: 0x87, // e.g. ADC A,($dp+X)
 *   a_imm: 0x88,         // e.g. ADC A,#$xx
 *   a_absX: 0x95,        // e.g. ADC A,$xxxx+X
 *   a_dpX: 0x94,         // e.g. ADC A,$dp+X
 *   a_absY: 0x96,
 *   a_indirectDpY: 0x97,
 *   a_abs: 0x85,         // e.g. ADC A,$1234
 *   a_dp: 0x84,          // e.g. ADC A,$12
 *   xy_indirect: 0x99,   // e.g. ADC (X),(Y)
 *   dp_imm: 0x98,        // e.g. ADC $dp,#$imm
 *   dp_dp: 0x89,         // e.g. ADC $dp,$dp
 * }
 */
type MemOpcode = "ADC" | "AND" | "EOR" | "OR" | "SBC" | "CMP";
type MemOpTable = {
  a_indirectX: number;
  a_indirectDpX: number;
  a_imm: number;
  a_absX: number;
  a_dpX: number;
  a_absY: number;
  a_indirectDpY: number;
  a_abs: number;
  a_dp: number;
  xy_indirect: number;
  dp_imm: number;
  dp_dp: number;
};
const memOpTables: Record<MemOpcode, MemOpTable> = {
  ADC: {
    a_indirectX: 0x86,
    a_indirectDpX: 0x87,
    a_imm: 0x88,
    a_absX: 0x95,
    a_dpX: 0x94,
    a_absY: 0x96,
    a_indirectDpY: 0x97,
    a_abs: 0x85,
    a_dp: 0x84,
    xy_indirect: 0x99,
    dp_imm: 0x98,
    dp_dp: 0x89,
  },
  AND: {
    a_indirectX: 0x26,
    a_indirectDpX: 0x27,
    a_imm: 0x28,
    a_absX: 0x35,
    a_dpX: 0x34,
    a_absY: 0x36,
    a_indirectDpY: 0x37,
    a_abs: 0x25,
    a_dp: 0x24,
    xy_indirect: 0x39,
    dp_imm: 0x38,
    dp_dp: 0x29,
  },
  EOR: {
    a_indirectX: 0x46,
    a_indirectDpX: 0x47,
    a_imm: 0x48,
    a_absX: 0x55,
    a_dpX: 0x54,
    a_absY: 0x56,
    a_indirectDpY: 0x57,
    a_abs: 0x45,
    a_dp: 0x44,
    xy_indirect: 0x59,
    dp_imm: 0x58,
    dp_dp: 0x49,
  },
  OR: {
    a_indirectX: 0x06,
    a_indirectDpX: 0x07,
    a_imm: 0x08,
    a_absX: 0x15,
    a_dpX: 0x14,
    a_absY: 0x16,
    a_indirectDpY: 0x17,
    a_abs: 0x05,
    a_dp: 0x04,
    xy_indirect: 0x19,
    dp_imm: 0x18,
    dp_dp: 0x09,
  },
  SBC: {
    a_indirectX: 0xa6,
    a_indirectDpX: 0xa7,
    a_imm: 0xa8,
    a_absX: 0xb5,
    a_dpX: 0xb4,
    a_absY: 0xb6,
    a_indirectDpY: 0xb7,
    a_abs: 0xa5,
    a_dp: 0xa4,
    xy_indirect: 0xb9,
    dp_imm: 0xb8,
    dp_dp: 0xa9,
  },
  CMP: {
    // The test file merges both "CMP A" forms and "CMP X/Y" forms. We'll handle the "A," forms here:
    a_indirectX: 0x66,
    a_indirectDpX: 0x67,
    a_imm: 0x68,
    a_absX: 0x75,
    a_dpX: 0x74,
    a_absY: 0x76,
    a_indirectDpY: 0x77,
    a_abs: 0x65,
    a_dp: 0x64,
    xy_indirect: 0x79,
    dp_imm: 0x78,
    dp_dp: 0x69,
  },
};

type BranchOpcode = "BPL" | "BMI" | "BVC" | "BVS" | "BCC" | "BCS" | "BNE" | "BEQ" | "BRA";
const branchOpcodes: Record<BranchOpcode, number> = {
  BPL: 0x10,
  BMI: 0x30,
  BVC: 0x50,
  BVS: 0x70,
  BCC: 0x90,
  BCS: 0xb0,
  BNE: 0xd0,
  BEQ: 0xf0,
  BRA: 0x2f,
};

type BitSetClearOpcode =
  | "SET0"
  | "SET1"
  | "SET2"
  | "SET3"
  | "SET4"
  | "SET5"
  | "SET6"
  | "SET7"
  | "CLR0"
  | "CLR1"
  | "CLR2"
  | "CLR3"
  | "CLR4"
  | "CLR5"
  | "CLR6"
  | "CLR7";
const bitSetClearOpcodes: Record<BitSetClearOpcode, number> = {
  SET0: 0x02,
  SET1: 0x22,
  SET2: 0x42,
  SET3: 0x62,
  SET4: 0x82,
  SET5: 0xa2,
  SET6: 0xc2,
  SET7: 0xe2,
  CLR0: 0x12,
  CLR1: 0x32,
  CLR2: 0x52,
  CLR3: 0x72,
  CLR4: 0x92,
  CLR5: 0xb2,
  CLR6: 0xd2,
  CLR7: 0xf2,
};

type BitBranchFamily = "BBS" | "BBC";

type BitBranchOpcode = {
  family: BitBranchFamily;
  mnemonicBit?: number;
};

/**
 * Parses numbered (`BBS3`) and wiki-native (`BBS $dp.n`) bit-branch mnemonics.
 * @param {string} opcode Instruction mnemonic.
 * @returns {BitBranchOpcode | undefined} Family and optional mnemonic bit.
 */
function parseBitBranchOpcode(opcode: string): BitBranchOpcode | undefined {
  const match = opcode.toUpperCase().match(/^(BBS|BBC)([0-7])?$/);
  if (!match) {
    return undefined;
  }
  if (match[2] === undefined) {
    return { family: match[1] as BitBranchFamily };
  }
  return { family: match[1] as BitBranchFamily, mnemonicBit: Number(match[2]) };
}

/**
 * Opcode byte for BBS/BBC: bit in bits 7–5, low nibble 3 / 13.
 * @param {BitBranchFamily} family BBS or BBC.
 * @param {number} bit Bit 0–7.
 * @returns {number} Opcode byte.
 */
function bitBranchOpcodeByte(family: BitBranchFamily, bit: number): number {
  if (family === "BBS") {
    return (bit << 5) | 0x03;
  }
  return (bit << 5) | 0x13;
}

type WordOpWithYaLeft = "CMPW" | "ADDW" | "SUBW" | "MOVW";
const wordOpsWithYaLeft: Record<WordOpWithYaLeft, number> = {
  CMPW: 0x5a,
  ADDW: 0x7a,
  SUBW: 0x9a,
  MOVW: 0xba,
};

const wordOpsWithYaRight: Record<"MOVW", number> = {
  MOVW: 0xda,
};

const singleWordOps: Record<"DECW" | "INCW", number> = {
  DECW: 0x1a,
  INCW: 0x3a,
};

type NumberedBitFamily = "NOT" | "OR" | "AND" | "EOR" | "MOV";

type NumberedBitOpcode = {
  family: NumberedBitFamily;
  mnemonicBit: number;
};

const NUMBERED_BIT_OPCODE = /^(NOT|OR|AND|EOR|MOV)([0-7])$/;

/**
 * Parses TASM/Asar numbered mem.bit mnemonics (`NOT2`, `OR1`, `MOV5`, …).
 * Native hardware names are the `*1` forms; the digit is the default bit.
 * @param {string} opcode Instruction mnemonic.
 * @returns {NumberedBitOpcode | undefined} Family and mnemonic bit, if any.
 */
function parseNumberedBitOpcode(opcode: string): NumberedBitOpcode | undefined {
  const match = opcode.toUpperCase().match(NUMBERED_BIT_OPCODE);
  if (!match) {
    return undefined;
  }
  return {
    family: match[1] as NumberedBitFamily,
    mnemonicBit: Number(match[2]),
  };
}

type SpcMemBitOperand = {
  addressText: string;
  bit?: number;
  invert: boolean;
};

/**
 * Parses a mem.bit operand: `$addr`, `$addr.n`, `!$addr`, `/addr.n`.
 * @param {string} raw Operand text.
 * @returns {SpcMemBitOperand | undefined} Address text, optional bit, invert flag.
 */
function parseSpcMemBitOperand(raw: string): SpcMemBitOperand | undefined {
  let rest = raw.trim();
  if (rest === "") {
    return undefined;
  }
  let invert = false;
  if (rest.startsWith("!") || rest.startsWith("/")) {
    invert = true;
    rest = rest.slice(1).trim();
  }
  const dotted = rest.match(/^(.*)\.([0-7])$/);
  if (dotted) {
    return {
      addressText: dotted[1].trim(),
      bit: Number(dotted[2]),
      invert,
    };
  }
  return { addressText: rest, invert };
}

/**
 * Parses a standalone bit number (`0`–`7`, optional `#`).
 * @param {string} raw Operand text.
 * @returns {number | undefined} Bit 0–7, or undefined if not a bit literal.
 */
function parseSpcBitNumber(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/^#/, "");
  if (!/^[0-7]$/.test(trimmed)) {
    return undefined;
  }
  return Number(trimmed);
}

/**
 * Additional instructions share similar addressing forms but have unique opcodes,
 * e.g. "(X),(Y)" or "$dp,#$imm", etc. However, some instructions (like "CMP X,#imm")
 * differ in syntax. We'll handle that in code directly.
 */

export class ArchSPC700 implements ArchitectureEncoder {
  assembler: EncoderRuntime;

  constructor(context: ArchitectureEncoderContext) {
    this.assembler = createEncoderRuntime(context);
  }

  /**
   * Returns the static SPC700 instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog(): InstructionDescriptor[] {
    return spc700Catalog;
  }

  /**
   * Estimates instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {number} The result.
   */
  estimateInstruction(instruction: LoweredInstruction): number {
    const loweredOperands = instruction.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction.mnemonic,
      instruction.operandText,
      instruction.loweredOperand,
      loweredOperands,
    );
  }

  /**
   * Encodes instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} The result.
   */
  encodeInstruction(instruction: LoweredInstruction): boolean {
    const loweredOperands = instruction.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction.mnemonic,
      instruction.operands,
      instruction.loweredOperand,
      loweredOperands,
    );
  }

  /**
   * Estimates size.
   * @param {string[]} words The words.
   * @returns {number} The result.
   */
  estimateSize(words: string[]): number {
    if (words.length === 0) {
      return 0;
    }
    const rawOperand = words.slice(1).join(" ").trim();
    const parsedOperands = rawOperand ? this.splitTopLevelComma(rawOperand) : [];
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = parsedOperands.map((operand) =>
      this.assembler.operandResolver.lowerOperand(operand),
    );
    return this.estimateResolvedInstruction(words[0], rawOperand, loweredOperand, loweredOperands);
  }

  /**
   * Estimates resolved instruction.
   * @param {string} mnemonic The mnemonic.
   * @param {string} operandText The operand text.
   * @param {LoweredOperand} [loweredOperand] The lowered operand.
   * @param {LoweredOperand[]} [loweredOperands] The lowered operands.
   * @returns {number} The result.
   */
  estimateResolvedInstruction(
    mnemonic: string,
    operandText: string,
    loweredOperand?: LoweredOperand,
    loweredOperands: LoweredOperand[] = [],
  ): number {
    let opcode = mnemonic.toUpperCase().trim();
    const dotIndex = opcode.indexOf(".");
    if (dotIndex !== -1) {
      opcode = opcode.substring(0, dotIndex);
    }

    let operands: string[] = [];
    if (loweredOperands.length > 0) {
      operands = loweredOperands.map((operand) => operand.expanded);
    } else if (operandText) {
      operands = this.splitTopLevelComma(operandText);
    }
    operands = operands.filter((value) => value !== "");
    const left = operands[0] ?? "";
    const right = operands[1] ?? "";
    const leftLowered = loweredOperands[0] ?? loweredOperand;
    const rightLowered = loweredOperands[1];

    if (operands.length === 0 && hasOwn(IMPLIED_SPC_OPCODES, opcode)) {
      return 1;
    }
    if (opcode === "TCALL" || opcode === "PUSH" || opcode === "POP") {
      return 1;
    }
    if ((opcode === "DAA" || opcode === "DAS") && left.toUpperCase() === "A") {
      return 1;
    }
    if (opcode === "MUL" || opcode === "DIV") {
      return 1;
    }
    if (hasOwn(branchOpcodes, opcode)) {
      return 2;
    }
    if (hasOwn(bitSetClearOpcodes, opcode)) {
      return 2;
    }
    if (parseBitBranchOpcode(opcode)) {
      return 3;
    }
    if (opcode === "CALL" || opcode === "JMP") {
      return 3;
    }
    if (opcode === "PCALL") {
      return 2;
    }
    if (opcode === "DBNZ") {
      if (isRegisterY(left, leftLowered)) {
        return 2;
      }
      return 3;
    }
    if (opcode === "CBNE") {
      return 3;
    }
    if (opcode === "TSET" || opcode === "TCLR") {
      return 3;
    }
    if (parseNumberedBitOpcode(opcode)) {
      return 3;
    }
    if (hasOwn(singleWordOps, opcode)) {
      return 2;
    }
    if (hasOwn(wordOpsWithYaLeft, opcode) || hasOwn(wordOpsWithYaRight, opcode)) {
      return 2;
    }
    if (hasOwn(SHIFT_INC_DEC_OPCODES, opcode)) {
      const dest = left.toUpperCase();
      if (dest === "A" || dest === "X" || dest === "Y") {
        return 1;
      }
      const plusX = dest.endsWith("+X");
      const base = plusX ? left.replace(/\+x$/i, "").trim() : left;
      return spcOpcodePlusAddressSize(base);
    }
    if (opcode === "MOV") {
      return this.estimateMovSize(left, right, leftLowered, rightLowered);
    }
    if (hasOwn(memOpTables, opcode)) {
      return this.estimateMemoryOpSize(left, right, leftLowered, rightLowered);
    }
    return 1;
  }

  /**
   * Encoded size for MOV. Must match {@link handleMovInstruction} / XY immediate forms.
   * @param {string} left Left operand.
   * @param {string} right Right operand.
   * @param {LoweredOperand} [leftLowered] Lowered left operand.
   * @param {LoweredOperand} [rightLowered] Lowered right operand.
   * @returns {number} Encoded size in bytes.
   */
  estimateMovSize(
    left: string,
    right: string,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): number {
    if (isMovRegisterPair(left, right)) {
      return 1;
    }
    const rightImmediate = rightLowered?.immediate ?? right.trim().startsWith("#");
    if (isRegisterX(left, leftLowered) && rightImmediate) {
      return 2;
    }
    if (isRegisterY(left, leftLowered) && rightImmediate) {
      return 2;
    }
    if (isAccumulator(left, leftLowered) && rightImmediate) {
      return 2;
    }
    if (this.isDpOrAbs(left) && rightImmediate) {
      return 3;
    }
    if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
      return 3;
    }
    if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
      return 3;
    }
    if (/\(\s*\$/.test(left) || /\(\s*\$/.test(right)) {
      return 2;
    }
    const addressOperand = /\$/.test(left) ? left : right;
    if (/\$/.test(addressOperand)) {
      const plusIndex = addressOperand.search(/\+[xy]$/i);
      let base = addressOperand;
      if (plusIndex >= 0) {
        base = addressOperand.slice(0, plusIndex);
      }
      return spcOpcodePlusAddressSize(base);
    }
    return 2;
  }

  /**
   * Encoded size for ADC/AND/EOR/OR/SBC/CMP. Must match {@link handleMemoryInstruction}.
   * @param {string} left Left operand.
   * @param {string} right Right operand.
   * @param {LoweredOperand} [leftLowered] Lowered left operand.
   * @param {LoweredOperand} [rightLowered] Lowered right operand.
   * @returns {number} Encoded size in bytes.
   */
  estimateMemoryOpSize(
    left: string,
    right: string,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): number {
    if (isRegisterX(left, leftLowered) || isRegisterY(left, leftLowered)) {
      if (rightLowered?.immediate ?? right.trim().startsWith("#")) {
        return 2;
      }
      return spcOpcodePlusAddressSize(right);
    }
    if (isParenX(left, leftLowered) && isParenY(right, rightLowered)) {
      return 1;
    }
    if (this.isDpOrAbs(left) && (rightLowered?.immediate ?? right.trim().startsWith("#"))) {
      return 3;
    }
    if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
      return 3;
    }
    if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
      return 3;
    }
    if (isAccumulator(left, leftLowered)) {
      const mode = this.classifySpc700Addressing(right, rightLowered).mode;
      if (mode === "indirectX") {
        return 1;
      }
      if (mode === "abs" || mode === "absX" || mode === "absY") {
        return 3;
      }
      return 2;
    }
    return 2;
  }

  /**
   * Processes an SPC700 assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  encode(words: string[]): boolean {
    debug("asblock_spc700", words);
    if (words.length === 0) {
      return false;
    }
    const opcode = words[0];
    const rawOperand = words.slice(1).join(" ").trim();
    const parsedOperands = rawOperand ? this.splitTopLevelComma(rawOperand) : [];
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = parsedOperands.map((operand) =>
      this.assembler.operandResolver.lowerOperand(operand),
    );
    return this.encodeResolvedInstruction(opcode, parsedOperands, loweredOperand, loweredOperands);
  }

  /** Legacy API alias for {@link encode}. */
  readonly asblock_spc700 = this.encode.bind(this);

  /**
   * Encodes resolved instruction.
   * @param {string} mnemonic The mnemonic.
   * @param {string[]} operands The operands.
   * @param {LoweredOperand} [loweredOperand] The lowered operand.
   * @param {LoweredOperand[]} [loweredOperands] The lowered operands.
   * @returns {boolean} The result.
   */
  encodeResolvedInstruction(
    mnemonic: string,
    operands: string[],
    loweredOperand?: LoweredOperand,
    loweredOperands: LoweredOperand[] = [],
  ): boolean {
    // Extract the opcode and raw operand text.
    let opcode = mnemonic;
    const operand = loweredOperand?.expanded ?? "";
    const normalizedOperands = operands
      .map((operandText, index) => loweredOperands[index]?.expanded ?? operandText)
      .filter((value) => value !== "");

    // Check for an explicit length suffix (.b, .w, .l).
    let forcedLen: number | null = null;
    let explicitlen = false;
    const dotIndex = opcode.indexOf(".");
    if (dotIndex !== -1) {
      forcedLen = this.getlenfromchar(opcode[dotIndex + 1]);
      explicitlen = true;
      opcode = opcode.substring(0, dotIndex);
    }
    opcode = opcode.toUpperCase().trim();
    debug("asblock_spc700", { opcode, operand, forcedLen, explicitlen });

    // 1) Single word no-opcode or built-ins? E.g. NOP, BRK, RET, etc.
    if (this.handleSingleNoOperand(opcode)) {
      return true;
    }

    // 2) We'll see if it's an instruction with one or two operands, e.g. "ADC A,(X)", "MOV $12,#$34", etc.
    const firstLowered = loweredOperands[0];
    const secondLowered = loweredOperands[1];
    if (normalizedOperands.length === 1) {
      // e.g. "BRA label", etc.
      return this.handleOneOperand(
        opcode,
        normalizedOperands[0],
        forcedLen,
        explicitlen,
        firstLowered,
      );
    }
    if (normalizedOperands.length === 2) {
      return this.handleTwoOperands(
        opcode,
        normalizedOperands[0],
        normalizedOperands[1],
        forcedLen,
        explicitlen,
        firstLowered,
        secondLowered,
      );
    }
    if (normalizedOperands.length === 3 && parseNumberedBitOpcode(opcode)) {
      return this.handleBitManipulation(
        opcode,
        normalizedOperands[0],
        normalizedOperands[1],
        normalizedOperands[2],
      );
    }

    return false;
  }

  /**
   * Splits by commas at top-level, ignoring any parentheses grouping.
   * For spc700 code, we typically do not nest parentheses deeply, so a simpler approach may suffice.
   * @param {string} text - the operand string
   * @returns {string[]} array of operands
   */
  splitTopLevelComma(text: string): string[] {
    const result: string[] = [];
    let level = 0;
    let current = "";

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "(") {
        level++;
        current += c;
      } else if (c === ")") {
        level--;
        current += c;
      } else if (c === "," && level === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    if (current.trim()) {
      result.push(current.trim());
    }
    return result;
  }

  /**
   * Handles single, no-operand opcodes, like NOP, BRK, etc.
   * @param {string} opcode - the opcode
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleSingleNoOperand(opcode: string): boolean {
    debug("handleSingleNoOperand", opcode);

    type SingleByteOpcode =
      | "NOP"
      | "BRK"
      | "RET"
      | "RETI"
      | "CLRP"
      | "SETP"
      | "CLRC"
      | "SETC"
      | "EI"
      | "DI"
      | "CLRV"
      | "NOTC"
      | "SLEEP"
      | "STOP"
      | "XCN";
    const singleByte: Record<SingleByteOpcode, number> = {
      NOP: 0x00,
      BRK: 0x0f,
      RET: 0x6f,
      RETI: 0x7f,
      CLRP: 0x20,
      SETP: 0x40,
      CLRC: 0x60,
      SETC: 0x80,
      EI: 0xa0,
      DI: 0xc0,
      CLRV: 0xe0,
      NOTC: 0xed,
      SLEEP: 0xef,
      STOP: 0xff,
      XCN: 0x9f,
    };

    if (hasOwn(singleByte, opcode)) {
      this.assembler.write1(singleByte[opcode]);
      return true;
    }

    return false;
  }

  /**
   * Handle instructions that have exactly one operand
   * e.g. ASL A, LSR A, DEC A, DEC X, DEC Y,
   * or branches like BRA label, or bit set/clear with one operand, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} loweredOperand - optional lowered metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleOneOperand(
    opcode: string,
    operand: string,
    forcedLen: number | null,
    explicitlen: boolean,
    loweredOperand?: LoweredOperand,
  ): boolean {
    debug("handleOneOperand", { opcode, operand, forcedLen, explicitlen });

    // 1) check if it's a shift / inc / dec with A or dp, etc.
    if (this.handleShiftIncDec(opcode, operand, forcedLen, explicitlen)) {
      return true;
    }

    // 2) handle SETn / CLRn
    if (hasOwn(bitSetClearOpcodes, opcode)) {
      if (this.handleBitSetClear(opcode, operand)) {
        return true;
      }
    }

    // 3) handle branch instructions: BPL, BMI, BVC, BVS, BCC, BCS, BNE, BEQ, BRA
    if (hasOwn(branchOpcodes, opcode)) {
      if (this.handleBranch(opcode, operand)) {
        return true;
      }
    }

    // 4) handle TCALL n
    if (opcode === "TCALL") {
      const num = parseInt(operand.trim(), 10);
      if (isNaN(num) || num < 0 || num > 15) {
        return false;
      }
      // tcall # => ((num << 4) | 1)
      this.assembler.write1(((num & 0x0f) << 4) | 0x01);
      return true;
    }

    // 5) handle push/pop instructions with a single operand: e.g. PUSH A => 0x2D
    if (this.handlePushPop(opcode, operand, loweredOperand)) {
      return true;
    }

    // 6) handle calls/jumps with single operand (CALL $1234, PCALL $12, JMP $1234, etc.)
    if (this.handleCallJump(opcode, operand, loweredOperand)) {
      return true;
    }

    // 8) TSET / TCLR $1234,a => "TSET $addr,A" or "TCLR $addr,A"
    // If the user wrote it as `TSET $1234,A`, it might appear as
    //   opcode="TSET", operand="$1234,A" => that's two separate operands, but
    //   our top-level parse gave us only one chunk if the line used no commas (the test code does use a comma, so we might not get here).
    // We'll leave that to handleTwoOperands. If the test code forcibly uses "TSET $1234,a", we won't see it here.

    // 9) Something else, maybe "MUL YA", "DIV YA,X", "DAA A", "DAS A"
    if (this.handleSingleOperandSpecial(opcode, operand)) {
      return true;
    }

    return false;
  }

  /**
   * Handle instructions that have exactly two operands, e.g. "ADC A,($12+X)" or "MOV $12,#$34".
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTwoOperands(
    opcode: string,
    left: string,
    right: string,
    forcedLen: number | null,
    explicitlen: boolean,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleTwoOperands", { opcode, left, right, forcedLen, explicitlen });

    // check BBSn / BBCn / wiki-native BBS $dp.n
    if (parseBitBranchOpcode(opcode)) {
      if (this.handleTwoOperandsBitBranch(opcode, left, right)) {
        return true;
      }
    }

    // e.g. "DBNZ Y,Mylabel" => 0xFE FF, "DBNZ $12,Mylabel => 6E 12 FF
    if (opcode === "DBNZ" || opcode === "CBNE") {
      if (this.handleDbnzCbne(opcode, left, right, leftLowered, rightLowered)) {
        return true;
      }
    }

    // 7) handle "CMP X,#$12" or "CMP Y,#$12" or "MOV X,#$12" or "MOV Y,#$12"
    //    or "CMP X,$1234" etc.
    if (
      this.handleCmpXyOrMovXy(
        opcode,
        [left, right].join(","),
        forcedLen,
        explicitlen,
        leftLowered,
        rightLowered,
      )
    ) {
      return true;
    }

    // 1) Memory instructions like "ADC A,(X)" or "OR A,($12+X)", etc.
    if (
      this.handleMemoryInstruction(
        opcode,
        left,
        right,
        forcedLen,
        explicitlen,
        leftLowered,
        rightLowered,
      )
    ) {
      return true;
    }

    // 2) SHIFT instructions with dp+X => Already handled with handleShiftIncDec in the one-operand path,
    //    but if we see something like "ASL $12+X"? That's still one operand after the opcode.
    //    So we probably never get here for shift instructions.

    // 3) TSET / TCLR => e.g. "TSET $1234,A" or "TCLR $1234,A"
    if (this.handleTsetTclr(opcode, left, right, rightLowered)) {
      return true;
    }

    // 4) MOV instructions that handle e.g. "MOV X,A" or "MOV ($12+X),A" or "MOV $12,#$34" etc.
    if (opcode === "MOV") {
      return this.handleMovInstruction(left, right, forcedLen, explicitlen);
    }

    // 5) MOV1/NOT1/OR1/AND1/EOR1 and numbered TASM forms (NOT2, MOV2, …)
    if (this.handleBitManipulation(opcode, left, right)) {
      return true;
    }

    if (this.handleSingleOperandSpecial(opcode, [left, right].join(","))) {
      return true;
    }

    if (this.handleWordOpsTwoOperands(opcode, left, right)) {
      return true;
    }

    return false;
  }

  /**
   * handleWordOpsTwoOperands: covers
   *   CMPW YA,$12  => 5A dp
   *   ADDW YA,$12  => 7A dp
   *   SUBW YA,$12  => 9A dp
   *   MOVW YA,$12  => BA dp
   *   MOVW $12,YA  => DA dp
   *
   * According to the test file lines:
   *   "CMPW YA,$12 => 5A 12"
   *   "ADDW YA,$12 => 7A 12"
   *   "SUBW YA,$12 => 9A 12"
   *   "MOVW YA,$12 => BA 12"
   *   "MOVW $12,YA => DA 12"
   *
   * The test only shows an 8-bit direct-page operand. No examples of $1234 for these instructions,
   * so we assume DP only.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleWordOpsTwoOperands(opcode: string, left: string, right: string): boolean {
    debug("handleWordOpsTwoOperands", { opcode, left, right });
    const upOp = opcode.toUpperCase();
    // left or right might be "YA".
    // We'll parse them:
    const leftUp = left.trim().toUpperCase();
    const rightUp = right.trim().toUpperCase();

    // Check forms:
    //   "<OP> YA,$dp" => single DP byte next
    //   "MOVW $dp,YA" => single DP byte
    // The test code's hex shows: e.g. "CMPW YA,$12 => 5A 12" => just 2 bytes. So we skip absolute addressing.

    // 1) If left = "YA" and right = "$dp"
    if (
      leftUp === "YA" &&
      /^\$[\da-f]{1,2}$/i.test(right.trim()) &&
      hasOwn(wordOpsWithYaLeft, upOp)
    ) {
      const dpVal = parseInt(right.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(wordOpsWithYaLeft[upOp]);
      this.assembler.write1(dpVal);
      return true;
    }

    // 2) If right = "YA" and left = "$dp" => "MOVW $12,YA => 0xDA 12"
    if (
      rightUp === "YA" &&
      /^\$[\da-f]{1,2}$/i.test(left.trim()) &&
      hasOwn(wordOpsWithYaRight, upOp)
    ) {
      const dpVal = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(wordOpsWithYaRight[upOp]);
      this.assembler.write1(dpVal);
      return true;
    }

    return false;
  }

  /**
   * Handle instructions like "ADC A,(X)" or "SBC (X),(Y)", "AND A,$1234", etc.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMemoryInstruction(
    opcode: string,
    left: string,
    right: string,
    forcedLen: number | null,
    explicitlen: boolean,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleMemoryInstruction", { opcode, left, right });
    const opName = opcode.toUpperCase();
    if (!hasOwn(memOpTables, opName)) {
      debug("handleMemoryInstruction not in table", { opcode, left, right });
      return false;
    }
    const table = memOpTables[opName];

    // 1) If left is "A" => we interpret the right side as addressing
    if (isAccumulator(left, leftLowered)) {
      debug("handleMemoryInstruction left is A", { opcode, left, right });
      const modeInfo = this.classifySpc700Addressing(right, rightLowered);
      const addr = modeInfo.val;
      const mode = modeInfo.mode;

      // Handle explicit length for dp vs abs addressing modes
      if (explicitlen && forcedLen !== null) {
        if (mode === "dp" || mode === "abs") {
          this.assembler.write1(forcedLen === 1 ? table.a_dp : table.a_abs);
          if (forcedLen === 1) {
            this.assembler.write1(addr & 0xff);
          } else {
            this.assembler.write2(addr);
          }
          return true;
        }
        if (mode === "dpX" || mode === "absX") {
          this.assembler.write1(forcedLen === 1 ? table.a_dpX : table.a_absX);
          if (forcedLen === 1) {
            this.assembler.write1(addr & 0xff);
          } else {
            this.assembler.write2(addr);
          }
          return true;
        }
      }

      // Handle each addressing mode with correct byte lengths
      switch (mode) {
        case "indirectX":
          this.assembler.write1(table.a_indirectX);
          return true;

        case "indirectDpX":
          this.assembler.write1(table.a_indirectDpX);
          this.assembler.write1(addr);
          return true;

        case "imm":
          this.assembler.write1(table.a_imm);
          this.assembler.write1(addr);
          return true;

        case "absX":
          this.assembler.write1(table.a_absX);
          this.assembler.write2(addr);
          return true;

        case "dpX":
          this.assembler.write1(table.a_dpX);
          this.assembler.write1(addr);
          return true;

        case "absY":
          this.assembler.write1(table.a_absY);
          this.assembler.write2(addr);
          return true;

        case "indirectDpY":
          this.assembler.write1(table.a_indirectDpY);
          this.assembler.write1(addr);
          return true;

        case "abs":
          this.assembler.write1(table.a_abs);
          this.assembler.write2(addr);
          return true;

        case "dp":
          this.assembler.write1(table.a_dp);
          this.assembler.write1(addr);
          return true;
      }
    }

    // 2) If left is "(X)" and right is "(Y)" => xy_indirect
    if (isParenX(left, leftLowered) && isParenY(right, rightLowered)) {
      this.assembler.write1(table.xy_indirect);
      return true;
    }

    // 3) If left is "dp" or "abs" and right is "#imm" => dp_imm
    if (this.isDpOrAbs(left) && (rightLowered?.immediate ?? right.startsWith("#"))) {
      this.assembler.write1(table.dp_imm);
      // immediate then dp:
      const immSource = rightLowered?.baseExpression ?? right;
      const immVal = this.assembler.operandResolver.getnum(immSource) & 0xff;
      this.assembler.write1(immVal);
      const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
      // Some SPC700 disassemblies keep dp,dp memory-op forms wrapped, e.g.
      // `or ($CE), ($CD)`. Encode those the same way as the plain `$CE,$CD`
      // form so the parser does not reject otherwise valid source.
      this.assembler.write1(table.dp_dp);
      const rightVal = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(rightVal);
      const leftVal = parseInt(left.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    // 4) If left is dp and right is dp => dp_dp
    if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
      this.assembler.write1(table.dp_dp);
      const rightVal = parseInt(right.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(rightVal);
      const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    return false;
  }

  /**
   * Writes a dp (1 byte) or abs (2 byte) address.
   * Width follows the source spelling via `length`, not whether the value fits in 8 bits.
   * `$0030` is absolute even though 0x30 is a direct-page number.
   * @param {number} value Address to write.
   * @param {number} length 1 for direct page, 2 for absolute.
   */
  writeDpOrAbs(value: number, length: number) {
    debug("writeDpOrAbs", { value, length });
    this.assembler.write1(value & 0xff);
    if (length <= 1) {
      return;
    }
    this.assembler.write1((value >> 8) & 0xff);
  }

  /**
   * Classify operand for "A,(X)" style memory instructions,
   * returning an address mode name that matches e.g. a_indirectX, a_dp, a_abs, etc.
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {{ mode: string; val: number }} the address mode and value
   */
  classifySpc700Addressing(
    operand: string,
    loweredOperand?: LoweredOperand,
  ): {
    mode:
      | "indirectX"
      | "indirectDpX"
      | "imm"
      | "absX"
      | "dpX"
      | "absY"
      | "indirectDpY"
      | "abs"
      | "dp";
    val: number;
  } {
    debug("classifySpc700Addressing", operand);
    const resolveValue = (value: string): number => {
      try {
        return this.assembler.operandResolver.getnum(value) & 0xffff;
      } catch {
        return parseInt(value.replace(/\$/g, ""), 16) & 0xffff;
      }
    };

    if (
      loweredOperand?.mode === "registerIndirect" &&
      loweredOperand.registerName?.toUpperCase() === "X"
    ) {
      return { mode: "indirectX", val: 0 };
    }
    if (loweredOperand?.mode === "directPageIndexedXIndirect" && loweredOperand.baseExpression) {
      return { mode: "indirectDpX", val: resolveValue(loweredOperand.baseExpression) & 0xff };
    }
    if (loweredOperand?.immediate) {
      return {
        mode: "imm",
        val: resolveValue(loweredOperand.baseExpression ?? loweredOperand.expanded) & 0xff,
      };
    }
    if (loweredOperand?.mode === "directPageIndirectIndexedY" && loweredOperand.baseExpression) {
      return { mode: "indirectDpY", val: resolveValue(loweredOperand.baseExpression) & 0xff };
    }

    // Keep the original case for symbolic operands so label lookups like
    // `spc_07C2+Y` survive mode classification unchanged.
    const trimmedRaw = operand.trim();
    const trimmed = trimmedRaw.toUpperCase();
    // (X)
    if (trimmed === "(X)") {
      return { mode: "indirectX", val: 0 };
    }
    // e.g. "($12+X)"
    if (trimmed.startsWith("(") && trimmed.endsWith(")") && trimmed.includes("+X")) {
      // parse dp
      const inside = trimmedRaw.slice(1, -1); // e.g. "$12+X"
      const dpStr = inside.split("+")[0].trim(); // e.g. "$12"
      const val = parseInt(dpStr.replace(/\$/g, ""), 16);
      return { mode: "indirectDpX", val };
    }
    // #$xx
    if (trimmed.startsWith("#")) {
      const val = parseInt(trimmed.replace(/[^\dA-F]/g, ""), 16) & 0xff;
      return { mode: "imm", val };
    }
    // e.g. "$1234+X" vs. "$12+X"
    if (trimmed.endsWith("+X")) {
      const baseStr = trimmedRaw.replace(/\+x$/i, "").trim();
      const val = resolveValue(baseStr);
      const size = getAddressSize(baseStr);
      if (size === 1) {
        return { mode: "dpX", val };
      } else {
        return { mode: "absX", val };
      }
    }
    // e.g. "$1234+Y", "$12+Y", or "($12)+Y"
    if (trimmed.endsWith("+Y")) {
      const baseStr = trimmedRaw.replace(/\+y$/i, "").trim();
      if (baseStr.startsWith("(") && baseStr.endsWith(")")) {
        // => "($12)+Y" => indirectDpY
        const inner = baseStr.slice(1, -1).trim();
        const val = resolveValue(inner) & 0xffff;
        return { mode: "indirectDpY", val };
      }

      // The opcode tables used here only distinguish `absY` and `(dp)+Y`.
      // Keep plain `value+Y` operands in the `absY` bucket instead of trying
      // to invent a separate direct-page-Y mode for these instruction families.
      const val = resolveValue(baseStr);
      return { mode: "absY", val };
    }
    // e.g. "($12)+Y" => covered above
    // e.g. "$1234" or "$12"
    if (/^\$[\da-f]+$/i.test(trimmedRaw)) {
      const val = parseInt(trimmedRaw.replace(/\$/g, ""), 16) >>> 0;
      const size = getAddressSize(trimmedRaw);
      if (size === 1) {
        return { mode: "dp", val };
      } else {
        return { mode: "abs", val };
      }
    }

    const fallbackSource = loweredOperand?.baseExpression ?? operand;
    const fallbackValue = resolveValue(fallbackSource);
    // Use the expanded source text rather than the resolved value so symbolic
    // operands preserve the width the author wrote.
    const fallbackLength = getAddressSize(loweredOperand?.expanded ?? fallbackSource);
    return fallbackLength === 1
      ? { mode: "dp", val: fallbackValue & 0xff }
      : { mode: "abs", val: fallbackValue };
  }

  /**
   * Checks whether dp or abs.
   * @param {string} operand The operand.
   * @returns {boolean} The result.
   */
  isDpOrAbs(operand: string): boolean {
    debug("isDpOrAbs", operand);
    const cleaned = operand.replace(/\$/g, "");
    if (!/^[\dA-Fa-f]+$/.test(cleaned)) {
      return false;
    }
    return true;
  }

  /**
   * SHIFT, INC, DEC instructions. e.g. "ASL A" => 0x1C, "ASL $12+X" => 0x1B 12, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleShiftIncDec(
    opcode: string,
    operand: string,
    forcedLen: number | null,
    explicitlen: boolean,
  ): boolean {
    debug("handleShiftIncDec", { opcode, operand, forcedLen, explicitlen });
    // We'll have tables for ASL, LSR, ROL, ROR, INC, DEC.
    // Each has forms:
    //   <op> A
    //   <op> $dp or $abs
    //   <op> $dp+X
    //   <op> $abs+X
    // The test shows e.g. "ASL A => 0x1C", "ASL $12+X => 0x1B 12", "ASL $1234 => 0x0C 34 12", "ASL $12 => 0x0B 12"
    // We'll define a small map:
    const table: Record<string, { a: number; dpX: number; dp: number; abs: number }> = {
      ASL: { a: 0x1c, dpX: 0x1b, dp: 0x0b, abs: 0x0c },
      DEC: { a: 0x9c, dpX: 0x9b, dp: 0x8b, abs: 0x8c },
      INC: { a: 0xbc, dpX: 0xbb, dp: 0xab, abs: 0xac },
      LSR: { a: 0x5c, dpX: 0x5b, dp: 0x4b, abs: 0x4c },
      ROL: { a: 0x3c, dpX: 0x3b, dp: 0x2b, abs: 0x2c },
      ROR: { a: 0x7c, dpX: 0x7b, dp: 0x6b, abs: 0x6c },
    };

    const upper = opcode.toUpperCase();
    if (!(upper in table)) {
      return false;
    }

    // Special case for DEC X and DEC Y
    if (upper === "DEC") {
      if (operand.toUpperCase() === "X") {
        this.assembler.write1(0x1d);
        return true;
      }
      if (operand.toUpperCase() === "Y") {
        this.assembler.write1(0xdc);
        return true;
      }
    }

    // Special case for INC X and INC Y
    if (upper === "INC") {
      if (operand.toUpperCase() === "X") {
        this.assembler.write1(0x3d);
        return true;
      }
      if (operand.toUpperCase() === "Y") {
        this.assembler.write1(0xfc);
        return true;
      }
    }

    // check if operand is "A"
    if (isAccumulator(operand)) {
      debug("handleShiftIncDec operand is A", {
        opcode,
        operand,
        write: table[upper].a.toString(16),
      });
      this.assembler.write1(table[upper].a);
      return true;
    }

    // parse for e.g. $12+X => dpX, $1234 => abs or dp, etc.
    const plusX = operand.toUpperCase().endsWith("+X");
    if (plusX) {
      debug("handleShiftIncDec operand ends with +X", {
        opcode,
        operand,
        write: table[upper].dpX.toString(16),
      });
      // remove +X
      const baseStr = operand.replace(/\+x$/i, "").trim();
      debug("handleShiftIncDec baseStr", baseStr);
      const val = parseInt(baseStr.replace(/\$/g, ""), 16) & 0xffff;
      debug("handleShiftIncDec val", val);
      // If explicit length is set, use that to determine mode
      if (explicitlen) {
        debug("handleShiftIncDec explicitlen", { opcode, operand, forcedLen, explicitlen });
        if (forcedLen === 1) {
          this.assembler.write1(table[upper].dpX);
          this.assembler.write1(val & 0xff);
        } else {
          this.assembler.write1(table[upper].abs);
          this.assembler.write2(val);
        }
        return true;
      }

      // Otherwise use value size to determine mode
      if (val <= 0xff) {
        debug("handleShiftIncDec val <= 0xff", {
          opcode,
          operand,
          forcedLen,
          explicitlen,
          write: table[upper].dpX.toString(16),
        });
        this.assembler.write1(table[upper].dpX);
        this.assembler.write1(val & 0xff);
      } else {
        debug("handleShiftIncDec val > 0xff", {
          opcode,
          operand,
          forcedLen,
          explicitlen,
          write: table[upper].abs.toString(16),
        });
        this.assembler.write1(table[upper].abs);
        this.assembler.write2(val);
      }
      return true;
    }

    // parse $dp or $abs
    const val = parseInt(operand.replace(/\$/g, ""), 16) & 0xffff;

    // If explicit length is set, use that to determine mode
    if (explicitlen) {
      if (forcedLen === 1) {
        this.assembler.write1(table[upper].dp);
        this.assembler.write1(val & 0xff);
      } else {
        this.assembler.write1(table[upper].abs);
        this.assembler.write2(val);
      }
      return true;
    }

    // Otherwise use value size to determine mode
    if (val <= 0xff) {
      this.assembler.write1(table[upper].dp);
      this.assembler.write1(val & 0xff);
    } else {
      this.assembler.write1(table[upper].abs);
      this.assembler.write2(val);
    }
    return true;
  }

  /**
   * Actually that's 2 "operands," but the test lumps them into a single comma-split line "BBS0 $12,Mylabel".
   * We'll handle that in handleTwoOperands.
   *
   * For "SETn $12 => 0x02 12" or "CLRn $12 => 0x12 12," that's one operand + the bit # is in the opcode name.
   * Asar also accepts `SET1 $13.7` / `CLR1 $13.7`, where the bit comes from the operand.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleBitSetClear(opcode: string, operand: string): boolean {
    debug("handleBitSetClear", { opcode, operand });
    const normalizedOpcode = opcode.toUpperCase();
    if (!hasOwn(bitSetClearOpcodes, normalizedOpcode)) {
      return false;
    }
    const trimmed = operand.trim();
    const dotted = trimmed.match(/^\$([\da-f]+)\.([0-7])$/i);
    let opcodeByte = bitSetClearOpcodes[normalizedOpcode];
    let dp: number;
    if (dotted) {
      dp = parseInt(dotted[1], 16) & 0xff;
      const bit = parseInt(dotted[2], 10);
      let lowNibble = 0x12;
      if (normalizedOpcode.startsWith("SET")) {
        lowNibble = 0x02;
      }
      opcodeByte = (bit << 5) | lowNibble;
    } else {
      dp = parseInt(trimmed.replace(/\$/g, ""), 16) & 0xff;
    }
    this.assembler.write1(opcodeByte);
    this.assembler.write1(dp);
    return true;
  }

  /**
   * BPL / BMI / BVC / BVS / BCC / BCS / BNE / BEQ / BRA => 1 operand (the label).
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleBranch(opcode: string, operand: string): boolean {
    debug("handleBranch", { opcode, operand });
    if (!hasOwn(branchOpcodes, opcode)) {
      return false;
    }

    const opByte = branchOpcodes[opcode];
    this.assembler.write1(opByte);

    // Calculate relative branch offset:
    // - For a label: needs to be (label_addr - (current_addr + 2))
    //   The +2 accounts for the branch instruction's 2 bytes
    // - Result must fit in signed byte (-128 to +127)
    // Relative +/- labels are anchored to the address immediately after the
    // branch instruction, matching the 65816 path and the original assembler.
    const branchReferenceAddress = this.assembler.currentTargetAddress + 1;
    let targetAddr: number;
    if (/^\++$/.test(operand)) {
      targetAddr = this.assembler.symbolScope.findNextLabel(operand, branchReferenceAddress);
    } else if (/^-+$/.test(operand)) {
      targetAddr = this.assembler.symbolScope.findPreviousLabel(operand, branchReferenceAddress);
    } else {
      targetAddr = this.assembler.operandResolver.getnum(operand);
    }
    debug("handleBranch targetAddr", targetAddr);
    const currentAddr = this.assembler.currentTargetAddress;
    debug("handleBranch currentAddr", currentAddr);
    // +1 because the branch instruction is 1 byte and we already wrote the opcode
    const offset = targetAddr - (currentAddr + 1);
    debug("handleBranch offset", offset);

    // Validate offset fits in signed byte
    // if (offset < -128 || offset > 127) {
    //   throw new Error(`Branch offset ${offset} out of range (-128 to +127)`);
    // }
    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(0xff);
    } else {
      // Convert to unsigned byte representation of signed value
      const unsignedOffset = offset < 0 ? 256 + offset : offset;
      debug("handleBranch unsignedOffset", unsignedOffset);
      this.assembler.write1(unsignedOffset & 0xff);
    }

    return true;
  }

  /**
   * BBSn / BBCn / wiki-native `BBS $dp.n`: e.g. "BBC0 $12,Mylabel => 13 12 FF",
   * "BBS $12.3,L => 63 12 FF". Bit comes from `$dp.n` if present, else the mnemonic digit.
   * That logic is in handleTwoOperands because we have two comma-split sections.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTwoOperandsBitBranch(opcode: string, left: string, right: string): boolean {
    debug("handleTwoOperandsBitBranch", { opcode, left, right });
    const parsed = parseBitBranchOpcode(opcode);
    if (!parsed) {
      debug("handleTwoOperandsBitBranch no match", { opcode, left, right });
      return false;
    }

    const trimmed = left.trim();
    const dotted = trimmed.match(/^\$([\da-f]+)\.([0-7])$/i);
    let dpVal: number;
    let bit = parsed.mnemonicBit;
    if (dotted) {
      dpVal = Number.parseInt(dotted[1], 16) & 0xff;
      bit = Number(dotted[2]);
    } else {
      dpVal = Number.parseInt(trimmed.replace(/\$/g, ""), 16) & 0xff;
    }
    if (bit === undefined) {
      return false;
    }

    const opcodeByte = bitBranchOpcodeByte(parsed.family, bit);

    // For the second operand (label/address), we need to:
    // 1. Get the target address
    // 2. Calculate relative offset as: target - (pc + 3)
    //    The +3 is because the instruction is 3 bytes:
    //    - 1 byte opcode
    //    - 1 byte direct page value
    //    - 1 byte relative offset
    // 3. The offset must fit in a signed byte (-128 to +127)

    debug("handleTwoOperandsBitBranch =", opcodeByte.toString(16));
    this.assembler.write1(opcodeByte);
    debug("handleTwoOperandsBitBranch =", dpVal.toString(16));
    this.assembler.write1(dpVal);

    // Handle label resolution based on the pass
    debug("handleTwoOperandsBitBranch right", right);

    if (!this.assembler.enforceResolvedLabels) {
      // First pass: use placeholder 0xFF for labels
      this.assembler.write1(0xff);
    } else {
      // Second pass: try to resolve the label or use calculated offset
      let offset = 0xff;

      const target = this.assembler.operandResolver.getnum(right);
      const pc = this.assembler.currentTargetAddress;
      // The offset is relative to the position after this 3-byte instruction
      const relativeOffset = target - (pc + 1);

      // Convert to unsigned byte representation of signed value
      offset = relativeOffset < 0 ? 256 + relativeOffset : relativeOffset;
      offset &= 0xff;

      debug("handleTwoOperandsBitBranch =", offset.toString(16));
      this.assembler.write1(offset);
    }

    return true;
  }

  /**
   * e.g. DBNZ Y,Mylabel => FE offset, DBNZ $dp,Mylabel => 6E dp offset
   * also "CBNE $dp+X,Mylabel => DE dp offset" or "CBNE $dp,Mylabel => 2E dp offset"
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} _rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleDbnzCbne(
    opcode: string,
    left: string,
    right: string,
    leftLowered?: LoweredOperand,
    _rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleDbnzCbne", { opcode, left, right });

    const isYForm = opcode.toUpperCase() === "DBNZ" && isRegisterY(left, leftLowered);
    let instructionSize = 3;
    if (isYForm) {
      instructionSize = 2;
    }

    const target = this.assembler.operandResolver.getnum(right);
    const offset = target - (this.assembler.currentTargetAddress + instructionSize);
    debug("handleDbnzCbne offset", offset);
    if (this.assembler.enforceResolvedLabels && (offset < -128 || offset > 127)) {
      throw this.assembler.diagnostics.error(`Branch target out of range (${offset})`);
    }
    const storedOffset = offset & 0xff;

    if (opcode.toUpperCase() === "DBNZ") {
      if (isYForm) {
        this.assembler.write1(0xfe);
        this.assembler.write1(storedOffset);
        return true;
      }
      const val = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(0x6e);
      this.assembler.write1(val);
      this.assembler.write1(storedOffset);
      return true;
    }

    if (opcode.toUpperCase() === "CBNE") {
      const upper = left.toUpperCase();
      if (leftLowered?.mode === "directPageIndexedX" || upper.endsWith("+X")) {
        const base = upper.replace(/\+X$/, "").trim();
        const val = parseInt(base.replace(/\$/g, ""), 16) & 0xff;
        this.assembler.write1(0xde);
        this.assembler.write1(val);
        this.assembler.write1(storedOffset);
        return true;
      }
      const val = parseInt(upper.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(0x2e);
      this.assembler.write1(val);
      this.assembler.write1(storedOffset);
      return true;
    }

    return false;
  }

  /**
   * handle push/pop with single operand => e.g. PUSH A => 0x2D, PUSH X => 0x4D, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handlePushPop(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean {
    debug("handlePushPop", { opcode, operand });
    type PushPopRegister = "P" | "A" | "X" | "Y";
    const pushMap: Record<PushPopRegister, number> = {
      P: 0x0d,
      A: 0x2d,
      X: 0x4d,
      Y: 0x6d,
    };
    const popMap: Record<PushPopRegister, number> = {
      P: 0x8e,
      A: 0xae,
      X: 0xce,
      Y: 0xee,
    };

    if (opcode.toUpperCase() === "PUSH") {
      const key = (loweredOperand?.registerName ?? operand).toUpperCase();
      if (hasOwn(pushMap, key)) {
        this.assembler.write1(pushMap[key]);
        return true;
      }
    }
    if (opcode.toUpperCase() === "POP") {
      const key = (loweredOperand?.registerName ?? operand).toUpperCase();
      if (hasOwn(popMap, key)) {
        this.assembler.write1(popMap[key]);
        return true;
      }
    }
    return false;
  }

  /**
   * handle call/jump instructions with single operand => e.g. "CALL $1234", "PCALL $12"
   * "JMP $1234", "JMP ($1234+X)"
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleCallJump(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean {
    debug("handleCallJump", { opcode, operand });
    const upper = opcode.toUpperCase();
    const resolveOperand = (value: string): number => {
      try {
        return this.assembler.operandResolver.getnum(value) & 0xffff;
      } catch {
        return parseInt(value.replace(/\$/g, ""), 16) & 0xffff;
      }
    };
    if (upper === "CALL") {
      // => 3F  lo hi
      this.assembler.write1(0x3f);
      const val = resolveOperand(operand);
      this.assembler.write2(val);
      return true;
    }
    if (upper === "PCALL") {
      // => 4F dp
      this.assembler.write1(0x4f);
      const val = resolveOperand(operand) & 0xff;
      this.assembler.write1(val);
      return true;
    }
    if (upper === "JMP") {
      const trimmed = operand.trim().toUpperCase();
      debug("handleCallJump JMP trimmed", trimmed);
      // if operand is "($1234+X)" => 1F lo hi, else => 5F lo hi
      if (
        loweredOperand?.mode === "directPageIndexedXIndirect" ||
        (trimmed.startsWith("(") && trimmed.endsWith("+X)"))
      ) {
        // => 0x1f
        this.assembler.write1(0x1f);
        // Extract value between ( and +X)
        const inner =
          loweredOperand?.baseExpression ??
          operand
            .trim()
            .slice(1, operand.trim().length - 3)
            .trim();
        const val = resolveOperand(inner);
        this.assembler.write2(val);
        return true;
      } else {
        // => 0x5f
        this.assembler.write1(0x5f);
        const val = resolveOperand(operand);
        this.assembler.write2(val);
        return true;
      }
    }
    return false;
  }

  /**
   * handle "CMP X,#$12" or "CMP X,$1234" or "MOV X,#$12" or "MOV Y,#$12" etc.
   * We see from the test code lines like:
   *  CMP X,#$12 => C8 12
   *  CMP X,$1234 => 1E 34 12
   *  CMP X,$12 => 3E 12
   *  MOV X,#$12 => CD 12
   *  MOV Y,#$12 => 8D 12
   *
   * We'll unify them here.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleCmpXyOrMovXy(
    opcode: string,
    operand: string,
    forcedLen: number | null,
    explicitlen: boolean,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleCmpXyOrMovXy", { opcode, operand, forcedLen, explicitlen });
    const upper = opcode.toUpperCase();

    // check for "CMP X," / "CMP Y," or "MOV X," / "MOV Y," / "MOV A," but the latter might be handled in memory instructions.
    // We'll do patterns from test:
    //  CMP X,#$12 => 0xC8 12
    //  CMP X,$1234 => 0x1E 34 12
    //  CMP X,$12 => 0x3E 12
    if (upper === "CMP") {
      // might be "CMP X,#xx" or "CMP X,$addr" or "CMP Y,#xx" or "CMP Y,$addr"
      // from test: "CMP X,#$12 => C8 12" / "CMP X,$1234 => 1E 34 12" / "CMP X,$12 => 3E 12"
      //            "CMP Y,#$12 => AD 12" / "CMP Y,$1234 => 5E 34 12" / "CMP Y,$12 => 7E 12"
      const upOp = operand.toUpperCase();
      const leftOperandIsX = leftLowered ? isRegisterX("", leftLowered) : upOp.startsWith("X,");
      const leftOperandIsY = leftLowered ? isRegisterY("", leftLowered) : upOp.startsWith("Y,");
      let tail = "";
      if (rightLowered) {
        tail = rightLowered.expanded.toUpperCase();
      } else if (leftOperandIsX || leftOperandIsY) {
        tail = upOp.slice(2).trim();
      }
      if (leftOperandIsX) {
        if (rightLowered?.immediate ?? tail.startsWith("#")) {
          // => 0xC8
          this.assembler.write1(0xc8);
          const imm = parseInt(tail.replace(/[^\da-f]/gi, ""), 16) & 0xff;
          this.assembler.write1(imm);
          return true;
        } else {
          // => check dp vs abs
          const val = parseInt(tail.replace(/\$/g, ""), 16) & 0xffff;
          if (explicitlen) {
            if (forcedLen === 1) {
              this.assembler.write1(0x3e);
              this.assembler.write1(val & 0xff);
            } else {
              this.assembler.write1(0x1e);
              this.assembler.write2(val);
            }
          } else {
            if (getAddressSize(tail) === 1) {
              // => 0x3E
              this.assembler.write1(0x3e);
              this.assembler.write1(val & 0xff);
            } else {
              // => 0x1E
              this.assembler.write1(0x1e);
              this.assembler.write2(val);
            }
          }
          return true;
        }
      }
      if (leftOperandIsY) {
        if (rightLowered?.immediate ?? tail.startsWith("#")) {
          // => 0xAD
          this.assembler.write1(0xad);
          const imm = parseInt(tail.replace(/[^\da-f]/gi, ""), 16) & 0xff;
          this.assembler.write1(imm);
          return true;
        } else {
          // dp vs abs => "5E" or "7E"
          const val = parseInt(tail.replace(/\$/g, ""), 16) & 0xffff;
          if (explicitlen) {
            if (forcedLen === 1) {
              this.assembler.write1(0x7e);
              this.assembler.write1(val & 0xff);
            } else {
              this.assembler.write1(0x5e);
              this.assembler.write2(val);
            }
          } else {
            if (getAddressSize(tail) === 1) {
              // => 0x7E
              this.assembler.write1(0x7e);
              this.assembler.write1(val & 0xff);
            } else {
              // => 0x5E
              this.assembler.write1(0x5e);
              this.assembler.write2(val);
            }
          }
          return true;
        }
      }
    }

    // MOV X,#$12 => CD 12, MOV Y,#$12 => 8D 12,
    // also "MOV A,#$12 => E8 12" is in handleMemoryInstruction. We keep it consistent if not matched there?
    if (upper === "MOV") {
      const upOp = operand.toUpperCase();
      const leftOperandIsX = leftLowered ? isRegisterX("", leftLowered) : upOp.startsWith("X,#");
      const leftOperandIsY = leftLowered ? isRegisterY("", leftLowered) : upOp.startsWith("Y,#");
      if (leftOperandIsX && (rightLowered?.immediate ?? upOp.startsWith("X,#"))) {
        // => 0xCD imm
        this.assembler.write1(0xcd);
        const imm = rightLowered?.baseExpression
          ? this.assembler.operandResolver.getnum(rightLowered.baseExpression) & 0xff
          : parseInt(upOp.replace(/[^\da-f]/gi, ""), 16) & 0xff;
        this.assembler.write1(imm);
        return true;
      }
      if (leftOperandIsY && (rightLowered?.immediate ?? upOp.startsWith("Y,#"))) {
        // => 0x8D imm
        this.assembler.write1(0x8d);
        const imm = rightLowered?.baseExpression
          ? this.assembler.operandResolver.getnum(rightLowered.baseExpression) & 0xff
          : parseInt(upOp.replace(/[^\da-f]/gi, ""), 16) & 0xff;
        this.assembler.write1(imm);
        return true;
      }
    }

    return false;
  }

  /**
   * TSET / TCLR => e.g. "TSET $1234,A" => 0x0E 34 12
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTsetTclr(
    opcode: string,
    left: string,
    right: string,
    rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleTsetTclr", { opcode, left, right });
    const up = opcode.toUpperCase();
    if (up !== "TSET" && up !== "TCLR") {
      return false;
    }

    // The test code:
    // TSET $1234,a => 0x0E 34 12
    // TCLR $1234,a => 0x4E 34 12
    // That means the difference is 0x0E vs 0x4E. Then we write lo, hi. The second operand must be "A".
    if (!isAccumulator(right, rightLowered)) {
      return false;
    }

    const val = parseInt(left.replace(/\$/g, ""), 16) & 0xffff;
    const baseOpcode = up === "TSET" ? 0x0e : 0x4e;
    this.assembler.write1(baseOpcode);
    this.assembler.write1(val & 0xff);
    this.assembler.write1((val >> 8) & 0xff);
    return true;
  }

  /**
   * handle e.g. "MOV X,A" or "MOV (X+),A" or "MOV $12,#$34".
   * Some are covered by memory instructions if the left side is A.
   * This function focuses on the big variety from the test lines.
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMovInstruction(
    left: string,
    right: string,
    forcedLen: number | null,
    explicitlen: boolean,
  ): boolean {
    debug("handleMovInstruction", { left, right, forcedLen, explicitlen });

    // Simple register moves
    const tableMoves = [
      { pattern: /^x\s*,\s*a$/i, opcode: 0x5d },
      { pattern: /^a\s*,\s*x$/i, opcode: 0x7d },
      { pattern: /^x\s*,\s*sp$/i, opcode: 0x9d },
      { pattern: /^sp\s*,\s*x$/i, opcode: 0xbd },
      { pattern: /^a\s*,\s*y$/i, opcode: 0xdd },
      { pattern: /^y\s*,\s*a$/i, opcode: 0xfd },
      { pattern: /^\(x\+\)\s*,\s*a$/i, opcode: 0xaf },
      { pattern: /^a\s*,\s*\(x\+\)$/i, opcode: 0xbf },
      { pattern: /^\(x\)\s*,\s*a$/i, opcode: 0xc6 },
      { pattern: /^a\s*,\s*\(x\)$/i, opcode: 0xe6 },
    ];

    const combined = `${left.trim()},${right.trim()}`;

    // Handle simple register moves first
    for (const t of tableMoves) {
      if (t.pattern.test(combined)) {
        this.assembler.write1(t.opcode);
        return true;
      }
    }

    // Handle memory moves with explicit length
    // mov.b A, $0000 => E4 00
    // mov.w A, $0000 => E5 00 00
    // mov.b A, $0000+X => F4 00
    // mov.w A, $0000+X => F5 00 00
    // mov.b X, $0000 => F8 00
    // mov.w X, $0000 => E9 00 00
    // mov.b Y, $0000 => EB 00
    // mov.w Y, $0000 => EC 00 00
    // mov.b $0000, A => C4 00
    // mov.w $0000, A => C5 00 00
    // mov.b $0000+X, A => D4 00
    // mov.w $0000+X, A => D5 00 00
    // mov.b $0000, X => D8 00
    // mov.w $0000, X => C9 00 00
    // mov.b $0000, Y => CB 00
    // mov.w $0000, Y => CC 00 00

    type MovMemoryKey = "A,$" | "A,$+X" | "X,$" | "Y,$" | "$,A" | "$+X,A" | "$,X" | "$,Y";
    const memoryMoves: Record<MovMemoryKey, { byte: number; word: number }> = {
      "A,$": { byte: 0xe4, word: 0xe5 },
      "A,$+X": { byte: 0xf4, word: 0xf5 },
      "X,$": { byte: 0xf8, word: 0xe9 },
      "Y,$": { byte: 0xeb, word: 0xec },
      "$,A": { byte: 0xc4, word: 0xc5 },
      "$+X,A": { byte: 0xd4, word: 0xd5 },
      "$,X": { byte: 0xd8, word: 0xc9 },
      "$,Y": { byte: 0xcb, word: 0xcc },
    };

    // Parse the operands into a key format
    let key: MovMemoryKey | null = null;
    if (/^\$[\da-f]+$/i.test(left)) {
      key = `$,${right.toUpperCase()}` as MovMemoryKey;
    } else if (/^\$[\da-f]+\+x$/i.test(left)) {
      key = `$+X,${right.toUpperCase()}` as MovMemoryKey;
    } else if (/^\$[\da-f]+$/i.test(right)) {
      key = `${left.toUpperCase()},$` as MovMemoryKey;
    } else if (/^\$[\da-f]+\+x$/i.test(right)) {
      key = `${left.toUpperCase()},$+X` as MovMemoryKey;
    }

    if (key && hasOwn(memoryMoves, key)) {
      // Extract the value from whichever operand contains the $ address
      const operandWithAddr = /\$([^+]+)/.exec(left) ? left : right;
      const match = /\$([^+]+)/.exec(operandWithAddr);
      if (!match) return false;

      const val = parseInt(match[1], 16);
      const mode = memoryMoves[key];
      const inferredLength = getAddressSize(`$${match[1]}`);
      const selectedLength = explicitlen ? forcedLen : inferredLength;
      const opcode = selectedLength === 1 ? mode.byte : mode.word;

      this.assembler.write1(opcode);
      if (opcode === mode.word) {
        this.assembler.write2(val);
      } else {
        this.assembler.write1(val & 0xff);
      }
      return true;
    }

    // Handle immediate moves
    if (/^a\s*,\s*#\$[\da-f]+$/i.test(combined)) {
      this.assembler.write1(0xe8);
      const imm = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(imm);
      return true;
    }

    // Handle dp to dp moves
    if (this.isDpOrAbs(left) && right.startsWith("#")) {
      this.assembler.write1(0x8f);
      const imm = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(imm);
      const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
      // The Ghouls'n Ghosts SPC disassembly keeps some MOV dp,dp forms wrapped
      // in parentheses, e.g. `mov ($D1), ($D0)`. Treat those as the normal
      // direct-page move opcode rather than rejecting the syntax outright.
      this.assembler.write1(0xfa);
      const rightVal = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(rightVal);
      const leftVal = parseInt(left.replace(/[^\da-f]/gi, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
      this.assembler.write1(0xfa);
      const rightVal = parseInt(right.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(rightVal);
      const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(leftVal);
      return true;
    }

    return this.handleMovMemoryCombo(left, right) || this.handleMovMemoryCombo2(left, right);
  }

  /**
   * handle combos like "MOV ($12+X),A => 0xC7 12"
   * or "MOV ($12)+Y,A => 0xD7 12"
   * or "MOV A,($12+X) => 0xE7 12"
   * or "MOV A,($12)+Y => 0xF7 12"
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleMovMemoryCombo(left: string, right: string): boolean {
    debug("handleMovMemoryCombo", { left, right });
    // We look for patterns "($XX+X),A", "($XX)+Y,A", "A,($XX+X)", "A,($XX)+Y"
    // from the test lines:
    //   MOV ($12+X),A => 0xC7 12
    //   MOV ($12)+Y,A => 0xD7 12
    //   MOV A,($12+X) => 0xE7 12
    //   MOV A,($12)+Y => 0xF7 12

    const combined = `${left.trim()},${right.trim()}`.toUpperCase();
    // const reLeft = /^\(\$([\dA-F]{1,4})\+X\)$/;
    // const reLeftY = /^\(\$([\dA-F]{1,4})\)\+Y$/;
    // const reRight = /\(\$([\dA-F]{1,4})\+X\)$/;
    // const reRightY = /\(\$([\dA-F]{1,4})\)\+Y$/;

    debug("handleMovMemoryCombo combined", combined);
    // ($dp+X),A => 0xC7 dp
    let m = combined.match(/^\(?\$([\dA-F]+)\+X?\),A$/);
    if (m) {
      const dpVal = parseInt(m[1], 16) & 0xff;
      this.assembler.write1(0xc7);
      this.assembler.write1(dpVal);
      return true;
    }
    // ($dp)+Y,A => 0xD7 dp
    m = combined.match(/^\(?\$([\dA-F]+)\)\+Y?,A$/);
    if (m) {
      const dpVal = parseInt(m[1], 16) & 0xff;
      this.assembler.write1(0xd7);
      this.assembler.write1(dpVal);
      return true;
    }
    // A,($dp+X) => 0xE7 dp
    m = combined.match(/^A ?,?\(?\$([\dA-F]+)\+X?\)$/);
    if (m) {
      const dpVal = parseInt(m[1], 16) & 0xff;
      this.assembler.write1(0xe7);
      this.assembler.write1(dpVal);
      return true;
    }
    // A,($dp)+Y => 0xF7 dp
    m = combined.match(/^A ?,?\(?\$([\dA-F]+)\)\+Y$/);
    if (m) {
      const dpVal = parseInt(m[1], 16) & 0xff;
      this.assembler.write1(0xf7);
      this.assembler.write1(dpVal);
      return true;
    }

    return false;
  }

  /**
   * handle combos like "MOV $1234+X,A => 0xD5 34 12", "MOV $12+X,A => 0xD4 12", etc.
   * or "MOV A,$1234+X => 0xF5 34 12" etc.
   * or "MOV $12+Y,X => 0xD9 12", etc.
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleMovMemoryCombo2(left: string, right: string): boolean {
    debug("handleMovMemoryCombo2", { left, right });
    // We see patterns from the test:
    //   MOV $1234+X,A => 0xD5 34 12
    //   MOV $12+X,A => 0xD4 12
    //   MOV $1234+Y,A => 0xD6 34 12
    //   MOV $12+Y,X => 0xD9 12
    //   MOV X,$12+Y => 0xF9 12
    //   MOV A,$1234+X => 0xF5 34 12
    //   MOV A,$12+X => 0xF4 12
    //   etc...
    // We'll define small tables for left->right and right->left. We'll parse the "+X" or "+Y."

    const combined = `${left.trim()},${right.trim()}`.toUpperCase();
    const resolveIndexedExpression = (
      operand: string,
    ): { value: number; index: "X" | "Y"; length: number } | null => {
      if (operand.includes("(") || operand.includes(")")) {
        return null;
      }
      const match = operand.trim().match(/^(.*)\+([xy])$/i);
      if (!match) {
        return null;
      }
      const baseExpression = match[1].trim();
      if (!baseExpression) {
        return null;
      }
      return {
        value: this.assembler.operandResolver.getnum(baseExpression),
        index: match[2].toUpperCase() as "X" | "Y",
        length: getAddressSize(baseExpression),
      };
    };

    const leftIndexed = resolveIndexedExpression(left);
    if (leftIndexed) {
      const leftIndexedOpcodes: Record<
        string,
        Partial<Record<"X" | "Y", { dp: number; abs: number }>>
      > = {
        A: { X: { dp: 0xd4, abs: 0xd5 }, Y: { dp: 0xd6, abs: 0xd6 } },
        X: { Y: { dp: 0xd9, abs: 0xd9 } },
        Y: { X: { dp: 0xdb, abs: 0xdb } },
      };
      const rightRegister = right.trim().toUpperCase();
      const modes = leftIndexedOpcodes[rightRegister]?.[leftIndexed.index];
      if (modes) {
        let opcode = modes.abs;
        if (leftIndexed.length === 1) {
          opcode = modes.dp;
        }
        this.assembler.write1(opcode);
        this.writeDpOrAbs(leftIndexed.value, leftIndexed.length);
        return true;
      }
    }

    const rightIndexed = resolveIndexedExpression(right);
    if (rightIndexed) {
      const rightIndexedOpcodes: Record<
        string,
        Partial<Record<"X" | "Y", { dp: number; abs: number }>>
      > = {
        A: { X: { dp: 0xf4, abs: 0xf5 }, Y: { dp: 0xf6, abs: 0xf6 } },
        X: { Y: { dp: 0xf9, abs: 0xf9 } },
        Y: { X: { dp: 0xfb, abs: 0xfb } },
      };
      const leftRegister = left.trim().toUpperCase();
      const modes = rightIndexedOpcodes[leftRegister]?.[rightIndexed.index];
      if (modes) {
        let opcode = modes.abs;
        if (rightIndexed.length === 1) {
          opcode = modes.dp;
        }
        this.assembler.write1(opcode);
        this.writeDpOrAbs(rightIndexed.value, rightIndexed.length);
        return true;
      }
    }

    // e.g. "^(?:\$([0-9A-F]+)\+X),A$"
    // We'll do direct regex approach:
    const patterns = [
      // left side with +X or +Y, right side = A
      {
        regex: /^\$([\dA-F]+)\+X\s*,\s*A$/,
        opcodeDp: 0xd4,
        opcodeAbs: 0xd5,
      },
      {
        regex: /^\$([\dA-F]+)\+Y\s*,\s*A$/,
        opcodeDp: 0xd6,
        opcodeAbs: 0xd6, // test uses same? Actually the test lines for "+Y" are the same 0xd6 for 16-bit.
      },
      // left side with +Y, right side = X => e.g. "MOV $12+Y,X => 0xD9 12"
      {
        regex: /^\$([\dA-F]+)\+Y\s*,\s*X$/,
        opcodeDp: 0xd9,
        opcodeAbs: 0xd9, // the test doesn't differentiate, so we unify
      },
      // left side with +X, right side = Y => "MOV $12+X,Y => 0xDB 12"
      {
        regex: /^\$([\dA-F]+)\+X\s*,\s*Y$/,
        opcodeDp: 0xdb,
        opcodeAbs: 0xdb,
      },
    ];

    for (const p of patterns) {
      const m = combined.match(p.regex);
      if (m) {
        const val = parseInt(m[1], 16) & 0xffff;
        const length = getAddressSize("$" + m[1]);
        let op = p.opcodeAbs;
        if (length === 1) {
          op = p.opcodeDp;
        }
        this.assembler.write1(op);
        this.writeDpOrAbs(val, length);
        return true;
      }
    }

    // Now the reverse side: "A,$12+X" or "X,$12+Y" etc.
    const patterns2 = [
      // A,$12+X => 0xF4 / 0xF5
      {
        regex: /^A\s*,\s*\$([\dA-F]+)\+X$/,
        opcodeDp: 0xf4,
        opcodeAbs: 0xf5,
      },
      // A,$12+Y => 0xF6 (the test code says "MOV A,$1234+Y => 0xF6 34 12" or "MOV A,$12+Y => 0xF6 12"?
      {
        regex: /^A\s*,\s*\$([\dA-F]+)\+Y$/,
        opcodeDp: 0xf6,
        opcodeAbs: 0xf6,
      },
      // X,$12+Y => 0xF9, Y,$12+X => 0xFB, etc. from the test
      {
        regex: /^X\s*,\s*\$([\dA-F]+)\+Y$/,
        opcodeDp: 0xf9,
        opcodeAbs: 0xf9,
      },
      {
        regex: /^Y\s*,\s*\$([\dA-F]+)\+X$/,
        opcodeDp: 0xfb,
        opcodeAbs: 0xfb,
      },
    ];

    for (const p of patterns2) {
      const m = combined.match(p.regex);
      if (m) {
        const val = parseInt(m[1], 16) & 0xffff;
        const length = getAddressSize("$" + m[1]);
        let op = p.opcodeAbs;
        if (length === 1) {
          op = p.opcodeDp;
        }
        this.assembler.write1(op);
        this.writeDpOrAbs(val, length);
        return true;
      }
    }

    // Finally, "MOV $1234,A => 0xC5 34 12", "MOV $12,A => 0xC4 12", "MOV $1234,X => 0xC9 34 12", "MOV $12,X => 0xD8 12", etc.
    // We'll define an array for e.g. "($abs => A) => 0xc5" if abs, or 0xc4 if dp, etc.
    const patterns3 = [
      {
        regex: /^\$([\dA-F]+)\s*,\s*A$/,
        opcodeDp: 0xc4,
        opcodeAbs: 0xc5,
      },
      {
        regex: /^\$([\dA-F]+)\s*,\s*X$/,
        opcodeDp: 0xd8,
        opcodeAbs: 0xc9,
      },
      {
        regex: /^\$([\dA-F]+)\s*,\s*Y$/,
        opcodeDp: 0xcb,
        opcodeAbs: 0xcc,
      },
      // The reverse: "A,$1234" => 0xe5 or 0xe4 for dp; "X,$1234" => 0xe9 or 0xf8 for dp, etc.
      {
        regex: /^A\s*,\s*\$([\dA-F]+)$/,
        opcodeDp: 0xe4,
        opcodeAbs: 0xe5,
      },
      {
        regex: /^X\s*,\s*\$([\dA-F]+)$/,
        opcodeDp: 0xf8,
        opcodeAbs: 0xe9,
      },
      {
        regex: /^Y\s*,\s*\$([\dA-F]+)$/,
        opcodeDp: 0xeb,
        opcodeAbs: 0xec,
      },
    ];

    for (const p of patterns3) {
      const m = combined.match(p.regex);
      if (m) {
        const val = parseInt(m[1], 16) & 0xffff;
        const length = getAddressSize("$" + m[1]);
        let op = p.opcodeAbs;
        if (length === 1) {
          op = p.opcodeDp;
        }
        this.assembler.write1(op);
        this.writeDpOrAbs(val, length);
        return true;
      }
    }

    return false;
  }

  /**
   * Encodes mem.bit carry ops. Bit is taken from `$addr.n` if present, else the
   * mnemonic digit (`NOT2` → bit 2). High byte is `(addr >> 8) | (bit << 5)`.
   *
   *   NOT1 $1234 / NOT2 C,$0027 / NOT1 $12.3 / NOT1 $addr,3
   *   MOV1 C,$addr / MOV2 $addr,C
   *   OR1 C,$addr / OR1 C,!$addr / AND1 C,/addr
   * @param {string} opcode Mnemonic, including numbered TASM forms.
   * @param {string} left Left operand.
   * @param {string} right Right operand, or empty for one-operand NOT/MOV.
   * @param {string} [explicitBitText] Optional third operand bit (`AND1 C,$addr,2`).
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleBitManipulation(
    opcode: string,
    left: string,
    right: string,
    explicitBitText = "",
  ): boolean {
    debug("handleBitManipulation", { opcode, left, right, explicitBitText });
    const parsed = parseNumberedBitOpcode(opcode);
    if (!parsed) {
      return false;
    }

    const leftUp = left.trim().toUpperCase();
    const rightUp = right.trim().toUpperCase();
    let memRaw = "";
    let movToCarry = true;
    let bitFromOperand: number | undefined;

    if (explicitBitText !== "") {
      const parsedBit = parseSpcBitNumber(explicitBitText);
      if (parsedBit === undefined) {
        return false;
      }
      bitFromOperand = parsedBit;
    }

    if (parsed.family === "MOV") {
      if (leftUp === "C") {
        memRaw = right;
        movToCarry = true;
      } else if (rightUp === "C") {
        memRaw = left;
        movToCarry = false;
      } else if (right === "") {
        memRaw = left;
        movToCarry = true;
      } else {
        return false;
      }
    } else if (parsed.family === "NOT") {
      if (right === "") {
        memRaw = left;
      } else if (leftUp === "C") {
        memRaw = right;
      } else if (rightUp === "C") {
        memRaw = left;
      } else {
        const bitNumber = parseSpcBitNumber(right);
        if (bitNumber === undefined) {
          return false;
        }
        memRaw = left;
        bitFromOperand = bitNumber;
      }
    } else if (leftUp === "C") {
      memRaw = right;
    } else if (rightUp === "C") {
      memRaw = left;
    } else {
      return false;
    }

    const mem = parseSpcMemBitOperand(memRaw);
    if (!mem) {
      return false;
    }

    let bit = parsed.mnemonicBit;
    if (mem.bit !== undefined) {
      bit = mem.bit;
    }
    if (bitFromOperand !== undefined) {
      bit = bitFromOperand;
    }

    let opcodeByte = 0xea;
    if (parsed.family === "OR") {
      opcodeByte = 0x0a;
      if (mem.invert) {
        opcodeByte = 0x2a;
      }
    } else if (parsed.family === "AND") {
      opcodeByte = 0x4a;
      if (mem.invert) {
        opcodeByte = 0x6a;
      }
    } else if (parsed.family === "EOR") {
      opcodeByte = 0x8a;
    } else if (parsed.family === "MOV") {
      opcodeByte = 0xaa;
      if (!movToCarry) {
        opcodeByte = 0xca;
      }
    }

    const hex = mem.addressText.match(/^\$([\da-f]+)$/i);
    let addr: number;
    if (hex) {
      addr = Number.parseInt(hex[1], 16) & 0xffff;
    } else {
      addr = this.assembler.operandResolver.getnum(mem.addressText) & 0xffff;
    }

    this.assembler.write1(opcodeByte);
    this.assembler.write1(addr & 0xff);
    this.assembler.write1(((addr >> 8) & 0xff) | ((bit & 7) << 5));
    return true;
  }

  /**
   * handle instructions with 1 operand that didn't match the prior sets, e.g. "DAA A => DF," "DAS A => BE," "MUL YA => CF," "DIV YA,X => 9E"
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleSingleOperandSpecial(opcode: string, operand: string): boolean {
    debug("handleSingleOperandSpecial", { opcode, operand });
    const upOpcode = opcode.toUpperCase();
    const upOperand = operand.toUpperCase();

    // e.g. "DAA A => 0xDF", "DAS A => 0xBE"
    if ((upOpcode === "DAA" || upOpcode === "DAS") && upOperand === "A") {
      if (upOpcode === "DAA") {
        this.assembler.write1(0xdf);
      } else {
        this.assembler.write1(0xbe);
      }
      return true;
    }

    // "MUL YA => 0xCF", "DIV YA,X => 0x9E"
    if (upOpcode === "MUL" && upOperand === "YA") {
      // => 0xcf
      this.assembler.write1(0xcf);
      return true;
    }
    if (upOpcode === "DIV" && upOperand === "YA,X") {
      // => 0x9e
      this.assembler.write1(0x9e);
      return true;
    }

    if (parseNumberedBitOpcode(upOpcode)) {
      return this.handleBitManipulation(upOpcode, operand, "");
    }

    // e.g. "DECW $12 => 1A 12", "INCW $12 => 3A 12", "CMPW YA,$12 => ???" => 2 operands though
    // "ADDW YA,$12" => 7A => 2 operands.
    if (this.handleWordOps(upOpcode, operand)) {
      return true;
    }

    return false;
  }

  /**
   * e.g. "DECW $12 => 1A 12", "INCW $12 => 3A 12", "CMPW YA,$12 => 5A ???" => That's 2 operands though
   * We'll handle the single-operand forms: DECW dp => 1A dp, INCW dp => 3A dp
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleWordOps(opcode: string, operand: string): boolean {
    debug("handleWordOps", { opcode, operand });
    // "DECW $12 => 1A 12"
    // "INCW $12 => 3A 12"
    // "CMPW YA,$12 => 5A 12" => 2 operands => we skip. Actually the test says "CMPW YA,$12 => 5A 12"? That's 2? The test lumps "YA" as the left operand. We'll treat that as 2 operands.
    // but the test code lumps it as "CMPW YA,$12" => we can parse it as "one operand with a comma?" The code uses top-level comma splitting though => "YA,$12" => two.
    // We'll do single operand for DECW, INCW only.
    const up = opcode.toUpperCase();
    if (hasOwn(singleWordOps, up)) {
      const val = parseInt(operand.replace(/\$/g, ""), 16) & 0xff;
      this.assembler.write1(singleWordOps[up]);
      this.assembler.write1(val);
      return true;
    }
    return false;
  }

  /**
   * Resolves the operand length from opcode suffix.
   * @param {string} c - the opcode suffix
   * @returns {number} the operand length
   */
  getlenfromchar(c: string): number {
    debug("getlenfromchar", c);
    switch (c.toLowerCase()) {
      case "b":
        return 1;
      case "w":
        return 2;
      case "l":
        return 3;
      case "d":
        debug("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }
}
