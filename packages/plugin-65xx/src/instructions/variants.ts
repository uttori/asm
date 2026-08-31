import {
  ca65EaTable,
  ca65VariantTables,
  type Ca65InstructionRow,
} from "./variant-tables.generated.js";
import {
  getOperandCodec,
  getOperandFields,
  type AddressingMode,
  type CpuDefinition,
  type CpuFeature,
  type InstructionForm,
  type OperandCodecId,
} from "./schema.js";

interface ModeDefinition {
  readonly mode: AddressingMode;
  readonly codec?: OperandCodecId;
}

/**
 * Maps ca65 addressing-mode bit indices (0–31) onto our {@link AddressingMode}s.
 * Indices 21–23 are all immediate (8-bit variants in ca65's table); 27 is 16-bit
 * immediate. Mode 10 is zp-indirect on 65C02-class, (zp),z on CE02/4510.
 */
const commonModes: Readonly<Partial<Record<number, ModeDefinition>>> = {
  0: { mode: "implied" },
  1: { mode: "accumulator" },
  2: { mode: "zeroPage" },
  3: { mode: "absolute" },
  5: { mode: "zeroPageIndexedX" },
  6: { mode: "absoluteIndexedX" },
  7: { mode: "absoluteLongIndexedX", codec: "unsigned24-le" },
  8: { mode: "zeroPageIndexedY" },
  9: { mode: "absoluteIndexedY" },
  11: { mode: "indirect" },
  12: { mode: "zeroPageIndirectLong" },
  13: { mode: "indirectIndexedY" },
  15: { mode: "indexedIndirectX" },
  16: { mode: "absoluteIndexedIndirect" },
  17: { mode: "relative" },
  18: { mode: "relative16" },
  20: { mode: "stackRelativeIndirectIndexedY" },
  21: { mode: "immediate" },
  22: { mode: "immediate" },
  23: { mode: "immediate" },
  27: { mode: "immediate", codec: "unsigned16-le" },
  30: { mode: "basePageIndirectIndexedZ" },
  31: { mode: "quadAccumulator" },
};

/** ca65 table name → the feature that unlocks those forms. */
const featureByTable: Readonly<Record<keyof typeof ca65VariantTables, CpuFeature>> = {
  "6502DTV": "dtv",
  "65SC02": "cmos",
  "65C02": "rockwell",
  W65C02: "wdc",
  "65CE02": "ce02",
  "4510": "4510",
  "45GS02": "45gs02",
  HuC6280: "huc6280",
  M740: "m740",
};

/**
 * Opcode for one (row, mode) cell: `base | eaTable[mode]`, then 4510/45GS02
 * remaps. Put4510 swaps several 65CE02 opcodes onto the 4510 encoding;
 * Put45GS02_Q rewrites INC/DEC accumulator to $1A/$3A under the Q prefix.
 * @param {Ca65InstructionRow} row The ca65 instruction row.
 * @param {number} modeIndex The mode index.
 * @returns {number} The opcode.
 */
function opcodeFor(row: Ca65InstructionRow, modeIndex: number): number {
  if (row[4] === "PutJSR_m740") {
    if (modeIndex === 10) return 0x02;
    if (modeIndex === 29) return 0x22;
    return 0x20;
  }
  if (row[4] === "PutBitBranch_m740") {
    return modeIndex === 28 ? row[2] + 0x04 : row[2];
  }
  if (row[4] === "PutLDM_m740") return row[2];
  const [, , base, eaTable] = row;
  const extension = ca65EaTable[eaTable]?.[modeIndex];
  if (extension === undefined) throw new Error(`Missing ca65 EA table ${eaTable}/${modeIndex}.`);
  let opcode = base | extension;
  if (row[4] === "Put4510" || row[4] === "Put45GS02") {
    opcode =
      new Map([
        [0x47, 0x44],
        [0x57, 0x54],
        [0x93, 0x82],
        [0x9c, 0x8b],
        [0x9e, 0x9b],
        [0xaf, 0xab],
        [0xbf, 0xbb],
        [0xb3, 0xe2],
        [0xd0, 0xc2],
        [0xfc, 0x23],
      ]).get(opcode) ?? opcode;
  }
  if (row[4] === "Put45GS02_Q") {
    if (opcode === 0xea) opcode = 0x1a;
    else if (opcode === 0xca) opcode = 0x3a;
  }
  return opcode;
}

/**
 * Resolves a ca65 mode bit. Mode 10 is the CMOS vs CE02 fork:
 * 65SC02/65C02/W65C02 → `(zp)`; 65CE02/4510/45GS02 → `(zp),z`.
 * @param {keyof typeof ca65VariantTables} table The ca65 variant table.
 * @param {Ca65InstructionRow} row The ca65 instruction row.
 * @param {number} modeIndex The mode index.
 * @returns {ModeDefinition | undefined} The mode definition.
 */
