/** A bounds-safe, read-only byte source used by architecture decoders. */
export interface DecoderByteSource {
    /** Total number of readable bytes; valid offsets are `0` through `length - 1`. */
    readonly length: number;
    /**
     * Reads one byte without throwing.
     * @param offset Zero-based byte offset into the source.
     * @returns The byte value (0-255), or undefined when the offset is not an in-bounds integer.
     */
    readByte(offset: number): number | undefined;
    /**
     * Reads a contiguous run of bytes without throwing.
     * @param offset Zero-based byte offset of the first byte.
     * @param length Number of bytes to read.
     * @returns A copy of the requested bytes, or undefined when any part of the range is out of bounds.
     */
    readBytes(offset: number, length: number): Uint8Array | undefined;
}
/**
 * Immutable `Uint8Array`-backed decoder input. The constructor copies its
 * input so callers cannot mutate bytes while an analysis is in progress.
 */
export declare class Uint8ArrayDecoderSource implements DecoderByteSource {
    #private;
    /**
     * Copies the provided bytes into private storage.
     * @param bytes Source bytes; values are wrapped modulo 256 by `Uint8Array.from`.
     */
    constructor(bytes: ArrayLike<number>);
    /**
     * The length of the byte source.
     * @returns The length of the byte source.
     */
    get length(): number;
    /**
     * Reads a byte from the byte source.
     * @param offset The offset to read from.
     * @returns The byte at the offset, or undefined if the offset is out of bounds.
     */
    readByte(offset: number): number | undefined;
    /**
     * Reads bytes from the byte source.
     * @param offset The offset to read from.
     * @param length The length to read.
     * @returns The bytes at the offset and length, or undefined if the offset or length is out of bounds.
     */
    readBytes(offset: number, length: number): Uint8Array | undefined;
}
/** Target-neutral metadata shared by editor tooling and architecture decoders. */
export interface ArchitectureInstructionSpecification {
    /** Stable specification identifier, unique within its architecture. */
    readonly id: string;
    /** Architecture identifier that owns this specification. */
    readonly architecture: string;
    /** Leading opcode byte sequence that selects this specification. */
    readonly opcode: readonly number[];
    /** Canonical mnemonic as written in source. */
    readonly mnemonic: string;
    /** Architecture-specific addressing-mode name. */
    readonly mode: string;
    /** Smallest encoded size in bytes, including the opcode. */
    readonly minimumSize: number;
    /** Largest encoded size in bytes; exceeds `minimumSize` when the size depends on CPU state. */
    readonly maximumSize: number;
    /** Short human-readable description for tooling. */
    readonly summary?: string;
}
/** Semantic category of a decoded operand. */
export type DecodedOperandKind = "accumulator" | "address" | "bank" | "bit" | "displacement" | "immediate" | "register" | "signature";
/** One operand extracted from an encoded instruction. */
export interface DecodedOperand {
    /** Semantic category of the operand. */
    readonly kind: DecodedOperandKind;
    /** Raw encoded value; signed when `signed` is true. Absent for implicit operands. */
    readonly value?: number;
    /** Encoded width of `value` in bytes. */
    readonly width?: number;
    /** True when `value` was sign-extended from its encoded width. */
    readonly signed?: boolean;
    /** Register name for register operands. */
    readonly register?: string;
    /** Resolved logical address for relative operands, computed from the instruction end. */
    readonly targetAddress?: number;
}
/** How an instruction refers to another location. */
export type DecodedReferenceKind = "branch" | "call" | "data" | "jump" | "pointer";
/** A code or data location referenced by a decoded instruction. */
export interface DecodedReference {
    /** Control-flow or data relationship to the referenced location. */
    readonly kind: DecodedReferenceKind;
    /** Index into `DecodedInstruction.operands` that supplies the reference. */
    readonly operandIndex?: number;
    /** Logical target address; absent when it cannot be determined statically. */
    readonly address?: number;
    /** True when the target is read through memory or a register at run time. */
    readonly indirect?: boolean;
}
/** Control-flow category of a decoded instruction. */
export type InstructionFlowKind = "call" | "conditionalBranch" | "fallthrough" | "interrupt" | "jump" | "return" | "stop" | "wait";
/** Control-flow summary of a decoded instruction. */
export interface InstructionFlow {
    /** Control-flow category. */
    readonly kind: InstructionFlowKind;
    /** True when execution can continue at the next sequential instruction. */
    readonly fallthrough: boolean;
    /** True when the transfer target is computed at run time. */
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
/** A fully decoded instruction at one source offset. */
export interface DecodedInstruction {
    /** Architecture identifier that decoded the instruction. */
    readonly architecture: string;
    /** `ArchitectureInstructionSpecification.id` that matched. */
    readonly specificationId: string;
    /** Leading opcode byte. */
    readonly opcode: number;
    /** Canonical mnemonic. */
    readonly mnemonic: string;
    /** Architecture-specific addressing-mode name. */
    readonly mode: string;
    /** Byte offset of the instruction within the decoder source. */
    readonly offset: number;
    /** CPU-visible address of the first instruction byte. */
    readonly logicalAddress: number;
    /** Encoded instruction bytes; length equals `size`. */
    readonly bytes: Uint8Array;
    /** Encoded size in bytes. */
    readonly size: number;
    /** Operands in source order. */
    readonly operands: readonly DecodedOperand[];
    /** Code and data locations referenced by the instruction. */
    readonly references: readonly DecodedReference[];
    /** Control-flow summary. */
    readonly flow: InstructionFlow;
    /** State changes applied by executing the instruction. */
    readonly effects: readonly InstructionStateEffect[];
}
/** Input for decoding one instruction. */
export interface ArchitectureDecodeContext<State = unknown> {
    /** Bytes being decoded. */
    readonly source: DecoderByteSource;
    /** Byte offset of the instruction within `source`. */
    readonly offset: number;
    /** CPU-visible address corresponding to `offset`. */
    readonly logicalAddress: number;
    /** Known CPU state; undefined means state-dependent sizes are reported as ambiguous. */
    readonly state?: State;
}
/** Reason an instruction could not be decoded. */
export type ArchitectureDecodeErrorCode = "invalidOpcode" | "invalidState" | "outOfBounds" | "truncated";
/** Successful decode with a single interpretation. */
export interface ArchitectureDecodeInstructionResult {
    /** Discriminant for a single decoded instruction. */
    readonly kind: "instruction";
    /** The decoded instruction. */
    readonly instruction: DecodedInstruction;
}
/** Decode whose size or meaning depends on CPU state that was not supplied. */
export interface ArchitectureDecodeAmbiguousResult {
    /** Discriminant for a state-dependent decode. */
    readonly kind: "ambiguous";
    /** Human-readable explanation of the missing state. */
    readonly reason: string;
    /** Names of the state fields that would disambiguate the decode. */
    readonly requiredState: readonly string[];
    /** Every interpretation whose bytes fit in the source. */
    readonly alternatives: readonly DecodedInstruction[];
    /** Candidate sizes that could not be decoded because the input ended. */
    readonly unavailableAlternatives?: readonly {
        readonly code: "truncated";
        readonly size: number;
        readonly availableBytes: number;
    }[];
    /** Smallest candidate size in bytes. */
    readonly minimumSize: number;
    /** Largest candidate size in bytes. */
    readonly maximumSize: number;
}
/** Failed decode. */
export interface ArchitectureDecodeErrorResult {
    /** Discriminant for a failed decode. */
    readonly kind: "error";
    /** Failure category. */
    readonly code: ArchitectureDecodeErrorCode;
    /** Human-readable failure description. */
    readonly message: string;
    /** Byte offset at which decoding was attempted. */
    readonly offset: number;
    /** Bytes needed to decode the instruction, for truncated input. */
    readonly requiredBytes?: number;
    /** Bytes remaining in the source from `offset`, for truncated input. */
    readonly availableBytes?: number;
}
/** Outcome of decoding one instruction. */
export type ArchitectureDecodeResult = ArchitectureDecodeInstructionResult | ArchitectureDecodeAmbiguousResult | ArchitectureDecodeErrorResult;
/** Decodes single instructions for one architecture. */
export interface ArchitectureDecoder<State = unknown> {
    /**
     * Decodes the instruction at `context.offset` without throwing for malformed input.
     * @param context Source bytes, position and optional CPU state.
     * @returns The instruction, an ambiguous result listing alternatives, or an error.
     */
    decode(context: ArchitectureDecodeContext<State>): ArchitectureDecodeResult;
}
//# sourceMappingURL=decoder-types.d.ts.map