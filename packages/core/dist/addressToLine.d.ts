/** Information mapping a logical address to a source file and line number. */
export interface AddrToLineInfo {
    readonly fileIdx: number;
    readonly line: number;
    readonly addr: number;
}
/** Fingerprinted source file referenced by address mappings. */
export interface AddressToLineFileEntry {
    readonly name: string;
    readonly crc: number;
    readonly size: number;
    readonly sha256: string;
}
/** Half-open logical and output range owned by one source line. */
export interface AddressToLineRange {
    readonly fileIdx: number;
    /** One-based source line. */
    readonly line: number;
    readonly architecture: string;
    readonly addressSpace: string;
    readonly start: number;
    readonly end: number;
    /** Half-open output range. Absent when the logical address is not file-backed. */
    readonly outputStart?: number;
    readonly outputEnd?: number;
}
/** One numeric operand evaluation performed by the encoder, before width truncation. */
export interface ResolvedInstructionOperand {
    readonly expression: string;
    readonly value: number;
}
/** Source-attributed final emission; separate records preserve repeated macro/loop expansions. */
export interface InstructionSourceInfo {
    readonly fileIdx: number;
    readonly line: number;
    readonly architecture: string;
    readonly addressSpace: string;
    readonly address: number;
    /** Actual emitted bytes, including bank wrapping. Absent in older retained debug maps. */
    readonly size?: number;
    readonly outputOffset?: number;
    readonly operands: readonly ResolvedInstructionOperand[];
}
/** One emitted asset, attributed to the assembly statement and its binary input separately. */
export interface AssetEmissionInfo {
    readonly fileIdx: number;
    readonly assetFileIdx: number;
    readonly line: number;
    readonly format: string;
    readonly part: string;
    readonly size: number;
    readonly transforms: readonly string[];
    readonly address: number;
    readonly outputOffset?: number;
    /** Exact half-open input slice for raw incbin; encoded assets use format-specific consumption. */
    readonly inputStart?: number;
    readonly inputEnd?: number;
    /** Actual evaluated include contract, retained for source hosts; raw incbin has no conversion. */
    readonly conversion?: AssetEmissionConversion;
}
/** Source resource names retain their declared spelling and resolved build identity separately. */
export interface AssetEmissionConversion {
    readonly version: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly resources: Readonly<Record<string, string>>;
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
    readonly fileIdx: number;
    readonly line: number;
    /** Fully qualified record/field, including the element index for array fields. */
    readonly reference: string;
    readonly expression: string;
    readonly size: number;
    readonly outputOffset: number;
}
/** Portable representation used by debug-map writers and readers. */
export interface SerializableAddressRange extends Omit<AddressToLineRange, "fileIdx"> {
    readonly source: string;
}
/**
 * Stores source mappings collected while an assembler writes bytes. Ranges are
 * kept half-open, coalesced, and serializable so the same data supports both
 * address-to-source and source-to-address queries.
 */
export declare class AddressToLineMapping {
    fileList: AddressToLineFileEntry[];
    filenameCrcs: number[];
    addrToLineInfo: AddrToLineInfo[];
    ranges: AddressToLineRange[];
    /** Final encoder evaluations, collected without evaluating expressions a second time. */
    instructions: InstructionSourceInfo[];
    /** Successful final-pass asset emissions; binary files have no source lines. */
    assets: AssetEmissionInfo[];
    /** Field attribution supplements row-level ranges without inventing overlapping source writes. */
    structFields: StructFieldEmissionInfo[];
    /** Clears all stored mappings and file information. */
    reset(): void;
    /** Record a binary dependency using the bytes consumed by assembly, not a later disk read.
     * @param {string} filename Provider path.
     * @param {Uint8Array} bytes Build snapshot.
     */
    registerDependencySnapshot(filename: string, bytes: Uint8Array): void;
    /**
     * Adds a legacy point mapping. New debugger consumers should use ranges.
     * @param {string} filename Source filename.
     * @param {number} line One-based source line.
     * @param {number} addr Logical address.
     */
    includeMapping(filename: string, line: number, addr: number): void;
    /**
     * Adds one emitted byte, coalescing it with the preceding compatible range.
     * @param {string} filename Source filename.
     * @param {number} line One-based source line.
     * @param {string} architecture Architecture contribution id.
     * @param {string} addressSpace Address-space contribution id.
     * @param {number} address Logical byte address.
     * @param {number} outputOffset Physical output offset, or a negative value when unmapped.
     */
    includeByte(filename: string, line: number, architecture: string, addressSpace: string, address: number, outputOffset: number): void;
    /**
     * Returns all source ranges containing a logical address.
     * @param {string} addressSpace Address-space contribution id.
     * @param {number} address Logical address.
     * @param {string} architecture Optional architecture filter.
     * @returns {readonly SerializableAddressRange[]} Matching source ranges.
     */
    findSourceRanges(addressSpace: string, address: number, architecture?: string): readonly SerializableAddressRange[];
    /**
     * Returns all address ranges generated by a one-based source line.
     * @param {string} source Source path.
     * @param {number} line One-based source line.
     * @param {string} architecture Optional architecture filter.
     * @returns {readonly SerializableAddressRange[]} Matching address ranges.
     */
    findAddressRanges(source: string, line: number, architecture?: string): readonly SerializableAddressRange[];
    /** @returns {readonly SerializableAddressRange[]} Deterministic path-based ranges. */
    serializableRanges(): readonly SerializableAddressRange[];
    /**
     * Gets or creates a fingerprinted source-file entry.
     * @param {string} filename Source path.
     * @returns {number} Stable file-table index.
     */
    getFileIndex(filename: string): number;
}
//# sourceMappingURL=addressToLine.d.ts.map