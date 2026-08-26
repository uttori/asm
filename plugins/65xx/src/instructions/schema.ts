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
  | "45gs02";

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
  | "zero-page-relative8";

/**
 * Boolean combination of {@link CpuFeature}s. Empty `anyOf` is treated as
 * "no restriction"; `allOf`/`noneOf` are vacuously true when omitted.
 */
export interface FeatureExpression {
  readonly allOf?: readonly CpuFeature[];
  readonly anyOf?: readonly CpuFeature[];
  readonly noneOf?: readonly CpuFeature[];
}

/** One encoded operand field (immediate, address, or relative target). */
export interface OperandField {
  readonly name: string;
  readonly width: 1 | 2 | 3;
  readonly signed?: boolean;
  readonly relative?: boolean;
}

/**
 * One assemblable (or decodable) instruction encoding.
 * `encoding` may include MEGA65 prefixes (`42 42`, `EA`) before the opcode byte.
 */
export interface InstructionForm {
  readonly opcode: number;
  readonly mnemonic: string;
  readonly aliases?: readonly string[];
  readonly mode: AddressingMode;
  readonly encoding: readonly number[];
  readonly operands: readonly OperandField[];
  readonly codec: OperandCodecId;
  readonly availableWhen: FeatureExpression;
  readonly canonical: boolean;
  readonly documented: boolean;
  readonly stability: "documented" | "stable-undocumented" | "unstable-undocumented";
  readonly note?: string;
  /** Bytes from the opcode address to the relative reference point. Defaults to instruction size. */
  readonly relativeBaseOffset?: number;
}

/** A 65xx CPU variant: id, aliases, and the feature set that unlocks forms. */
export interface CpuDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly features: ReadonlySet<CpuFeature>;
}

/**
 * Returns whether `features` satisfy `expression`.
 *
 * @param {FeatureExpression} expression Required / forbidden feature sets.
 * @param {ReadonlySet<CpuFeature>} features CPU feature set.
 * @returns {boolean} True when the form is available on this CPU.
 */
export function matchesFeatures(
  expression: FeatureExpression,
  features: ReadonlySet<CpuFeature>,
): boolean {
  if (expression.allOf?.some((feature) => !features.has(feature))) return false;
  if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) return false;
  if (expression.noneOf?.some((feature) => features.has(feature))) return false;
  return true;
}

/**
 * Default codec for a mode. Immediate/zp/stack-relative collapse to `unsigned8`;
 * 24-bit `absoluteLongIndexedX` is the MEGA65/4510 long-x form.
 *
 * @param {AddressingMode} mode Addressing mode.
 * @returns {OperandCodecId} Operand codec id.
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
    default:
      return "unsigned8";
  }
}

/**
 * Operand field list for a codec. `zero-page-relative8` is BBR/BBS: zp then rel8.
 *
 * @param {OperandCodecId} codec Operand codec.
 * @returns {readonly OperandField[]} Field descriptors in emit order.
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
    case "unsigned8":
      return [{ name: "value", width: 1 }];
  }
  return [];
}
