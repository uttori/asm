import type {
  ArchitectureInstructionSpecification,
  InstructionAddressingMode,
  InstructionDescriptor,
  InstructionFlow,
  InstructionStateEffect,
} from "@uttori/asm-core";

export type Cpu65816WidthFlag = "m" | "x";

export interface Cpu65816ModeDefinition {
  readonly id: string;
  readonly syntax: string;
  readonly minimumSize: number;
  readonly maximumSize: number;
  readonly widthFlag?: Cpu65816WidthFlag;
}

export interface Cpu65816InstructionSpecification extends ArchitectureInstructionSpecification {
  readonly opcode: readonly [number];
  readonly widthFlag?: Cpu65816WidthFlag;
  readonly syntax: string;
  readonly flow: InstructionFlow;
  readonly effects: readonly InstructionStateEffect[];
  readonly operandStatusEffect?: "clearBits" | "setBits";
}

const mode = (
  id: string,
  syntax: string,
  minimumSize: number,
  maximumSize = minimumSize,
  widthFlag?: Cpu65816WidthFlag,
): Cpu65816ModeDefinition => ({
  id,
  syntax,
  minimumSize,
  maximumSize,
  ...(widthFlag ? { widthFlag } : {}),
});

export const cpu65816Modes = Object.freeze({
  imp: mode("implied", "", 1),
  acc: mode("accumulator", "", 1),
  sig: mode("signature", "#const", 2),
  immM: mode("immediate", "#const", 2, 3, "m"),
  immX: mode("immediate", "#const", 2, 3, "x"),
  imm16: mode("immediate16", "addr", 3),
  dp: mode("direct", "dp", 2),
  dpx: mode("directIndexedX", "dp,x", 2),
  dpy: mode("directIndexedY", "dp,y", 2),
  dpi: mode("directIndirect", "(dp)", 2),
  dil: mode("directIndirectLong", "[dp]", 2),
  dix: mode("directIndexedXIndirect", "(dp,x)", 2),
  diy: mode("directIndirectIndexedY", "(dp),y", 2),
  dily: mode("directIndirectLongIndexedY", "[dp],y", 2),
  sr: mode("stackRelative", "sr,s", 2),
  sriy: mode("stackRelativeIndirectIndexedY", "(sr,s),y", 2),
  abs: mode("absolute", "addr", 3),
  abx: mode("absoluteIndexedX", "addr,x", 3),
  aby: mode("absoluteIndexedY", "addr,y", 3),
  long: mode("absoluteLong", "long", 4),
  longx: mode("absoluteLongIndexedX", "long,x", 4),
  rel8: mode("relative", "label", 2),
  rel16: mode("relativeLong", "label", 3),
  ind: mode("absoluteIndirect", "(addr)", 3),
  indx: mode("absoluteIndexedXIndirect", "(addr,x)", 3),
  indlong: mode("absoluteIndirectLong", "[addr]", 3),
  block: mode("blockMove", "srcBank,destBank", 3),
});

type Cpu65816ModeKey = keyof typeof cpu65816Modes;

/**
 * The opcode rows for the 65816.
 */
