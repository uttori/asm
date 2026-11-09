/** A byte range in the complete cartridge file. End is exclusive. */
export interface NesSection {
    /** Byte offset from the start of the cartridge image. */
    readonly offset: number;
    /** Section length in bytes; the end offset is exclusive. */
    readonly size: number;
}
/** Parsed legacy iNES cartridge. Byte access returns copies, preserving the original input identity. */
export declare class NesCartridge {
    #private;
    /** iNES mapper number derived from the header. */
    readonly mapper: number;
    /** Whether the header advertises battery-backed PRG RAM. */
    readonly battery: boolean;
    /** Nametable mirroring mode declared in the header. */
    readonly mirroring: "horizontal" | "vertical" | "four-screen";
    /** Optional 512-byte trainer section immediately after the header. */
    readonly trainer: NesSection;
    /** PRG ROM section layout within the image. */
    readonly prg: NesSection;
    /** CHR ROM section layout within the image. */
    readonly chr: NesSection;
    /** Bytes after PRG and CHR, when present in the supplied image. */
    readonly trailing: NesSection;
    /** Legacy zero means unspecified; mapper-specific defaults belong to the machine profile. */
    readonly declaredPrgRamSize: number | undefined;
    /**
     * Parse a complete iNES image and freeze section layout derived from the header.
     * @param input Full cartridge bytes including the 16-byte header.
     */
    constructor(input: Uint8Array);
    /** Total byte length of the parsed cartridge image. */
    get size(): number;
    /**
     * Copy the full cartridge image so callers cannot mutate the parsed original.
     * @returns Defensive copy of all cartridge bytes.
     */
    bytes(): Uint8Array;
    /**
     * Copy the 16-byte iNES header prefix.
     * @returns Header bytes independent of the internal buffer.
     */
    header(): Uint8Array;
    /**
     * Copy one parsed section range from the cartridge image.
     * @param section Offset and size describing a contiguous cartridge range.
     * @returns Bytes for the requested section only.
     */
    section(section: NesSection): Uint8Array;
    /** Physical PRG offset; undefined never aliases open bus or RAM. */
    readPrg(offset: number): number | undefined;
}
//# sourceMappingURL=cartridge.d.ts.map