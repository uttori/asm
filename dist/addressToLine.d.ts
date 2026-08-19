/**
 * Information mapping a rom address to a source file and line number.
 */
interface AddrToLineInfo {
    fileIdx: number;
    line: number;
    addr: number;
}
/**
 * Represents an entry for a source file, storing its name and its file contents' CRC.
 */
interface FileEntry {
    name: string;
    crc: number;
}
/**
 * Class to store address-to-line mappings for richer symbolic information.
 * During assembly, included files and information about generated assembly
 * should be added here, and then read back during symbol file generation.
 */
export declare class AddressToLineMapping {
    fileList: FileEntry[];
    filenameCrcs: number[];
    addrToLineInfo: AddrToLineInfo[];
    constructor();
    /**
     * Clears all stored mappings and file information.
     */
    reset(): void;
    /**
     * Adds information linking an output ROM address to a source file and line number.
     * @param {string} filename The name of the source file.
     * @param {number} line The line number in the source file.
     * @param {number} addr The output ROM address.
     */
    includeMapping(filename: string, line: number, addr: number): void;
    /**
     * Retrieves the index of the file in the file list.
     * If the file is new, it reads the file to compute its CRC and adds it to the list.
     * @param {string} filename The source file name.
     * @returns {number} The index of the file in the internal list.
     */
    getFileIndex(filename: string): number;
}
export {};
//# sourceMappingURL=addressToLine.d.ts.map