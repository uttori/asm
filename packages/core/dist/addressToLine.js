import { CRC32 } from "./crc32.js";
/**
 * Computes identity fingerprints for a source path, optionally from supplied bytes.
 * @param filename Path used when disk reads are required.
 * @param supplied Optional byte snapshot to fingerprint instead of reading disk.
 */
const sourceIdentity = (filename, supplied) => {
    try {
        const fs = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:fs");
        const crypto = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:crypto");
        if (!fs || !crypto) {
            return { crc: 0, size: 0, sha256: "" };
        }
        const data = supplied ?? fs.readFileSync(filename);
        return {
            crc: CRC32.compute(data),
            size: data.length,
            sha256: crypto.createHash("sha256").update(data).digest("hex"),
        };
    }
    catch {
        return { crc: 0, size: 0, sha256: "" };
    }
};
/**
 * Stores source mappings collected while an assembler writes bytes. Ranges are
 * kept half-open, coalesced, and serializable so the same data supports both
 * address-to-source and source-to-address queries.
 */
export class AddressToLineMapping {
    /** Fingerprinted source files indexed by {@link getFileIndex}. */
    fileList = [];
    /** CRC32 of paths parallel to {@link fileList} for fast lookup. */
    filenameCrcs = [];
    /** Legacy point mappings retained for older debug consumers. */
    addrToLineInfo = [];
    /** Coalesced half-open logical and output ranges. */
    ranges = [];
    /** Final encoder evaluations, collected without evaluating expressions a second time. */
    instructions = [];
    /** Successful final-pass asset emissions; binary files have no source lines. */
    assets = [];
    /** Field attribution supplements row-level ranges without inventing overlapping source writes. */
    structFields = [];
    /** Clears all stored mappings and file information. */
    reset() {
        this.fileList = [];
        this.filenameCrcs = [];
        this.addrToLineInfo = [];
        this.ranges = [];
        this.instructions = [];
        this.assets = [];
        this.structFields = [];
    }
    /**
     * Record a binary dependency using the bytes consumed by assembly, not a later disk read.
     * @param filename Provider path.
     * @param bytes Build snapshot.
     */
    registerDependencySnapshot(filename, bytes) {
        const index = this.getFileIndex(filename);
        const identity = sourceIdentity(filename, bytes);
        this.fileList[index] = { name: filename, ...identity };
    }
    /**
     * Adds a legacy point mapping. New debugger consumers should use ranges.
     * @param filename Source filename.
     * @param line One-based source line.
     * @param addr Logical address.
     */
    includeMapping(filename, line, addr) {
        const fileIdx = this.getFileIndex(filename);
        this.addrToLineInfo.push({ fileIdx, line, addr });
    }
    /**
     * Adds one emitted byte, coalescing it with the preceding compatible range.
     * @param filename Source filename.
     * @param line One-based source line.
     * @param architecture Architecture contribution id.
     * @param addressSpace Address-space contribution id.
     * @param address Logical byte address.
     * @param outputOffset Physical output offset, or a negative value when unmapped.
     */
    includeByte(filename, line, architecture, addressSpace, address, outputOffset) {
        const fileIdx = this.getFileIndex(filename);
        const mappedOutput = Number.isInteger(outputOffset) && outputOffset >= 0;
        const previous = this.ranges.at(-1);
        if (previous &&
            previous.fileIdx === fileIdx &&
            previous.line === line &&
            previous.architecture === architecture &&
            previous.addressSpace === addressSpace &&
            previous.end === address &&
            ((mappedOutput && previous.outputEnd === outputOffset) ||
                (!mappedOutput && previous.outputStart === undefined))) {
            this.ranges[this.ranges.length - 1] = {
                ...previous,
                end: address + 1,
                ...(mappedOutput ? { outputEnd: outputOffset + 1 } : {}),
            };
            return;
        }
        this.ranges.push({
            fileIdx,
            line,
            architecture,
            addressSpace,
            start: address,
            end: address + 1,
            ...(mappedOutput ? { outputStart: outputOffset, outputEnd: outputOffset + 1 } : {}),
        });
    }
    /**
     * Returns all source ranges containing a logical address.
     * @param addressSpace Address-space contribution id.
     * @param address Logical address.
     * @param architecture Optional architecture filter.
     * @returns Matching source ranges.
     */
    findSourceRanges(addressSpace, address, architecture) {
        return this.serializableRanges().filter((range) => range.addressSpace === addressSpace &&
            range.start <= address &&
            address < range.end &&
            (architecture === undefined || range.architecture === architecture));
    }
    /**
     * Returns all address ranges generated by a one-based source line.
     * @param source Source path.
     * @param line One-based source line.
     * @param architecture Optional architecture filter.
     * @returns Matching address ranges.
     */
    findAddressRanges(source, line, architecture) {
        return this.serializableRanges().filter((range) => range.source === source &&
            range.line === line &&
            (architecture === undefined || range.architecture === architecture));
    }
    /**
     * Converts stored ranges into portable path-based records sorted for stable output.
     * @returns Sorted serializable ranges.
     */
    serializableRanges() {
        return this.ranges
            .map(({ fileIdx, ...range }) => ({ ...range, source: this.fileList[fileIdx]?.name ?? "" }))
            .toSorted((left, right) => left.addressSpace.localeCompare(right.addressSpace) ||
            left.architecture.localeCompare(right.architecture) ||
            left.start - right.start ||
            left.end - right.end ||
            left.source.localeCompare(right.source) ||
            left.line - right.line);
    }
    /**
     * Gets or creates a fingerprinted source-file entry.
     * @param filename Source path.
     * @returns Stable file-table index.
     */
    getFileIndex(filename) {
        const filenameCrc = CRC32.compute(new TextEncoder().encode(filename));
        for (let i = 0; i < this.filenameCrcs.length; i++) {
            if (this.filenameCrcs[i] === filenameCrc && this.fileList[i]?.name === filename) {
                return i;
            }
        }
        this.fileList.push({ name: filename, ...sourceIdentity(filename) });
        this.filenameCrcs.push(filenameCrc);
        return this.fileList.length - 1;
    }
}
//# sourceMappingURL=addressToLine.js.map