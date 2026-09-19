import type { DecodedInstruction } from "@uttori/asm-core";
import type { RomImage } from "@uttori/asm-disassembler";
import { type SnesStructAccessPart } from "./struct-expressions.js";
import type { SnesStructBinding, SnesStructLayout } from "./struct-map.js";
/** A curated capture reference, separate from static operand identity and CPU control flow. */
export interface SnesStructAccessObservation {
    readonly expression: string;
    /** Resolved CPU address; the complete access must remain inside one physical binding. */
    readonly address: number;
    /** Physical owner and exact field/gap coverage of the complete access. */
    readonly binding: string;
    readonly parts: readonly SnesStructAccessPart[];
    /** Number of bytes in this CPU access, one or two; independent of the field's declared size. */
    readonly width: number;
    readonly access: "read" | "write" | "read-write";
    /** A bus observation and an inference from instruction/register traces are different evidence. */
    readonly provenance: "observed" | "trace-derived";
    /** Capture path or stable identifier; export renders it as provenance and never opens it. */
    readonly source: string;
    /** Capture location and reasoning, such as instruction sequence and pointer reconstruction. */
    readonly detail: string;
    /** SHA-256 of the capture's headerless ROM, checked against the export ROM. */
    readonly romSha256: string;
}
/** Validated instruction-specific metadata; expressions resolve only against this map's declarations. */
export interface SnesStructInstructionUse {
    readonly address: number;
    /** Complete instruction encoding, including opcode; stale metadata aborts export before writes. */
    readonly expectedBytes: readonly number[];
    readonly reason: string;
    /** Immediate value expression; mutually exclusive with memoryOperand and access observations. */
    readonly operand?: {
        readonly expression: string;
        readonly value: number;
    };
    /** Encoded direct memory address, before indexing/DB/D; never a resolved runtime effective address. */
    readonly memoryOperand?: {
        readonly expression: string;
        readonly value: number;
    };
    readonly observations: readonly SnesStructAccessObservation[];
}
/**
 * Resolve optional instructionUses against already validated layouts and bindings.
 * Native expressions name exact operands; observations describe complete spans within a binding.
 * @param {unknown} value Optional instructionUses array from JSON.
 * @param {readonly SnesStructLayout[]} structures Validated zero-based layouts.
 * @param {readonly SnesStructBinding[]} bindings Validated physical record bindings.
 * @returns {readonly SnesStructInstructionUse[]} Resolved uses in CPU-address order.
 */
export declare const validateSnesStructInstructionUses: (value: unknown, structures: readonly SnesStructLayout[], bindings: readonly SnesStructBinding[]) => readonly SnesStructInstructionUse[];
/**
 * Index only annotated instructions, O(uses), rather than scanning uses for every CFG variant.
 * Mapper aliases, complete byte encodings and capture ROM identities are checked before export.
 * The callback returns undefined for unmapped addresses; instruction bytes must map contiguously.
 * @param {readonly SnesStructInstructionUse[] | undefined} uses Validated instruction uses.
 * @param {RomImage} rom Immutable ROM supplying instruction bytes and capture identity.
 * @param {Function} toFileOffset Mapper-specific CPU-to-ROM translation.
 * @returns {ReadonlyMap<number, SnesStructInstructionUse> | undefined} Sparse lookup, absent when unused.
 */
export declare const indexSnesStructInstructionUses: (uses: readonly SnesStructInstructionUse[] | undefined, rom: RomImage, toFileOffset: (address: number) => number | undefined) => ReadonlyMap<number, SnesStructInstructionUse> | undefined;
/**
 * Replace a proven immediate or direct memory operand, preserving its encoded width and indexing.
 * This runs for every accepted state variant. A size/value mismatch is an error, never truncation.
 * @param {DecodedInstruction} instruction One accepted decode context.
 * @param {string} source Existing formatted source, including any conservative numeric fallback.
 * @param {SnesStructInstructionUse} use Validated metadata at this ROM instruction.
 * @returns {string} Width-preserving symbolic operand, or the original instruction for observations.
 */
export declare const applySnesStructInstructionOperand: (instruction: DecodedInstruction, source: string, use: SnesStructInstructionUse) => string;
/**
 * Render all capture alternatives as comments; they never become fixed-address CPU operands.
 * @param {SnesStructInstructionUse} use Validated instruction metadata in curator-supplied order.
 * @returns {readonly string[]} Individual comment bodies without the leading semicolon.
 */
export declare const renderSnesStructUseComments: (use: SnesStructInstructionUse) => readonly string[];
//# sourceMappingURL=struct-instruction-uses.d.ts.map