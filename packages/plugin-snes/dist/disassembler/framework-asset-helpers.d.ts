/** Decoded 16-bit pointer relative to the beginning of its table. */
export interface FrameworkRelativePointer {
    readonly index: number;
    readonly storedOffset: number;
    readonly targetAddress: number;
}
/** One extraction range derived from two adjacent 24-bit Framework pointers. */
export interface FrameworkAssetExtractionRange {
    readonly index: number;
    readonly sourceStart: number;
    readonly sourceEnd: number;
}
/** One four-byte SNES sample directory entry. */
export interface FrameworkSamplePointer {
    readonly index: number;
    readonly startAddress: number;
    readonly loopAddress: number;
    readonly kind: "sample" | "zero" | "unused";
    readonly loopOffset?: number;
}
/** Unique sample payload range projected from ARAM addresses into the ROM. */
export interface FrameworkSampleExtractionRange {
    readonly id: number;
    readonly startAddress: number;
    readonly sourceStart: number;
    readonly sourceEnd: number;
    readonly pointerIndexes: readonly number[];
}
/**
 * Decodes the Framework helper's table-base-relative 16-bit pointers.
 * @param {Uint8Array} bytes Complete relative-pointer table bytes.
 * @param {number} tableAddress Logical address of the table beginning.
 * @returns {readonly FrameworkRelativePointer[]} Decoded qualified targets.
 */
export declare const decodeFrameworkRelativePointerTable: (bytes: Uint8Array, tableAddress: number) => readonly FrameworkRelativePointer[];
/**
 * Derives extraction ranges from an ordered 24-bit pointer list. The last
 * pointer is a terminal boundary and does not create an asset by itself.
 * @param {Uint8Array} pointerBytes Complete adjacent 24-bit pointer list.
 * @param {number} [headerSize] Bytes skipped at the start of each asset.
 * @returns {readonly FrameworkAssetExtractionRange[]} Half-open source ranges.
 */
export declare const deriveFrameworkAssetExtractionRanges: (pointerBytes: Uint8Array, headerSize?: number) => readonly FrameworkAssetExtractionRange[];
/**
 * Decodes four-byte `(start, loop)` sample-directory records.
 * @param {Uint8Array} bytes Complete sample pointer table bytes.
 * @returns {readonly FrameworkSamplePointer[]} Decoded directory records.
 */
export declare const decodeFrameworkSamplePointers: (bytes: Uint8Array) => readonly FrameworkSamplePointer[];
/**
 * Groups duplicate sample pointers and projects ordered ARAM sample starts onto
 * half-open ROM ranges. The configured data end closes the final unique sample.
 * @param {readonly FrameworkSamplePointer[]} pointers Decoded sample directory.
 * @param {number} sourceDataStart ROM address corresponding to `aramDataBase`.
 * @param {number} sourceDataEnd Exclusive ROM end for the final sample.
 * @param {number} aramDataBase First ARAM address stored in the ROM payload.
 * @returns {readonly FrameworkSampleExtractionRange[]} Unique projected payload ranges.
 */
export declare const deriveFrameworkSampleExtractionRanges: (pointers: readonly FrameworkSamplePointer[], sourceDataStart: number, sourceDataEnd: number, aramDataBase: number) => readonly FrameworkSampleExtractionRange[];
//# sourceMappingURL=framework-asset-helpers.d.ts.map