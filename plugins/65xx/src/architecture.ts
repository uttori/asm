import type {
  ArchitectureEncoder,
  ArchitectureEncoderContext,
  InstructionDescriptor,
  LoweredInstruction,
  LoweredOperand,
} from "@uttori/asm-core";

/**
 * Table-driven 65xx encoder. Forms come from the NMOS grid or ca65-derived
 * variant tables; `.b`/`.w` force zp vs abs; branches use `+`/`-` unnamed labels.
 */

import { buildInstructionCatalog } from "./instructions/catalog.js";
import { getCpuAssemblyForms, nmos6502DecodeTable } from "./instructions/opcodes.js";
import {
  matchesFeatures,
  type AddressingMode,
  type CpuDefinition,
  type InstructionForm,
} from "./instructions/schema.js";
import { variantFormsByCpuId } from "./instructions/variants.js";

/** `.w` / inferred-abs: promote zp forms to their 16-bit twins. */
const directToAbsolute: Readonly<Partial<Record<AddressingMode, AddressingMode>>> = {
  zeroPage: "absolute",
  zeroPageIndexedX: "absoluteIndexedX",
  zeroPageIndexedY: "absoluteIndexedY",
  zeroPageIndirect: "indirect",
  indexedIndirectX: "absoluteIndexedIndirect",
};
/** `.b`: demote abs forms. Missing twins (e.g. no `STX abs,y`) error at resolve. */
const absoluteToDirect: Readonly<Partial<Record<AddressingMode, AddressingMode>>> = {
  absolute: "zeroPage",
  absoluteIndexedX: "zeroPageIndexedX",
  absoluteIndexedY: "zeroPageIndexedY",
  indirect: "zeroPageIndirect",
  absoluteIndexedIndirect: "indexedIndirectX",
};

const aliasToMnemonic = new Map<string, string>();
for (const form of nmos6502DecodeTable) {
  for (const alias of form.aliases ?? []) aliasToMnemonic.set(alias, form.mnemonic);
}

interface ParsedMnemonic {
  readonly mnemonic: string;
  readonly forcedWidth?: 1 | 2;
}

/**
 * Parses a mnemonic with optional width suffix.
 * `LDA.B` / `STA.W` - ca65-style width force. `.L` is not a 65xx suffix here.
 * @param {string} value The mnemonic to parse.
 * @returns {ParsedMnemonic} The parsed mnemonic.
 */
function parseMnemonic(value: string): ParsedMnemonic {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^([A-Z][\dA-Z]{2,4})(?:\.([BW]))?$/);
  if (!match) return { mnemonic: value.trim().toUpperCase() };
  let forcedWidth: 1 | 2 | undefined;
  if (match[2] === "B") forcedWidth = 1;
  else if (match[2] === "W") forcedWidth = 2;
  return {
    mnemonic: match[1],
    forcedWidth,
  };
}

/**
 * Calculates the size of an instruction in bytes.
 * @param {InstructionForm} form The instruction form.
 * @returns {number} The size of the instruction in bytes.
 */
function modeSize(form: InstructionForm): number {
  return form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0);
}

/**
 * Normalizes a relative delta to a signed 16-bit value.
 * Sign-extend a 16-bit wrapping subtraction so 8-bit branches can range-check.
 * @param {number} target The target address.
 * @param {number} reference The reference address.
 * @returns {number} The normalized relative delta.
 */
function normalizeRelativeDelta(target: number, reference: number): number {
  return ((target - reference + 0x8000) & 0xffff) - 0x8000;
}

/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling; the live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export function materializeOpcodeForm(
  form: InstructionForm,
  operandBytes: readonly number[] = [],
): Uint8Array {
  const expected = form.operands.reduce((size, operand) => size + operand.width, 0);
  if (operandBytes.length !== expected) {
    throw new Error(
      `${form.mnemonic} ${form.mode} expects ${expected} encoded operand byte(s), got ${operandBytes.length}.`,
    );
  }
  for (const byte of operandBytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new RangeError(`Encoded operand byte ${byte} is outside the byte range.`);
    }
  }
  return Uint8Array.from([...form.encoding, ...operandBytes]);
}