const opcodeRows = [
  "BRK:sig ORA:dix COP:sig ORA:sr TSB:dp ORA:dp ASL:dp ORA:dil PHP:imp ORA:immM ASL:acc PHD:imp TSB:abs ORA:abs ASL:abs ORA:long",
  "BPL:rel8 ORA:diy ORA:dpi ORA:sriy TRB:dp ORA:dpx ASL:dpx ORA:dily CLC:imp ORA:aby INC:acc TCS:imp TRB:abs ORA:abx ASL:abx ORA:longx",
  "JSR:abs AND:dix JSL:long AND:sr BIT:dp AND:dp ROL:dp AND:dil PLP:imp AND:immM ROL:acc PLD:imp BIT:abs AND:abs ROL:abs AND:long",
  "BMI:rel8 AND:diy AND:dpi AND:sriy BIT:dpx AND:dpx ROL:dpx AND:dily SEC:imp AND:aby DEC:acc TSC:imp BIT:abx AND:abx ROL:abx AND:longx",
  "RTI:imp EOR:dix WDM:sig EOR:sr MVP:block EOR:dp LSR:dp EOR:dil PHA:imp EOR:immM LSR:acc PHK:imp JMP:abs EOR:abs LSR:abs EOR:long",
  "BVC:rel8 EOR:diy EOR:dpi EOR:sriy MVN:block EOR:dpx LSR:dpx EOR:dily CLI:imp EOR:aby PHY:imp TCD:imp JML:long EOR:abx LSR:abx EOR:longx",
  "RTS:imp ADC:dix PER:rel16 ADC:sr STZ:dp ADC:dp ROR:dp ADC:dil PLA:imp ADC:immM ROR:acc RTL:imp JMP:ind ADC:abs ROR:abs ADC:long",
  "BVS:rel8 ADC:diy ADC:dpi ADC:sriy STZ:dpx ADC:dpx ROR:dpx ADC:dily SEI:imp ADC:aby PLY:imp TDC:imp JMP:indx ADC:abx ROR:abx ADC:longx",
  "BRA:rel8 STA:dix BRL:rel16 STA:sr STY:dp STA:dp STX:dp STA:dil DEY:imp BIT:immM TXA:imp PHB:imp STY:abs STA:abs STX:abs STA:long",
  "BCC:rel8 STA:diy STA:dpi STA:sriy STY:dpx STA:dpx STX:dpy STA:dily TYA:imp STA:aby TXS:imp TXY:imp STZ:abs STA:abx STZ:abx STA:longx",
  "LDY:immX LDA:dix LDX:immX LDA:sr LDY:dp LDA:dp LDX:dp LDA:dil TAY:imp LDA:immM TAX:imp PLB:imp LDY:abs LDA:abs LDX:abs LDA:long",
  "BCS:rel8 LDA:diy LDA:dpi LDA:sriy LDY:dpx LDA:dpx LDX:dpy LDA:dily CLV:imp LDA:aby TSX:imp TYX:imp LDY:abx LDA:abx LDX:aby LDA:longx",
  "CPY:immX CMP:dix REP:sig CMP:sr CPY:dp CMP:dp DEC:dp CMP:dil INY:imp CMP:immM DEX:imp WAI:imp CPY:abs CMP:abs DEC:abs CMP:long",
  "BNE:rel8 CMP:diy CMP:dpi CMP:sriy PEI:dpi CMP:dpx DEC:dpx CMP:dily CLD:imp CMP:aby PHX:imp STP:imp JML:indlong CMP:abx DEC:abx CMP:longx",
  "CPX:immX SBC:dix SEP:sig SBC:sr CPX:dp SBC:dp INC:dp SBC:dil INX:imp SBC:immM NOP:imp XBA:imp CPX:abs SBC:abs INC:abs SBC:long",
  "BEQ:rel8 SBC:diy SBC:dpi SBC:sriy PEA:imm16 SBC:dpx INC:dpx SBC:dily SED:imp SBC:aby PLX:imp XCE:imp JSR:indx SBC:abx INC:abx SBC:longx",
] as const;

/**
 * The summaries for the 65816 instructions.
 */
const summaries: Readonly<Record<string, string>> = {
  ADC: "Add with carry to the accumulator.",
  AND: "Bitwise AND with the accumulator.",
  ASL: "Arithmetic shift left.",
  BCC: "Branch if carry clear.",
  BCS: "Branch if carry set.",
  BEQ: "Branch if equal (zero set).",
  BIT: "Test bits against the accumulator.",
  BMI: "Branch if minus (negative set).",
  BNE: "Branch if not equal (zero clear).",
  BPL: "Branch if plus (negative clear).",
  BRA: "Branch always.",
  BRK: "Software break / interrupt.",
  BRL: "Branch always long (16-bit relative).",
  BVC: "Branch if overflow clear.",
  BVS: "Branch if overflow set.",
  CLC: "Clear carry flag.",
  CLD: "Clear decimal flag.",
  CLI: "Clear interrupt-disable flag.",
  CLV: "Clear overflow flag.",
  CMP: "Compare with the accumulator.",
  COP: "Coprocessor enable interrupt.",
  CPX: "Compare with the X register.",
  CPY: "Compare with the Y register.",
  DEC: "Decrement memory or the accumulator.",
  DEX: "Decrement the X register.",
  DEY: "Decrement the Y register.",
  EOR: "Bitwise exclusive-OR with the accumulator.",
  INC: "Increment memory or the accumulator.",
  INX: "Increment the X register.",
  INY: "Increment the Y register.",
  JML: "Jump long (24-bit).",
  JMP: "Jump.",
  JSL: "Jump to subroutine long.",
  JSR: "Jump to subroutine.",
  LDA: "Load the accumulator.",
  LDX: "Load the X register.",
  LDY: "Load the Y register.",
  LSR: "Logical shift right.",
  MVN: "Block move next (ascending).",
  MVP: "Block move previous (descending).",
  NOP: "No operation.",
  ORA: "Bitwise OR with the accumulator.",
  PEA: "Push effective absolute address.",
  PEI: "Push effective indirect address.",
  PER: "Push effective PC-relative address.",
  PHA: "Push the accumulator.",
  PHB: "Push the data bank register.",
  PHD: "Push the direct page register.",
  PHK: "Push the program bank register.",
  PHP: "Push the processor status register.",
  PHX: "Push the X register.",
  PHY: "Push the Y register.",
  PLA: "Pull the accumulator.",
  PLB: "Pull the data bank register.",
  PLD: "Pull the direct page register.",
  PLP: "Pull the processor status register.",
  PLX: "Pull the X register.",
  PLY: "Pull the Y register.",
  REP: "Reset status bits.",
  ROL: "Rotate left through carry.",
  ROR: "Rotate right through carry.",
  RTI: "Return from interrupt.",
  RTL: "Return from subroutine long.",
  RTS: "Return from subroutine.",
  SBC: "Subtract with borrow from the accumulator.",
  SEC: "Set carry flag.",
  SED: "Set decimal flag.",
  SEI: "Set interrupt-disable flag.",
  SEP: "Set status bits.",
  STA: "Store the accumulator.",
  STP: "Stop the processor.",
  STX: "Store the X register.",
  STY: "Store the Y register.",
  STZ: "Store zero to memory.",
  TAX: "Transfer accumulator to X.",
  TAY: "Transfer accumulator to Y.",
  TCD: "Transfer accumulator to direct page register.",
  TCS: "Transfer accumulator to stack pointer.",
  TDC: "Transfer direct page register to accumulator.",
  TRB: "Test and reset bits.",
  TSB: "Test and set bits.",
  TSC: "Transfer stack pointer to accumulator.",
  TSX: "Transfer stack pointer to X.",
  TXA: "Transfer X to accumulator.",
  TXS: "Transfer X to stack pointer.",
  TXY: "Transfer X to Y.",
  TYA: "Transfer Y to accumulator.",
  TYX: "Transfer Y to X.",
  WAI: "Wait for interrupt.",
  WDM: "Reserved (William D. Mensch) opcode.",
  XBA: "Exchange the bytes of the accumulator.",
  XCE: "Exchange carry and emulation flags.",
};

