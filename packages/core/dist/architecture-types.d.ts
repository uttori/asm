import type { ExpressionNode } from "./ir/expression-node.js";
import type { LinkExpression } from "./ir/link-expression.js";
import type { RelocationEncoding } from "./relocatable.js";
/** Expression values are numeric or string literals. Conversion is the caller's responsibility. */
export type MathValue = number | string;
/** Live access to the current session's symbols and operand expressions. */
export interface OperandResolutionContext {
    /** displayText preserves emission attribution when a typed expression replaces a text input. */
    getnum(expression: string | ExpressionNode, displayText?: string): number;
    /**
     * Reads the logical program counter at the start of the instruction being encoded.
     * @returns The current logical address.
     */
    getCurrentAddress(): number;
}
/** Writes at the session's logical cursor, applying target mapping and stage write rules. */
export interface EncoderEmissionContext {
    /** Object producers retain an explicit field; absolute-only embedding hosts may omit this capability. */
    writeRelocation?(expression: LinkExpression, encoding: RelocationEncoding): void;
    /** Emit the low byte and advance by one byte. */
    write1(value: number): void;
    /** Emit the low 2 bytes, little-endian, and advance by two bytes. */
    write2(value: number): void;
    /** Emit the low 3 bytes, little-endian, and advance by three bytes. */
    write3(value: number): void;
    /** Emit the low byte and advance by one byte; equivalent to `write1`. */
    writeByte(value: number): void;
    /** Emit already encoded bytes in order. The whole run is validated before any byte is written. */
    writeBytes(values: readonly number[]): void;
    /**
     * Emit the low 1–4 bytes of a safe integer (two's complement for negatives), little-endian
     * by default. Invalid arguments throw before writes or cursor changes; use writeBytes for wider data.
     */
    writeValue(value: number, width: number, endianness?: "little" | "big"): void;
}
/** Current logical byte address used for layout and branch-size estimates. */
export interface EncoderSizingContext {
    /**
     * Reads the logical program counter used for size estimates.
     * @returns The current logical address.
     */
    getCurrentAddress(): number;
}
/** Stage-sensitive label lookup for relative branches and unnamed labels. */
export interface EncoderBranchContext {
    /**
     * Reports whether the active stage requires every label to resolve.
     * @returns False during definition collection and layout, when lookups return placeholders.
     */
    enforceResolvedLabels(): boolean;
    /**
     * Finds the nearest `+`-style unnamed label at or after an address.
     * @param label Unnamed label text; the count of `+` characters selects the depth.
     * @param referenceAddress Logical address the search starts from.
     * @returns The target logical address, or 0 while labels are not enforced.
     */
    findNextLabel(label: string, referenceAddress: number): number;
    /**
     * Finds the nearest `-`-style unnamed label before an address.
     * @param label Unnamed label text; the count of `-` characters selects the depth.
     * @param referenceAddress Logical address the search starts from.
     * @returns The target logical address, or 0 while labels are not enforced.
     */
    findPreviousLabel(label: string, referenceAddress: number): number;
}
/** Creates source-attributed errors. The encoder decides when to throw them. */
export interface EncoderDiagnosticContext {
    /**
     * Builds an error attributed to the instruction being encoded.
     * @param message Human-readable failure description.
     * @returns The unthrown error.
     */
    error(message: string): Error;
}
/** Borrowed capabilities for a single session, without ownership of its mutable runtime. */
export interface ArchitectureEncoderContext {
    /** Expression evaluation against the session's symbols. */
    operands: OperandResolutionContext;
    /** Byte output at the logical cursor. */
    emission: EncoderEmissionContext;
    /** Address queries for size estimates. */
    sizing: EncoderSizingContext;
    /** Unnamed-label lookup for relative branches. */
    branches: EncoderBranchContext;
    /** Source-attributed error construction. */
    diagnostics: EncoderDiagnosticContext;
}
/** Host services used by the expression evaluator. Logical addresses are distinct from file offsets. */
export interface ExpressionHost {
    /** Bind explicitly generated expression grammar using the session's ordered define state. */
    bindExpressionTemplate?(template: import("./ir/expression-node.js").TemplateExpressionNode): import("./ir/expression-node.js").ExpressionNode;
    /** Typed hosts preserve reference structure and distinguish a missing value from a real zero. */
    resolveReference(reference: import("./ir/expression-node.js").ReferenceExpressionNode): import("./ir/reference-path.js").ReferenceResolution;
    /**
     * Resolves a label, loop variable or unnamed-label reference by name.
     * @param identifier Label text as written in the expression.
     * @returns The label's numeric or string value.
     */
    resolveLabel(identifier: string): MathValue;
    /**
     * Maps a logical address through the active target mapping.
     * @param address CPU-visible logical address.
     * @returns The output file offset; negative when the address has no output offset.
     */
    convertLogicalToOutputOffset(address: number): number;
    /**
     * Maps an output file offset back to the active target's logical address space.
     * @param offset Zero-based output file offset.
     * @returns The corresponding logical address.
     */
    convertOutputOffsetToLogical(offset: number): number;
    /**
     * Reads the logical program counter.
     * @returns The current logical address.
     */
    getCurrentAddress(): number;
    /**
     * Reads the logical address of the active `base` region, which may differ from the program counter.
     * @returns The current base logical address.
     */
    getCurrentBaseAddress(): number;
    /**
     * Tests whether a define or struct exists.
     * @param identifier Define or struct name.
     * @returns Numeric 1 when defined, otherwise 0.
     */
    isDefined(identifier: string): number;
    /**
     * Measures a struct, data object or variadic macro argument list.
     * @param identifier Object name; `...` selects the active variadic argument count.
     * @param baseOnly True for `sizeof`, which excludes struct extension sizes.
     * @returns The size in bytes, or the argument count for `...`.
     */
    getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
    /** Optional for non-assembler hosts. Reflects declared bounds, never reads emitted data. */
    getExpressionStructMetadata?(identifier: string, property: import("./services/struct-metadata.js").StructMetadataProperty): number;
    /**
     * Measures a file resolved against the current file and include paths.
     * @param filename Path as written in the expression.
     * @returns The file size in bytes; throws when the file cannot be resolved or sized.
     */
    getFileSize(filename: string): number;
    /**
     * Reports file availability for `filestatus`.
     * @param filename Path as written in the expression.
     * @returns 0 when readable, 1 when not found, 2 when found but unreadable.
     */
    getFileStatus(filename: string): number;
    /**
     * Tests whether a byte range lies within a resolvable file.
     * @param filename Path as written in the expression.
     * @param position Zero-based file offset; truncated to an integer.
     * @param size Byte count; truncated to an integer and may be zero.
     * @returns Numeric 1 when the whole range is readable, otherwise 0.
     */
    canReadFile(filename: string, position: number, size: number): number;
    /**
     * Reads an unsigned little-endian value from a file.
     * @param filename Path as written in the expression.
     * @param position Zero-based file offset; truncated to an integer.
     * @param size Value width in bytes (1-4).
     * @param defaultValue Returned instead of throwing when the file or range is unavailable.
     * @returns The unsigned value or `defaultValue`.
     */
    readFile(filename: string, position: number, size: number, defaultValue?: number): number;
    /**
     * Tests whether a byte range lies within the base image, or the current output when no base image is loaded.
     * @param position Zero-based byte offset; truncated to an integer.
     * @param size Byte count; truncated to an integer and may be zero.
     * @returns Numeric 1 when the whole range is readable, otherwise 0.
     */
    canReadBaseImage(position: number, size: number): number;
    /**
     * Reads an unsigned little-endian value from the base image, or the current output when no base image is loaded.
     * @param position Logical address, mapped to an output offset before reading.
     * @param size Value width in bytes (1-4).
     * @param defaultValue Returned instead of throwing when the address is unmapped or out of range.
     * @returns The unsigned value or `defaultValue`.
     */
    readBaseImage(position: number, size: number, defaultValue?: number): number;
}
/**
 * One addressing-mode form of an instruction, used for hover, completion, and
 * signature help in editor tooling.
 */
