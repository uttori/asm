import {
  getOperandCodec,
  getOperandFields,
  matchesFeatures,
  type AddressingMode,
  type CpuDefinition,
  type CpuFeature,
  type InstructionForm,
} from "./schema.js";
import { variantFormsByCpuId } from "./variants.js";

const rows = [
  "BRK:imp ORA:inx JAM:imp SLO:inx NOP:zp ORA:zp ASL:zp SLO:zp PHP:imp ORA:imm ASL:acc ANC:imm NOP:abs ORA:abs ASL:abs SLO:abs",
  "BPL:rel ORA:iny JAM:imp SLO:iny NOP:zpx ORA:zpx ASL:zpx SLO:zpx CLC:imp ORA:aby NOP:imp SLO:aby NOP:abx ORA:abx ASL:abx SLO:abx",
  "JSR:abs AND:inx JAM:imp RLA:inx BIT:zp AND:zp ROL:zp RLA:zp PLP:imp AND:imm ROL:acc ANC:imm BIT:abs AND:abs ROL:abs RLA:abs",
  "BMI:rel AND:iny JAM:imp RLA:iny NOP:zpx AND:zpx ROL:zpx RLA:zpx SEC:imp AND:aby NOP:imp RLA:aby NOP:abx AND:abx ROL:abx RLA:abx",
  "RTI:imp EOR:inx JAM:imp SRE:inx NOP:zp EOR:zp LSR:zp SRE:zp PHA:imp EOR:imm LSR:acc ALR:imm JMP:abs EOR:abs LSR:abs SRE:abs",
  "BVC:rel EOR:iny JAM:imp SRE:iny NOP:zpx EOR:zpx LSR:zpx SRE:zpx CLI:imp EOR:aby NOP:imp SRE:aby NOP:abx EOR:abx LSR:abx SRE:abx",
  "RTS:imp ADC:inx JAM:imp RRA:inx NOP:zp ADC:zp ROR:zp RRA:zp PLA:imp ADC:imm ROR:acc ARR:imm JMP:ind ADC:abs ROR:abs RRA:abs",
  "BVS:rel ADC:iny JAM:imp RRA:iny NOP:zpx ADC:zpx ROR:zpx RRA:zpx SEI:imp ADC:aby NOP:imp RRA:aby NOP:abx ADC:abx ROR:abx RRA:abx",
  "NOP:imm STA:inx NOP:imm SAX:inx STY:zp STA:zp STX:zp SAX:zp DEY:imp NOP:imm TXA:imp ANE:imm STY:abs STA:abs STX:abs SAX:abs",
  "BCC:rel STA:iny JAM:imp SHA:iny STY:zpx STA:zpx STX:zpy SAX:zpy TYA:imp STA:aby TXS:imp TAS:aby SHY:abx STA:abx SHX:aby SHA:aby",
  "LDY:imm LDA:inx LDX:imm LAX:inx LDY:zp LDA:zp LDX:zp LAX:zp TAY:imp LDA:imm TAX:imp LAX:imm LDY:abs LDA:abs LDX:abs LAX:abs",
  "BCS:rel LDA:iny JAM:imp LAX:iny LDY:zpx LDA:zpx LDX:zpy LAX:zpy CLV:imp LDA:aby TSX:imp LAS:aby LDY:abx LDA:abx LDX:aby LAX:aby",
  "CPY:imm CMP:inx NOP:imm DCP:inx CPY:zp CMP:zp DEC:zp DCP:zp INY:imp CMP:imm DEX:imp AXS:imm CPY:abs CMP:abs DEC:abs DCP:abs",
  "BNE:rel CMP:iny JAM:imp DCP:iny NOP:zpx CMP:zpx DEC:zpx DCP:zpx CLD:imp CMP:aby NOP:imp DCP:aby NOP:abx CMP:abx DEC:abx DCP:abx",
  "CPX:imm SBC:inx NOP:imm ISC:inx CPX:zp SBC:zp INC:zp ISC:zp INX:imp SBC:imm NOP:imp SBC:imm CPX:abs SBC:abs INC:abs ISC:abs",
  "BEQ:rel SBC:iny JAM:imp ISC:iny NOP:zpx SBC:zpx INC:zpx ISC:zpx SED:imp SBC:aby NOP:imp ISC:aby NOP:abx SBC:abx INC:abx ISC:abx",
] as const;

