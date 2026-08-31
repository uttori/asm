/** Feature flags used by {@link FeatureExpression} to select instruction forms. */
export type CpuFeature = "nmos" | "undocumented" | "dtv" | "cmos" | "rockwell" | "wdc" | "ce02" | "4510" | "45gs02" | "huc6280" | "m740";
/** Addressing modes recognized by the 65xx classifier and encoder. */
export type AddressingMode = "implied" | "accumulator" | "immediate" | "zeroPage" | "zeroPageIndexedX" | "zeroPageIndexedY" | "absolute" | "absoluteIndexedX" | "absoluteIndexedY" | "absoluteLongIndexedX" | "indirect" | "zeroPageIndirect" | "zeroPageIndirectLong" | "indexedIndirectX" | "indirectIndexedY" | "absoluteIndexedIndirect" | "zeroPageIndirectIndexedZ" | "stackRelative" | "stackRelativeIndirectIndexedY" | "relative" | "relative16" | "zeroPageRelative" | "accumulatorRelative" | "zeroPageImmediate" | "specialPage" | "blockTransfer" | "immediateZeroPage" | "immediateZeroPageIndexedX" | "immediateAbsolute" | "immediateAbsoluteIndexedX" | "basePageIndirectIndexedZ" | "quadAccumulator";
/** How operand bytes are written after the opcode (and any prefixes). */
export type OperandCodecId = "none" | "unsigned8" | "unsigned16-le" | "unsigned24-le" | "relative8" | "relative16" | "zero-page-relative8" | "accumulator-relative8" | "zero-page-immediate8" | "special-page" | "three-unsigned16-le" | "immediate-unsigned8" | "immediate-unsigned16";
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
    /** Optional declarative validation for irregular immediate operands. */
    readonly operandConstraint?: "power-of-two";
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
export declare function matchesFeatures(expression: FeatureExpression, features: ReadonlySet<CpuFeature>): boolean;
/**
 * Default codec for a mode. Immediate/zp/stack-relative collapse to `unsigned8`;
 * 24-bit `absoluteLongIndexedX` is the MEGA65/4510 long-x form.
 *
 * @param {AddressingMode} mode Addressing mode.
 * @returns {OperandCodecId} Operand codec id.
 */
export declare function getOperandCodec(mode: AddressingMode): OperandCodecId;
/**
 * Operand field list for a codec. `zero-page-relative8` is BBR/BBS: zp then rel8.
 *
 * @param {OperandCodecId} codec Operand codec.
 * @returns {readonly OperandField[]} Field descriptors in emit order.
 */
export declare function getOperandFields(codec: OperandCodecId): readonly OperandField[];
//# sourceMappingURL=schema.d.ts.map