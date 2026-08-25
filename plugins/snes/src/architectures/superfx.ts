import {
  createEncoderRuntime,
  type ArchitectureEncoder,
  type ArchitectureEncoderContext,
  type EncoderRuntime,
  type InstructionDescriptor,
  type LoweredInstruction,
  type LoweredOperand,
} from "@uttori/asm-core";
import {
  encodeSuperFxMoveShortAddress,
  type SuperFxMoveShortAddressMode,
} from "../asar/compatibility.js";
import { superFxCatalog } from "../tooling/instruction-catalog.js";

let debug = (..._: unknown[]) => {};
try {
  const { default: d } = await import("debug");
  debug = d("ArchSuperFX");
} catch {}

const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
  Object.hasOwn(obj, key);

const ALT1 = 0x3d;
const ALT2 = 0x3e;
const ALT3 = 0x3f;

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
type ImpliedOpcode =
  | "STOP"
  | "NOP"
  | "CACHE"
  | "LSR"
  | "ROL"
  | "LOOP"
  | "ALT1"
  | "ALT2"
  | "ALT3"
  | "PLOT"
  | "SWAP"
  | "COLOR"
  | "NOT"
  | "MERGE"
  | "SBK"
  | "SEX"
  | "ASR"
  | "ROR"
  | "LOB"
  | "FMULT"
  | "HIB"
  | "GETC"
  | "GETB";