/**
 * Rel8 flag-conditioned branches. `BRA`/`BRL` are unconditional and excluded.
 */
export const conditionalBranches: ReadonlySet<string> = new Set([
  "BCC",
  "BCS",
  "BEQ",
  "BMI",
  "BNE",
  "BPL",
  "BVC",
  "BVS",
]);

/**
 * The flow for a 65816 instruction.
 * @param {string} mnemonic The mnemonic of the instruction.
 * @param {string} addressingMode The addressing mode of the instruction.
 * @returns {InstructionFlow} The flow for the instruction.
 */
const flowFor = (mnemonic: string, addressingMode: string): InstructionFlow => {
  if (conditionalBranches.has(mnemonic)) {
    return { kind: "conditionalBranch", fallthrough: true };
  }
  if (mnemonic === "BRA" || mnemonic === "BRL") {
    return { kind: "jump", fallthrough: false };
  }
  if (mnemonic === "JMP" || mnemonic === "JML") {
    return {
      kind: "jump",
      fallthrough: false,
      ...(addressingMode.includes("Indirect") ? { indirect: true } : {}),
    };
  }
  if (mnemonic === "JSR" || mnemonic === "JSL") {
    return {
      kind: "call",
      fallthrough: true,
      ...(addressingMode.includes("Indirect") ? { indirect: true } : {}),
    };
  }
  if (mnemonic === "RTI" || mnemonic === "RTL" || mnemonic === "RTS") {
    return { kind: "return", fallthrough: false };
  }
  if (mnemonic === "BRK" || mnemonic === "COP") {
    return { kind: "interrupt", fallthrough: false };
  }
  if (mnemonic === "WAI") {
    return { kind: "wait", fallthrough: false };
  }
  if (mnemonic === "STP") {
    return { kind: "stop", fallthrough: false };
  }
  return { kind: "fallthrough", fallthrough: true };
};

/**
 * The effects for the 65816 instructions.
 */
