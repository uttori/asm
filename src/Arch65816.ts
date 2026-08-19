import {
  createEncoderRuntime,
  type ArchitectureEncoder,
  type ArchitectureEncoderContext,
  type EncoderRuntime,
  type InstructionDescriptor,
  type LoweredInstruction,
} from "./architecture-types.js";
import { cpu65816Catalog } from "./lsp/instruction-catalog.js";

let debug = (..._args: unknown[]): void => {};
/* c8 ignore next */
try {
  const { default: d } = await import("debug");
  debug = d("Arch65816");
} catch {}

export class Arch65816 implements ArchitectureEncoder {
  assembler: EncoderRuntime;

  constructor(context: ArchitectureEncoderContext) {
    this.assembler = createEncoderRuntime(context);
  }

  /**
   * Returns the static 65816 instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog(): InstructionDescriptor[] {
    return cpu65816Catalog;
  }

  /**
   * Estimates instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {number} The result.
   */
  estimateInstruction(instruction: LoweredInstruction): number {
    return this.estimateResolvedInstruction(
      instruction.mnemonic,
      instruction.operandText,
      instruction.loweredOperand.expanded,
      instruction.loweredOperand.length,
    );
  }

  /**
   * Encodes instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} The result.
   */
  encodeInstruction(instruction: LoweredInstruction): boolean {
    return this.encodeResolvedInstruction(
      instruction.mnemonic,
      instruction.operandText,
      instruction.loweredOperand.expanded,
      instruction.loweredOperand.length,
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
    const mnemonic = words[0] ?? "";
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    return this.estimateResolvedInstruction(
      mnemonic,
      rawOperand,
      loweredOperand.expanded,
      loweredOperand.length,
    );
  }

  /**
   * Estimates resolved instruction.
   * @param {string} mnemonic The mnemonic.
   * @param {string} rawOperand The raw operand.
   * @param {string} operand The operand.
   * @param {number} operandLength The operand length.
   * @returns {number} The result.
   */
  estimateResolvedInstruction(
    mnemonic: string,
    rawOperand: string,
    operand: string,
    operandLength: number,
  ): number {
    let opcode = mnemonic.toUpperCase();
    const noOperandOpcodes = new Set([
      "CLC",
      "CLD",
      "CLI",
      "CLV",
      "DEX",
      "DEY",
      "INX",
      "INY",
      "NOP",
      "PHA",
      "PHB",
      "PHD",
      "PHK",
      "PHP",
      "PHX",
      "PHY",
      "PLA",
      "PLB",
      "PLD",
      "PLP",
      "PLX",
      "PLY",
      "RTI",
      "RTL",
      "RTS",
      "SEC",
      "SED",
      "SEI",
      "STP",
      "TAX",
      "TAY",
      "TCD",
      "TCS",
      "TDC",
      "TSC",
      "TSX",
      "TXA",
      "TXS",
      "TXY",
      "TYA",
      "TYX",
      "WAI",
      "XBA",
      "XCE",
    ]);
    const accumulatorRepeatOpcodes = new Set(["ASL", "LSR", "ROL", "ROR", "INC", "DEC"]);
    const branchOpcodes = new Set([
      "BPL",
      "BMI",
      "BVC",
      "BVS",
      "BCC",
      "BCS",
      "BNE",
      "BEQ",
      "BRA",
      "BRL",
    ]);

    if (noOperandOpcodes.has(opcode)) {
      if (rawOperand.startsWith("#")) {
        try {
          return Math.max(1, this.assembler.operandResolver.getnum(rawOperand));
        } catch {
          return 1;
        }
      }
      return 1;
    }

    if (opcode.includes(".")) {
      const len = this.getlenfromchar(opcode[opcode.indexOf(".") + 1]);
      opcode = opcode.substring(0, opcode.indexOf("."));
      return 1 + len;
    }

    if (accumulatorRepeatOpcodes.has(opcode) && !rawOperand.trim()) {
      return 1;
    }

    if (accumulatorRepeatOpcodes.has(opcode) && rawOperand.startsWith("#")) {
      return this.assembler.operandResolver.getnum(rawOperand.substring(1));
    }

    if (branchOpcodes.has(opcode)) {
      return opcode === "BRL" ? 3 : 2;
    }

    if (opcode === "MVP" || opcode === "MVN") {
      return 3;
    }
    if (opcode === "PER") {
      return 3;
    }
    if (opcode === "JSL" || opcode === "JML") {
      return 4;
    }
    if (opcode === "JMP" || opcode === "JSR") {
      return 3;
    }
    if (opcode === "PEA") {
      return 3;
    }
    if (["BRK", "COP", "PEI", "REP", "SEP", "WDM"].includes(opcode)) {
      return 2;
    }

    if (operand.startsWith("#")) {
      return 1 + operandLength;
    }
    if (/^\$[\da-f]{6}(,x)?$/i.test(operand)) {
      return 4;
    }
    return 1 + operandLength;
  }

  /**
   * Processes a 65816 assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  encode(words: string[]): boolean {
    debug("asblock_65816", words);
    if (words.length === 0) {
      return false;
    }
    const mnemonic = words[0] ?? "";
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    return this.encodeResolvedInstruction(
      mnemonic,
      rawOperand,
      loweredOperand.expanded,
      loweredOperand.length,
    );
  }

  /** Legacy API alias for {@link encode}. */
  readonly asblock_65816 = this.encode.bind(this);

  /**
   * Encodes resolved instruction.
   * @param {string} mnemonic The mnemonic.
   * @param {string} rawOperand The raw operand.
   * @param {string} operand The operand.
   * @param {number} operandLength The operand length.
   * @returns {boolean} The result.
   */
  encodeResolvedInstruction(
    mnemonic: string,
    rawOperand: string,
    operand: string,
    operandLength: number,
  ): boolean {
    let opcode = mnemonic.toUpperCase();
    debug("asblock_65816 operand expanded", operand, "expected length:", operandLength);

    // Handle special cases where length is on the opcode
    let len = 0;
    let explicitlen = false;
    // For opcodes with explicit length (e.g., LDA.B), use the specified length.
    if (opcode.includes(".")) {
      len = this.getlenfromchar(opcode[opcode.indexOf(".") + 1]);
      explicitlen = true;
      opcode = opcode.substring(0, opcode.indexOf("."));
    } else {
      // Otherwise, use the length determined from expandOperand
      len = operandLength;
    }

    debug("asblock_65816 opcode", opcode);
    debug("asblock_65816 operand", operand);

    if (["ASL", "LSR", "ROL", "ROR", "INC", "DEC"].includes(opcode)) {
      return this.handleArithmeticOperations(opcode, operand, len, explicitlen);
    }

    if (["SBC", "STA", "LDA", "ADC"].includes(opcode)) {
      return this.handleMemoryOperations(opcode, operand, len, explicitlen, rawOperand);
    }

    if (["AND", "EOR", "ORA", "CMP", "CPX", "CPY"].includes(opcode)) {
      return this.handleLogicAndCompareOperations(opcode, operand, len, explicitlen);
    }

    // Single Byte Operations
    if (this.handleNoOperandOperations(opcode, operand)) {
      return true;
    }

    if (opcode === "LDX" || opcode === "LDY") {
      return this.handleLoadRegister(opcode, operand, len, explicitlen);
    }

    if (["JSL", "JSR", "JMP", "JML"].includes(opcode)) {
      return this.handleJump(opcode, operand, rawOperand);
    }

    if (["BIT", "TSB", "TRB"].includes(opcode)) {
      return this.handleBitTestOperations(opcode, operand, len, explicitlen);
    }

    if (opcode === "MVP" || opcode === "MVN") {
      return this.handleBlockMove(opcode, operand);
    }

    if (opcode === "PER") {
      return this.handlePER(operand);
    }

    if (["STX", "STY", "STZ"].includes(opcode)) {
      return this.handleStoreOperations(opcode, operand, len, explicitlen);
    }

    // Handle Branch Instructions
    if (this.handleBranchInstructions(opcode, operand)) return true;

    // Handle special cases where length is on the opcode
    let hexconstant = false;
    let num = 0;
    if (operand) {
      num = this.assembler.operandResolver.getnum(operand);
      hexconstant = /^[$%]/.test(operand);
    }

    // Handle generic opcode mappings
    return this.handleGenericOpcode(opcode, num, len, explicitlen, hexconstant);
  }

  /**
   * Handles ORA, SBC, STA, LDA, EOR, CMP, AND, ADC with all valid addressing modes.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @param {string} rawOperand The raw source operand before expansion.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleMemoryOperations(
    opcode: string,
    operand: string,
    len: number,
    explicitlen: boolean,
    rawOperand = operand,
  ): boolean {
    debug("handleMemoryOperations", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const resolvedOperand = loweredOperand.expanded;
    const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
    const isExplicitDirectPage = loweredOperand.explicitDirectPage ?? false;
    const isExplicitDirectPageIndexedX = loweredOperand.explicitDirectPageIndexedX ?? false;

    // Immediate Mode (#$XX)
    if (loweredOperand.immediate) {
      debug("handleMemoryOperations Immediate Mode (#$XX)", opcode, resolvedOperand);
      const immediateOpcodes: { [key: string]: number } = {
        ADC: 0x69,
        LDA: 0xa9,
        SBC: 0xe9, // STA does not support immediate mode
      };
      if (opcode in immediateOpcodes) {
        this.assembler.write1(immediateOpcodes[opcode]);
        // Force operand length based on explicit setting:
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(resolvedOperand));
        } else {
          // Default immediate mode uses 2 bytes (even if operand value is small)
          this.assembler.write2(this.assembler.operandResolver.getnum(resolvedOperand));
        }
        return true;
      }
      throw new Error(`Error: ${opcode} does not support immediate mode.`);
    }

    // If an explicit length is specified, override the normal guess.
    if (explicitlen) {
      if (loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
        const forcedIndexed: { [key: string]: { [L: number]: number } } = {
          ADC: { 1: 0x75, 2: 0x7d, 3: 0x7f },
          STA: { 1: 0x95, 2: 0x9d, 3: 0x9f },
          LDA: { 1: 0xb5, 2: 0xbd, 3: 0xbf },
          SBC: { 1: 0xf5, 2: 0xfd, 3: 0xff },
        };
        if (!(opcode in forcedIndexed)) {
          throw new Error(`Error: Opcode ${opcode} not supported in forced indexed mode.`);
        }
        this.assembler.write1(forcedIndexed[opcode][len]);
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        } else if (len === 2) {
          this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        } else if (len === 3) {
          this.assembler.write3(this.assembler.operandResolver.getnum(baseOperand));
        }
        return true;
      } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect) {
        const forcedIndexedY: { [key: string]: { [L: number]: number } } = {
          ADC: { 2: 0x79 },
          STA: { 2: 0x99 },
          LDA: { 2: 0xb9 },
          SBC: { 2: 0xf9 },
        };
        if (!(opcode in forcedIndexedY) || !(len in forcedIndexedY[opcode])) {
          throw new Error(`Error: Opcode ${opcode} not supported in forced indexed-Y mode.`);
        }
        this.assembler.write1(forcedIndexedY[opcode][len]);
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      } else {
        // Non-indexed forced addressing:
        const forcedNonIndexed: { [key: string]: { [L: number]: number } } = {
          ADC: { 1: 0x65, 2: 0x6d, 3: 0x6f },
          STA: { 1: 0x85, 2: 0x8d, 3: 0x8f },
          LDA: { 1: 0xa5, 2: 0xad, 3: 0xaf },
          SBC: { 1: 0xe5, 2: 0xed, 3: 0xef },
        };
        if (!(opcode in forcedNonIndexed)) {
          throw new Error(`Error: Opcode ${opcode} not supported in forced non-indexed mode.`);
        }
        this.assembler.write1(forcedNonIndexed[opcode][len]);
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(operand));
        } else if (len === 2) {
          this.assembler.write2(this.assembler.operandResolver.getnum(operand));
        } else if (len === 3) {
          this.assembler.write3(this.assembler.operandResolver.getnum(operand));
        }
        return true;
      }
    }

    // Absolute Indexed, X Mode (Opcode $1D, $3D, $5D, etc.)
    if (loweredOperand.mode === "absoluteIndexedX") {
      debug("handleMemoryOperations Absolute Indexed,X", opcode, resolvedOperand);
      const absoluteIndexedXOpcodes: { [key: string]: number } = {
        ADC: 0x7d,
        STA: 0x9d,
        LDA: 0xbd,
        SBC: 0xfd,
      };
      if (opcode in absoluteIndexedXOpcodes) {
        debug("handleMemoryOperations =", absoluteIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(absoluteIndexedXOpcodes[opcode]);
        debug(
          "handleMemoryOperations =",
          this.assembler.operandResolver.getnum(baseOperand).toString(16),
        );
        // Extract absolute address
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Absolute Long Indexed, X Mode
    if (loweredOperand.mode === "absoluteLongIndexedX") {
      debug("handleMemoryOperations Absolute Long Indexed,X", opcode, resolvedOperand);
      const absoluteLongIndexedXOpcodes: { [key: string]: number } = {
        ADC: 0x7f,
        STA: 0x9f,
        LDA: 0xbf,
        SBC: 0xff,
      };
      if (opcode in absoluteLongIndexedXOpcodes) {
        this.assembler.write1(absoluteLongIndexedXOpcodes[opcode]);
        this.assembler.write3(this.assembler.operandResolver.getnum(baseOperand)); // Extract absolute long address
        return true;
      }
    }

    // Indexed Indirect (X)
    if (loweredOperand.mode === "indexedIndirectX") {
      debug("handleMemoryOperations Indexed Indirect (X)", opcode, resolvedOperand);
      const indexedIndirectOpcodes: { [key: string]: number } = {
        ADC: 0x61,
        STA: 0x81,
        LDA: 0xa1,
        SBC: 0xe1,
      };
      if (opcode in indexedIndirectOpcodes) {
        this.assembler.write1(indexedIndirectOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Direct Page Indirect
    if (loweredOperand.mode === "directPageIndirect") {
      debug("handleMemoryOperations Direct Page Indirect", opcode, resolvedOperand);
      const indirectDPIndirect: { [key: string]: number } = {
        ADC: 0x72,
        STA: 0x92,
        LDA: 0xb2,
        SBC: 0xf2,
      };
      if (opcode in indirectDPIndirect) {
        this.assembler.write1(indirectDPIndirect[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // DP Indexed, X
    if (
      (this.assembler.optimizeDirectPage || isExplicitDirectPageIndexedX) &&
      loweredOperand.indexRegister === "x" &&
      !loweredOperand.indirect
    ) {
      debug("handleMemoryOperations DP Indexed,X", opcode, resolvedOperand);

      const dpIndexedXOpcodes: { [key: string]: number } = {
        ADC: 0x75,
        STA: 0x95,
        LDA: 0xb5,
        SBC: 0xf5,
      };

      if (opcode in dpIndexedXOpcodes) {
        debug("handleMemoryOperations = 1", dpIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(dpIndexedXOpcodes[opcode]);
        debug("handleMemoryOperations = 1.5", baseOperand);
        const dpAddress = this.assembler.operandResolver.getnum(baseOperand);
        debug("handleMemoryOperations = 2", dpAddress.toString(16));
        this.assembler.write1(dpAddress); // Extract DP address
        return true;
      }
    }

    // Indexed Indirect (sr,S)
    if (loweredOperand.mode === "stackRelative") {
      debug("handleMemoryOperations Indexed Indirect (sr,S)", opcode, resolvedOperand);
      const stackRelativeOpcodes: { [key: string]: number } = {
        ADC: 0x63,
        STA: 0x83,
        LDA: 0xa3,
        SBC: 0xe3,
      };
      if (opcode in stackRelativeOpcodes) {
        this.assembler.write1(stackRelativeOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Stack Relative Indexed Indirect (sr,S),Y
    if (loweredOperand.mode === "stackRelativeIndexedIndirectY") {
      debug(
        "handleMemoryOperations Stack Relative Indexed Indirect (sr,S),Y",
        opcode,
        resolvedOperand,
      );
      const stackIndexedOpcodes: { [key: string]: number } = {
        ADC: 0x73,
        STA: 0x93,
        LDA: 0xb3,
        SBC: 0xf3,
      };
      if (opcode in stackIndexedOpcodes) {
        this.assembler.write1(stackIndexedOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Indirect Long (`[$00]`)
    if (loweredOperand.mode === "indirectLong") {
      const indirectLongOpcodes: { [key: string]: number } = {
        ADC: 0x67,
        STA: 0x87,
        LDA: 0xa7,
        SBC: 0xe7,
      };
      if (opcode in indirectLongOpcodes) {
        this.assembler.write1(indirectLongOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand)); // Remove `[$00]`
        return true;
      }
    }

    // Indirect Long Indexed (`[$00],Y`)
    if (loweredOperand.mode === "indirectLongIndexedY") {
      const indirectLongIndexedOpcodes: { [key: string]: number } = {
        ADC: 0x77,
        STA: 0x97,
        LDA: 0xb7,
        SBC: 0xf7,
      };
      if (opcode in indirectLongIndexedOpcodes) {
        this.assembler.write1(indirectLongIndexedOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand)); // Remove `[$00],Y`
        return true;
      }
    }

    // Indirect Indexed (Y)
    if (loweredOperand.mode === "indirectIndexedY") {
      debug("handleMemoryOperations Indirect Indexed (Y)", opcode, resolvedOperand);
      const indirectIndexedOpcodes: { [key: string]: number } = {
        ADC: 0x71,
        STA: 0x91,
        LDA: 0xb1,
        SBC: 0xf1,
      };
      if (opcode in indirectIndexedOpcodes) {
        this.assembler.write1(indirectIndexedOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Absolute Indexed (X)
    if (loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
      debug("handleMemoryOperations Absolute Indexed (X)", opcode, resolvedOperand);
      const absoluteXOpcodes: { [key: string]: number } = {
        ADC: 0x7d,
        STA: 0x9d,
        LDA: 0xbd,
        SBC: 0xfd,
      };
      if (opcode in absoluteXOpcodes) {
        this.assembler.write1(absoluteXOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Absolute Indexed (Y)
    if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect) {
      debug("handleMemoryOperations Absolute Indexed (Y)", opcode, resolvedOperand);
      const absoluteYOpcodes: { [key: string]: number } = {
        ADC: 0x79,
        STA: 0x99,
        LDA: 0xb9,
        SBC: 0xf9,
      };
      if (opcode in absoluteYOpcodes) {
        this.assembler.write1(absoluteYOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }

    // Absolute Long ($000000)
    if (loweredOperand.mode === "absoluteLong") {
      debug("handleMemoryOperations Absolute Long ($000000)", opcode, resolvedOperand);
      const longOpcodes: { [key: string]: number } = {
        ADC: 0x6f,
        STA: 0x8f,
        LDA: 0xaf,
        SBC: 0xef,
      };

      if (opcode in longOpcodes) {
        this.assembler.write1(longOpcodes[opcode]);
        this.assembler.write3(this.assembler.operandResolver.getnum(resolvedOperand));
        return true;
      }
    }

    // Absolute
    if (loweredOperand.mode === "absolute") {
      debug("handleMemoryOperations Absolute", opcode, resolvedOperand);
      const absoluteOpcodes: { [key: string]: number } = {
        ADC: 0x6d,
        STA: 0x8d,
        LDA: 0xad,
        SBC: 0xed,
      };
      if (opcode in absoluteOpcodes) {
        this.assembler.write1(absoluteOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(resolvedOperand));
        return true;
      }
    }

    // Direct page shortening can be disabled by "optimize dp none".
    if (this.assembler.optimizeDirectPage || isExplicitDirectPage) {
      debug("handleMemoryOperations Direct Page", opcode, operand);
      const directPageOpcodes: { [key: string]: number } = {
        ADC: 0x65,
        STA: 0x85,
        LDA: 0xa5,
        SBC: 0xe5,
      };
      if (opcode in directPageOpcodes) {
        this.assembler.write1(directPageOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(operand));
        return true;
      }
    } else {
      debug(
        "handleMemoryOperations Direct Page optimization disabled; using absolute",
        opcode,
        operand,
      );
      const absoluteOpcodes: { [key: string]: number } = {
        ADC: 0x6d,
        STA: 0x8d,
        LDA: 0xad,
        SBC: 0xed,
      };
      if (opcode in absoluteOpcodes) {
        this.assembler.write1(absoluteOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(operand));
        return true;
      }
    }

    return false;
  }

  /**
   * Handles AND, EOR, ORA, CMP, CPX, and CPY instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleLogicAndCompareOperations(
    opcode: string,
    operand: string,
    len: number,
    explicitlen: boolean,
  ): boolean {
    debug("handleLogicAndCompareOperations", { opcode, operand, len, explicitlen });
    type LogicOpcode = "ORA" | "AND" | "EOR" | "CMP" | "CPX" | "CPY";
    type LogicMode =
      | "immediate"
      | "direct"
      | "directX"
      | "absolute"
      | "absoluteX"
      | "absoluteY"
      | "indirectX"
      | "indirectY"
      | "indirect"
      | "indirectLong"
      | "indirectLongY"
      | "stackRelative"
      | "stackRelativeIndirectY"
      | "absoluteLong"
      | "absoluteLongX"
      | "directIndirectLong"
      | "directIndirectLongY";
    type LogicModeMap = {
      immediate: number;
      direct: number;
      directX?: number;
      absolute: number;
      absoluteX?: number;
      absoluteY?: number;
      indirectX?: number;
      indirectY?: number;
      indirect?: number;
      indirectLong?: number;
      indirectLongY?: number;
      stackRelative?: number;
      stackRelativeIndirectY?: number;
      absoluteLong?: number;
      absoluteLongX?: number;
      directIndirectLong?: number;
      directIndirectLongY?: number;
    };

    const opcodes: Record<LogicOpcode, LogicModeMap> = {
      ORA: {
        immediate: 0x09,
        direct: 0x05,
        directX: 0x15,
        absolute: 0x0d,
        absoluteX: 0x1d,
        absoluteY: 0x19,
        indirectX: 0x01,
        indirectY: 0x11,
        indirect: 0x12,
        indirectLong: 0x0f,
        indirectLongY: 0x1f,
        stackRelative: 0x03,
        stackRelativeIndirectY: 0x13,
        absoluteLong: 0x0f,
        absoluteLongX: 0x1f,
        directIndirectLong: 0x07,
        directIndirectLongY: 0x17,
      },
      AND: {
        immediate: 0x29,
        direct: 0x25,
        directX: 0x35,
        absolute: 0x2d,
        absoluteX: 0x3d,
        absoluteY: 0x39,
        indirectX: 0x21,
        indirectY: 0x31,
        indirect: 0x32,
        indirectLong: 0x2f,
        indirectLongY: 0x3f,
        stackRelative: 0x23,
        stackRelativeIndirectY: 0x33,
        absoluteLong: 0x2f,
        absoluteLongX: 0x3f,
        directIndirectLong: 0x27,
        directIndirectLongY: 0x37,
      },
      EOR: {
        immediate: 0x49,
        direct: 0x45,
        directX: 0x55,
        absolute: 0x4d,
        absoluteX: 0x5d,
        absoluteY: 0x59,
        indirectX: 0x41,
        indirectY: 0x51,
        indirect: 0x52,
        indirectLong: 0x4f,
        indirectLongY: 0x5f,
        stackRelative: 0x43,
        stackRelativeIndirectY: 0x53,
        absoluteLong: 0x4f,
        absoluteLongX: 0x5f,
        directIndirectLong: 0x47,
        directIndirectLongY: 0x57,
      },
      CMP: {
        immediate: 0xc9,
        direct: 0xc5,
        directX: 0xd5,
        absolute: 0xcd,
        absoluteX: 0xdd,
        absoluteY: 0xd9,
        indirectX: 0xc1,
        indirectY: 0xd1,
        indirect: 0xd2,
        indirectLong: 0xcf,
        indirectLongY: 0xdf,
        stackRelative: 0xc3,
        stackRelativeIndirectY: 0xd3,
        absoluteLong: 0xcf,
        absoluteLongX: 0xdf,
        directIndirectLong: 0xc7,
        directIndirectLongY: 0xd7,
      },
      CPX: { immediate: 0xe0, direct: 0xe4, absolute: 0xec },
      CPY: { immediate: 0xc0, direct: 0xc4, absolute: 0xcc },
    };
    const dpMap: Record<LogicOpcode, number> = {
      AND: 0x25,
      ORA: 0x05,
      EOR: 0x45,
      CMP: 0xc5,
      CPX: 0xe4,
      CPY: 0xc4,
    };
    const absMap: Record<LogicOpcode, number> = {
      AND: 0x2d,
      ORA: 0x0d,
      EOR: 0x4d,
      CMP: 0xcd,
      CPX: 0xec,
      CPY: 0xcc,
    };
    // For "long" (i.e. 3-byte) addressing we assume a variant that is 2 higher than the absolute opcode:
    const absLongMap: Partial<Record<LogicOpcode, number>> = {
      AND: 0x2f,
      ORA: 0x0f,
      EOR: 0x4f,
      CMP: 0xcf,
    };
    const dpXMap: Partial<Record<LogicOpcode, number>> = {
      AND: 0x35,
      ORA: 0x15,
      EOR: 0x55,
      CMP: 0xd5,
    };
    const absXMap: Partial<Record<LogicOpcode, number>> = {
      AND: 0x3d,
      ORA: 0x1d,
      EOR: 0x5d,
      CMP: 0xdd,
    };
    const absYMap: Partial<Record<LogicOpcode, number>> = {
      AND: 0x39,
      ORA: 0x19,
      EOR: 0x59,
      CMP: 0xd9,
    };
    if (!(opcode in opcodes)) {
      return false; // Not a logic or compare instruction
    }
    const logicOpcode = opcode as LogicOpcode;
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const resolvedOperand = loweredOperand.expanded;
    const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;

    let address = 0;
    let mode: LogicMode; // Determines which mode we're using

    // **Immediate Mode (e.g., ORA #$00, CMP #$00)**
    if (loweredOperand.immediate) {
      debug("handleLogicAndCompareOperations Immediate Mode", opcode, resolvedOperand);
      mode = "immediate";
      // Remove `#`
      address = this.assembler.operandResolver.getnum(baseOperand);
      this.assembler.write1(opcodes[logicOpcode].immediate);
      if (len === 1) {
        this.assembler.write1(address);
      } else {
        // default immediate mode uses 2 bytes
        this.assembler.write2(address);
      }
      return true;
    }

    // If an explicit length was given, use it to choose the number of operand bytes.
    if (explicitlen) {
      // Forced-size operands still need indexed base extraction so `.w foo,Y`
      // resolves `foo` numerically instead of handing `foo,Y` to the math parser.
      let forcedIndexedMode: "x" | "y" | undefined;
      if (!loweredOperand.indirect) {
        if (loweredOperand.indexRegister === "x") {
          forcedIndexedMode = "x";
        } else if (loweredOperand.mode === "absoluteIndexedY") {
          forcedIndexedMode = "y";
        }
      }
      const explicitOperand = forcedIndexedMode ? baseOperand : resolvedOperand;
      if (forcedIndexedMode === "x") {
        // For indexed X addressing:
        if (len === 1) {
          const forcedOpcode = dpXMap[logicOpcode];
          if (forcedOpcode === undefined) {
            throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
          }
          this.assembler.write1(forcedOpcode);
          this.assembler.write1(this.assembler.operandResolver.getnum(explicitOperand));
        } else if (len === 2) {
          const forcedOpcode = absXMap[logicOpcode];
          if (forcedOpcode === undefined) {
            throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
          }
          this.assembler.write1(forcedOpcode);
          this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
        } else if (len === 3) {
          // For long indexed, assume the opcode is 2 greater than the absoluteX variant.
          const forcedOpcode = absXMap[logicOpcode];
          if (forcedOpcode === undefined) {
            throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
          }
          this.assembler.write1(forcedOpcode + 2);
          this.assembler.write3(this.assembler.operandResolver.getnum(explicitOperand));
        }
        return true;
      } else if (forcedIndexedMode === "y") {
        if (len !== 2) {
          throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
        }
        const forcedOpcode = absYMap[logicOpcode];
        if (forcedOpcode === undefined) {
          throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
        }
        this.assembler.write1(forcedOpcode);
        this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
        return true;
      } else {
        // Non-indexed addressing:
        if (len === 1) {
          this.assembler.write1(dpMap[logicOpcode]);
          this.assembler.write1(this.assembler.operandResolver.getnum(explicitOperand));
        } else if (len === 2) {
          this.assembler.write1(absMap[logicOpcode]);
          this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
        } else if (len === 3) {
          const forcedOpcode = absLongMap[logicOpcode];
          if (forcedOpcode === undefined) {
            throw new Error(`Opcode ${logicOpcode} not supported in forced non-indexed mode.`);
          }
          this.assembler.write1(forcedOpcode);
          this.assembler.write3(this.assembler.operandResolver.getnum(explicitOperand));
        }
        return true;
      }
    }

    // **Absolute Indexed, X Mode (e.g., ORA $0000,X)**
    if (loweredOperand.mode === "absoluteIndexedX" && opcodes[logicOpcode].absoluteX) {
      mode = "absoluteX";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract absolute address
    }
    // **Absolute Indexed, Y Mode (e.g., ORA $0000,Y)**
    else if (loweredOperand.mode === "absoluteIndexedY" && opcodes[logicOpcode].absoluteY) {
      mode = "absoluteY";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract absolute address
    }
    // **Absolute Long**
    else if (loweredOperand.mode === "absoluteLong") {
      mode = "absoluteLong";
      this.assembler.operandResolver.getnum(resolvedOperand);
    } else if (
      loweredOperand.mode === "absoluteLongIndexedX" &&
      opcodes[logicOpcode].absoluteLongX
    ) {
      mode = "absoluteLongX";
      address = this.assembler.operandResolver.getnum(baseOperand);
    }
    // **Stack Relative Mode (e.g., ORA $00,s)**
    else if (loweredOperand.mode === "stackRelative" && opcodes[logicOpcode].stackRelative) {
      mode = "stackRelative";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract stack relative address
    }
    // **Stack Relative Indexed Indirect Mode (e.g., ORA ($00,s),Y)**
    else if (
      loweredOperand.mode === "stackRelativeIndexedIndirectY" &&
      opcodes[logicOpcode].stackRelativeIndirectY
    ) {
      mode = "stackRelativeIndirectY";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect address
    }
    // **Direct Page Mode (e.g., ORA $00, CMP $00)**
    else if (/^\$[\dA-Fa-f]{2}$/.test(resolvedOperand)) {
      mode = "direct";
      address = this.assembler.operandResolver.getnum(resolvedOperand);
    }
    // **Direct Page Indexed, X Mode (e.g., ORA $00,X)**
    else if (loweredOperand.mode === "directPageIndexedX" && opcodes[logicOpcode].directX) {
      mode = "directX";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract DP address
    }
    // **Indexed Indirect, X Mode (e.g., ORA ($00,X))**
    else if (loweredOperand.mode === "indexedIndirectX") {
      mode = "indirectX";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect address
    }
    // **Indirect Indexed, Y Mode (e.g., ORA ($00),Y)**
    else if (loweredOperand.mode === "indirectIndexedY") {
      mode = "indirectY";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect address
    }
    // **Indirect Mode (e.g., ORA ($00))**
    else if (loweredOperand.mode === "directPageIndirect") {
      mode = "indirect";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect address
    }
    // **Direct Page Indirect Long (ORA [$00])**
    else if (loweredOperand.mode === "indirectLong" && opcodes[logicOpcode].directIndirectLong) {
      mode = "directIndirectLong";
      address = this.assembler.operandResolver.getnum(baseOperand);
    }
    // **Direct Page Indirect Long Indexed, Y (ORA [$00],Y)**
    else if (
      loweredOperand.mode === "indirectLongIndexedY" &&
      opcodes[logicOpcode].directIndirectLongY
    ) {
      mode = "directIndirectLongY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    }
    // **Indirect Long Mode (e.g., ORA [$00])**
    else if (loweredOperand.mode === "indirectLong") {
      mode = "indirectLong";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect long address
    }
    // **Indirect Long Indexed, Y Mode (e.g., ORA [$00],Y)**
    else if (loweredOperand.mode === "indirectLongIndexedY") {
      mode = "indirectLongY";
      address = this.assembler.operandResolver.getnum(baseOperand); // Extract indirect long address
    }
    // **Absolute Mode (e.g., ORA $0000, CMP $0000)**
    else if (loweredOperand.mode === "absolute") {
      mode = "absolute";
      address = this.assembler.operandResolver.getnum(resolvedOperand);
    } else {
      throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
    }

    // **Write opcode & address**
    debug("handleLogicAndCompareOperations mode", mode, operand);
    const opcodeByte = opcodes[logicOpcode][mode];
    if (!opcodeByte) {
      throw new Error(`Error: Invalid operand format for ${opcode}: ${operand} => ${opcodeByte}`);
    }
    // Keep legacy behavior for unsupported routed modes (e.g. CPX/CPY fallback tests).
    this.assembler.write1(opcodeByte);
    if (
      (opcode === "AND" ||
        opcode === "ORA" ||
        opcode === "EOR" ||
        opcode === "CPY" ||
        opcode === "CPX" ||
        opcode === "CMP") &&
      mode === "directIndirectLong"
    ) {
      this.assembler.write1(address);
    } else if (["absolute", "absoluteX", "absoluteY", "directIndirectLong"].includes(mode)) {
      this.assembler.write2(address);
    } else if (["absoluteLong", "absoluteLongX", "indirectLong", "indirectLongY"].includes(mode)) {
      this.assembler.write3(address);
    } else {
      this.assembler.write1(address);
    }

    return true;
  }

  /**
   * Handles operators that do not take operands.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleNoOperandOperations(opcode: string, operand: string): boolean {
    const stackOpcodes: { [key: string]: number } = {
      CLC: 0x18,
      CLD: 0xd8,
      CLI: 0x58,
      CLV: 0xb8,
      DEX: 0xca,
      DEY: 0x88,
      INX: 0xe8,
      INY: 0xc8,
      NOP: 0xea,
      PHA: 0x48,
      PHB: 0x8b,
      PHD: 0x0b,
      PHK: 0x4b,
      PHP: 0x08,
      PHX: 0xda,
      PHY: 0x5a,
      PLA: 0x68,
      PLB: 0xab,
      PLD: 0x2b,
      PLP: 0x28,
      PLX: 0xfa,
      PLY: 0x7a,
      RTI: 0x40,
      RTL: 0x6b,
      RTS: 0x60,
      SEC: 0x38,
      SED: 0xf8,
      SEI: 0x78,
      STP: 0xdb,
      TAX: 0xaa,
      TAY: 0xa8,
      TCD: 0x5b,
      TCS: 0x1b,
      TDC: 0x7b,
      TSC: 0x3b,
      TSX: 0xba,
      TXA: 0x8a,
      TXS: 0x9a,
      TXY: 0x9b,
      TYA: 0x98,
      TYX: 0xbb,
      WAI: 0xcb,
      XBA: 0xeb,
      XCE: 0xfb,
    };
    if (!(opcode in stackOpcodes)) {
      return false;
    }
    debug("handleNoOperandOperations", {
      opcode,
      operand,
      value: stackOpcodes[opcode].toString(16),
    });

    // By default, the opcode is written once.
    let count = 1;

    // If a repeat count is provided, it should be the second token starting with '#'.
    if (operand && operand.startsWith("#")) {
      // Remove the '#' and parse the rest as a number.
      let repStr = operand.substring(1);
      // Check for and remove '$' prefix that might be introduced by expandOperand
      if (repStr.startsWith("$")) {
        repStr = repStr.substring(1);
        debug("handleNoOperandOperations removed $ prefix", repStr);
      }
      count = Number.parseInt(repStr, 10);
      debug("handleNoOperandOperations count", count);
      if (Number.isNaN(count)) {
        throw new Error(`Invalid repeat count in pseudo opcode: ${operand}`);
      }
    }

    // Write the opcode 'count' times.
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        this.assembler.write1(stackOpcodes[opcode]);
      }
    }
    return true;
  }

  /**
   * Handles ASL (Arithmetic Shift Left), LSR (Logical Shift Right),
   * ROL (Rotate Left), ROR (Rotate Right), INC (Increment), and DEC (Decrement).
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleArithmeticOperations(
    opcode: string,
    operand: string,
    len: number,
    explicitlen: boolean,
  ): boolean {
    debug("handleArithmeticOperations", opcode, operand);
    // 65816 accepts accumulator unary forms either as an explicit `A`
    // operand (`DEC A`) or as an implied accumulator instruction (`DEC`).
    const operandText = operand?.trim() || "A";
    const accumulatorOpcodes: { [key: string]: number } = {
      ASL: 0x0a,
      LSR: 0x4a,
      ROL: 0x2a,
      ROR: 0x6a,
      INC: 0x1a,
      DEC: 0x3a,
    };

    // Pseudo forms such as `asl #3` mean "repeat the accumulator shift 3 times"
    // rather than "shift direct-page address $03".
    if (operandText.startsWith("#")) {
      const repeatCount = this.assembler.operandResolver.getnum(operandText.substring(1));
      if (!Number.isInteger(repeatCount) || repeatCount < 1) {
        throw new Error(`Invalid repeat count in pseudo opcode: ${operandText}`);
      }
      if (opcode in accumulatorOpcodes) {
        for (let i = 0; i < repeatCount; i++) {
          this.assembler.write1(accumulatorOpcodes[opcode]);
        }
        return true;
      }
    }

    // Accumulator mode
    if (operandText === "A") {
      if (opcode in accumulatorOpcodes) {
        this.assembler.write1(accumulatorOpcodes[opcode]);
        return true;
      }
    }

    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }

    const loweredOperand = this.assembler.operandResolver.lowerOperand(operandText);

    // Track indexed addressing without mutating the raw operand.
    const rawOperand = operandText;
    const isIndexed = loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
    const normalizedOperand = isIndexed ? rawOperand.slice(0, -2).trim() : rawOperand;

    // If an explicit length was given, choose the forced opcode variant.
    if (explicitlen) {
      if (isIndexed) {
        // Forced indexed opcodes for arithmetic instructions.
        const forcedIndexed: { [op: string]: { [L: number]: number } } = {
          ASL: { 1: 0x16, 2: 0x1e },
          LSR: { 1: 0x56, 2: 0x5e },
          ROL: { 1: 0x36, 2: 0x3e },
          ROR: { 1: 0x76, 2: 0x7e },
          INC: { 1: 0xf6, 2: 0xfe },
          DEC: { 1: 0xd6, 2: 0xde },
        };
        if (!(opcode in forcedIndexed)) {
          throw new Error(`Opcode ${opcode} not supported in forced indexed mode.`);
        }
        this.assembler.write1(forcedIndexed[opcode][len]);
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand));
        } else if (len === 2) {
          this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
        } else {
          throw new Error("Forced length for arithmetic operations must be 1 or 2 bytes.");
        }
        return true;
      } else {
        // Forced non-indexed opcodes for arithmetic instructions.
        const forcedNonIndexed: { [op: string]: { [L: number]: number } } = {
          ASL: { 1: 0x06, 2: 0x0e },
          LSR: { 1: 0x46, 2: 0x4e },
          ROL: { 1: 0x26, 2: 0x2e },
          ROR: { 1: 0x66, 2: 0x6e },
          INC: { 1: 0xe6, 2: 0xee },
          DEC: { 1: 0xc6, 2: 0xce },
        };
        if (!(opcode in forcedNonIndexed)) {
          throw new Error(`Opcode ${opcode} not supported in forced non-indexed mode.`);
        }
        this.assembler.write1(forcedNonIndexed[opcode][len]);
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand));
        } else if (len === 2) {
          this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
        } else {
          throw new Error("Forced length for arithmetic operations must be 1 or 2 bytes.");
        }
        return true;
      }
    }

    // DP Indexed, X Mode (Opcode $16, $36, $56, etc.)
    if (/^\$[\da-f]{2}$/i.test(normalizedOperand) && loweredOperand.mode === "directPageIndexedX") {
      debug("handleArithmeticOperations DP Indexed,X", opcode, rawOperand);

      const dpIndexedXOpcodes: { [key: string]: number } = {
        ASL: 0x16,
        ROL: 0x36,
        LSR: 0x56,
        ROR: 0x76,
        INC: 0xf6,
        DEC: 0xd6,
      };

      if (opcode in dpIndexedXOpcodes) {
        this.assembler.write1(dpIndexedXOpcodes[opcode]);
        this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand)); // Extract DP address
        return true;
      }
    }

    // Absolute,X Mode
    if (loweredOperand.mode === "absoluteIndexedX") {
      const absoluteXOpcodes: { [key: string]: number } = {
        ASL: 0x1e,
        LSR: 0x5e,
        ROL: 0x3e,
        ROR: 0x7e,
        INC: 0xfe,
        DEC: 0xde,
      };
      if (opcode in absoluteXOpcodes) {
        this.assembler.write1(absoluteXOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
        return true;
      }
    }

    // Absolute Mode
    if (loweredOperand.mode === "absolute") {
      const absoluteOpcodes: { [key: string]: number } = {
        ASL: 0x0e,
        LSR: 0x4e,
        ROL: 0x2e,
        ROR: 0x6e,
        INC: 0xee,
        DEC: 0xce,
      };
      if (opcode in absoluteOpcodes) {
        this.assembler.write1(absoluteOpcodes[opcode]);
        this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
        return true;
      }
    }

    // Direct Page Mode
    const directPageOpcodes: { [key: string]: number } = {
      ASL: 0x06,
      LSR: 0x46,
      ROL: 0x26,
      ROR: 0x66,
      INC: 0xe6,
      DEC: 0xc6,
    };
    if (opcode in directPageOpcodes) {
      this.assembler.write1(directPageOpcodes[opcode]);
      this.assembler.write1(this.assembler.operandResolver.getnum(rawOperand));
      return true;
    }

    return false;
  }

  /**
   * Handles Load X/Y Register instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleLoadRegister(opcode: string, operand: string, len: number, explicitlen: boolean): boolean {
    debug("handleLoadRegister", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);

    let opcodeByte = 0;
    let address = 0;
    const isLDX = opcode === "LDX";
    const isLDY = opcode === "LDY";

    // Immediate mode (e.g. ldx #$00)
    if (operand.startsWith("#")) {
      if (isLDX) {
        opcodeByte = 0xa2; // Immediate LDX
      } else if (isLDY) {
        opcodeByte = 0xa0; // Immediate LDY
      }
      address = this.assembler.operandResolver.getnum(operand.slice(1));
      this.assembler.write1(opcodeByte);
      if (len === 1) {
        this.assembler.write1(address);
      } else {
        this.assembler.write2(address);
      }
      return true;
    }

    // Check for indexed addressing:
    const isIndexed =
      (isLDX && loweredOperand.indexRegister === "y" && !loweredOperand.indirect) ||
      (isLDY && loweredOperand.indexRegister === "x" && !loweredOperand.indirect);
    if (isIndexed) {
      operand = operand.slice(0, -2).trim();
    }
    const isDirectPageLiteral = /^\$[\da-f]{1,2}$/i.test(operand);
    const isAbsoluteLiteral = /^\$[\da-f]{4}$/i.test(operand);
    const inferredAbsoluteWidth =
      !isDirectPageLiteral && (loweredOperand.length === 2 || len === 2);

    // If an explicit length is provided, use forced maps:
    if (explicitlen) {
      if (isLDX) {
        if (!isIndexed) {
          // Forced non-indexed LDX: .b → A6; .w → AE.
          const forcedLDX: { [L: number]: number } = { 1: 0xa6, 2: 0xae };
          opcodeByte = forcedLDX[len] ?? 0xae;
        } else {
          // For LDX with ,Y: .b → B6; .w → BE.
          const forcedLDXY: { [L: number]: number } = { 1: 0xb6, 2: 0xbe };
          opcodeByte = forcedLDXY[len] ?? 0xbe;
        }
      } else if (isLDY) {
        if (!isIndexed) {
          // Forced non-indexed LDY: .b → A4; .w → AC.
          const forcedLDY: { [L: number]: number } = { 1: 0xa4, 2: 0xac };
          opcodeByte = forcedLDY[len] ?? 0xac;
        } else {
          // For LDY with ,X: .b → B4; .w → BC.
          const forcedLDYX: { [L: number]: number } = { 1: 0xb4, 2: 0xbc };
          opcodeByte = forcedLDYX[len] ?? 0xbc;
        }
      }
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(opcodeByte);
      if (len === 1) {
        this.assembler.write1(address);
      } else if (len === 2) {
        this.assembler.write2(address);
      } else {
        // (For these instructions we only support .b and .w)
        throw new Error(`Forced length ${len} not supported for ${opcode}`);
      }
      return true;
    }

    // Fallback: No explicit length.
    // For non-indexed, if operand is 4 digits, use absolute; otherwise, use direct page.
    if (isLDX) {
      if (!isIndexed) {
        address = this.assembler.operandResolver.getnum(operand);
        if (
          (loweredOperand.mode === "absolute" && !isDirectPageLiteral) ||
          isAbsoluteLiteral ||
          inferredAbsoluteWidth ||
          address > 0xff
        ) {
          opcodeByte = 0xae; // Absolute LDX
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 0xa6; // Direct page LDX
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      } else {
        address = this.assembler.operandResolver.getnum(operand);
        if (
          (loweredOperand.mode === "absoluteIndexedY" && !isDirectPageLiteral) ||
          isAbsoluteLiteral ||
          inferredAbsoluteWidth ||
          address > 0xff
        ) {
          opcodeByte = 0xbe; // Absolute Indexed Y LDX
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 0xb6; // Direct page Indexed Y LDX
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      }
    } else if (isLDY) {
      if (!isIndexed) {
        address = this.assembler.operandResolver.getnum(operand);
        if (
          (loweredOperand.mode === "absolute" && !isDirectPageLiteral) ||
          isAbsoluteLiteral ||
          inferredAbsoluteWidth ||
          address > 0xff
        ) {
          opcodeByte = 0xac; // Absolute LDY
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 0xa4; // Direct page LDY
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      } else {
        address = this.assembler.operandResolver.getnum(operand);
        if (
          (loweredOperand.mode === "absoluteIndexedX" && !isDirectPageLiteral) ||
          isAbsoluteLiteral ||
          inferredAbsoluteWidth ||
          address > 0xff
        ) {
          opcodeByte = 0xbc; // Absolute Indexed X LDY
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 0xb4; // Direct page Indexed X LDY
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      }
    }
    return true;
  }

  /**
   * Handles the JMP (Jump), JSR (Jump to Subroutine), and JSL (Jump to Subroutine Long) instructions.
   * @param {string} opcode - The opcode to handle.
   * @param {string} operand - The resolved operand to handle.
   * @param {string} rawOperand - The original source operand before expansion.
   * @returns {boolean} True if the opcode and operand were handled successfully, false otherwise.
   */
  handleJump(opcode: string, operand: string, rawOperand = operand): boolean {
    debug("handleJump", { opcode, operand, rawOperand });
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const baseOperand = loweredOperand.baseExpression ?? rawOperand;
    const symbolicOperand = rawOperand.trim();

    const jumpOpcodes: { [key: string]: number } = {
      JMP: 0x4c, // JMP Absolute
      JSR: 0x20, // JSR Absolute
      JML: 0x5c, // JMP Absolute Long
      JSL: 0x22, // JSL Absolute Long
    };

    const jumpIndirectOpcodes: { [key: string]: number } = {
      JMP_INDIRECT: 0x6c, // JMP (Absolute Indirect)
      JMP_INDIRECT_LONG: 0xdc, // JMP [Absolute Indirect Long]
      JMP_INDEXED_INDIRECT: 0x7c, // JMP (Absolute Indexed Indirect,X)
      JSR_INDEXED_INDIRECT: 0xfc, // JSR (Absolute Indexed Indirect,X)
    };

    let address = 0;
    let mode: keyof typeof jumpOpcodes;
    const hintedBank = (() => {
      const simpleBankedLabel =
        symbolicOperand.startsWith("_") &&
        symbolicOperand.length >= 7 &&
        /^[\da-f]{6}$/i.test(symbolicOperand.slice(1, 7));
      if (!simpleBankedLabel) {
        return null;
      }
      return Number.parseInt(symbolicOperand.slice(1, 3), 16);
    })();
    const longMode = (currentOpcode: string): keyof typeof jumpOpcodes => {
      if (currentOpcode === "JMP") return "JML";
      if (currentOpcode === "JSR") return "JSL";
      return currentOpcode;
    };
    const shortMode = (currentOpcode: string): keyof typeof jumpOpcodes => currentOpcode;
    const absolutePointer = (value: number): number => value & 0xffff;
    const selectDirectJumpMode = (
      currentOpcode: string,
      resolvedAddress: number,
    ): { mode: keyof typeof jumpOpcodes; address: number } => {
      if (currentOpcode === "JML" || currentOpcode === "JSL") {
        return { mode: currentOpcode, address: resolvedAddress };
      }

      if (resolvedAddress > 0xffff) {
        const currentBank = (this.assembler.currentTargetAddress >>> 16) & 0xff;
        const targetBank = (resolvedAddress >>> 16) & 0xff;

        // The disassembly stores banked SNES labels even for in-bank subroutine
        // calls. Preserve JSR/JMP when the destination remains in the current
        // program bank, and only upgrade to the long form for cross-bank jumps.
        if ((currentOpcode === "JMP" || currentOpcode === "JSR") && targetBank === currentBank) {
          return { mode: shortMode(currentOpcode), address: absolutePointer(resolvedAddress) };
        }

        // Early passes can temporarily push forward labels near a bank boundary
        // into the next bank even when the source operand explicitly names the
        // current bank (for example `_02FF22`). Keep sizing stable by trusting
        // that bank hint for same-bank JMP/JSR decisions until later passes
        // converge on the final absolute address.
        if ((currentOpcode === "JMP" || currentOpcode === "JSR") && hintedBank === currentBank) {
          return { mode: shortMode(currentOpcode), address: absolutePointer(resolvedAddress) };
        }

        return { mode: longMode(currentOpcode), address: resolvedAddress };
      }

      return { mode: shortMode(currentOpcode), address: resolvedAddress };
    };

    // **Plain numeric / hex literal mode**
    if (/^\d+$/.test(operand)) {
      ({ mode, address } = selectDirectJumpMode(
        opcode,
        this.assembler.operandResolver.getnum(operand),
      ));
      debug("handleJump mode", mode);
    }
    // **Plain hex literal mode**
    else if (/^\$[\dA-Fa-f]{1,6}$/.test(operand)) {
      ({ mode, address } = selectDirectJumpMode(
        opcode,
        this.assembler.operandResolver.getnum(operand),
      ));
      debug("handleJump mode", mode);
    }
    // **Absolute Indirect Long Mode: JMP [$0000]**
    else if (loweredOperand.mode === "indirectLong") {
      mode = "JMP_INDIRECT_LONG";
      debug("handleJump mode", mode);
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand)); // Extract 16-bit indirect long pointer
    }
    // **Absolute indexed/indirect jump modes accept expressions, not just raw
    // hex literals, as long as they resolve to a 16-bit absolute pointer.**
    else if (opcode === "JSR" && loweredOperand.mode === "indexedIndirectX") {
      // Local labels resolve to banked SNES addresses, but JSR (abs,X) only
      // encodes the absolute pointer within the current program bank.
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JSR_INDEXED_INDIRECT";
      debug("handleJump mode", mode);
    }
    // **Absolute Indexed Indirect Mode: JMP ($0000,X)**
    else if (loweredOperand.mode === "indexedIndirectX") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDEXED_INDIRECT";
      debug("handleJump mode", mode);
    }
    // **Absolute Indirect Mode: JMP ($0000)**
    else if (loweredOperand.mode === "directPageIndirect") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDIRECT";
      debug("handleJump mode", mode);
    } else {
      try {
        // Long/short jump operands are often labels such as `_018049_8053`
        // rather than raw numeric literals. Resolve those through the common
        // operand pipeline before rejecting the instruction shape outright.
        ({ mode, address } = selectDirectJumpMode(
          opcode,
          this.assembler.operandResolver.getnum(baseOperand),
        ));
        debug("handleJump mode", mode);
      } catch {
        debug("handleJump", `Error: Invalid operand format for ${opcode}: ${operand}`);
        throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
      }
    }

    debug("handleJump address", address?.toString(16));

    // **Write opcode & address**
    if (mode in jumpOpcodes) {
      this.assembler.write1(jumpOpcodes[mode]);
      if (mode === "JSL" || mode === "JML") {
        this.assembler.write3(address);
      } else {
        this.assembler.write2(address);
      }
    } else if (mode in jumpIndirectOpcodes) {
      this.assembler.write1(jumpIndirectOpcodes[mode]);
      this.assembler.write2(address);
    }

    return true;
  }

  /**
   * Handles the PER (Push Effective Relative Address) instruction.
   * @param {string} operand The operand to handle.
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handlePER(operand: string): boolean {
    debug("handlePER", operand);
    if (!operand) {
      throw new Error("Error: PER requires an operand.");
    }

    const offset = this.assembler.operandResolver.getnum(operand);
    const address = offset; // (this.assembler.currentTargetAddress + offset) & 0xFFFF; // 16-bit wraparound

    this.assembler.write1(0x62); // Opcode for PER
    this.assembler.write2(address);

    return true;
  }

  /**
   * Handles STX, STY, and STZ instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the instruction was handled, false otherwise
   */
  handleStoreOperations(
    opcode: string,
    operand: string,
    len: number,
    explicitlen: boolean,
  ): boolean {
    debug("handleStoreOperations", { opcode, operand, len, explicitlen });
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const rawOperand = operand;
    type StoreOpcode = "STX" | "STY" | "STZ";
    type StoreModeMap = {
      direct: number;
      directX?: number;
      directY?: number;
      absolute: number;
      absoluteX?: number;
    };
    type ForcedLengthMap = Partial<Record<1 | 2, number>>;
    const storeOpcodes = {
      STX: { direct: 0x86, absolute: 0x8e, directY: 0x96 }, // STX Direct Page, Absolute, Indexed Y
      STY: { direct: 0x84, absolute: 0x8c, directX: 0x94 }, // STY Direct Page, Absolute, Indexed X
      STZ: { direct: 0x64, directX: 0x74, absolute: 0x9c, absoluteX: 0x9e }, // STZ DP, DP Indexed X, Absolute, Absolute Indexed X
    } satisfies Record<StoreOpcode, StoreModeMap>;

    if (!(opcode in storeOpcodes)) {
      return false; // Not a store instruction
    }
    const storeOpcode = opcode as StoreOpcode;
    const storeModeMap: StoreModeMap = storeOpcodes[storeOpcode];
    const getForcedOpcode = (map: ForcedLengthMap, fallback: number): number => {
      const forced = map[len as 1 | 2];
      return forced ?? fallback;
    };

    let address = 0;
    let mode: keyof StoreModeMap; // Determines which mode we're using
    const isIndexed =
      (storeOpcode === "STX" && loweredOperand.indexRegister === "y" && !loweredOperand.indirect) ||
      (storeOpcode === "STY" && loweredOperand.indexRegister === "x" && !loweredOperand.indirect) ||
      (storeOpcode === "STZ" && loweredOperand.indexRegister === "x" && !loweredOperand.indirect);
    if (isIndexed) {
      operand = rawOperand.slice(0, -2).trim();
    }

    // Forced (explicit) mode: if the user appended a suffix, force the operand length.
    if (explicitlen) {
      if (isIndexed) {
        // For STZ with index, use forced indexed mapping.
        if (storeOpcode === "STZ") {
          const forcedSTZIndexed: ForcedLengthMap = { 1: 0x74, 2: 0x9e };
          this.assembler.write1(getForcedOpcode(forcedSTZIndexed, 0x9e));
        } else {
          // For STX/STY, index mode is less common.
          // (You could add forced mappings if needed; here we fall back to non-indexed.)
          if (storeOpcode === "STX") {
            const forcedSTX: ForcedLengthMap = { 1: 0x86, 2: 0x8e };
            this.assembler.write1(getForcedOpcode(forcedSTX, 0x8e));
          } else if (storeOpcode === "STY") {
            const forcedSTY: ForcedLengthMap = { 1: 0x84, 2: 0x8c };
            this.assembler.write1(getForcedOpcode(forcedSTY, 0x8c));
          }
        }
      } else {
        // Non-indexed forced mode.
        if (storeOpcode === "STX") {
          const forcedSTX: ForcedLengthMap = { 1: 0x86, 2: 0x8e };
          this.assembler.write1(getForcedOpcode(forcedSTX, 0x8e));
        } else if (storeOpcode === "STY") {
          const forcedSTY: ForcedLengthMap = { 1: 0x84, 2: 0x8c };
          this.assembler.write1(getForcedOpcode(forcedSTY, 0x8c));
        } else if (storeOpcode === "STZ") {
          const forcedSTZ: ForcedLengthMap = { 1: 0x64, 2: 0x9c };
          this.assembler.write1(getForcedOpcode(forcedSTZ, 0x9c));
        }
      }
      address = this.assembler.operandResolver.getnum(operand);
      if (len === 1) {
        this.assembler.write1(address);
      } else if (len === 2) {
        this.assembler.write2(address);
      } else {
        throw new Error(`Forced length ${len} not supported for ${opcode}`);
      }
      return true;
    }

    // DP Indexed, X Mode: STZ $00,x
    if (
      loweredOperand.mode === "directPageIndexedX" &&
      storeModeMap.directX &&
      /^\$[\da-f]{2}$/i.test(operand)
    ) {
      mode = "directX";
      address = this.assembler.operandResolver.getnum(operand); // Extract DP address
    }
    // DP Indexed, Y Mode: STX $00,y
    else if (
      loweredOperand.indexRegister === "y" &&
      !loweredOperand.indirect &&
      storeModeMap.directY
    ) {
      mode = "directY";
      address = this.assembler.operandResolver.getnum(operand); // Extract absolute address
    }
    // Absolute Indexed, X Mode: STX $0000,X, STY $0000,X, STZ $0000,X
    else if (loweredOperand.mode === "absoluteIndexedX" && storeModeMap.absoluteX) {
      mode = "absoluteX";
      address = this.assembler.operandResolver.getnum(operand); // Extract absolute address
    }

    // Absolute Mode: STX $0000, STY $0000, STZ $0000
    if (!isIndexed && /^\$[\dA-Fa-f]{4}$/.test(operand)) {
      mode = "absolute";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].absolute);
      this.assembler.write2(address);
      debug("handleStoreOperations mode", mode);
      return true;
    }
    // Direct Page Mode: STX $00, STY $00, STZ $00
    else if (!isIndexed && /^\$[\dA-Fa-f]{2}$/.test(operand)) {
      mode = "direct";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].direct);
      this.assembler.write1(address);
      debug("handleStoreOperations mode", mode);
      return true;
    } else if (isIndexed) {
      // Default indexed: use the indexed variant from the lookup table.
      if (storeOpcode === "STX") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directY";
          this.assembler.write1(storeOpcodes[storeOpcode].directY);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STY") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STZ") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand) && storeOpcodes[storeOpcode].absoluteX) {
          mode = "absoluteX";
          this.assembler.write1(storeOpcodes[storeOpcode].absoluteX);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      }
    }

    throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
  }

  /**
   * Handles MVN (Move Negative) and MVP (Move Positive) instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBlockMove(opcode: string, operand: string): boolean {
    debug("handleBlockMove", opcode, operand);
    const params = operand.split(",").map((p) => p.trim());
    if (params.length !== 2) {
      throw new Error(`Error: ${opcode} requires two parameters (source, destination).`);
    }

    const srcBank = this.assembler.operandResolver.getnum(params[0]);
    const destBank = this.assembler.operandResolver.getnum(params[1]);

    this.assembler.write1(opcode === "MVP" ? 0x44 : 0x54); // MVP = 0x44, MVN = 0x54
    this.assembler.write1(srcBank);
    this.assembler.write1(destBank);

    return true;
  }

  /**
   * Handles BIT, TSB, and TRB instructions, including all their addressing modes.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBitTestOperations(
    opcode: string,
    operand: string,
    len: number,
    explicitlen: boolean,
  ): boolean {
    debug("handleBitTestOperations", { opcode, operand });
    opcode = opcode.toUpperCase();
    type BitOpcode = "BIT" | "TSB" | "TRB";
    type BitModeMap = {
      immediate?: number;
      direct: number;
      directX?: number;
      absolute: number;
      absoluteX?: number;
    };
    type ForcedBitMap = {
      immediate?: number;
      direct: Partial<Record<1 | 2, number>>;
      directX?: Partial<Record<1 | 2, number>>;
    };
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const rawOperand = operand;
    const normalizedOperand =
      loweredOperand.indexRegister === "x" && !loweredOperand.indirect
        ? rawOperand.slice(0, -2).trim()
        : rawOperand;

    // Define forced maps for BIT, TSB, and TRB.
    const forcedMaps: Record<BitOpcode, ForcedBitMap> = {
      BIT: {
        immediate: 0x89,
        direct: { 1: 0x24, 2: 0x2c },
        directX: { 1: 0x34, 2: 0x3c },
      },
      TSB: {
        direct: { 1: 0x04, 2: 0x0c },
      },
      TRB: {
        direct: { 1: 0x14, 2: 0x1c },
      },
    };
    // Default opcode map (used when no explicit length is provided)
    const opcodes: Record<BitOpcode, BitModeMap> = {
      BIT: { immediate: 0x89, direct: 0x24, directX: 0x34, absolute: 0x2c, absoluteX: 0x3c },
      TSB: { direct: 0x04, absolute: 0x0c },
      TRB: { direct: 0x14, absolute: 0x1c },
    };

    if (!(opcode in opcodes)) {
      return false; // Not a BIT, TSB, or TRB instruction
    }
    const bitOpcode = opcode as BitOpcode;
    const getForcedBitOpcode = (map: Partial<Record<1 | 2, number>>, fallback: number): number => {
      const forced = map[len as 1 | 2];
      return forced ?? fallback;
    };

    let address = 0;
    let outLength = 0; // Number of operand bytes to output
    // Immediate mode (only BIT supports immediate)
    if (operand.startsWith("#")) {
      debug("handleBitTestOperations immediate", {
        opcode,
        operand,
        value: forcedMaps[bitOpcode].immediate?.toString(16),
      });
      address = this.assembler.operandResolver.getnum(operand.slice(1));
      if (explicitlen) {
        const immediate = forcedMaps[bitOpcode].immediate;
        if (immediate === undefined) {
          throw new Error(`Opcode ${opcode} does not support immediate mode.`);
        }
        this.assembler.write1(immediate);
        outLength = len === 1 ? 1 : 2;
      } else {
        const immediate = opcodes[bitOpcode].immediate;
        if (immediate === undefined) {
          throw new Error(`Opcode ${opcode} does not support immediate mode.`);
        }
        this.assembler.write1(immediate);
        // Match Asar behavior: #$0000 emits a 16-bit immediate operand.
        outLength = operand.length === 6 ? 2 : 1;
      }
    } else {
      // Determine whether this is indexed addressing without mutating operand.
      const isIndexed = loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
      address = this.assembler.operandResolver.getnum(normalizedOperand);
      if (explicitlen) {
        if (isIndexed) {
          // Forced indexed mode for BIT.
          if (!forcedMaps[bitOpcode].directX) {
            throw new Error(`Opcode ${opcode} does not support indexed addressing in forced mode.`);
          }
          this.assembler.write1(
            getForcedBitOpcode(
              forcedMaps[bitOpcode].directX,
              forcedMaps[bitOpcode].directX[2] ?? forcedMaps[bitOpcode].directX[1] ?? 0,
            ),
          );
          outLength = len === 1 ? 1 : 2;
        } else {
          // Forced non-indexed mode.
          this.assembler.write1(
            getForcedBitOpcode(
              forcedMaps[bitOpcode].direct,
              forcedMaps[bitOpcode].direct[2] ?? forcedMaps[bitOpcode].direct[1] ?? 0,
            ),
          );
          outLength = len === 1 ? 1 : 2;
        }
      } else {
        // Default mode: use operand format to choose addressing.
        if (
          isIndexed &&
          loweredOperand.mode === "directPageIndexedX" &&
          /^\$[\da-f]{1,2}$/i.test(normalizedOperand) &&
          opcodes[bitOpcode].directX
        ) {
          this.assembler.write1(opcodes[bitOpcode].directX);
          outLength = 1;
        } else if (/^\$[\da-f]{1,2}$/i.test(normalizedOperand)) {
          this.assembler.write1(opcodes[bitOpcode].direct);
          outLength = 1;
        } else if (/^\$[\da-f]{4}$/i.test(normalizedOperand)) {
          // For 4-digit operands, use the absolute opcode.
          if (isIndexed && opcodes[bitOpcode].absoluteX) {
            this.assembler.write1(opcodes[bitOpcode].absoluteX);
          } else {
            this.assembler.write1(opcodes[bitOpcode].absolute);
          }
          outLength = 2;
        } else {
          throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
        }
      }
    }

    // Write the operand value using outLength bytes.
    if (outLength === 1) {
      this.assembler.write1(address);
    } else if (outLength === 2) {
      this.assembler.write2(address);
    }
    return true;
  }

  /**
   * Handles generic opcodes with standard addressing.
   * @param {string} opcode The opcode to handle.
   * @param {number} num The operand value.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @param {boolean} hexconstant Whether the operand is a hex constant.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleGenericOpcode(
    opcode: string,
    num: number,
    len: number,
    explicitlen: boolean,
    hexconstant: boolean,
  ): boolean {
    debug("handleGenericOpcode", { opcode, num, len, explicitlen, hexconstant });
    type GenericOpcode = "BRK" | "COP" | "PEA" | "PEI" | "REP" | "SEP" | "WDM";
    const opcodeMap: Record<GenericOpcode, number> = {
      BRK: 0x00,
      COP: 0x02,
      PEA: 0xf4,
      PEI: 0xd4,
      REP: 0xc2,
      SEP: 0xe2,
      WDM: 0x42,
    };

    if (opcode in opcodeMap) {
      const genericOpcode = opcode as GenericOpcode;
      const opcodeByte = opcodeMap[genericOpcode];
      if ((opcode === "REP" || opcode === "SEP") && (len !== 1 || num < 0 || num > 0xff)) {
        throw new Error("Error: invalid_number");
      }
      if (!explicitlen && !hexconstant) {
        debug(`arch65816 handleGenericOpcode: ${opcode} assuming 8-bit mode.`);
      }
      this.assembler.write1(opcodeByte);
      // These opcodes have fixed operand widths in 65816 encoding.
      if (opcode === "PEA") {
        this.assembler.write2(num);
      } else {
        this.assembler.write1(num);
      }
      return true;
    }
    return false;
  }

  /**
   * Handle Branch Instructions
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBranchInstructions(opcode: string, operand: string): boolean {
    debug("handleBranchInstructions", opcode, operand);
    const branchOpcodes: { [key: string]: number } = {
      BPL: 0x10,
      BMI: 0x30,
      BVC: 0x50,
      BVS: 0x70,
      BCC: 0x90,
      BCS: 0xb0,
      BNE: 0xd0,
      BEQ: 0xf0,
      BRA: 0x80,
      BRL: 0x82,
    };

    if (!(opcode in branchOpcodes)) {
      return false;
    }

    // Handle +/- labels
    let targetAddress: number;
    const instructionSize = opcode === "BRL" ? 3 : 2;
    const branchReferenceAddress = this.assembler.currentTargetAddress + instructionSize;
    if (/^\++$/.test(operand)) {
      targetAddress = this.assembler.symbolScope.findNextLabel(operand, branchReferenceAddress);
    } else if (/^-+$/.test(operand)) {
      targetAddress = this.assembler.symbolScope.findPreviousLabel(operand, branchReferenceAddress);
    } else {
      targetAddress = this.assembler.operandResolver.getnum(operand);
    }

    const currentAddress = this.assembler.currentTargetAddress + instructionSize; // Offset by instruction size
    const relativeAddress = targetAddress - currentAddress;

    debug(
      "handleBranchInstructions targetAddress:",
      targetAddress,
      "/",
      targetAddress.toString(16),
    );
    debug(
      "handleBranchInstructions currentAddress:",
      currentAddress,
      "/",
      currentAddress.toString(16),
    );
    debug(
      "handleBranchInstructions relativeAddress:",
      relativeAddress,
      "/",
      relativeAddress.toString(16),
    );

    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(branchOpcodes[opcode]);
      if (opcode === "BRL") {
        this.assembler.write2(0); // Placeholder
      } else {
        this.assembler.write1(0); // Placeholder
      }
      return true;
    }

    if (Number.isNaN(relativeAddress)) {
      throw this.assembler.diagnostics.error("Error: relativeAddress is NaN.");
    }

    debug(
      "handleBranchInstructions relativeAddress",
      relativeAddress,
      "/",
      relativeAddress.toString(16),
    );
    if (opcode === "BRL") {
      if (relativeAddress < -32768 || relativeAddress > 32767) {
        throw this.assembler.diagnostics.error(
          `Error: BRL target out of range (${relativeAddress}).`,
        );
      }
      this.assembler.write1(branchOpcodes[opcode]);
      this.assembler.write2(relativeAddress);
      return true;
    } else {
      if (relativeAddress < -128 || relativeAddress > 127) {
        throw this.assembler.diagnostics.error(
          `Error: Branch target out of range (${relativeAddress}).`,
        );
      }
      // **Ensure signed byte is written correctly**
      let signedByte = (relativeAddress & 0xff) >>> 0;
      if (relativeAddress < 0) {
        signedByte |= 0x100; // Ensure two's complement behavior
      }
      this.assembler.write1(branchOpcodes[opcode]);
      this.assembler.write1(signedByte);
      return true;
    }
  }

  /**
   * Handles bit manipulation instructions (TSB, TRB) with both absolute and direct page addressing modes.
   * @param {string} opcode (TSB or TRB)
   * @param {string} operand (absolute or direct)
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMemoryBitInstructions(opcode: string, operand: string): boolean {
    debug("handleMemoryBitInstructions", opcode, operand);
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const memoryBitOpcodes: { [key: string]: { direct: number; absolute: number } } = {
      TSB: { direct: 0x04, absolute: 0x0c },
      TRB: { direct: 0x14, absolute: 0x1c },
    };

    if (opcode in memoryBitOpcodes) {
      const address = this.assembler.operandResolver.getnum(operand);
      const opcodeByte =
        loweredOperand.mode === "absolute" || operand.length === 5
          ? memoryBitOpcodes[opcode].absolute
          : memoryBitOpcodes[opcode].direct;

      this.assembler.write1(opcodeByte);

      if (opcodeByte === memoryBitOpcodes[opcode].absolute) {
        this.assembler.write2(address);
      } else {
        this.assembler.write1(address);
      }

      return true;
    }

    return false;
  }

  /**
   * Resolves the operand length from opcode suffix.
   * @param {string} c The opcode suffix to resolve the length of.
   * @returns {number} The operand length.
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