const IMPLIED_OPCODES: Record<ImpliedOpcode, number> = {
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

const PREFIXED_OPCODES: Record<string, { prefix: number; opcode: number }> = {
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

type ShortBranchOpcode =
  | "BRA"
  | "BGE"
  | "BLT"
  | "BNE"
  | "BEQ"
  | "BPL"
  | "BMI"
  | "BCC"
  | "BCS"
  | "BVC"
  | "BVS";

const SHORT_BRANCH_OPCODES: Record<ShortBranchOpcode, number> = {
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

type RegisterOpEncoding = {
  prefix?: number;
  base: number;
  min?: number;
  max?: number;
};

const REGISTER_OPS: Record<string, RegisterOpEncoding> = {
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

const IMMEDIATE_OPS: Record<string, RegisterOpEncoding> = {
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

const INDIRECT_OPS: Record<string, RegisterOpEncoding> = {
  STW: { base: 0x30, min: 0, max: 11 },
  LDW: { base: 0x40, min: 0, max: 11 },
  STB: { prefix: ALT1, base: 0x30, min: 0, max: 11 },
  LDB: { prefix: ALT1, base: 0x40, min: 0, max: 11 },
};

/**
 * Returns 1 for a bare opcode byte, 2 when an ALT prefix is present.
 * @param {RegisterOpEncoding} encoding The encoding table entry.
 * @returns {number} Encoded size in bytes.
 */
const encodedOpSize = (encoding: RegisterOpEncoding): number => {
  if (encoding.prefix === undefined) {
    return 1;
  }
  return 2;
};

/**
 * True when a 16-bit immediate fits in a signed byte, so MOVE can use IBT.
 * `$FF` does not qualify; `$FF80`–`$FFFF` do.
 * @param {number} value The immediate value.
 * @returns {boolean} True if IBT can encode the value.
 */
const fitsSignedByte = (value: number): boolean => {
  const imm = value & 0xffff;
  return imm < 0x80 || imm >= 0xff80;
};

/**
 * LMS/SMS short form: even RAM byte address in `$000`–`$1FE`.
 * Auto-MOVE uses this opcode too; the stored byte is {@link encodeSuperFxMoveShortAddress}.
 * @param {number} addrVal The RAM byte address.
 * @returns {boolean} True if the address fits the short form.
 */
const isShortRamAddress = (addrVal: number): boolean => (addrVal & 1) === 0 && addrVal < 0x200;

export class ArchSuperFX implements ArchitectureEncoder {
  assembler: EncoderRuntime;

  constructor(
    context: ArchitectureEncoderContext,
    readonly asarMoveShortAddress: () => boolean = () => false,
  ) {
    this.assembler = createEncoderRuntime(context);
  }

  /**
   * Returns the static Super FX instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog(): InstructionDescriptor[] {
    return superFxCatalog;
  }

  /**
   * Estimates instruction size from a lowered instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {number} Encoded size in bytes.
   */
  estimateInstruction(instruction: LoweredInstruction): number {
    const loweredOperands = instruction.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction.mnemonic,
      instruction.operands,
      instruction.loweredOperand,
      loweredOperands,
    );
  }

  /**
   * Encodes a lowered instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} True if the instruction was encoded.
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
   * Estimates size from tokenized words.
   * @param {string[]} words The words.
   * @returns {number} Encoded size in bytes.
   */
  estimateSize(words: string[]): number {
    if (words.length === 0) {
      return 0;
    }
    const { opcode, operands, rawOperand } = this.parseInstructionWords(words);
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = operands.map((operand) =>
      this.assembler.operandResolver.lowerOperand(operand),
    );
    return this.estimateResolvedInstruction(opcode, operands, loweredOperand, loweredOperands);
  }

  /**
   * Estimates encoded size. Must match {@link encodeResolvedInstruction} byte counts
   * so layout `step()` stays in sync with emit.
   * @param {string} mnemonic The mnemonic.
   * @param {string[]} operands The operands.
   * @param {LoweredOperand} [loweredOperand] The combined lowered operand.
   * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
   * @returns {number} Encoded size in bytes.
   */
  estimateResolvedInstruction(
    mnemonic: string,
    operands: string[],
    loweredOperand?: LoweredOperand,
    loweredOperands: LoweredOperand[] = [],
  ): number {
    const opcode = mnemonic.toUpperCase();
    if (hasOwn(IMPLIED_OPCODES, opcode)) {
      return 1;
    }
    if (hasOwn(PREFIXED_OPCODES, opcode)) {
      return 2;
    }

    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const secondLowered = loweredOperands[1];
    const leftOp = firstLowered?.expanded ?? operands[0] ?? "";
    const rightOp = secondLowered?.expanded ?? operands[1] ?? "";

    if (operands.length <= 1 && hasOwn(SHORT_BRANCH_OPCODES, opcode)) {
      return 2;
    }

    if (operands.length <= 1) {
      const regR = this.resolveRegister(leftOp, firstLowered, "r");
      if (regR !== null && hasOwn(REGISTER_OPS, opcode)) {
        return encodedOpSize(REGISTER_OPS[opcode]);
      }
      const regHash = this.resolveRegister(leftOp, firstLowered, "hash");
      if (regHash !== null && hasOwn(IMMEDIATE_OPS, opcode)) {
        return encodedOpSize(IMMEDIATE_OPS[opcode]);
      }
      const regParr = this.resolveRegister(leftOp, firstLowered, "parr");
      if (regParr !== null && hasOwn(INDIRECT_OPS, opcode)) {
        return encodedOpSize(INDIRECT_OPS[opcode]);
      }
      return 1;
    }

    if (operands.length !== 2) {
      return 1;
    }

    const reg1r = this.resolveRegister(leftOp, firstLowered, "r");
    const reg1parr = this.resolveRegister(leftOp, firstLowered, "parr");
    const reg2r = this.resolveRegister(rightOp, secondLowered, "r");
    const reg2parr = this.resolveRegister(rightOp, secondLowered, "parr");

    if (reg1r !== null && reg2r !== null) {
      if (opcode === "MOVE" || opcode === "MOVES") {
        return 2;
      }
    }

    if (reg1r !== null && (secondLowered?.immediate ?? rightOp.startsWith("#"))) {
      if (opcode === "IBT") {
        return 2;
      }
      if (opcode === "IWT") {
        return 3;
      }
      if (opcode === "MOVE") {
        const immediateExpression = secondLowered?.baseExpression ?? rightOp.slice(1);
        const immVal = this.tryGetNumber(immediateExpression);
        if (immVal !== undefined && fitsSignedByte(immVal)) {
          return 2;
        }
        return 3;
      }
    }

    if (reg1parr !== null && reg2r !== null) {
      if (opcode === "MOVEB") {
        return reg1parr === 0 ? 2 : 3;
      }
      if (opcode === "MOVEW") {
        return reg1parr === 0 ? 1 : 2;
      }
    }

    if (reg1r !== null && reg2parr !== null) {
      if (opcode === "MOVEB") {
        return reg1r === 0 ? 2 : 3;
      }
      if (opcode === "MOVEW") {
        return reg1r === 0 ? 1 : 2;
      }
    }

    if (reg1r !== null) {
      if (opcode === "LM") {
        return 4;
      }
      if (opcode === "LMS") {
        return 3;
      }
      if (opcode === "LEA") {
        return 3;
      }
      if (opcode === "MOVE") {
        const addressExpression = secondLowered?.baseExpression ?? rightOp;
        const addrVal = this.tryGetNumber(addressExpression);
        if (addrVal !== undefined && isShortRamAddress(addrVal)) {
          return 3;
        }
        return 4;
      }
    }

    const leftIsRegisterIndirect = firstLowered?.mode === "registerIndirect";
    if (
      reg2r !== null &&
      !leftIsRegisterIndirect &&
      (firstLowered?.indirect ?? (leftOp.startsWith("(") && leftOp.endsWith(")")))
    ) {
      if (opcode === "SM") {
        return 4;
      }
      if (opcode === "SMS") {
        return 3;
      }
      if (opcode === "MOVE") {
        const addressExpression = firstLowered?.baseExpression ?? leftOp;
        const addrVal = this.tryGetNumber(addressExpression);
        if (addrVal !== undefined && isShortRamAddress(addrVal)) {
          return 3;
        }
        return 4;
      }
    }

    return 1;
  }

  /**
   * Processes a SuperFX assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  public encode(words: string[]): boolean {
    debug("asblock_superfx", words);
    if (words.length === 0) {
      return false;
    }

    const { opcode, operands, rawOperand } = this.parseInstructionWords(words);
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = operands.map((operand) =>
      this.assembler.operandResolver.lowerOperand(operand),
    );
    return this.encodeResolvedInstruction(opcode, operands, loweredOperand, loweredOperands);
  }

  /**
   * Encodes a resolved instruction.
   * @param {string} mnemonic The mnemonic.
   * @param {string[]} operands The operands.
   * @param {LoweredOperand} [loweredOperand] The combined lowered operand.
   * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
   * @returns {boolean} True if the instruction was encoded.
   */
  encodeResolvedInstruction(
    mnemonic: string,
    operands: string[],
    loweredOperand?: LoweredOperand,
    loweredOperands: LoweredOperand[] = [],
  ): boolean {
    const opcode = mnemonic.toUpperCase();
    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const secondLowered = loweredOperands[1];
    const operand = firstLowered?.expanded ?? "";
    const operandLength = firstLowered?.length ?? this.getOperandLength(operand);
    debug("asblock_superfx opcode", opcode);
    debug("asblock_superfx operand", operand);

    if (hasOwn(IMPLIED_OPCODES, opcode) || hasOwn(PREFIXED_OPCODES, opcode)) {
      if (operands.length !== 0) {
        throw this.assembler.diagnostics.error(`${opcode} does not take operands`);
      }
      return this.handleSingleWordOpcode(opcode);
    }

    if (operands.length === 1) {
      return this.handleOneOperandOpcode(opcode, operand, operandLength, firstLowered);
    }

    if (operands.length === 2) {
      return this.handleTwoOperandOpcode(
        opcode,
        firstLowered?.expanded ?? operands[0],
        secondLowered?.expanded ?? operands[1],
        firstLowered,
        secondLowered,
      );
    }

    return false;
  }

  /**
   * Handles implied SuperFX opcodes with no operands.
   * @param {string} opcode - the opcode
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleSingleWordOpcode(opcode: string): boolean {
    debug("handleSingleWordOpcode", opcode);

    if (hasOwn(IMPLIED_OPCODES, opcode)) {
      this.assembler.write1(IMPLIED_OPCODES[opcode]);
      return true;
    }

    if (hasOwn(PREFIXED_OPCODES, opcode)) {
      const command = PREFIXED_OPCODES[opcode];
      this.assembler.write1(command.prefix);
      this.assembler.write1(command.opcode);
      return true;
    }

    return false;
  }

  /**
   * Handles instructions with a single operand (e.g., "TO R1", "BRA label").
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number} operandLength - the length of the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleOneOperandOpcode(
    opcode: string,
    operand: string,
    operandLength: number,
    loweredOperand?: LoweredOperand,
  ): boolean {
    debug("handleOneOperandOpcode", opcode, operand, operandLength);

    if (hasOwn(SHORT_BRANCH_OPCODES, opcode)) {
      const branchOpcode = SHORT_BRANCH_OPCODES[opcode];
      const sourceSpelling = (loweredOperand?.raw ?? operand).trim();
      const val = this.assembler.operandResolver.getnum(operand);
      // Asar getlen==1: only an explicit `$XX` spelling is a raw 8-bit offset.
      // Labels that expand to `$80` stay PC-relative: target - (pc + 2).
      if (this.isRawBranchOffset(sourceSpelling)) {
        this.assembler.write1(branchOpcode);
        this.assembler.write1(val & 0xff);
        return true;
      }

      const pc = this.assembler.currentTargetAddress & 0xffffff;
      const offset = val - (pc + 2);
      if (this.assembler.enforceResolvedLabels && (offset < -128 || offset > 127)) {
        throw this.assembler.diagnostics.error(`Branch target out of range (${offset})`);
      }
      this.assembler.write1(branchOpcode);
      this.assembler.write1(offset & 0xff);
      return true;
    }

    const regR = this.resolveRegister(operand, loweredOperand, "r");
    const regHash = this.resolveRegister(operand, loweredOperand, "hash");
    const regParr = this.resolveRegister(operand, loweredOperand, "parr");

    if (regR !== null && hasOwn(REGISTER_OPS, opcode)) {
      this.writeRegisterOp(REGISTER_OPS[opcode], regR);
      return true;
    }

    if (regHash !== null && hasOwn(IMMEDIATE_OPS, opcode)) {
      this.writeRegisterOp(IMMEDIATE_OPS[opcode], regHash);
      return true;
    }

    if (regParr !== null && hasOwn(INDIRECT_OPS, opcode)) {
      this.writeRegisterOp(INDIRECT_OPS[opcode], regParr);
      return true;
    }

    return false;
  }

  /**
   * Handles instructions with two operands (e.g., MOVE r1, r2).
   * @param {string} opcode - the opcode
   * @param {string} leftOp - the left operand
   * @param {string} rightOp - the right operand
   * @param {LoweredOperand} leftLowered - optional lowered metadata for left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for right operand
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleTwoOperandOpcode(
    opcode: string,
    leftOp: string,
    rightOp: string,
    leftLowered?: LoweredOperand,
    rightLowered?: LoweredOperand,
  ): boolean {
    debug("handleTwoOperandOpcode", { opcode, leftOp, rightOp });

    const reg1r = this.resolveRegister(leftOp, leftLowered, "r");
    const reg1parr = this.resolveRegister(leftOp, leftLowered, "parr");
    const reg2r = this.resolveRegister(rightOp, rightLowered, "r");
    const reg2parr = this.resolveRegister(rightOp, rightLowered, "parr");
    debug("handleTwoOperandOpcode", { reg1r, reg1parr, reg2r, reg2parr });

    if (reg1r !== null && reg2r !== null) {
      switch (opcode) {
        case "MOVE":
          // WITH src / TO dest. B and D default back to R0 after the pair.
          this.assembler.write1(0x20 + reg2r);
          this.assembler.write1(0x10 + reg1r);
          return true;
        case "MOVES":
          // WITH dest / FROM src (also copies flags into SReg).
          this.assembler.write1(0x20 + reg1r);
          this.assembler.write1(0xb0 + reg2r);
          return true;
      }
    }

    if (reg1r !== null && (rightLowered?.immediate ?? rightOp.startsWith("#"))) {
      const immediateExpression = rightLowered?.baseExpression ?? rightOp.slice(1);
      const immVal = this.assembler.operandResolver.getnum(immediateExpression) & 0xffff;
      switch (opcode) {
        case "IBT":
          this.assembler.write1(0xa0 + reg1r);
          this.assembler.write1(immVal & 0xff);
          return true;
        case "IWT":
          this.assembler.write1(0xf0 + reg1r);
          this.assembler.write1(immVal & 0xff);
          this.assembler.write1((immVal >> 8) & 0xff);
          return true;
        case "MOVE":
          if (fitsSignedByte(immVal)) {
            this.assembler.write1(0xa0 + reg1r);
            this.assembler.write1(immVal & 0xff);
          } else {
            this.assembler.write1(0xf0 + reg1r);
            this.assembler.write1(immVal & 0xff);
            this.assembler.write1((immVal >> 8) & 0xff);
          }
          return true;
      }
    }

    // MOVEB/MOVEW expand to FROM/TO + LDB/STB/LDW/STW. B/D default to R0, so the
    // R0 cases drop the prefix. Asar store syntax `MOVEB (Rn), Rm` is
    // FROM Rn / STB (Rm): parenthesized reg is the byte source, the other is
    // the pointer. Load `MOVEB Rn, (Rm)` is TO Rn / LDB (Rm).
    // The 30+x / 40+x slot is R0-R11, same as LDB/STB/LDW/STW.
    if (reg1parr !== null && reg2r !== null) {
      switch (opcode) {
        case "MOVEB":
          this.rangeCheck(0, reg2r, 11);
          if (reg1parr === 0) {
            this.assembler.write1(ALT1);
            this.assembler.write1(0x30 + reg2r);
          } else {
            this.assembler.write1(0xb0 + reg1parr);
            this.assembler.write1(ALT1);
            this.assembler.write1(0x30 + reg2r);
          }
          return true;
        case "MOVEW":
          this.rangeCheck(0, reg2r, 11);
          if (reg1parr === 0) {
            this.assembler.write1(0x30 + reg2r);
          } else {
            this.assembler.write1(0xb0 + reg1parr);
            this.assembler.write1(0x30 + reg2r);
          }
          return true;
      }
    }

    if (reg1r !== null && reg2parr !== null) {
      switch (opcode) {
        case "MOVEB":
          this.rangeCheck(0, reg2parr, 11);
          if (reg1r === 0) {
            this.assembler.write1(ALT1);
            this.assembler.write1(0x40 + reg2parr);
          } else {
            this.assembler.write1(0x10 + reg1r);
            this.assembler.write1(ALT1);
            this.assembler.write1(0x40 + reg2parr);
          }
          return true;
        case "MOVEW":
          this.rangeCheck(0, reg2parr, 11);
          if (reg1r === 0) {
            this.assembler.write1(0x40 + reg2parr);
          } else {
            this.assembler.write1(0x10 + reg1r);
            this.assembler.write1(0x40 + reg2parr);
          }
          return true;
      }
    }

    if (reg1r !== null) {
      const addressExpression = rightLowered?.baseExpression ?? rightOp;
      const addrVal = this.assembler.operandResolver.getnum(addressExpression);
      switch (opcode) {
        case "LM":
          this.assembler.write1(ALT1);
          this.assembler.write1(0xf0 + reg1r);
          this.assembler.write2(addrVal);
          return true;
        case "LMS":
          this.checkShortAddr(addrVal);
          this.assembler.write1(ALT1);
          this.assembler.write1(0xa0 + reg1r);
          this.assembler.write1(addrVal >> 1);
          return true;
        case "MOVE":
          // Auto LMS vs LM. Short-form byte is hardware `addr>>1` unless Asar compat is on.
          if (isShortRamAddress(addrVal)) {
            this.assembler.write1(ALT1);
            this.assembler.write1(0xa0 + reg1r);
            this.assembler.write1(this.moveShortAddressByte(addrVal));
          } else {
            this.assembler.write1(ALT1);
            this.assembler.write1(0xf0 + reg1r);
            this.assembler.write2(addrVal);
          }
          return true;
        case "LEA":
          this.assembler.write1(0xf0 + reg1r);
          this.assembler.write1(addrVal & 0xff);
          this.assembler.write1((addrVal >> 8) & 0xff);
          return true;
      }
    }

    const leftIsRegisterIndirect = leftLowered?.mode === "registerIndirect";
    if (
      reg2r !== null &&
      !leftIsRegisterIndirect &&
      (leftLowered?.indirect ?? (leftOp.startsWith("(") && leftOp.endsWith(")")))
    ) {
      const addressExpression = leftLowered?.baseExpression ?? leftOp;
      const addrVal = this.assembler.operandResolver.getnum(addressExpression);
      switch (opcode) {
        case "SM":
          this.assembler.write1(ALT2);
          this.assembler.write1(0xf0 + reg2r);
          this.assembler.write2(addrVal);
          return true;
        case "SMS":
          this.checkShortAddr(addrVal);
          this.assembler.write1(ALT2);
          this.assembler.write1(0xa0 + reg2r);
          this.assembler.write1(addrVal >> 1);
          return true;
        case "MOVE":
          if (isShortRamAddress(addrVal)) {
            this.assembler.write1(ALT2);
            this.assembler.write1(0xa0 + reg2r);
            this.assembler.write1(this.moveShortAddressByte(addrVal));
          } else {
            this.assembler.write1(ALT2);
            this.assembler.write1(0xf0 + reg2r);
            this.assembler.write2(addrVal);
          }
          return true;
      }
    }

    return false;
  }

  /**
   * Resolves a SuperFX register operand.
   * @param {string} str The operand text.
   * @param {LoweredOperand | undefined} lowered The lowered operand.
   * @param {"r" | "parr" | "hash"} type Direct (`rN`), indirect (`(rN)`), or `#n`.
   * @returns {number | null} Register number 0-15, or null if it doesn't match.
   */
  resolveRegister(
    str: string,
    lowered: LoweredOperand | undefined,
    type: "r" | "parr" | "hash",
  ): number | null {
    if (lowered) {
      if (
        type === "r" &&
        lowered.mode === "register" &&
        lowered.registerName?.toLowerCase().startsWith("r")
      ) {
        const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
        return regnum === -1 ? null : regnum;
      }
      if (
        type === "parr" &&
        lowered.mode === "registerIndirect" &&
        lowered.registerName?.toLowerCase().startsWith("r")
      ) {
        const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
        return regnum === -1 ? null : regnum;
      }
      if (type === "hash" && lowered.immediate) {
        const regnum = this.assembler.operandResolver.getnum(
          lowered.baseExpression ?? lowered.expanded.slice(1),
        );
        if (Number.isNaN(regnum) || regnum < 0 || regnum > 15) {
          return null;
        }
        return regnum;
      }
    }
    return this.getRegister(str, type);
  }

  /**
   * Attempts to parse a register from a string, e.g. "r0", "(r3)", "#3".
   * @param {string} str The operand string.
   * @param {"r" | "parr" | "hash"} type The type of register.
   * @returns {number | null} The register number or null if it doesn't match.
   */
  getRegister(str: string, type: "r" | "parr" | "hash"): number | null {
    if (type === "parr") {
      if (!str.startsWith("(")) {
        return null;
      }
      str = str.slice(1);
      if (!/^r\d{1,2}\)/i.test(str)) {
        return null;
      }
      if (str[0].toLowerCase() !== "r") {
        return null;
      }
      str = str.slice(1);

      const regnum = this.parseRegisterNumber(str.replace(/\)$/, ""));
      if (regnum === -1) {
        return null;
      }
      return regnum;
    }

    if (type === "r") {
      if (!str.toLowerCase().startsWith("r")) {
        return null;
      }
      const regnum = this.parseRegisterNumber(str.slice(1));
      if (regnum === -1) {
        return null;
      }
      return regnum;
    }

    if (type === "hash") {
      if (!str.startsWith("#")) {
        return null;
      }
      const regnum = this.assembler.operandResolver.getnum(str.slice(1));
      if (Number.isNaN(regnum) || regnum < 0 || regnum > 15) {
        debug("Invalid register number", str, regnum);
        return null;
      }
      return regnum;
    }

    return null;
  }

  /**
   * Parses the register number. E.g. '5', '10', '15'. Returns -1 if invalid.
   * @param {string} str The string to parse.
   * @returns {number} The register number.
   */
  parseRegisterNumber(str: string): number {
    const match = str.match(/^\d{1,2}$/);
    if (!match) {
      return -1;
    }
    const value = parseInt(str, 10);
    if (value < 0 || value > 15) {
      return -1;
    }
    return value;
  }

  /**
   * Raises an error if `mid < min` or `mid > max`.
   * @param {number} min The minimum value.
   * @param {number} mid The middle value.
   * @param {number} max The maximum value.
   * @throws {Error} If the middle value is out of range.
   */
  rangeCheck(min: number, mid: number, max: number) {
    if (mid < min || mid > max) {
      throw this.assembler.diagnostics.error(`Register out of valid range ${min}-${max}: ${mid}`);
    }
  }

  /**
   * For LMS/SMS short addressing, the address must be even and in `[0x000..0x1FE]`.
   * @param {number} num - the address
   * @returns {boolean} True if the address is valid.
   */
  checkShortAddr(num: number): boolean {
    debug("checkShortAddr", num);
    if (num % 2 !== 0 || num < 0 || num > 0x1fe) {
      throw this.assembler.diagnostics.error(
        `Invalid short address ${num}. Must be even and in range 0..0x1FE`,
      );
    }
    return true;
  }

  /**
   * True when the source spelling is an explicit 2-digit hex branch offset (`$XX`).
   * Expanded label values that happen to fit in a byte must not use this path.
   * @param {string} operand The raw or expanded operand.
   * @returns {boolean} True if the operand is a raw 8-bit offset spelling.
   */
  isRawBranchOffset(operand: string): boolean {
    return /^\$[\dA-Fa-f]{2}$/.test(operand.trim());
  }

  /**
   * Returns 1 for a 2-digit hex operand (`$XX`), otherwise 2.
   * @param {string} operand the operand
   * @returns {number} The operand length.
   */
  getOperandLength(operand: string): number {
    if (this.isRawBranchOffset(operand)) {
      return 1;
    }
    return 2;
  }

  /**
   * Splits tokenized words into opcode plus comma-separated operands.
   * @param {string[]} words The tokenized instruction.
   * @returns {{ opcode: string; operands: string[]; rawOperand: string }} Parsed parts.
   */
  parseInstructionWords(words: string[]): {
    opcode: string;
    operands: string[];
    rawOperand: string;
  } {
    const opcode = words[0];
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const operands = rawOperand ? rawOperand.split(",").map((operand) => operand.trim()) : [];
    return { opcode, operands, rawOperand };
  }

  /**
   * Writes a register-encoded ALU/load op, with optional ALT prefix and range check.
   * @param {RegisterOpEncoding} encoding The encoding table entry.
   * @param {number} register The register number.
   */
  writeRegisterOp(encoding: RegisterOpEncoding, register: number) {
    if (encoding.min !== undefined && encoding.max !== undefined) {
      this.rangeCheck(encoding.min, register, encoding.max);
    }
    if (encoding.prefix !== undefined) {
      this.assembler.write1(encoding.prefix);
    }
    this.assembler.write1(encoding.base + register);
  }

  /**
   * Encodes the LMS/SMS operand byte for auto-MOVE short addressing.
   * @param {number} addrVal Even RAM byte address below `$200`.
   * @returns {number} Hardware word index, or Asar's raw byte when compat is enabled.
   */
  moveShortAddressByte(addrVal: number): number {
    let mode: SuperFxMoveShortAddressMode = "hardware";
    if (this.asarMoveShortAddress()) {
      mode = "asar";
    }
    return encodeSuperFxMoveShortAddress(addrVal, mode);
  }

  /**
   * Resolves a numeric operand for sizing without failing layout on forward refs.
   * @param {string} expression The expression.
   * @returns {number | undefined} The value, or undefined if it cannot be resolved yet.
   */
  tryGetNumber(expression: string): number | undefined {
    try {
      const value = this.assembler.operandResolver.getnum(expression);
      if (Number.isNaN(value)) {
        return undefined;
      }
      return value;
    } catch {
      return undefined;
    }
  }
}