const effects: Readonly<Record<string, readonly InstructionStateEffect[]>> = {
  CLC: [{ kind: "clearBits", target: "p", mask: 0x01 }],
  SEC: [{ kind: "setBits", target: "p", mask: 0x01 }],
  CLI: [{ kind: "clearBits", target: "p", mask: 0x04 }],
  SEI: [{ kind: "setBits", target: "p", mask: 0x04 }],
  CLD: [{ kind: "clearBits", target: "p", mask: 0x08 }],
  SED: [{ kind: "setBits", target: "p", mask: 0x08 }],
  CLV: [{ kind: "clearBits", target: "p", mask: 0x40 }],
  PHA: [{ kind: "push", source: "a" }],
  PHB: [{ kind: "push", source: "dbr" }],
  PHD: [{ kind: "push", source: "d" }],
  PHK: [{ kind: "push", source: "pbr" }],
  PHP: [{ kind: "push", source: "p" }],
  PHX: [{ kind: "push", source: "x" }],
  PHY: [{ kind: "push", source: "y" }],
  PLA: [{ kind: "pull", target: "a" }],
  PLB: [{ kind: "pull", target: "dbr" }],
  PLD: [{ kind: "pull", target: "d" }],
  PLP: [{ kind: "pull", target: "p" }],
  PLX: [{ kind: "pull", target: "x" }],
  PLY: [{ kind: "pull", target: "y" }],
  TAX: [{ kind: "copy", from: "a", to: "x" }],
  TAY: [{ kind: "copy", from: "a", to: "y" }],
  TCD: [{ kind: "copy", from: "a", to: "d" }],
  TCS: [{ kind: "copy", from: "a", to: "s" }],
  TDC: [{ kind: "copy", from: "d", to: "a" }],
  TSC: [{ kind: "copy", from: "s", to: "a" }],
  TSX: [{ kind: "copy", from: "s", to: "x" }],
  TXA: [{ kind: "copy", from: "x", to: "a" }],
  TXS: [{ kind: "copy", from: "x", to: "s" }],
  TXY: [{ kind: "copy", from: "x", to: "y" }],
  TYA: [{ kind: "copy", from: "y", to: "a" }],
  TYX: [{ kind: "copy", from: "y", to: "x" }],
  XBA: [{ kind: "custom", name: "exchange-accumulator-bytes" }],
  XCE: [
    { kind: "exchange", left: "c", right: "e" },
    { kind: "custom", name: "normalize-emulation-widths" },
  ],
  RTI: [
    { kind: "pull", target: "p" },
    { kind: "pull", target: "pc" },
    { kind: "pull", target: "pbr" },
  ],
  RTS: [{ kind: "pull", target: "pc" }],
  RTL: [
    { kind: "pull", target: "pc" },
    { kind: "pull", target: "pbr" },
  ],
};

/**
 * The entries for the 65816 instructions.
 */
const entries = opcodeRows.flatMap((row) => row.split(" "));
if (entries.length !== 256) {
  throw new Error(`65816 opcode table has ${entries.length} entries.`);
}

/**
 * The specifications for the 65816 instructions.
 */
export const cpu65816Specifications: readonly Cpu65816InstructionSpecification[] = Object.freeze(
  entries.map((entry, opcode): Cpu65816InstructionSpecification => {
    const [mnemonic, modeKeyText] = entry.split(":");
    const modeKey = modeKeyText as Cpu65816ModeKey;
    const definition = cpu65816Modes[modeKey];
    if (!mnemonic || !definition) {
      throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
    }
    let operandStatusEffect: "clearBits" | "setBits" | undefined;
    if (mnemonic === "REP") {
      operandStatusEffect = "clearBits";
    } else if (mnemonic === "SEP") {
      operandStatusEffect = "setBits";
    }
    return Object.freeze({
      id: `snes.65816.${opcode.toString(16).padStart(2, "0")}`,
      architecture: "snes.65816",
      opcode: [opcode] as const,
      mnemonic,
      mode: definition.id,
      syntax: mnemonic === "PEI" ? "dp" : definition.syntax,
      minimumSize: definition.minimumSize,
      maximumSize: definition.maximumSize,
      summary: summaries[mnemonic] ?? `${mnemonic} instruction.`,
      flow: flowFor(mnemonic, definition.id),
      effects: effects[mnemonic] ?? [],
      ...(definition.widthFlag ? { widthFlag: definition.widthFlag } : {}),
      ...(operandStatusEffect ? { operandStatusEffect } : {}),
    });
  }),
);

/**
 * Generates editor hover/completion data from the same 256-entry table used to decode.
 * @returns {InstructionDescriptor[]} Generated editor instruction descriptors.
 */
export function buildCpu65816Catalog(): InstructionDescriptor[] {
  const grouped = new Map<string, InstructionDescriptor>();
  for (const specification of cpu65816Specifications) {
    const addressingMode: InstructionAddressingMode = {
      mode: specification.mode,
      syntax: specification.syntax,
      opcode: specification.opcode[0],
      ...(specification.minimumSize === specification.maximumSize
        ? { size: specification.minimumSize }
        : {}),
    };
    const descriptor = grouped.get(specification.mnemonic);
    if (descriptor) {
      descriptor.modes.push(addressingMode);
    } else {
      grouped.set(specification.mnemonic, {
        mnemonic: specification.mnemonic,
        summary: specification.summary,
        modes: [addressingMode],
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