export interface InstructionAddressingMode {
    /** The addressing-mode name, e.g. "immediate", "absolute", "absoluteIndexedX". */
    mode: string;
    /** Example operand syntax, e.g. "#const", "addr", "addr,x". */
    syntax: string;
    /** The leading opcode byte when statically known. */
    opcode?: number;
    /** The total instruction size in bytes when statically known. */
    size?: number;
}
/**
 * A static description of one instruction mnemonic for a given architecture.
 */
export interface InstructionDescriptor {
    /** The uppercase mnemonic, e.g. "LDA". */
    mnemonic: string;
    /** A short human-readable summary suitable for hover documentation. */
    summary?: string;
    /** The addressing-mode forms supported by the mnemonic. */
    modes: InstructionAddressingMode[];
}
/** Per-session encoder. Sizing returns byte counts. Encoding reports whether it handled the instruction. */
export interface ArchitectureEncoder {
    /** Converted families use only parsed instructions and a fresh stage-owned resolution frame. */
    typed: import("./ir/resolved-instruction.js").TypedArchitectureEncoder;
    /** Resets pass-local encoder state (M/X flags, etc.) at the start of each assembly stage. */
    beginPass?(): void;
    /**
     * Returns the static instruction catalog for editor tooling, when available.
     * @returns The instruction descriptors.
     */
    getInstructionCatalog?(): InstructionDescriptor[];
}
//# sourceMappingURL=architecture-types.d.ts.map