import {
  createEncoderRuntime,
  type ArchitectureEncoder,
  type ArchitectureEncoderContext,
  type EncoderRuntime,
  type InstructionDescriptor,
  type LoweredInstruction,
  type LoweredOperand,
} from "./architecture-types.js";
import { superFxCatalog } from "./lsp/instruction-catalog.js";

let debug = (..._: unknown[]) => {};
try {
  const { default: d } = await import("debug");
  debug = d("ArchSuperFX");
} catch {}

const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T => Object.hasOwn(obj, key);

export class ArchSuperFX implements ArchitectureEncoder {
  assembler: EncoderRuntime;

  constructor(context: ArchitectureEncoderContext) {
    this.assembler = createEncoderRuntime(context);
  }

  /**
   * Returns the static Super FX instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog(): InstructionDescriptor[] {
    return superFxCatalog;
  }

  encode(words: string[]): boolean {
    return this.asblock_superfx(words);
  }

  estimateInstruction(instruction: LoweredInstruction): number {
    const loweredOperands = instruction.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction.mnemonic,
      instruction.operandText,
      instruction.loweredOperand,
      loweredOperands,
    );
  }

  encodeInstruction(instruction: LoweredInstruction): boolean {
    const loweredOperands = instruction.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction.mnemonic,
      instruction.operands,
      instruction.loweredOperand,
      loweredOperands,
    );
  }

  estimateSize(words: string[]): number {
    if (words.length === 0) {
      return 0;
    }
    return this.estimateResolvedInstruction(words[0], words.slice(1).join(" "));
  }

  estimateResolvedInstruction(
    mnemonic: string,
    operandText: string,
    loweredOperand?: LoweredOperand,
    loweredOperands: LoweredOperand[] = [],
  ): number {
    const opcode = mnemonic.toUpperCase();
    let size = 1;
    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const expandedOperand = firstLowered?.expanded ?? operandText;
    if (expandedOperand) {
      if (expandedOperand.startsWith("#")) {
        size = 2;
      } else if (expandedOperand.includes("$") || loweredOperands.length > 1 || expandedOperand.includes(",")) {
        size = 3;
      }
    }
    if (["JSL", "JML"].includes(opcode)) {
      size = 4;
    }
    return size;
  }

  /**
   * Processes a SuperFX assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  public asblock_superfx(words: string[]): boolean {
    debug("asblock_superfx", words);
    if (words.length === 0) {
      return false;
    }

    const opcode = words[0];
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const parsedOperands = rawOperand ? rawOperand.split(",").map((operand) => operand.trim()) : [];
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = parsedOperands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    return this.encodeResolvedInstruction(opcode, parsedOperands, loweredOperand, loweredOperands);
  }

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

    // Handle single-word opcodes (e.g., NOP, STOP, etc.)
    if (this.handleSingleWordOpcode(opcode)) {
      return true;
    }

    if (operands.length === 1 && this.handleTwoWordOpcode(opcode, operand, operandLength, firstLowered)) {
      return true;
    }

    if (operands.length === 1) {
      // Single argument instructions
      return this.handleOneOperandOpcode(opcode, operand, operandLength, firstLowered);
    } else if (operands.length === 2) {
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
   * Handles single-word (no-operand) opcodes for SuperFX.
   * @param {string} opcode - the opcode
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleSingleWordOpcode(opcode: string): boolean {
    debug("handleSingleWordOpcode", opcode);

    // Simple single-byte instructions
    type SingleOpcode =
      | "STOP" | "NOP" | "CACHE" | "LSR" | "ROL" | "LOOP" | "ALT1" | "ALT2" | "ALT3"
      | "PLOT" | "SWAP" | "COLOR" | "NOT" | "MERGE" | "SBK" | "SEX" | "ASR" | "ROR"
      | "LOB" | "FMULT" | "HIB" | "GETC" | "GETB";
    const singleOpcodes: Record<SingleOpcode, number> = {
      STOP: 0x00,
      NOP: 0x01,
      CACHE: 0x02,
      LSR: 0x03,
      ROL: 0x04,
      LOOP: 0x3C,
      ALT1: 0x3D,
      ALT2: 0x3E,
      ALT3: 0x3F,
      PLOT: 0x4C,
      SWAP: 0x4D,
      COLOR: 0x4E,
      NOT: 0x4F,
      MERGE: 0x70,
      SBK: 0x90,
      SEX: 0x95,
      ASR: 0x96,
      ROR: 0x97,
      LOB: 0x9E,
      FMULT: 0x9F,
      HIB: 0xC0,
      GETC: 0xDF,
      GETB: 0xEF,
    };

    // Some instructions require a prefix like 0x3D, 0x3E, or 0x3F
    // (e.g., "RPIX" => 0x3D + 0x4C).
    // We'll handle those separately:
    type TwoByteCommand = {
      mnemonic: string;
      prefix: number;
      opcode: number;
    };

    const extendedOpcodes: TwoByteCommand[] = [
      { mnemonic: "RPIX", prefix: 0x3D, opcode: 0x4C },
      { mnemonic: "CMODE", prefix: 0x3D, opcode: 0x4E },
      { mnemonic: "DIV2", prefix: 0x3D, opcode: 0x96 },
      { mnemonic: "LMULT", prefix: 0x3D, opcode: 0x9F },
      { mnemonic: "GETBH", prefix: 0x3D, opcode: 0xEF },

      { mnemonic: "RAMB", prefix: 0x3E, opcode: 0xDF },
      { mnemonic: "GETBL", prefix: 0x3E, opcode: 0xEF },

      { mnemonic: "ROMB", prefix: 0x3F, opcode: 0xDF },
      { mnemonic: "GETBS", prefix: 0x3F, opcode: 0xEF },
    ];

    // Check simple single-byte opcodes
    if (hasOwn(singleOpcodes, opcode)) {
      this.assembler.write1(singleOpcodes[opcode]);
      return true;
    }

    // Check two-byte extended opcodes
    for (const cmd of extendedOpcodes) {
      if (opcode === cmd.mnemonic) {
        this.assembler.write1(cmd.prefix);
        this.assembler.write1(cmd.opcode);
        return true;
      }
    }

    return false;
  }

  /**
   * Handles two-word opcodes (one opcode + one operand).
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number} operandLength - the lowered operand length
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleTwoWordOpcode(opcode: string, operand: string, operandLength: number, loweredOperand?: LoweredOperand): boolean {
    debug("handleTwoWordOpcode", opcode, operand);
    return this.handleOneOperandOpcode(opcode, operand, operandLength, loweredOperand);
  }

  /**
   * Handles instructions with a single operand (e.g., "TO R1", "BRA label").
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number} operandLength - the length of the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleOneOperandOpcode(opcode: string, operand: string, operandLength: number, loweredOperand?: LoweredOperand): boolean {
    debug("handleOneOperandOpcode", opcode, operand, operandLength);

    // Mapping for short branches (8-bit offset)
    type ShortBranchOpcode = "BRA" | "BGE" | "BLT" | "BNE" | "BEQ" | "BPL" | "BMI" | "BCC" | "BCS" | "BVC" | "BVS";
    const shortBranchMap: Record<ShortBranchOpcode, number> = {
      BRA: 0x05,
      BGE: 0x06,
      BLT: 0x07,
      BNE: 0x08,
      BEQ: 0x09,
      BPL: 0x0A,
      BMI: 0x0B,
      BCC: 0x0C,
      BCS: 0x0D,
      BVC: 0x0E,
      BVS: 0x0F,
    };

    if (hasOwn(shortBranchMap, opcode)) {
      const branchOpcode = shortBranchMap[opcode];
      // We interpret the operand as an address for branching
      // If the user wants an 8-bit offset, we allow direct or label
      const val = this.assembler.operandResolver.getnum(operand);
      // Use operandLength determined by expandOperand
      if (operandLength === 1) {
        // direct offset
        this.assembler.write1(branchOpcode);
        this.assembler.write1(val & 0xff);
      } else {
        // relative
        const pc = this.assembler.currentTargetAddress & 0xffffff;
        const offset = (val - (pc + 2)) & 0xff;
        this.assembler.write1(branchOpcode);
        this.assembler.write1(offset);
      }
      return true;
    }

    // Attempt to parse the operand as register
    const regR = this.resolveRegister(operand, loweredOperand, "r");
    const regHash = this.resolveRegister(operand, loweredOperand, "hash");
    const regParr = this.resolveRegister(operand, loweredOperand, "parr");

    // Potential second-level variants for ALT instructions
    // Example: "ADC Rn" => write1(0x3D), write1(0x50 + n)

    // "TO Rn", "WITH Rn", etc.
    if (regR !== null) {
      // handle instructions that take a single Rn
      switch (opcode) {
        case "TO":
          this.assembler.write1(0x10 + regR);
          return true;
        case "WITH":
          this.assembler.write1(0x20 + regR);
          return true;
        case "ADD":
          this.assembler.write1(0x50 + regR);
          return true;
        case "SUB":
          this.assembler.write1(0x60 + regR);
          return true;
        case "AND":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(0x70 + regR);
          return true;
        case "MULT":
          this.assembler.write1(0x80 + regR);
          return true;
        case "JMP":
          this.rangeCheck(8, regR, 13);
          this.assembler.write1(0x90 + regR);
          return true;
        case "FROM":
          this.assembler.write1(0xB0 + regR);
          return true;
        case "OR":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(0xC0 + regR);
          return true;
        case "INC":
          this.rangeCheck(0, regR, 14);
          this.assembler.write1(0xD0 + regR);
          return true;
        case "DEC":
          this.rangeCheck(0, regR, 14);
          this.assembler.write1(0xE0 + regR);
          return true;

        // ALT1 variants (0x3D prefix)
        case "ADC":
          // 0x3D, then 0x50 + reg
          this.assembler.write1(0x3D);
          this.assembler.write1(0x50 + regR);
          return true;
        case "SBC":
          this.assembler.write1(0x3D);
          this.assembler.write1(0x60 + regR);
          return true;
        case "BIC":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(0x3D);
          this.assembler.write1(0x70 + regR);
          return true;
        case "UMULT":
          this.assembler.write1(0x3D);
          this.assembler.write1(0x80 + regR);
          return true;
        case "LJMP":
          this.rangeCheck(8, regR, 13);
          this.assembler.write1(0x3D);
          this.assembler.write1(0x90 + regR);
          return true;
        case "XOR":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(0x3D);
          this.assembler.write1(0xC0 + regR);
          return true;

        case "CMP":
          // prefix 0x3F, then 0x60 + reg
          this.assembler.write1(0x3F);
          this.assembler.write1(0x60 + regR);
          return true;
      }
    }

    if (regHash !== null) {
      // e.g. LINK #n
      if (opcode === "LINK") {
        // range(1, reg, 4)
        this.rangeCheck(1, regHash, 4);
        this.assembler.write1(0x90 + regHash);
        return true;
      }

      // ALT2 prefix (0x3E) logic, e.g. ADD #n => 0x3E  0x50 + n
      switch (opcode) {
        case "ADD":
          this.assembler.write1(0x3E);
          this.assembler.write1(0x50 + regHash);
          return true;
        case "SUB":
          this.assembler.write1(0x3E);
          this.assembler.write1(0x60 + regHash);
          return true;
        case "AND":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(0x3E);
          this.assembler.write1(0x70 + regHash);
          return true;
        case "MULT":
          this.assembler.write1(0x3E);
          this.assembler.write1(0x80 + regHash);
          return true;
        case "OR":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(0x3E);
          this.assembler.write1(0xC0 + regHash);
          return true;

        // ALT3 prefix
        case "ADC":
          this.assembler.write1(0x3F);
          this.assembler.write1(0x50 + regHash);
          return true;
        case "BIC":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(0x3F);
          this.assembler.write1(0x70 + regHash);
          return true;
        case "UMULT":
          this.assembler.write1(0x3F);
          this.assembler.write1(0x80 + regHash);
          return true;
        case "XOR":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(0x3F);
          this.assembler.write1(0xC0 + regHash);
          return true;
      }
    }

    if (regParr !== null) {
      // e.g. STW (Rn), LDW (Rn)
      switch (opcode) {
        case "STW":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(0x30 + regParr);
          return true;
        case "LDW":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(0x40 + regParr);
          return true;
        case "STB":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(0x3D);
          this.assembler.write1(0x30 + regParr);
          return true;
        case "LDB":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(0x3D);
          this.assembler.write1(0x40 + regParr);
          return true;
      }
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

    // e.g. "MOVE Rn, Rm", "MOVES Rn, Rm", etc.
    const reg1r = this.resolveRegister(leftOp, leftLowered, "r");
    const reg1parr = this.resolveRegister(leftOp, leftLowered, "parr");
    const reg2r = this.resolveRegister(rightOp, rightLowered, "r");
    const reg2parr = this.resolveRegister(rightOp, rightLowered, "parr");
    debug("handleTwoOperandOpcode", { reg1r, reg1parr, reg2r, reg2parr });

    // Rn, Rm combos
    if (reg1r !== null && reg2r !== null) {
      switch (opcode) {
        case "MOVE":
          // write1(0x20+reg2); write1(0x10+reg1)
          this.assembler.write1(0x20 + reg2r);
          this.assembler.write1(0x10 + reg1r);
          return true;
        case "MOVES":
          // write1(0x20+reg1); write1(0xB0+reg2)
          this.assembler.write1(0x20 + reg1r);
          this.assembler.write1(0xB0 + reg2r);
          return true;
      }
    }

    // Rn, #imm combos
    if (reg1r !== null && (rightLowered?.immediate ?? rightOp.startsWith("#"))) {
      const immediateExpression = rightLowered?.baseExpression ?? rightOp.slice(1);
      const immVal = this.assembler.operandResolver.getnum(immediateExpression) & 0xffff;
      switch (opcode) {
        case "IBT":
          // => 0xA0+reg1, then immVal
          this.assembler.write1(0xA0 + reg1r);
          this.assembler.write1(immVal & 0xff);
          return true;
        case "IWT":
          // => 0xF0+reg1, then immVal (lo, hi)
          this.assembler.write1(0xF0 + reg1r);
          this.assembler.write1(immVal & 0xff);
          this.assembler.write1((immVal >> 8) & 0xff);
          return true;
        case "MOVE":
          // If immediate < 0x80 or >= 0xFF80 => 8-bit
          if (immVal < 0x80 || immVal >= 0xff80) {
            // prefix 0xA0+reg1
            this.assembler.write1(0xA0 + reg1r);
            this.assembler.write1(immVal & 0xff);
          } else {
            // prefix 0xF0+reg1, 16-bit
            this.assembler.write1(0xF0 + reg1r);
            this.assembler.write1(immVal & 0xff);
            this.assembler.write1((immVal >> 8) & 0xff);
          }
          return true;
      }
    }

    // (Rn), Rm combos
    if (reg1parr !== null && reg2r !== null) {
      switch (opcode) {
        case "MOVEB":
          // ...
          if (reg1parr === 0) {
            // e.g. MOVEB (r0), rX => 0x3D  0x30 + reg2?
            this.assembler.write1(0x3D);
            this.assembler.write1(0x30 + reg2r);
            return true;
          } else {
            // MOVEB (rN), rM => 0xB0+ reg1 then 0x3D  then 0x30+ reg2
            // Simplified version of code
            this.assembler.write1(0xB0 + reg1parr);
            this.assembler.write1(0x3D);
            this.assembler.write1(0x30 + reg2r);
            return true;
          }
        case "MOVEW":
          // ...
          if (reg1parr === 0) {
            this.assembler.write1(0x30 + reg2r);
          } else {
            this.assembler.write1(0xB0 + reg1parr);
            this.assembler.write1(0x30 + reg2r);
          }
          return true;
      }
    }

    // Rn, (Rm) combos
    if (reg1r !== null && reg2parr !== null) {
      switch (opcode) {
        case "MOVEB":
          if (reg2parr === 0) {
            this.assembler.write1(0x3D);
            this.assembler.write1(0x40 + reg1r);
            return true;
          } else {
            this.assembler.write1(0x10 + reg1r);
            this.assembler.write1(0x3D);
            this.assembler.write1(0x40 + reg2parr);
            return true;
          }
        case "MOVEW":
          if (reg2parr === 0) {
            this.assembler.write1(0x40 + reg1r);
            return true;
          } else {
            this.assembler.write1(0x10 + reg1r);
            this.assembler.write1(0x40 + reg2parr);
            return true;
          }
      }
    }

    // Rn, (imm)
    // e.g. "MOVE R0, (0x1234)" or "SMS (0x40), R3"
    if (reg1r !== null) {
      const addrVal = this.assembler.operandResolver.getnum(rightOp);
      switch (opcode) {
        case "LM":
          // => 0x3D, 0xF0 + reg1, then lo, hi
          this.assembler.write1(0x3D);
          this.assembler.write1(0xF0 + reg1r);
          this.assembler.write2(addrVal);
          return true;
        case "LMS":
          // short addressing check
          if (this.checkShortAddr(addrVal)) {
            this.assembler.write1(0x3D);
            this.assembler.write1(0xA0 + reg1r);
            this.assembler.write1(addrVal >> 1);
            return true;
          }
          return true; // might not do anything else if fail
        case "MOVE":
          if (addrVal & 1 || addrVal >= 0x200) {
            // 0x3D, 0xF0+reg, lo, hi
            this.assembler.write1(0x3D);
            this.assembler.write1(0xF0 + reg1r);
            this.assembler.write2(addrVal);
          } else {
            // 0x3D, 0xA0+reg, lo
            this.assembler.write1(0x3D);
            this.assembler.write1(0xA0 + reg1r);
            this.assembler.write1(addrVal & 0xff);
          }
          return true;
        case "LEA":
          // => 0xF0+ reg, lo, hi
          this.assembler.write1(0xF0 + reg1r);
          this.assembler.write1(addrVal & 0xff);
          this.assembler.write1((addrVal >> 8) & 0xff);
          return true;
      }
    }

    // (imm), Rn
    const leftIsRegisterIndirect = leftLowered?.mode === "registerIndirect";
    if (reg2r !== null && !leftIsRegisterIndirect && (leftLowered?.indirect ?? (leftOp.startsWith("(") && leftOp.endsWith(")")))) {
      const addressExpression = leftLowered?.baseExpression ?? leftOp;
      const addrVal = this.assembler.operandResolver.getnum(addressExpression);
        switch (opcode) {
          case "SM":
            this.assembler.write1(0x3E);
            this.assembler.write1(0xF0 + reg2r);
            this.assembler.write2(addrVal);
            return true;
          case "SMS":
            if (this.checkShortAddr(addrVal)) {
              this.assembler.write1(0x3E);
              this.assembler.write1(0xA0 + reg2r);
              this.assembler.write1(addrVal >> 1);
              return true;
            }
            return true;
          case "MOVE":
            if (addrVal & 1 || addrVal >= 0x200) {
              this.assembler.write1(0x3E);
              this.assembler.write1(0xF0 + reg2r);
              this.assembler.write2(addrVal);
            } else {
              this.assembler.write1(0x3E);
              this.assembler.write1(0xA0 + reg2r);
              this.assembler.write1(addrVal & 0xff);
            }
            return true;
      }
    }

    return false;
  }

  resolveRegister(str: string, lowered: LoweredOperand | undefined, type: "r" | "parr" | "hash"): number | null {
    if (lowered) {
      if (type === "r" && lowered.mode === "register" && lowered.registerName?.toLowerCase().startsWith("r")) {
        const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
        return regnum === -1 ? null : regnum;
      }
      if (type === "parr" && lowered.mode === "registerIndirect" && lowered.registerName?.toLowerCase().startsWith("r")) {
        const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
        return regnum === -1 ? null : regnum;
      }
      if (type === "hash" && lowered.immediate) {
        const regnum = this.assembler.operandResolver.getnum(lowered.baseExpression ?? lowered.expanded.slice(1));
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
    // reg_parr => (rN)
    // reg_r => rN
    // reg_hash => #N
    // Return null if parse fails
    if (type === "parr") {
      // Must start with '('
      if (!str.startsWith("(")) {
        return null;
      }
      str = str.slice(1); // skip '('
      if (!/^r\d{1,2}\)/i.test(str)) {
        return null;
      }
      // skip 'r'
      if (str[0].toLowerCase() !== "r") {
        return null;
      }
      str = str.slice(1);

      // parse digit
      const regnum = this.parseRegisterNumber(str.replace(/\)$/, "")); // remove trailing ')'
      if (regnum === -1) {
        return null;
      }
      return regnum;
    }

    if (type === "r") {
      // Must start with 'r'
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
      // Accept normalized forms like #$0 in addition to #0.
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
    // e.g. '10' => r10
    // valid registers are 0..15, but we also need to check for weird digits
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
   * For "LMS" or "SMS" short addressing forms, we need to ensure the address is
   * even and in range [0x000..0x1FE].
   * @param {number} num - the address
   * @returns {boolean} True if the address is valid, false otherwise.
   */
  checkShortAddr(num: number): boolean {
    debug("checkShortAddr", num);
    if (num % 2 !== 0 || num < 0 || num > 0x1FE) {
      throw this.assembler.diagnostics.error(
        `Invalid short address ${num}. Must be even and in range 0..0x1FE`
      );
    }
    return true;
  }

  /**
   * Returns an approximate operand length (1 or 2) by checking the operand format.
   * This is a simple approximation for short vs. relative addressing.
   * @param {string} operand the operand
   * @returns {number} The operand length.
   */
  getOperandLength(operand: string): number {
    // This is a simplified logic: if it looks hex with 2 digits, assume 1; else 2
    // If there's a label, or more digits, we guess 2.
    // You can refine as needed.
    const simpleHex2 = /^\$[\dA-Fa-f]{2}$/;
    if (simpleHex2.test(operand)) {
      return 1;
    }
    return 2;
  }
}
