/** Feature flags used by {@link FeatureExpression} to select instruction forms. */
export type CpuFeature =
  | "nmos"
  | "undocumented"
  | "dtv"
  | "cmos"
  | "rockwell"
  | "wdc"
  | "ce02"
  | "4510"
  | "45gs02"
  | "huc6280"
  | "m740";

/** Addressing modes recognized by the 65xx classifier and encoder. */
export type AddressingMode =
  | "implied"
  | "accumulator"
  | "immediate"
  | "zeroPage"
  | "zeroPageIndexedX"
  | "zeroPageIndexedY"
  | "absolute"
  | "absoluteIndexedX"
  | "absoluteIndexedY"
  | "absoluteLongIndexedX"
  | "indirect"
  | "zeroPageIndirect"
  | "zeroPageIndirectLong"
  | "indexedIndirectX"
  | "indirectIndexedY"
  | "absoluteIndexedIndirect"
  | "zeroPageIndirectIndexedZ"
  | "stackRelative"
  | "stackRelativeIndirectIndexedY"
  | "relative"
  | "relative16"
  | "zeroPageRelative"
  | "accumulatorRelative"
  | "zeroPageImmediate"
  | "specialPage"
  | "blockTransfer"
  | "immediateZeroPage"
  | "immediateZeroPageIndexedX"
  | "immediateAbsolute"
  | "immediateAbsoluteIndexedX"
  | "basePageIndirectIndexedZ"
  | "quadAccumulator";

/** How operand bytes are written after the opcode (and any prefixes). */
export type OperandCodecId =
  | "none"
  | "unsigned8"
  | "unsigned16-le"
  | "unsigned24-le"
  | "relative8"
  | "relative16"
  | "zero-page-relative8"
  | "accumulator-relative8"
  | "zero-page-immediate8"
  | "special-page"
  | "three-unsigned16-le"
  | "immediate-unsigned8"
  | "immediate-unsigned16";

/**
 * Boolean combination of {@link CpuFeature}s. Empty `anyOf` is treated as
 * "no restriction". `allOf`/`noneOf` are vacuously true when omitted.
 */
export interface FeatureExpression {
  /** Every listed feature must be present. */
  readonly allOf?: readonly CpuFeature[];
  /** At least one listed feature must be present; empty or omitted means no restriction. */
  readonly anyOf?: readonly CpuFeature[];
  /** None of the listed features may be present. */
  readonly noneOf?: readonly CpuFeature[];
}

/** One encoded operand field (immediate, address, or relative target). */
export interface OperandField {
  /** Field role such as `value` or `target`. */
  readonly name: string;
  /** Encoded width in bytes. */
  readonly width: 1 | 2 | 3;
  /** True when the encoded value is two's-complement. */
  readonly signed?: boolean;
  /** True when the value is a displacement from the form's relative base rather than an absolute value. */
  readonly relative?: boolean;
}

/**
 * One assemblable (or decodable) instruction encoding.
 * `encoding` may include MEGA65 prefixes (`42 42`, `EA`) before the opcode byte.
 */
export interface InstructionForm {
  /** Opcode byte, excluding any prefix bytes in `encoding`. */
  readonly opcode: number;
  /** Uppercase mnemonic. */
  readonly mnemonic: string;
  /** Alternate uppercase mnemonics accepted for the same encoding. */
  readonly aliases?: readonly string[];
  /** Addressing mode selected by operand syntax. */
  readonly mode: AddressingMode;
  /** Prefix and opcode bytes written before the operand fields. */
  readonly encoding: readonly number[];
  /** Operand fields in encoded order. */
  readonly operands: readonly OperandField[];
  /** Codec that writes the operand fields. */
  readonly codec: OperandCodecId;
  /** CPU features required for this form to be available. */
  readonly availableWhen: FeatureExpression;
  /** True for the form preferred when assembling; duplicate encodings of the same mnemonic and mode are decode-only. */
  readonly canonical: boolean;
  /** True for officially documented encodings. */
  readonly documented: boolean;
  /** Hardware reliability of the encoding; unstable forms are chip-dependent. */
  readonly stability: "documented" | "stable-undocumented" | "unstable-undocumented";
  /** Hardware or compatibility caveat surfaced in tooling. */
  readonly note?: string;
  /** Optional declarative validation for irregular immediate operands. */
  readonly operandConstraint?: "power-of-two";
  /** Bytes from the opcode address to the relative reference point. Defaults to instruction size. */
  readonly relativeBaseOffset?: number;
}