function modeFor(
  table: keyof typeof ca65VariantTables,
  row: Ca65InstructionRow,
  modeIndex: number,
): ModeDefinition | undefined {
  if (row[4] === "PutBlockTransfer" && modeIndex === 25) {
    return { mode: "blockTransfer", codec: "three-unsigned16-le" };
  }
  if (row[4] === "PutTST") {
    if (modeIndex === 2) return { mode: "immediateZeroPage", codec: "immediate-unsigned8" };
    if (modeIndex === 3) return { mode: "immediateAbsolute", codec: "immediate-unsigned16" };
    if (modeIndex === 5) return { mode: "immediateZeroPageIndexedX", codec: "immediate-unsigned8" };
    if (modeIndex === 6)
      return { mode: "immediateAbsoluteIndexedX", codec: "immediate-unsigned16" };
  }
  if (row[4] === "PutBitBranch_m740") {
    if (modeIndex === 1) return { mode: "accumulatorRelative", codec: "accumulator-relative8" };
    if (modeIndex === 28) return { mode: "zeroPageRelative", codec: "zero-page-relative8" };
  }
  if (row[4] === "PutLDM_m740" && modeIndex === 28) {
    return { mode: "zeroPageImmediate", codec: "zero-page-immediate8" };
  }
  if (row[4] === "PutJSR_m740" && modeIndex === 29) {
    return { mode: "specialPage", codec: "special-page" };
  }
  if (modeIndex === 10) {
    return table === "65CE02" || table === "4510" || table === "45GS02"
      ? { mode: "zeroPageIndirectIndexedZ" }
      : { mode: "zeroPageIndirect" };
  }
  return commonModes[modeIndex];
}

/**
 * Builds one {@link InstructionForm}. 45GS02 Q ops prefix `42 42`; `[zp],z`
 * (modes 12 and 30) also needs a leading `EA` NOP prefix.
 * @param {keyof typeof ca65VariantTables} table The ca65 variant table.
 * @param {Ca65InstructionRow} row The ca65 instruction row.
 * @param {number} modeIndex The mode index.
 * @param {ModeDefinition} modeDefinition The mode definition.
 * @returns {InstructionForm} The instruction form.
 */
function createForm(
  table: keyof typeof ca65VariantTables,
  row: Ca65InstructionRow,
  modeIndex: number,
  modeDefinition: ModeDefinition,
): InstructionForm {
  let opcode = opcodeFor(row, modeIndex);
  const codec = modeDefinition.codec ?? getOperandCodec(modeDefinition.mode);
  const prefixes: number[] = [];
  if (row[4] === "PutTAMn") {
    prefixes.push(0x53);
    opcode = row[2];
  } else if (row[4] === "PutTMAn") {
    prefixes.push(0x43);
    opcode = row[2];
  } else if (row[4] === "Put45GS02_Q") {
    prefixes.push(0x42, 0x42);
    if (modeIndex === 12 || modeIndex === 30) prefixes.push(0xea);
  } else if (row[4] === "Put45GS02" && modeIndex === 30) {
    prefixes.push(0xea);
  }
  let relativeBaseOffset: number | undefined;
  if (row[4] === "PutPCRel4510") {
    relativeBaseOffset = 2;
  } else if (row[4] === "PutBitBranch_m740") {
    relativeBaseOffset = 3;
  }
  return Object.freeze({
    opcode,
    mnemonic: row[0],
    mode: modeDefinition.mode,
    encoding: [...prefixes, opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: [featureByTable[table]] },
    canonical: true,
    documented: true,
    stability: "documented",
    relativeBaseOffset,
    operandConstraint: row[4] === "PutTMA" ? "power-of-two" : undefined,
  });
}

/**
 * Expands one ca65 instruction table into frozen forms.
 * `PutBitBranch` is BBR/BBS (rel base = 3). `PutPCRel8` / `PutPCRel4510`
 * skip the bit mask and use relative / relative16 directly.
 * @param {keyof typeof ca65VariantTables} table The ca65 variant table.
 * @returns {readonly InstructionForm[]} The decode table.
 */
function decodeTable(table: keyof typeof ca65VariantTables): readonly InstructionForm[] {
  const forms: InstructionForm[] = [];
  for (const row of ca65VariantTables[table] as readonly Ca65InstructionRow[]) {
    if (row[4] === "PutBitBranch") {
      forms.push(
        Object.freeze({
          opcode: row[2],
          mnemonic: row[0],
          mode: "zeroPageRelative",
          encoding: [row[2]],
          operands: getOperandFields("zero-page-relative8"),
          codec: "zero-page-relative8",
          availableWhen: { allOf: [featureByTable[table]] },
          canonical: true,
          documented: true,
          stability: "documented",
          relativeBaseOffset: 3,
        }),
      );
      continue;
    }
    if (row[4] === "PutPCRel8" || row[4] === "PutPCRel4510") {
      const modeIndex = row[4] === "PutPCRel8" ? 17 : 18;
      const modeDefinition = commonModes[modeIndex];
      if (modeDefinition) forms.push(createForm(table, row, modeIndex, modeDefinition));
      continue;
    }

    const seenModes = new Set<string>();
    for (let modeIndex = 0; modeIndex < 32; modeIndex++) {
      if ((row[1] & (2 ** modeIndex)) === 0) continue;
      // ca65 sets both bits for accumulator instructions; the explicit accumulator
      // form also accepts an omitted A in our native syntax.
      if (modeIndex === 0 && (row[1] & 2) !== 0) continue;
      const modeDefinition = modeFor(table, row, modeIndex);
      if (!modeDefinition) {
        throw new Error(`Unsupported ca65 mode bit ${modeIndex} for ${table} ${row[0]}.`);
      }
      const key = `${modeDefinition.mode}:${modeDefinition.codec ?? ""}`;
      if (seenModes.has(key)) continue;
      seenModes.add(key);
      forms.push(createForm(table, row, modeIndex, modeDefinition));
    }
  }
  return Object.freeze(forms);
}

