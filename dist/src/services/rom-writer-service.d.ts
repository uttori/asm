export interface RomWriterHost {
    snespos: number;
    realsnespos: number;
    startpos: number;
    realstartpos: number;
    bytes: number;
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
}
export declare class RomWriterService {
    private readonly host;
    constructor(host: RomWriterHost);
    step(num: number): void;
    write1_65816(num: number): void;
    write1(num: number): void;
    write2(num: number): void;
    write3(num: number): void;
    write4(num: number): void;
    assertBankCrossAllowed(length: number): void;
    finishPass(): void;
    snestopc(addr: number): number;
    pctosnes(addr: number): number;
    verifysnespos(): void;
    fixsnespos(inaddr: number, step?: number): number;
}
//# sourceMappingURL=rom-writer-service.d.ts.map