/** A bounds-safe, read-only byte source used by architecture decoders. */
export interface DecoderByteSource {
    readonly length: number;
    readByte(offset: number): number | undefined;
    readBytes(offset: number, length: number): Uint8Array | undefined;
}
/**
 * Immutable `Uint8Array`-backed decoder input. The constructor copies its
 * input so callers cannot mutate bytes while an analysis is in progress.
 */
export declare class Uint8ArrayDecoderSource implements DecoderByteSource {
    #private;
    constructor(bytes: ArrayLike<number>);
    /**
     * The length of the byte source.
     * @returns {number} The length of the byte source.
     */
    get length(): number;
    /**
     * Reads a byte from the byte source.
     * @param {number} offset The offset to read from.
     * @returns {number | undefined} The byte at the offset, or undefined if the offset is out of bounds.
     */
    readByte(offset: number): number | undefined;
    /**
     * Reads bytes from the byte source.
     * @param {number} offset The offset to read from.
     * @param {number} length The length to read.
     * @returns {Uint8Array | undefined} The bytes at the offset and length, or undefined if the offset or length is out of bounds.
     */
    readBytes(offset: number, length: number): Uint8Array | undefined;
}
/** Target-neutral metadata shared by editor tooling and architecture decoders. */
export interface ArchitectureInstructionSpecification {
    readonly id: string;
    readonly architecture: string;
    readonly opcode: readonly number[];
    readonly mnemonic: string;
    readonly mode: string;
    readonly minimumSize: number;
    readonly maximumSize: number;
    readonly summary?: string;
}
export type DecodedOperandKind = "accumulator" | "address" | "bank" | "bit" | "displacement" | "immediate" | "register" | "signature";
export interface DecodedOperand {
    readonly kind: DecodedOperandKind;
    readonly value?: number;
    readonly width?: number;
    readonly signed?: boolean;
    readonly register?: string;
    readonly targetAddress?: number;
}
export type DecodedReferenceKind = "branch" | "call" | "data" | "jump" | "pointer";
export interface DecodedReference {
    readonly kind: DecodedReferenceKind;
    readonly operandIndex?: number;
    readonly address?: number;
    readonly indirect?: boolean;
}
export type InstructionFlowKind = "call" | "conditionalBranch" | "fallthrough" | "interrupt" | "jump" | "return" | "stop" | "wait";
export interface InstructionFlow {
    readonly kind: InstructionFlowKind;
    readonly fallthrough: boolean;
    readonly indirect?: boolean;
}
/** Architecture-neutral state effects useful to tracers and data-flow analysis. */
export type InstructionStateEffect = {
    readonly kind: "clearBits";
    readonly target: string;
    readonly mask: number;
} | {
    readonly kind: "setBits";
    readonly target: string;
    readonly mask: number;
} | {
    readonly kind: "copy";
    readonly from: string;
    readonly to: string;
} | {
    readonly kind: "exchange";
    readonly left: string;
    readonly right: string;
} | {
    readonly kind: "push";
    readonly source: string;
} | {
    readonly kind: "pull";
    readonly target: string;
} | {
    readonly kind: "unknown";
    readonly target: string;
} | {
    readonly kind: "custom";
    readonly name: string;
    readonly details?: Readonly<Record<string, unknown>>;
};
export interface DecodedInstruction {
    readonly architecture: string;
    readonly specificationId: string;
    readonly opcode: number;
    readonly mnemonic: string;
    readonly mode: string;
    readonly offset: number;
    readonly logicalAddress: number;
    readonly bytes: Uint8Array;
    readonly size: number;
    readonly operands: readonly DecodedOperand[];
    readonly references: readonly DecodedReference[];
    readonly flow: InstructionFlow;
    readonly effects: readonly InstructionStateEffect[];
}
export interface ArchitectureDecodeContext<State = unknown> {
    readonly source: DecoderByteSource;
    readonly offset: number;
    readonly logicalAddress: number;
    readonly state?: State;
}
export type ArchitectureDecodeErrorCode = "invalidOpcode" | "invalidState" | "outOfBounds" | "truncated";
export interface ArchitectureDecodeInstructionResult {
    readonly kind: "instruction";
    readonly instruction: DecodedInstruction;
}
export interface ArchitectureDecodeAmbiguousResult {
    readonly kind: "ambiguous";
    readonly reason: string;
    readonly requiredState: readonly string[];
    readonly alternatives: readonly DecodedInstruction[];
    /** Candidate sizes that could not be decoded because the input ended. */
    readonly unavailableAlternatives?: readonly {
        readonly code: "truncated";
        readonly size: number;
        readonly availableBytes: number;
    }[];
    readonly minimumSize: number;
    readonly maximumSize: number;
}
export interface ArchitectureDecodeErrorResult {
    readonly kind: "error";
    readonly code: ArchitectureDecodeErrorCode;
    readonly message: string;
    readonly offset: number;
    readonly requiredBytes?: number;
    readonly availableBytes?: number;
}
export type ArchitectureDecodeResult = ArchitectureDecodeInstructionResult | ArchitectureDecodeAmbiguousResult | ArchitectureDecodeErrorResult;
export interface ArchitectureDecoder<State = unknown> {
    decode(context: ArchitectureDecodeContext<State>): ArchitectureDecodeResult;
}
//# sourceMappingURL=decoder-types.d.ts.map