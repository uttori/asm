const assertInteger = (value, name) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative safe integer.`);
    }
};
const readLittleEndian = (bytes, offset, width) => {
    if (!(bytes instanceof Uint8Array))
        throw new Error("Framework table bytes must be Uint8Array.");
    if (offset < 0 || offset + width > bytes.length) {
        throw new Error(`Framework table read ${offset}..${offset + width} is out of bounds.`);
    }
    let value = 0;
    for (let index = 0; index < width; index++)
        value += bytes[offset + index] * 2 ** (index * 8);
    return value;
};
/**
 * Decodes the Framework helper's table-base-relative 16-bit pointers.
 * @param {Uint8Array} bytes Complete relative-pointer table bytes.
 * @param {number} tableAddress Logical address of the table beginning.
 * @returns {readonly FrameworkRelativePointer[]} Decoded qualified targets.
 */
export const decodeFrameworkRelativePointerTable = (bytes, tableAddress) => {
    assertInteger(tableAddress, "Framework relative-pointer tableAddress");
    if (bytes.length === 0 || bytes.length % 2 !== 0) {
        throw new Error("Framework relative-pointer table must contain a non-empty whole number of words.");
    }
    return Object.freeze(Array.from({ length: bytes.length / 2 }, (_, index) => {
        const storedOffset = readLittleEndian(bytes, index * 2, 2);
        return Object.freeze({ index, storedOffset, targetAddress: tableAddress + storedOffset });
    }));
};
/**
 * Derives extraction ranges from an ordered 24-bit pointer list. The last
 * pointer is a terminal boundary and does not create an asset by itself.
 * @param {Uint8Array} pointerBytes Complete adjacent 24-bit pointer list.
 * @param {number} [headerSize] Bytes skipped at the start of each asset.
 * @returns {readonly FrameworkAssetExtractionRange[]} Half-open source ranges.
 */
export const deriveFrameworkAssetExtractionRanges = (pointerBytes, headerSize = 4) => {
    assertInteger(headerSize, "Framework asset headerSize");
    if (pointerBytes.length < 6 || pointerBytes.length % 3 !== 0) {
        throw new Error("Framework asset table requires at least two complete 24-bit pointers.");
    }
    const pointers = Array.from({ length: pointerBytes.length / 3 }, (_, index) => readLittleEndian(pointerBytes, index * 3, 3));
    return Object.freeze(pointers.slice(0, -1).map((pointer, index) => {
        const sourceStart = pointer + headerSize;
        const sourceEnd = pointers[index + 1];
        if (sourceEnd < sourceStart) {
            throw new Error(`Framework asset pointer ${index} ends before its ${headerSize}-byte header is skipped.`);
        }
        return Object.freeze({ index, sourceStart, sourceEnd });
    }));
};
/**
 * Decodes four-byte `(start, loop)` sample-directory records.
 * @param {Uint8Array} bytes Complete sample pointer table bytes.
 * @returns {readonly FrameworkSamplePointer[]} Decoded directory records.
 */
export const decodeFrameworkSamplePointers = (bytes) => {
    if (bytes.length === 0 || bytes.length % 4 !== 0) {
        throw new Error("Framework sample pointer table must contain complete four-byte entries.");
    }
    return Object.freeze(Array.from({ length: bytes.length / 4 }, (_, index) => {
        const startAddress = readLittleEndian(bytes, index * 4, 2);
        const loopAddress = readLittleEndian(bytes, index * 4 + 2, 2);
        let kind = "sample";
        if (startAddress === 0)
            kind = "zero";
        else if (startAddress === 0xffff)
            kind = "unused";
        if (kind !== "sample") {
            if (loopAddress !== startAddress) {
                throw new Error(`Framework null sample pointer ${index} has mismatched start and loop values.`);
            }
            return Object.freeze({ index, startAddress, loopAddress, kind });
        }
        if (loopAddress < startAddress) {
            throw new Error(`Framework sample pointer ${index} loops before its sample start.`);
        }
        return Object.freeze({
            index,
            startAddress,
            loopAddress,
            kind,
            loopOffset: loopAddress - startAddress,
        });
    }));
};
/**
 * Groups duplicate sample pointers and projects ordered ARAM sample starts onto
 * half-open ROM ranges. The configured data end closes the final unique sample.
 * @param {readonly FrameworkSamplePointer[]} pointers Decoded sample directory.
 * @param {number} sourceDataStart ROM address corresponding to `aramDataBase`.
 * @param {number} sourceDataEnd Exclusive ROM end for the final sample.
 * @param {number} aramDataBase First ARAM address stored in the ROM payload.
 * @returns {readonly FrameworkSampleExtractionRange[]} Unique projected payload ranges.
 */
export const deriveFrameworkSampleExtractionRanges = (pointers, sourceDataStart, sourceDataEnd, aramDataBase) => {
    assertInteger(sourceDataStart, "Framework sample sourceDataStart");
    assertInteger(sourceDataEnd, "Framework sample sourceDataEnd");
    assertInteger(aramDataBase, "Framework sample aramDataBase");
    if (sourceDataEnd <= sourceDataStart) {
        throw new Error("Framework sample source data range must be non-empty.");
    }
    const groups = new Map();
    const starts = [];
    let lastSampleStart;
    for (const pointer of pointers) {
        if (pointer.kind !== "sample")
            continue;
        if (lastSampleStart !== undefined && pointer.startAddress < lastSampleStart) {
            throw new Error("Framework sample pointers are not ordered by start address.");
        }
        lastSampleStart = pointer.startAddress;
        const indexes = groups.get(pointer.startAddress);
        if (indexes)
            indexes.push(pointer.index);
        else {
            if (pointer.startAddress < aramDataBase) {
                throw new Error(`Framework sample pointer ${pointer.index} precedes the ARAM data base.`);
            }
            starts.push(pointer.startAddress);
            groups.set(pointer.startAddress, [pointer.index]);
        }
    }
    return Object.freeze(starts.map((startAddress, id) => {
        const sourceStart = sourceDataStart + startAddress - aramDataBase;
        const sourceEnd = id + 1 < starts.length ? sourceDataStart + starts[id + 1] - aramDataBase : sourceDataEnd;
        if (sourceStart < sourceDataStart || sourceEnd <= sourceStart || sourceEnd > sourceDataEnd) {
            throw new Error(`Framework sample ${id} projects outside the configured ROM data range.`);
        }
        return Object.freeze({
            id,
            startAddress,
            sourceStart,
            sourceEnd,
            pointerIndexes: Object.freeze([...(groups.get(startAddress) ?? [])]),
        });
    }));
};
//# sourceMappingURL=framework-asset-helpers.js.map