import type { InstructionDescriptor } from "@uttori/asm-core";
import type { InstructionForm } from "./schema.js";

const syntax: Readonly<Record<InstructionForm["mode"], string>> = {
  implied: "",
  accumulator: "A",
  immediate: "#value",
  zeroPage: "zp",
  zeroPageIndexedX: "zp,x",
  zeroPageIndexedY: "zp,y",
  absolute: "addr",
  absoluteIndexedX: "addr,x",
  absoluteIndexedY: "addr,y",
  absoluteLongIndexedX: "long,x",
  indirect: "(addr)",
  zeroPageIndirect: "(zp)",
  zeroPageIndirectLong: "[zp]",
  indexedIndirectX: "(zp,x)",
  indirectIndexedY: "(zp),y",
  absoluteIndexedIndirect: "(addr,x)",
  zeroPageIndirectIndexedZ: "(zp),z",
  stackRelative: "offset,s",
  stackRelativeIndirectIndexedY: "(offset,s),y",
  relative: "target",
  relative16: "target",
  zeroPageRelative: "zp,target",
  basePageIndirectIndexedZ: "[zp],z",
  quadAccumulator: "Q",
};

const summaries: Readonly<Record<string, string>> = {
  ADC: "Add memory to the accumulator with carry.",
  AND: "Bitwise AND memory with the accumulator.",
  ASL: "Shift left one bit.",
  BCC: "Branch when carry is clear.",
  BCS: "Branch when carry is set.",
  BEQ: "Branch when equal (zero set).",
  BIT: "Test accumulator bits without storing a result.",
  BMI: "Branch when negative.",
  BNE: "Branch when not equal (zero clear).",
  BPL: "Branch when positive.",
  BRK: "Trigger a software interrupt.",
  BVC: "Branch when overflow is clear.",
  BVS: "Branch when overflow is set.",
  CMP: "Compare memory with the accumulator.",
  CPX: "Compare memory with X.",
  CPY: "Compare memory with Y.",
  EOR: "Exclusive-OR memory with the accumulator.",
  JMP: "Jump to an address.",
  JSR: "Call a subroutine.",
  LDA: "Load the accumulator.",
  LDX: "Load X.",
  LDY: "Load Y.",
  NOP: "Perform no operation.",
  ORA: "Bitwise OR memory with the accumulator.",
  SBC: "Subtract memory and borrow from the accumulator.",
  STA: "Store the accumulator.",
  STX: "Store X.",
  STY: "Store Y.",
};

export function buildInstructionCatalog(
  forms: readonly InstructionForm[],
): InstructionDescriptor[] {
  const grouped = new Map<string, InstructionForm[]>();
  for (const form of forms) {
    const entries = grouped.get(form.mnemonic) ?? [];
    entries.push(form);
    grouped.set(form.mnemonic, entries);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([mnemonic, entries]) => ({
      mnemonic,
      summary:
        summaries[mnemonic] ??
        (entries.some((entry) => !entry.documented)
          ? "Undocumented NMOS 6502 instruction."
          : `${mnemonic} instruction.`),
      modes: entries.map((form) => ({
        mode: form.mode,
        syntax: syntax[form.mode],
        opcode: form.opcode,
        size:
          form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0),
      })),
    }));
}
