/** Decoded 16-bit pointer relative to the beginning of its table. */
export interface FrameworkRelativePointer {
    /** Zero-based word position in the table. */
    readonly index: number;
    /** Raw little-endian word, measured from the table beginning. */
    readonly storedOffset: number;
    /** Table address plus the stored offset; not wrapped to a bank. */
    readonly targetAddress: number;
}
/** One extraction range derived from two adjacent 24-bit Framework pointers. */
export interface FrameworkAssetExtractionRange {
    /** Position of the starting pointer in the list. */
    readonly index: number;
    /** Inclusive start after skipping the per-asset header. */
    readonly sourceStart: number;
    /** Exclusive end, taken from the next pointer. */
    readonly sourceEnd: number;
}
/** One four-byte SNES sample directory entry. */
export interface FrameworkSamplePointer {
    /** Zero-based entry position in the directory. */
    readonly index: number;
    /** ARAM address of the sample start word. */
    readonly startAddress: number;
    /** ARAM loop address; equals `startAddress` for null entries. */
    readonly loopAddress: number;
    /** `zero` and `unused` mark null entries whose start is `$0000` or `$FFFF`. */
    readonly kind: "sample" | "zero" | "unused";
    /** Loop distance from the sample start in bytes; present only for `sample` entries. */
    readonly loopOffset?: number;
}
/** Unique sample payload range projected from ARAM addresses into the ROM. */
export interface FrameworkSampleExtractionRange {
    /** Ordinal of the unique sample start, in ascending ARAM order. */
    readonly id: number;
    /** Shared ARAM start address of every grouped pointer. */
    readonly startAddress: number;
    /** Inclusive projected ROM address. */
    readonly sourceStart: number;
    /** Exclusive projected ROM address: the next unique start or the configured data end. */
    readonly sourceEnd: number;
    /** Directory indexes that point at this payload. */
    readonly pointerIndexes: readonly number[];
}
/**
 * Decodes the Framework helper's table-base-relative 16-bit pointers.
 * @param bytes Complete relative-pointer table bytes.
 * @param tableAddress Logical address of the table beginning.
 * @returns Decoded qualified targets.
 */
export declare const decodeFrameworkRelativePointerTable: (bytes: Uint8Array, tableAddress: number) => readonly FrameworkRelativePointer[];
/**
 * Derives extraction ranges from an ordered 24-bit pointer list. The last
 * pointer is a terminal boundary and does not create an asset by itself.
 * @param pointerBytes Complete adjacent 24-bit pointer list.
 * @param [headerSize] Bytes skipped at the start of each asset.
 * @returns Half-open source ranges.
 */
export declare const deriveFrameworkAssetExtractionRanges: (pointerBytes: Uint8Array, headerSize?: number) => readonly FrameworkAssetExtractionRange[];
/**
 * Decodes four-byte `(start, loop)` sample-directory records.
 * @param bytes Complete sample pointer table bytes.
 * @returns Decoded directory records.
 */
export declare const decodeFrameworkSamplePointers: (bytes: Uint8Array) => readonly FrameworkSamplePointer[];
/**
 * Groups duplicate sample pointers and projects ordered ARAM sample starts onto
 * half-open ROM ranges. The configured data end closes the final unique sample.
 * @param pointers Decoded sample directory.
 * @param sourceDataStart ROM address corresponding to `aramDataBase`.
 * @param sourceDataEnd Exclusive ROM end for the final sample.
 * @param aramDataBase First ARAM address stored in the ROM payload.
 * @returns Unique projected payload ranges.
 */
export declare const deriveFrameworkSampleExtractionRanges: (pointers: readonly FrameworkSamplePointer[], sourceDataStart: number, sourceDataEnd: number, aramDataBase: number) => readonly FrameworkSampleExtractionRange[];
//# sourceMappingURL=framework-asset-helpers.d.ts.map