const modeNames: Readonly<Record<string, AddressingMode>> = {
  imp: "implied",
  acc: "accumulator",
  imm: "immediate",
  zp: "zeroPage",
  zpx: "zeroPageIndexedX",
  zpy: "zeroPageIndexedY",
  abs: "absolute",
  abx: "absoluteIndexedX",
  aby: "absoluteIndexedY",
  ind: "indirect",
  inx: "indexedIndirectX",
  iny: "indirectIndexedY",
  rel: "relative",
};

const legalOpcodes = new Set([
  0x00, 0x01, 0x05, 0x06, 0x08, 0x09, 0x0a, 0x0d, 0x0e, 0x10, 0x11, 0x15, 0x16, 0x18, 0x19, 0x1d,
  0x1e, 0x20, 0x21, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2a, 0x2c, 0x2d, 0x2e, 0x30, 0x31, 0x35, 0x36,
  0x38, 0x39, 0x3d, 0x3e, 0x40, 0x41, 0x45, 0x46, 0x48, 0x49, 0x4a, 0x4c, 0x4d, 0x4e, 0x50, 0x51,
  0x55, 0x56, 0x58, 0x59, 0x5d, 0x5e, 0x60, 0x61, 0x65, 0x66, 0x68, 0x69, 0x6a, 0x6c, 0x6d, 0x6e,
  0x70, 0x71, 0x75, 0x76, 0x78, 0x79, 0x7d, 0x7e, 0x81, 0x84, 0x85, 0x86, 0x88, 0x8a, 0x8c, 0x8d,
  0x8e, 0x90, 0x91, 0x94, 0x95, 0x96, 0x98, 0x99, 0x9a, 0x9d, 0xa0, 0xa1, 0xa2, 0xa4, 0xa5, 0xa6,
  0xa8, 0xa9, 0xaa, 0xac, 0xad, 0xae, 0xb0, 0xb1, 0xb4, 0xb5, 0xb6, 0xb8, 0xb9, 0xba, 0xbc, 0xbd,
  0xbe, 0xc0, 0xc1, 0xc4, 0xc5, 0xc6, 0xc8, 0xc9, 0xca, 0xcc, 0xcd, 0xce, 0xd0, 0xd1, 0xd5, 0xd6,
  0xd8, 0xd9, 0xdd, 0xde, 0xe0, 0xe1, 0xe4, 0xe5, 0xe6, 0xe8, 0xe9, 0xea, 0xec, 0xed, 0xee, 0xf0,
  0xf1, 0xf5, 0xf6, 0xf8, 0xf9, 0xfd, 0xfe,
]);

const aliases: Readonly<Record<string, readonly string[]>> = {
  ALR: ["ASR"],
  ANC: ["AAC"],
  ANE: ["XAA"],
  AXS: ["SBX"],
  DCP: ["DCM"],
  ISC: ["ISB", "INS"],
  JAM: ["KIL", "HLT"],
  LAS: ["LAR"],
  SAX: ["AAX"],
  SHA: ["AHX"],
  SHX: ["SXA"],
  SHY: ["SYA"],
  SRE: ["LSE"],
  TAS: ["SHS"],
};

const unstable = new Set([
  "ANE:immediate",
  "LAX:immediate",
  "SHA:indirectIndexedY",
  "SHA:absoluteIndexedY",
  "SHX:absoluteIndexedY",
  "SHY:absoluteIndexedX",
  "TAS:absoluteIndexedY",
]);

const decoded = rows.flatMap((row) => row.split(" "));
if (decoded.length !== 256)
  throw new Error(`Expected 256 NMOS opcode entries, got ${decoded.length}.`);