export const mos6502DtvForms = decodeTable("6502DTV");
export const cmos65sc02Forms = decodeTable("65SC02");
export const cmos65c02Forms = decodeTable("65C02");
export const wdc65c02Forms = decodeTable("W65C02");
export const csg65ce02Forms = decodeTable("65CE02");
export const commodore4510Forms = decodeTable("4510");
export const mega65Gs02Forms = decodeTable("45GS02");
export const hudsonHuC6280Forms = decodeTable("HuC6280");
export const mitsubishiM740Forms = decodeTable("M740");

export const mos6502DtvCpu: CpuDefinition = Object.freeze({
  id: "65xx.6502dtv",
  displayName: "C64DTV 6502",
  aliases: ["6502dtv", "dtv"],
  features: new Set<CpuFeature>(["nmos", "undocumented", "dtv"]),
});

export const cmos65sc02Cpu: CpuDefinition = Object.freeze({
  id: "65xx.65sc02",
  displayName: "65SC02",
  aliases: ["65sc02"],
  features: new Set<CpuFeature>(["cmos"]),
});

export const cmos65c02Cpu: CpuDefinition = Object.freeze({
  id: "65xx.65c02",
  displayName: "65C02 with Rockwell extensions",
  aliases: ["65c02"],
  features: new Set<CpuFeature>(["cmos", "rockwell"]),
});

export const wdc65c02Cpu: CpuDefinition = Object.freeze({
  id: "65xx.w65c02",
  displayName: "WDC W65C02",
  aliases: ["w65c02"],
  features: new Set<CpuFeature>(["cmos", "rockwell", "wdc"]),
});

export const csg65ce02Cpu: CpuDefinition = Object.freeze({
  id: "65xx.65ce02",
  displayName: "CSG 65CE02",
  aliases: ["65ce02"],
  features: new Set<CpuFeature>(["cmos", "rockwell", "ce02"]),
});

export const commodore4510Cpu: CpuDefinition = Object.freeze({
  id: "65xx.4510",
  displayName: "Commodore 4510",
  aliases: ["4510"],
  features: new Set<CpuFeature>(["cmos", "rockwell", "ce02", "4510"]),
});

export const mega65Gs02Cpu: CpuDefinition = Object.freeze({
  id: "65xx.45gs02",
  displayName: "MEGA65 45GS02",
  aliases: ["45gs02"],
  features: new Set<CpuFeature>(["cmos", "rockwell", "ce02", "4510", "45gs02"]),
});

export const hudsonHuC6280Cpu: CpuDefinition = Object.freeze({
  id: "65xx.huc6280",
  displayName: "Hudson HuC6280",
  aliases: ["huc6280", "6280"],
  features: new Set<CpuFeature>(["cmos", "rockwell", "huc6280"]),
});

export const mitsubishiM740Cpu: CpuDefinition = Object.freeze({
  id: "65xx.m740",
  displayName: "Mitsubishi M740",
  aliases: ["m740", "740"],
  features: new Set<CpuFeature>(["m740"]),
});

export const variantCpus = Object.freeze([
  mos6502DtvCpu,
  cmos65sc02Cpu,
  cmos65c02Cpu,
  wdc65c02Cpu,
  csg65ce02Cpu,
  commodore4510Cpu,
  mega65Gs02Cpu,
  hudsonHuC6280Cpu,
  mitsubishiM740Cpu,
]);

export const variantFormsByCpuId: Readonly<Record<string, readonly InstructionForm[]>> =
  Object.freeze({
    [mos6502DtvCpu.id]: mos6502DtvForms,
    [cmos65sc02Cpu.id]: cmos65sc02Forms,
    [cmos65c02Cpu.id]: cmos65c02Forms,
    [wdc65c02Cpu.id]: wdc65c02Forms,
    [csg65ce02Cpu.id]: csg65ce02Forms,
    [commodore4510Cpu.id]: commodore4510Forms,
    [mega65Gs02Cpu.id]: mega65Gs02Forms,
    [hudsonHuC6280Cpu.id]: hudsonHuC6280Forms,
    [mitsubishiM740Cpu.id]: mitsubishiM740Forms,
  });
