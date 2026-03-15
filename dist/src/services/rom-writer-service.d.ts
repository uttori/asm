export interface RomWriterHost {
    snespos: number;
    realsnespos: number;
    mapper: string;
    sa1banks: number[];
    romdata: number[] | Uint8Array;
    default_freespacebyte: number;
    pass: number;
    bankCrossCheckMode: "off" | "full" | "half";
    spcInlineCompatMode: boolean;
    inSpcblock: boolean;
    activeFreespaceStartPc: number | null;
    activeFreespaceContentStartPc: number | null;
    checksumFixEnabled: boolean;
    fillRomData(start: number, value: number, length: number): void;
    writeDataBytes(start: number, value: number, length?: number): void;
    updateHeaderAndCRC32(): void;
    handleEndSpcblock(words: string[]): void;
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
}
export declare class RomWriterService {
    readonly host: RomWriterHost;
    constructor(host: RomWriterHost);
    /**
     * Steps the SNES position.
     * @param {number} num The number of bytes to step.
     */
    step(num: number): void;
    /**
     * Writes a 16-bit value to the ROM.
     * @param {number} num The value to write.
     */
    write1_65816(num: number): void;
    /**
     * Writes a 8-bit value to the ROM.
     * @param {number} num The value to write.
     */
    write1(num: number): void;
    /**
     * Writes a 16-bit value to the ROM.
     * @param {number} num The value to write.
     */
    write2(num: number): void;
    /**
     * Writes a 24-bit value to the ROM.
     * @param {number} num The value to write.
     */
    write3(num: number): void;
    /**
     * Writes a 32-bit value to the ROM.
     * @param {number} num The value to write.
     */
    write4(num: number): void;
    /**
     * Asserts that bank cross is allowed.
     * @param {number} length The length of the value to write.
     */
    assertBankCrossAllowed(length: number): void;
    /**
     * Finishes the pass.
     */
    finishPass(): void;
    /**
     * Converts a SNES address to a PC offset.
     * @param {number} addr The SNES address to convert.
     * @returns {number} The PC offset.
     */
    snestopc(addr: number): number;
    /**
     * Converts a PC offset to a SNES address.
     * @param {number} addr The PC offset to convert.
     * @returns {number} The SNES address.
     */
    pctosnes(addr: number): number;
    /**
     * Verifies the SNES position.
     */
    verifysnespos(): void;
    /**
     * Fixes the SNES position.
     * @param {number} inaddr The address to fix.
     * @param {number} step The number of bytes to step.
     * @returns {number} The fixed address.
     */
    fixsnespos(inaddr: number, step?: number): number;
}
//# sourceMappingURL=rom-writer-service.d.ts.map