/** A byte range in the complete cartridge file. End is exclusive. */
export interface NesSection {
  readonly offset: number;
  readonly size: number;
}

/** Parsed legacy iNES cartridge. Byte access returns copies, preserving the original input identity. */
export class NesCartridge {
  readonly #bytes: Uint8Array;
  readonly mapper: number;
  readonly battery: boolean;
  readonly mirroring: "horizontal" | "vertical" | "four-screen";
  readonly trainer: NesSection;
  readonly prg: NesSection;
  readonly chr: NesSection;
  readonly trailing: NesSection;
  /** Legacy zero means unspecified; mapper-specific defaults belong to the machine profile. */
  readonly declaredPrgRamSize: number | undefined;

  constructor(input: Uint8Array) {
    this.#bytes = Uint8Array.from(input);
    const bytes = this.#bytes;
    if (
      bytes.length < 16 ||
      bytes[0] !== 0x4e ||
      bytes[1] !== 0x45 ||
      bytes[2] !== 0x53 ||
      bytes[3] !== 0x1a
    ) {
      throw new Error("Expected a complete 16-byte iNES header.");
    }
    // NES 2.0 reuses legacy fields with different sizes and mapper bits; partial interpretation is unsafe.
    if ((bytes[7] & 0x0c) === 0x08)
      throw new Error("NES 2.0 cartridges are not supported by this analysis profile.");
    if ((bytes[7] & 0x0f) !== 0) throw new Error("Unsupported iNES console or header version.");
    this.mapper = (bytes[6] >>> 4) | (bytes[7] & 0xf0);
    this.battery = Boolean(bytes[6] & 2);
    this.mirroring = bytes[6] & 1 ? "vertical" : "horizontal";
    if (bytes[6] & 8) this.mirroring = "four-screen";
    this.declaredPrgRamSize = bytes[8] ? bytes[8] * 8192 : undefined;
    this.trainer = Object.freeze({ offset: 16, size: bytes[6] & 4 ? 512 : 0 });
    this.prg = Object.freeze({ offset: 16 + this.trainer.size, size: bytes[4] * 16384 });
    this.chr = Object.freeze({ offset: this.prg.offset + this.prg.size, size: bytes[5] * 8192 });
    const end = this.chr.offset + this.chr.size;
    if (!this.prg.size || end > bytes.length)
      throw new Error("iNES PRG/CHR sizes exceed the supplied cartridge or contain no PRG ROM.");
    this.trailing = Object.freeze({ offset: end, size: bytes.length - end });
  }

  get size(): number {
    return this.#bytes.length;
  }
  bytes(): Uint8Array {
    return this.#bytes.slice();
  }
  header(): Uint8Array {
    return this.#bytes.slice(0, 16);
  }
  section(section: NesSection): Uint8Array {
    return this.#bytes.slice(section.offset, section.offset + section.size);
  }
  /** Physical PRG offset; undefined never aliases open bus or RAM. */
  readPrg(offset: number): number | undefined {
    if (!Number.isInteger(offset) || offset < 0 || offset >= this.prg.size) return undefined;
    return this.#bytes[this.prg.offset + offset];
  }
}