/**
 * Splits top-level operands in a string.
 * BBR/BBS `zp,target` - do not split on commas inside `(…)` or `[…]`.
 * @param {string} value The string to split.
 * @returns {string[]} The split operands.
 */
function splitTopLevelOperands(value: string): string[] {
  const operands: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    else if (character === "," && depth === 0) {
      operands.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  operands.push(value.slice(start).trim());
  return operands.filter(Boolean);
}

/**
 * Table-driven encoder for one {@link CpuDefinition}. Unknown mnemonics that
 * exist only on another CPU get a targeted diagnostic; truly unknown ops
 * return false so the assembler can try the next architecture.
 */
export class Arch65xx implements ArchitectureEncoder {
  readonly forms: readonly InstructionForm[];
  readonly catalog: InstructionDescriptor[];
  readonly formsByMnemonic = new Map<string, readonly InstructionForm[]>();

  /**
   * @param {ArchitectureEncoderContext} context Encoder host (operands, emission, diagnostics).
   * @param {CpuDefinition} cpu CPU whose feature set filters {@link getCpuAssemblyForms}.
   */
  constructor(
    readonly context: ArchitectureEncoderContext,
    readonly cpu: CpuDefinition,
  ) {
    this.forms = getCpuAssemblyForms(cpu).filter((form) =>
      matchesFeatures(form.availableWhen, cpu.features),
    );
    this.catalog = buildInstructionCatalog(this.forms);
    const grouped = new Map<string, InstructionForm[]>();
    for (const form of this.forms) {
      const entries = grouped.get(form.mnemonic) ?? [];
      entries.push(form);
      grouped.set(form.mnemonic, entries);
    }
    for (const [mnemonic, entries] of grouped) this.formsByMnemonic.set(mnemonic, entries);
  }

  getInstructionCatalog(): InstructionDescriptor[] {
    return this.catalog;
  }

  /**
   * Estimates size from tokenized words.
   * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
   * @returns {number} Encoded size in bytes, or 0 if unknown.
   */
  estimateSize(words: readonly string[]): number {
    if (words.length === 0) return 0;
    const operand = words.slice(1).join(" ");
    return this.estimateResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
  }

  /**
   * Encodes tokenized words. Returns false when the mnemonic is unknown on this CPU.
   * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
   * @returns {boolean} True if encoded.
   */
  encode(words: readonly string[]): boolean {
    if (words.length === 0) return true;
    const operand = words.slice(1).join(" ");
    return this.encodeResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
  }

  estimateInstruction(instruction: LoweredInstruction): number {
    return this.estimateResolved(instruction.mnemonic, instruction.loweredOperand);
  }

  encodeInstruction(instruction: LoweredInstruction): boolean {
    return this.encodeResolved(instruction.mnemonic, instruction.loweredOperand);
  }

  private estimateResolved(rawMnemonic: string, operand: LoweredOperand): number {
    const resolved = this.resolveForm(rawMnemonic, operand);
    return resolved ? modeSize(resolved) : 0;
  }

  private encodeResolved(rawMnemonic: string, operand: LoweredOperand): boolean {
    const resolved = this.resolveForm(rawMnemonic, operand);
    if (!resolved) return false;
    const form = resolved;
    const relativeBaseOffset = form.relativeBaseOffset ?? modeSize(form);
    const branchDelta =
      form.codec === "relative8" || form.codec === "relative16"
        ? this.readBranchDelta(operand, relativeBaseOffset, form.codec === "relative8" ? 1 : 2)
        : 0;
    const compoundOperands =
      form.codec === "zero-page-relative8" ? splitTopLevelOperands(operand.expanded) : [];
    if (form.codec === "zero-page-relative8" && compoundOperands.length !== 2) {
      throw this.context.diagnostics.error(
        `${form.mnemonic} expects a zero-page address and branch target.`,
      );
    }
    const compoundBranchDelta =
      form.codec === "zero-page-relative8"
        ? this.readBranchExpression(
            compoundOperands[1] ?? "",
            form.relativeBaseOffset ?? modeSize(form),
            1,
          )
        : 0;
    this.context.emission.writeBytes(form.encoding);
    switch (form.codec) {
      case "none":
        return true;
      case "unsigned8":
        this.context.emission.writeByte(this.readValue(operand, 1, `${form.mnemonic} operand`));
        return true;
      case "unsigned16-le":
        this.context.emission.writeValue(
          this.readValue(operand, 2, `${form.mnemonic} address`),
          2,
          "little",
        );
        return true;
      case "unsigned24-le":
        this.context.emission.writeValue(
          this.readValue(operand, 3, `${form.mnemonic} address`),
          3,
          "little",
        );
        return true;
      case "relative8":
        this.context.emission.writeByte(branchDelta & 0xff);
        return true;
      case "relative16":
        this.context.emission.writeValue(branchDelta & 0xffff, 2, "little");
        return true;
      case "zero-page-relative8": {
        this.context.emission.writeByte(
          this.readExpressionValue(compoundOperands[0] ?? "", 1, `${form.mnemonic} address`, false),
        );
        this.context.emission.writeByte(compoundBranchDelta & 0xff);
        return true;
      }
    }
    return false;
  }

  private resolveForm(rawMnemonic: string, operand: LoweredOperand): InstructionForm | undefined {
    const parsed = parseMnemonic(rawMnemonic);
    let mnemonic = parsed.mnemonic;
    let forms = this.formsByMnemonic.get(mnemonic);
    const variantArchitectures = Object.entries(variantFormsByCpuId)
      .filter(([, entries]) => entries.some((entry) => entry.mnemonic === parsed.mnemonic))
      .map(([cpuId]) => cpuId);
    if (!forms) {
      const canonical = aliasToMnemonic.get(mnemonic);
      const aliasedForms = canonical ? this.formsByMnemonic.get(canonical) : undefined;
      if (canonical && aliasedForms) {
        mnemonic = canonical;
        forms = aliasedForms;
      }
    }
    const { forcedWidth } = parsed;
    if (!forms) {
      // Wrong-CPU diagnostics: "this mnemonic exists on 65c02, not 6502"
      // vs unofficial-only "needs 65xx.6502x".
      if (variantArchitectures.length > 0) {
        throw this.context.diagnostics.error(
          `Instruction '${parsed.mnemonic}' is available on ${variantArchitectures.join(", ")}, not ${this.cpu.id}.`,
        );
      }
      const knownOnlyOn6502x = nmos6502DecodeTable.some(
        (form) => form.mnemonic === mnemonic || form.aliases?.includes(mnemonic),
      );
      if (knownOnlyOn6502x) {
        throw this.context.diagnostics.error(
          `Instruction '${mnemonic}' or this operand form requires architecture '65xx.6502x'.`,
        );
      }
      return undefined;
    }

    const hasOperand = operand.raw.trim() !== "";
    if (mnemonic === "BRK" && forcedWidth === 2)
      throw this.context.diagnostics.error("BRK accepts at most an 8-bit signature byte.");

    let mode = operand.mode as AddressingMode | undefined;
    if (operand.raw.trim().toUpperCase() === "A") mode = "accumulator";
    if (operand.raw.trim().toUpperCase() === "Q") mode = "quadAccumulator";
    // Branches: any operand is a target; don't treat `$12` as zp.
    if (hasOperand && forms.some((entry) => entry.mode === "relative16")) mode = "relative16";
    else if (hasOperand && forms.some((entry) => entry.mode === "relative")) mode = "relative";
    if (!hasOperand && !forms.some((entry) => entry.mode === "implied")) {
      if (forms.some((entry) => entry.mode === "accumulator")) mode = "accumulator";
      else if (forms.some((entry) => entry.mode === "quadAccumulator")) mode = "quadAccumulator";
    }

    if (forcedWidth) {
      const byteMode = mode ? absoluteToDirect[mode] : undefined;
      const wordMode = mode ? directToAbsolute[mode] : undefined;
      const alreadyRequestedWidth =
        (forcedWidth === 1 && mode?.startsWith("zeroPage")) ||
        (forcedWidth === 2 &&
          (mode === "absolute" || mode === "indirect" || mode?.startsWith("absoluteIndexed")));
      if (!byteMode && !wordMode && !alreadyRequestedWidth) {
        throw this.context.diagnostics.error(
          `Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode}.`,
        );
      }
      mode =
        forcedWidth === 1 ? (absoluteToDirect[mode!] ?? mode) : (directToAbsolute[mode!] ?? mode);
    }

    let form = forms.find((entry) => entry.mode === mode);
    if (!form && mode && directToAbsolute[mode]) {
      form = forms.find((entry) => entry.mode === directToAbsolute[mode]);
    }
    if (!form) {
      const accepted = forms.map((entry) => entry.mode).join(", ");
      throw this.context.diagnostics.error(
        `${mnemonic} does not support addressing mode '${mode ?? "unknown"}' on ${this.cpu.id}; expected ${accepted}.`,
      );
    }
    return form;
  }

  private readValue(operand: LoweredOperand, width: 1 | 2 | 3, description: string): number {
    const expression = operand.baseExpression ?? operand.expanded;
    return this.readExpressionValue(expression, width, description, operand.mode === "immediate");
  }

  private readExpressionValue(
    expression: string,
    width: 1 | 2 | 3,
    description: string,
    immediate: boolean,
  ): number {
    const value = this.context.operands.getnum(expression);
    const minimum = width === 1 && immediate ? -128 : 0;
    let maximum = 0xff;
    if (width === 2) maximum = 0xffff;
    else if (width === 3) maximum = 0xffffff;
    // Immediate `#-1` is allowed for 8-bit (signed); addresses stay unsigned.
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw this.context.diagnostics.error(
        `${description} ${value} is outside the ${width * 8}-bit range.`,
      );
    }
    return value & maximum;
  }

  private readBranchDelta(
    operand: LoweredOperand,
    relativeBaseOffset: number,
    width: 1 | 2,
  ): number {
    return this.readBranchExpression(
      operand.baseExpression ?? operand.expanded,
      relativeBaseOffset,
      width,
    );
  }

  private readBranchExpression(
    expression: string,
    relativeBaseOffset: number,
    width: 1 | 2,
  ): number {
    if (!this.context.branches.enforceResolvedLabels()) return 0;
    const reference = (this.context.sizing.getCurrentAddress() + relativeBaseOffset) & 0xffff;
    let target: number;
    // Unnamed labels: `+` / `++` forward, `-` / `--` backward (ca65 / native).
    if (/^\++$/.test(expression)) {
      target = this.context.branches.findNextLabel(expression, reference);
    } else if (/^-+$/.test(expression)) {
      target = this.context.branches.findPreviousLabel(expression, reference);
    } else {
      target = this.context.operands.getnum(expression);
    }
    if (!Number.isInteger(target) || target < 0 || target > 0xffff) {
      throw this.context.diagnostics.error(
        `Branch target ${target} is outside the 16-bit address space.`,
      );
    }
    const delta = normalizeRelativeDelta(target, reference);
    const minimum = width === 1 ? -128 : -32768;
    const maximum = width === 1 ? 127 : 32767;
    if (delta < minimum || delta > maximum) {
      throw this.context.diagnostics.error(
        `Branch target $${target.toString(16).toUpperCase()} is out of range from $${reference.toString(16).toUpperCase()} (${delta}).`,
      );
    }
    return delta;
  }
}
