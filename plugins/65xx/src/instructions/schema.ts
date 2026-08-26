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

export type OperandCodecId =
  | "none"
  | "unsigned8"
  | "unsigned16-le"
  | "unsigned24-le"
  | "relative8"
  | "relative16"
  | "zero-page-relative8";

export interface FeatureExpression {
  readonly allOf?: readonly CpuFeature[];
  readonly anyOf?: readonly CpuFeature[];
  readonly noneOf?: readonly CpuFeature[];
}

export interface OperandField {
  readonly name: string;
  readonly width: 1 | 2 | 3;
  readonly signed?: boolean;
  readonly relative?: boolean;
}

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

export interface CpuDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly features: ReadonlySet<CpuFeature>;
}

export function matchesFeatures(
  expression: FeatureExpression,
  features: ReadonlySet<CpuFeature>,
): boolean {
  if (expression.allOf?.some((feature) => !features.has(feature))) return false;
  if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) return false;
  if (expression.noneOf?.some((feature) => features.has(feature))) return false;
  return true;
}

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
