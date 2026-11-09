/** Parsed legacy iNES cartridge. Byte access returns copies, preserving the original input identity. */
export class NesCartridge {
    #bytes;
    /** iNES mapper number derived from the header. */
    mapper;
    /** Whether the header advertises battery-backed PRG RAM. */
    battery;
    /** Nametable mirroring mode declared in the header. */
    mirroring;
    /** Optional 512-byte trainer section immediately after the header. */
    trainer;
    /** PRG ROM section layout within the image. */
    prg;
    /** CHR ROM section layout within the image. */
    chr;
    /** Bytes after PRG and CHR, when present in the supplied image. */
    trailing;
    /** Legacy zero means unspecified; mapper-specific defaults belong to the machine profile. */
    declaredPrgRamSize;
    /**
     * Parse a complete iNES image and freeze section layout derived from the header.
     * @param input Full cartridge bytes including the 16-byte header.
     */
    constructor(input) {
        this.#bytes = Uint8Array.from(input);
        const bytes = this.#bytes;
        if (bytes.length < 16 ||
            bytes[0] !== 0x4e ||
            bytes[1] !== 0x45 ||
            bytes[2] !== 0x53 ||
            bytes[3] !== 0x1a) {
            throw new Error("Expected a complete 16-byte iNES header.");
        }
        // NES 2.0 reuses legacy fields with different sizes and mapper bits; partial interpretation is unsafe.
        if ((bytes[7] & 0x0c) === 0x08) {
            throw new Error("NES 2.0 cartridges are not supported by this analysis profile.");
        }
        if ((bytes[7] & 0x0f) !== 0) {
            throw new Error("Unsupported iNES console or header version.");
        }
        this.mapper = (bytes[6] >>> 4) | (bytes[7] & 0xf0);
        this.battery = Boolean(bytes[6] & 2);
        this.mirroring = bytes[6] & 1 ? "vertical" : "horizontal";
        if (bytes[6] & 8) {
            this.mirroring = "four-screen";
        }
        this.declaredPrgRamSize = bytes[8] ? bytes[8] * 8192 : undefined;
        this.trainer = Object.freeze({ offset: 16, size: bytes[6] & 4 ? 512 : 0 });
        this.prg = Object.freeze({ offset: 16 + this.trainer.size, size: bytes[4] * 16384 });
        this.chr = Object.freeze({ offset: this.prg.offset + this.prg.size, size: bytes[5] * 8192 });
        const end = this.chr.offset + this.chr.size;
        if (!this.prg.size || end > bytes.length) {
            throw new Error("iNES PRG/CHR sizes exceed the supplied cartridge or contain no PRG ROM.");
        }
        this.trailing = Object.freeze({ offset: end, size: bytes.length - end });
    }
    /** Total byte length of the parsed cartridge image. */
    get size() {
        return this.#bytes.length;
    }
    /**
     * Copy the full cartridge image so callers cannot mutate the parsed original.
     * @returns Defensive copy of all cartridge bytes.
     */
    bytes() {
        return this.#bytes.slice();
    }
    /**
     * Copy the 16-byte iNES header prefix.
     * @returns Header bytes independent of the internal buffer.
     */
    header() {
        return this.#bytes.slice(0, 16);
    }
    /**
     * Copy one parsed section range from the cartridge image.
     * @param section Offset and size describing a contiguous cartridge range.
     * @returns Bytes for the requested section only.
     */
    section(section) {
        return this.#bytes.slice(section.offset, section.offset + section.size);
    }
    /** Physical PRG offset; undefined never aliases open bus or RAM. */
    readPrg(offset) {
        if (!Number.isInteger(offset) || offset < 0 || offset >= this.prg.size) {
            return undefined;
        }
        return this.#bytes[this.prg.offset + offset];
    }
}
//# sourceMappingURL=cartridge.js.map