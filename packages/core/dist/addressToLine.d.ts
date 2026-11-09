/** Information mapping a logical address to a source file and line number. */
export interface AddrToLineInfo {
    /** Index into the fingerprinted file table. */
    readonly fileIdx: number;
    /** One-based source line for the mapping point. */
    readonly line: number;
    /** Logical address associated with that source location. */
    readonly addr: number;
}
/** Fingerprinted source file referenced by address mappings. */
export interface AddressToLineFileEntry {
    /** Provider path recorded at assembly time. */
    readonly name: string;
    /** CRC32 of the bytes used when the file was registered. */
    readonly crc: number;
    /** Byte length of the registered snapshot. */
    readonly size: number;
    /** SHA-256 hex digest of the registered snapshot. */
    readonly sha256: string;
}
/** Half-open logical and output range owned by one source line. */
export interface AddressToLineRange {
    /** Index into the fingerprinted file table. */
    readonly fileIdx: number;
    /** One-based source line. */
    readonly line: number;
    /** Architecture contribution id for the emitted bytes. */
    readonly architecture: string;
    /** Address-space contribution id for the logical range. */
    readonly addressSpace: string;
    /** Inclusive start of the half-open logical range. */
    readonly start: number;
    /** Exclusive end of the half-open logical range. */
    readonly end: number;
    /** Half-open output range. Absent when the logical address is not file-backed. */
    readonly outputStart?: number;
    /** Exclusive end of the half-open output range when mapped. */
    readonly outputEnd?: number;
}
/** One numeric operand evaluation performed by the encoder, before width truncation. */
export interface ResolvedInstructionOperand {
    /** Source text of the evaluated operand expression. */
    readonly expression: string;
    /** Numeric value before instruction-field packing. */
    readonly value: number;
}
/** Source-attributed final emission; separate records preserve repeated macro/loop expansions. */
export interface InstructionSourceInfo {
    /** Index into the fingerprinted file table. */
    readonly fileIdx: number;
    /** One-based source line of the emitting statement. */
    readonly line: number;
    /** Architecture contribution id for the instruction. */
    readonly architecture: string;
    /** Address-space contribution id for the logical address. */
    readonly addressSpace: string;
    /** Logical address of the first emitted byte. */
    readonly address: number;
    /** Actual emitted bytes, including bank wrapping. Absent in older retained debug maps. */
    readonly size?: number;
    /** Physical output offset of the first byte when mapped. */
    readonly outputOffset?: number;
    /** Operand evaluations captured during encoding. */
    readonly operands: readonly ResolvedInstructionOperand[];
    /** Fixed object encoding and assembly-time processor assumptions, when emitted by a linker. */
    readonly form?: string;
    /** Frozen syntax snapshot of processor assumptions when present. */
    readonly state?: import("./ir/source-syntax.js").SyntaxValue;
}
/** One emitted asset, attributed to the assembly statement and its binary input separately. */
export interface AssetEmissionInfo {
    /** Index into the fingerprinted file table for the including source. */
    readonly fileIdx: number;
    /** Index into the fingerprinted file table for the asset input. */
    readonly assetFileIdx: number;
    /** One-based source line of the include directive. */
    readonly line: number;
    /** Asset converter or raw format identifier. */
    readonly format: string;
    /** Logical part name within a multi-part asset. */
    readonly part: string;
    /** Number of output bytes contributed by this emission. */
    readonly size: number;
    /** Ordered transform ids applied before emission. */
    readonly transforms: readonly string[];
    /** Logical address where the asset bytes begin. */
    readonly address: number;
    /** Physical output offset of the first byte when mapped. */
    readonly outputOffset?: number;
    /** Exact half-open input slice for raw incbin; encoded assets use format-specific consumption. */
    readonly inputStart?: number;
    /** Exclusive end of the input slice when recorded. */
    readonly inputEnd?: number;
    /** Actual evaluated include contract, retained for source hosts; raw incbin has no conversion. */
    readonly conversion?: AssetEmissionConversion;
}
/** Source resource names retain their declared spelling and resolved build identity separately. */
export interface AssetEmissionConversion {
    /** Converter contract version string. */
    readonly version: string;
    /** Converter options evaluated at include time. */
    readonly options: Readonly<Record<string, unknown>>;
    /** Resolved resource paths keyed by converter resource id. */
    readonly resources: Readonly<Record<string, string>>;
    /** Optional upper bound on emitted size enforced by the converter. */
    readonly maxSize?: number;
    /** Ordered transforms and their exact options/resources; imported artwork cannot replace this contract. */
    readonly transforms: readonly {
        readonly id: string;
        readonly version: string;
        readonly options: Readonly<Record<string, unknown>>;
        readonly resources: Readonly<Record<string, string>>;
    }[];
}
/** One encoded scalar of a typed record; line identifies the containing initializer's opening line. */
export interface StructFieldEmissionInfo {
    /** Final run address and processor scope are available after object linking. */
    readonly address?: number;
    /** Architecture contribution id when linked. */
    readonly architecture?: string;
    /** Address-space contribution id when linked. */
    readonly addressSpace?: string;
    /** Index into the fingerprinted file table. */
    readonly fileIdx: number;
    /** One-based source line of the struct initializer. */
    readonly line: number;
    /** Fully qualified record/field, including the element index for array fields. */
    readonly reference: string;
    /** Source expression text for the field value. */
    readonly expression: string;
    /** Encoded field width in bytes. */
    readonly size: number;
    /** Physical output offset of the field bytes. */
    readonly outputOffset: number;
}
/** Portable representation used by debug-map writers and readers. */
export interface SerializableAddressRange extends Omit<AddressToLineRange, "fileIdx"> {
    /** Source path in place of a file-table index. */
    readonly source: string;
}
/**
 * Stores source mappings collected while an assembler writes bytes. Ranges are
 * kept half-open, coalesced, and serializable so the same data supports both
 * address-to-source and source-to-address queries.
 */
