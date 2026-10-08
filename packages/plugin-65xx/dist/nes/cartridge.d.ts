/** A byte range in the complete cartridge file. End is exclusive. */
export interface NesSection {
    readonly offset: number;
    readonly size: number;
}
/** Parsed legacy iNES cartridge. Byte access returns copies, preserving the original input identity. */
export declare class NesCartridge {
    #private;
    readonly mapper: number;
    readonly battery: boolean;
    readonly mirroring: "horizontal" | "vertical" | "four-screen";
    readonly trainer: NesSection;
    readonly prg: NesSection;
    readonly chr: NesSection;
    readonly trailing: NesSection;
    /** Legacy zero means unspecified; mapper-specific defaults belong to the machine profile. */
    readonly declaredPrgRamSize: number | undefined;
    constructor(input: Uint8Array);
    get size(): number;
    bytes(): Uint8Array;
    header(): Uint8Array;
    section(section: NesSection): Uint8Array;
    /** Physical PRG offset; undefined never aliases open bus or RAM. */
    readPrg(offset: number): number | undefined;
}
//# sourceMappingURL=cartridge.d.ts.map