/** A 65xx CPU variant: id, aliases, and the feature set that unlocks forms. */
export interface CpuDefinition {
  /** Canonical architecture id such as `65xx.6502`. */
  readonly id: string;
  /** Human-readable CPU name. */
  readonly displayName: string;
  /** Lowercase CPU names accepted for selection. */
  readonly aliases: readonly string[];
  /** Features that gate which instruction forms are available. */
  readonly features: ReadonlySet<CpuFeature>;
}

/**
 * Returns whether `features` satisfy `expression`.
 *
 * @param expression Required / forbidden feature sets.
 * @param features CPU feature set.
 * @returns True when the form is available on this CPU.
 */
export function matchesFeatures(
  expression: FeatureExpression,
  features: ReadonlySet<CpuFeature>,
): boolean {
  if (expression.allOf?.some((feature) => !features.has(feature))) {
    return false;
  }
  if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) {
    return false;
  }
  if (expression.noneOf?.some((feature) => features.has(feature))) {
    return false;
  }
  return true;
}

/**
 * Default codec for a mode. Immediate/zp/stack-relative collapse to `unsigned8`.
 * 24-bit `absoluteLongIndexedX` is the MEGA65/4510 long-x form.
 *
 * @param mode Addressing mode.
 * @returns Operand codec id.
 */
export function getOperandCodec(mode: AddressingMode): OperandCodecId {
  switch (mode) {
    case "implied":
    case "accumulator":
    case "quadAccumulator":
      return "none";
    case "absolute":
    case "absoluteIndexedX":
    case "absoluteIndexedY":
    case "indirect":
    case "absoluteIndexedIndirect":
      return "unsigned16-le";
    case "absoluteLongIndexedX":
      return "unsigned24-le";
    case "relative":
      return "relative8";
    case "relative16":
      return "relative16";
    case "zeroPageRelative":
      return "zero-page-relative8";
    case "accumulatorRelative":
      return "accumulator-relative8";
    case "zeroPageImmediate":
      return "zero-page-immediate8";
    case "specialPage":
      return "special-page";
    case "blockTransfer":
      return "three-unsigned16-le";
    case "immediateZeroPage":
    case "immediateZeroPageIndexedX":
      return "immediate-unsigned8";
    case "immediateAbsolute":
    case "immediateAbsoluteIndexedX":
      return "immediate-unsigned16";
    case "immediate":
    case "zeroPage":
    case "zeroPageIndexedX":
    case "zeroPageIndexedY":
    case "zeroPageIndirect":
    case "zeroPageIndirectLong":
    case "indexedIndirectX":
    case "indirectIndexedY":
    case "zeroPageIndirectIndexedZ":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
    case "basePageIndirectIndexedZ":
      return "unsigned8";
  }
  const leftover: never = mode;
  throw new Error(`Unsupported addressing mode: ${String(leftover)}`);
}

/**
 * Operand field list for a codec. `zero-page-relative8` is BBR/BBS: zp then rel8.
 *
 * @param codec Operand codec.
 * @returns Field descriptors in emit order.
 */
export function getOperandFields(codec: OperandCodecId): readonly OperandField[] {
  switch (codec) {
    case "none":
      return [];
    case "unsigned16-le":
      return [{ name: "address", width: 2 }];
    case "unsigned24-le":
      return [{ name: "address", width: 3 }];
    case "relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "relative16":
      return [{ name: "target", width: 2, signed: true, relative: true }];
    case "zero-page-relative8":
      return [
        { name: "address", width: 1 },
        { name: "target", width: 1, signed: true, relative: true },
      ];
    case "accumulator-relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "zero-page-immediate8":
      return [
        { name: "address", width: 1 },
        { name: "value", width: 1 },
      ];
    case "special-page":
      return [{ name: "address", width: 1 }];
    case "three-unsigned16-le":
      return [
        { name: "source", width: 2 },
        { name: "destination", width: 2 },
        { name: "length", width: 2 },
      ];
    case "immediate-unsigned8":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 1 },
      ];
    case "immediate-unsigned16":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 2 },
      ];
    case "unsigned8":
      return [{ name: "value", width: 1 }];
  }
  return [];
}