export declare class AddressToLineMapping {
    /** Fingerprinted source files indexed by {@link getFileIndex}. */
    fileList: AddressToLineFileEntry[];
    /** CRC32 of paths parallel to {@link fileList} for fast lookup. */
    filenameCrcs: number[];
    /** Legacy point mappings retained for older debug consumers. */
    addrToLineInfo: AddrToLineInfo[];
    /** Coalesced half-open logical and output ranges. */
    ranges: AddressToLineRange[];
    /** Final encoder evaluations, collected without evaluating expressions a second time. */
    instructions: InstructionSourceInfo[];
    /** Successful final-pass asset emissions; binary files have no source lines. */
    assets: AssetEmissionInfo[];
    /** Field attribution supplements row-level ranges without inventing overlapping source writes. */
    structFields: StructFieldEmissionInfo[];
    /** Clears all stored mappings and file information. */
    reset(): void;
    /**
     * Record a binary dependency using the bytes consumed by assembly, not a later disk read.
     * @param filename Provider path.
     * @param bytes Build snapshot.
     */
    registerDependencySnapshot(filename: string, bytes: Uint8Array): void;
    /**
     * Adds a legacy point mapping. New debugger consumers should use ranges.
     * @param filename Source filename.
     * @param line One-based source line.
     * @param addr Logical address.
     */
    includeMapping(filename: string, line: number, addr: number): void;
    /**
     * Adds one emitted byte, coalescing it with the preceding compatible range.
     * @param filename Source filename.
     * @param line One-based source line.
     * @param architecture Architecture contribution id.
     * @param addressSpace Address-space contribution id.
     * @param address Logical byte address.
     * @param outputOffset Physical output offset, or a negative value when unmapped.
     */
    includeByte(filename: string, line: number, architecture: string, addressSpace: string, address: number, outputOffset: number): void;
    /**
     * Returns all source ranges containing a logical address.
     * @param addressSpace Address-space contribution id.
     * @param address Logical address.
     * @param architecture Optional architecture filter.
     * @returns Matching source ranges.
     */
    findSourceRanges(addressSpace: string, address: number, architecture?: string): readonly SerializableAddressRange[];
    /**
     * Returns all address ranges generated by a one-based source line.
     * @param source Source path.
     * @param line One-based source line.
     * @param architecture Optional architecture filter.
     * @returns Matching address ranges.
     */
    findAddressRanges(source: string, line: number, architecture?: string): readonly SerializableAddressRange[];
    /**
     * Converts stored ranges into portable path-based records sorted for stable output.
     * @returns Sorted serializable ranges.
     */
    serializableRanges(): readonly SerializableAddressRange[];
    /**
     * Gets or creates a fingerprinted source-file entry.
     * @param filename Source path.
     * @returns Stable file-table index.
     */
    getFileIndex(filename: string): number;
}
//# sourceMappingURL=addressToLine.d.ts.map