export type CpuFeature = "nmos" | "undocumented" | "dtv" | "cmos" | "rockwell" | "wdc" | "ce02" | "4510" | "45gs02";
export type AddressingMode = "implied" | "accumulator" | "immediate" | "zeroPage" | "zeroPageIndexedX" | "zeroPageIndexedY" | "absolute" | "absoluteIndexedX" | "absoluteIndexedY" | "absoluteLongIndexedX" | "indirect" | "zeroPageIndirect" | "zeroPageIndirectLong" | "indexedIndirectX" | "indirectIndexedY" | "absoluteIndexedIndirect" | "zeroPageIndirectIndexedZ" | "stackRelative" | "stackRelativeIndirectIndexedY" | "relative" | "relative16" | "zeroPageRelative" | "basePageIndirectIndexedZ" | "quadAccumulator";
export type OperandCodecId = "none" | "unsigned8" | "unsigned16-le" | "unsigned24-le" | "relative8" | "relative16" | "zero-page-relative8";
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
export declare function matchesFeatures(expression: FeatureExpression, features: ReadonlySet<CpuFeature>): boolean;
export declare function getOperandCodec(mode: AddressingMode): OperandCodecId;
export declare function getOperandFields(codec: OperandCodecId): readonly OperandField[];
//# sourceMappingURL=schema.d.ts.map