type MutableForm = Omit<InstructionForm, "canonical"> & { canonical: boolean };

const mutableForms: MutableForm[] = decoded.map((entry, opcode) => {
  const [mnemonic, shortMode] = entry.split(":");
  const mode = modeNames[shortMode];
  if (!mnemonic || !mode)
    throw new Error(`Invalid opcode table entry '${entry}' at $${opcode.toString(16)}.`);
  const documented = legalOpcodes.has(opcode);
  const codec = getOperandCodec(mode);
  const key = `${mnemonic}:${mode}`;
  let stability: InstructionForm["stability"] = "stable-undocumented";
  if (documented) stability = "documented";
  else if (unstable.has(key)) stability = "unstable-undocumented";
  let note: string | undefined;
  if (unstable.has(key)) {
    note =
      "Opcode semantics are unstable or chip-dependent; assembly emits the canonical ca65-compatible byte.";
  } else if (opcode === 0x6c) {
    note =
      "NMOS hardware wraps the high-byte fetch within the same page when the indirect pointer ends in $FF.";
  }
  return {
    opcode,
    mnemonic,
    aliases: aliases[mnemonic],
    mode,
    encoding: [opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: documented ? ["nmos"] : ["nmos", "undocumented"] },
    canonical: false,
    documented,
    stability,
    note,
  };
});

const groups = new Map<string, MutableForm[]>();
for (const form of mutableForms) {
  const key = `${form.mnemonic}:${form.mode}`;
  const group = groups.get(key) ?? [];
  group.push(form);
  groups.set(key, group);
}
for (const group of groups.values()) {
  const preferred = group.find((form) => form.documented) ?? group[0];
  if (preferred) preferred.canonical = true;
}

export const nmos6502DecodeTable: readonly InstructionForm[] = Object.freeze(
  mutableForms.map((form) => Object.freeze({ ...form })),
);

const brkSignatureForms: readonly InstructionForm[] = Object.freeze(
  (["immediate", "zeroPage", "absolute"] as const).map<InstructionForm>((mode) => ({
    opcode: 0x00,
    mnemonic: "BRK",
    mode,
    encoding: [0x00],
    operands: [{ name: "signature", width: 1 }],
    codec: "unsigned8",
    availableWhen: { allOf: ["nmos"] },
    canonical: true,
    documented: true,
    stability: "documented",
    note: "Current ca65-guide BRK signature extension; pinned ca65 V2.19 rejects this form.",
  })),
);

export const nmos6502Forms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.documented && form.canonical),
  ...brkSignatureForms,
]);

export const nmos6502xForms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.canonical),
  ...brkSignatureForms,
]);

export const nmos6502Cpu: CpuDefinition = Object.freeze({
  id: "65xx.6502",
  displayName: "NMOS 6502",
  aliases: ["6502", "6510", "8502", "2a03", "2a07", "6507"],
  features: new Set<CpuFeature>(["nmos"]),
});

export const nmos6502xCpu: CpuDefinition = Object.freeze({
  id: "65xx.6502x",
  displayName: "NMOS 6502 with undocumented opcodes",
  aliases: ["6502x"],
  features: new Set<CpuFeature>(["nmos", "undocumented"]),
});

export function getOpcodeForm(opcode: number): InstructionForm {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
    throw new RangeError(`Opcode ${opcode} is outside the byte range.`);
  }
  return nmos6502DecodeTable[opcode];
}

export function getCpuDecodeTable(cpu: CpuDefinition): readonly InstructionForm[] {
  const variantForms = variantFormsByCpuId[cpu.id];
  if (variantForms) return variantForms;
  return nmos6502DecodeTable.filter((form) => matchesFeatures(form.availableWhen, cpu.features));
}

export function getCpuAssemblyForms(cpu: CpuDefinition): readonly InstructionForm[] {
  const variantForms = variantFormsByCpuId[cpu.id];
  if (variantForms) return variantForms;
  return cpu.features.has("undocumented") ? nmos6502xForms : nmos6502Forms;
}
