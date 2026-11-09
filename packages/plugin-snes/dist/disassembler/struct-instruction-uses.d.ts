import type { DecodedInstruction } from "@uttori/asm-core";
import type { RomImage } from "@uttori/asm-disassembler";
import { type SnesStructAccessPart } from "./struct-expressions.js";
import type { SnesStructBinding, SnesStructConstant, SnesStructLayout } from "./struct-map.js";
/** A curated capture reference, separate from static operand identity and CPU control flow. */
export interface SnesStructAccessObservation {
    /** Resolved struct expression naming the observed binding and index. */
    readonly expression: string;
    /** Resolved CPU address. The complete access must remain inside one physical binding. */
    readonly address: number;
    /** Physical owner and exact field/gap coverage of the complete access. */
    readonly binding: string;
    /** Field-aligned slices covering the full CPU access without gaps or overlap. */
    readonly parts: readonly SnesStructAccessPart[];
    /** Number of bytes in this CPU access, one or two. Independent of the field's declared size. */
    readonly width: number;
    /** Bus direction inferred from the capture or trace. */
    readonly access: "read" | "write" | "read-write";
    /** A bus observation and an inference from instruction/register traces are different evidence. */
    readonly provenance: "observed" | "trace-derived";
    /** Capture path or stable identifier, retained for verification and never opened by export. */
    readonly source: string;
    /** Capture location and reasoning, such as instruction sequence and pointer reconstruction. */
    readonly detail: string;
    /** SHA-256 of the capture's headerless ROM, checked against the export ROM. */
    readonly romSha256: string;
}
/** Validated instruction-specific metadata. Expressions resolve only against this map's declarations. */
export interface SnesStructInstructionUse {
    /** CPU address of the instruction opcode byte. */
    readonly address: number;
    /** Complete instruction encoding, including opcode. Stale metadata aborts export before writes. */
    readonly expectedBytes: readonly number[];
    /** Research justification retained in metadata; never emitted as an assembly comment. */
    readonly reason: string;
    /** Explicit instruction-specific behavior or constraint; omitted/empty emits no comment. Field descriptions belong on their declarations. */
    readonly comment?: string;
    /** Immediate value expression. Mutually exclusive with other operand forms and access observations. */
    readonly operand?: {
        readonly expression: string;
        readonly value: number;
    };
    /** Encoded direct memory address, before indexing/DB/D. Never a resolved runtime effective address. */
    readonly memoryOperand?: {
        readonly expression: string;
        readonly value: number;
    };
    /** Encoded unsigned stack displacement (0–255), before adding S. Never a WRAM address or access observation. */
    readonly stackOperand?: {
        readonly expression: string;
        readonly value: number;
    };
    /** Curated memory-access evidence; may coexist with encoded operand replacements. */
    readonly observations: readonly SnesStructAccessObservation[];
}
/**
 * Resolve optional instructionUses against already validated layouts and bindings.
 * Native expressions name exact operands. Observations describe complete spans within a binding.
 * @param value Optional instructionUses array from JSON.
 * @param structures Validated zero-based layouts.
 * @param bindings Validated physical record bindings.
 * @param constants Optional declared scalar values, without storage ownership.
 * @returns Resolved uses in CPU-address order.
 */
export declare const validateSnesStructInstructionUses: (value: unknown, structures: readonly SnesStructLayout[], bindings: readonly SnesStructBinding[], constants?: readonly SnesStructConstant[]) => readonly SnesStructInstructionUse[];
/**
 * Index only annotated instructions, O(uses), rather than scanning uses for every CFG variant.
 * Mapper aliases, complete byte encodings and capture ROM identities are checked before export.
 * The callback returns undefined for unmapped addresses. Instruction bytes must map contiguously.
 * @param uses Validated instruction uses.
 * @param rom Immutable ROM supplying instruction bytes and capture identity.
 * @param toFileOffset Mapper-specific CPU-to-ROM translation.
 * @returns Sparse lookup, absent when unused.
 */
export declare const indexSnesStructInstructionUses: (uses: readonly SnesStructInstructionUse[] | undefined, rom: RomImage, toFileOffset: (address: number) => number | undefined) => ReadonlyMap<number, SnesStructInstructionUse> | undefined;
/**
 * Replace a proven immediate, memory address, data pointer or stack displacement without changing its mode.
 * This runs for every accepted state variant. A size/value mismatch is an error, never truncation.
 * @param instruction One accepted decode context.
 * @param source Existing formatted source, including any conservative numeric fallback.
 * @param use Validated metadata at this ROM instruction.
 * @returns Width-preserving symbolic operand, or the original instruction for observations.
 */
export declare const applySnesStructInstructionOperand: (instruction: DecodedInstruction, source: string, use: SnesStructInstructionUse) => string;
/**
 * Emit only explicitly curated instruction context. Justifications, field descriptions
 * and capture observations remain in metadata instead of becoming repetitive source notes.
 * Preserve the entire explanation; the assembly layout pass wraps it without clipping.
 * @param use Validated instruction metadata.
 * @returns Zero or one complete comment body, without a semicolon.
 */
export declare const renderSnesStructUseComments: (use: SnesStructInstructionUse) => readonly string[];
//# sourceMappingURL=struct-instruction-uses.d.ts.map