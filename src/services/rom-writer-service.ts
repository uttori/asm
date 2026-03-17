import type { AssemblerTraceWriteEvent } from "../debug-tracing.js";

export interface RomWriterHost {
  snespos: number;
  realsnespos: number;
  arch: string;
  mode: "layout" | "emit";
  canEmitBytes: boolean;
  canFinalize: boolean;
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
  /** Optional structured trace hook invoked once per emitted byte. */
  traceWrite?(event: Omit<AssemblerTraceWriteEvent, "type">): void;
}

export class RomWriterService {
  constructor(readonly host: RomWriterHost) {}

  /**
   * Steps the SNES position.
   * @param {number} num The number of bytes to step.
   */
  step(num: number): void {
    if (num === 0) {
      return;
    }
    if (num < 0) {
      throw new Error("step num is negative");
    }
    this.host.snespos = (this.host.snespos & 0xff000000) | this.fixsnespos(this.host.snespos & 0xffffff, num);
    this.host.realsnespos = (this.host.realsnespos & 0xff000000) | this.fixsnespos(this.host.realsnespos & 0xffffff, num);
    this.host.syncWriteStarts();
    this.host.incrementBytesWritten(num);
  }

  /**
   * Writes a single byte at the current position using 65816/ROM addressing.
   * @param {number} num The value to write.
   */
  write1_65816(num: number): void {
    if (Number.isNaN(num)) {
      throw new Error("write1_65816 num is NaN");
    }

    this.verifysnespos();

    const wrappedPos = this.fixsnespos(this.host.realsnespos & 0xFFFFFF);
    const bankByte = this.host.realsnespos & 0xFF000000;
    const newPos = bankByte | wrappedPos;
    const pcpos = this.snestopc(newPos & 0xFFFFFF);

    // Emit tracing before the position advances so listeners see the exact byte
    // address that will be written for this pass.
    this.host.traceWrite?.({
      pass: this.host.pass,
      arch: this.host.inSpcblock ? "spc700" : this.host.arch,
      file: "",
      line: 0,
      raw: "",
      normalized: "",
      snesAddress: newPos & 0xFFFFFF,
      pcAddress: pcpos,
      value: num & 0xFF,
    });

    if (this.host.canEmitBytes) {
      if (pcpos >= this.host.romdata.length && pcpos - this.host.romdata.length > 0) {
        this.host.fillRomData(this.host.romdata.length, this.host.default_freespacebyte, pcpos - this.host.romdata.length);
      }

      this.host.romdata[pcpos] = num & 0xFF;
    }

    this.step(1);
  }

  /**
   * Writes a single byte to the ROM.
   * @param {number} num The value to write.
   */
  write1(num: number): void {
    this.write1_65816(num);
  }

  /**
   * Writes a 16-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write2(num: number): void {
    this.assertBankCrossAllowed(2);
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
  }

  /**
   * Writes a 24-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write3(num: number): void {
    this.assertBankCrossAllowed(3);
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
  }

  /**
   * Writes a 32-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write4(num: number): void {
    this.assertBankCrossAllowed(4);
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
    this.write1((num >> 24) & 0xFF);
  }

  /**
   * Asserts that bank cross is allowed.
   * @param {number} length The length of the value to write.
   */
  assertBankCrossAllowed(length: number): void {
    if (this.host.bankCrossCheckMode === "off" || length <= 1) {
      return;
    }

    const start = this.host.realsnespos & 0xFFFFFF;
    const end = (start + length - 1) & 0xFFFFFF;
    const mask = this.host.bankCrossCheckMode === "half" ? 0x7FFF8000 : 0x7FFF0000;

    if (((start ^ end) & mask) !== 0) {
      const errorAddr = (start + length) & 0xFFFFFF;
      throw new Error(`Ebank_border_crossed: A bank border was crossed, SNES address $${errorAddr.toString(16).toUpperCase().padStart(6, "0")}.`);
    }
  }

  /**
   * Finishes the pass.
   */
  finishPass(): void {
    if (this.host.spcInlineCompatMode && this.host.inSpcblock) {
      this.host.handleEndSpcblock(["endspcblock", "execute", "0"]);
    }
    if (this.host.inSpcblock) {
      throw new Error("Missing endspcblock before end of pass.");
    }
    if (this.host.canFinalize && this.host.activeFreespaceStartPc !== null && this.host.activeFreespaceContentStartPc !== null) {
      const contentEndPc = this.snestopc(this.host.realsnespos & 0xFFFFFF) - 1;
      if (contentEndPc >= this.host.activeFreespaceContentStartPc) {
        const contentLen = (contentEndPc - this.host.activeFreespaceContentStartPc) + 1;
        const ratsLenMinusOne = Math.max(0, contentLen - 1) & 0xFFFF;
        const ratsComp = (~ratsLenMinusOne) & 0xFFFF;

        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 4, ratsLenMinusOne & 0xFF, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 5, (ratsLenMinusOne >> 8) & 0xFF, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 6, ratsComp & 0xFF, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 7, (ratsComp >> 8) & 0xFF, 1);
      }
    }
    if (this.host.canFinalize && this.host.checksumFixEnabled) {
      this.host.updateHeaderAndCRC32();
    }
  }

  /**
   * Converts a SNES address to a PC offset.
   * @param {number} addr The SNES address to convert.
   * @returns {number} The PC offset.
   */
  snestopc(addr: number): number {
    if (addr < 0 || addr > 0xFFFFFF) return -1;

    if (this.host.mapper === "lorom") {
      if ((addr & 0xFE0000) === 0x7E0000 || (addr & 0x408000) === 0x000000 || (addr & 0x708000) === 0x700000) {
        return -1;
      }
      return ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
    }

    if (this.host.mapper === "hirom") {
      if ((addr & 0xFE0000) === 0x7E0000 || (addr & 0x408000) === 0x000000) {
        return -1;
      }
      return addr & 0x3FFFFF;
    }

    if (this.host.mapper === "exlorom") {
      if ((addr & 0xF00000) === 0x700000 || (addr & 0x408000) === 0x000000) {
        return -1;
      }
      if (addr & 0x800000) {
        return ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
      }
      return (((addr & 0x7F0000) >> 1) | (addr & 0x7FFF)) + 0x400000;
    }

    if (this.host.mapper === "exhirom") {
      if ((addr & 0xFE0000) === 0x7E0000 || (addr & 0x408000) === 0x000000) {
        return -1;
      }
      return (addr & 0x800000) === 0 ? (addr & 0x3FFFFF) | 0x400000 : addr & 0x3FFFFF;
    }

    if (this.host.mapper === "sfxrom") {
      if ((addr & 0x600000) === 0x600000 || (addr & 0x408000) === 0x000000 || (addr & 0x800000) === 0x800000) {
        return -1;
      }
      return addr & 0x400000 ? addr & 0x3FFFFF : ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
    }

    if (this.host.mapper === "sa1rom") {
      if ((addr & 0x408000) === 0x008000) {
        return this.host.sa1banks[(addr & 0xE00000) >> 21] | ((addr & 0x1F0000) >> 1) | (addr & 0x007FFF);
      }
      if ((addr & 0xC00000) === 0xC00000) {
        return this.host.sa1banks[((addr & 0x100000) >> 20) | ((addr & 0x200000) >> 19)] | (addr & 0x0FFFFF);
      }
      return -1;
    }

    if (this.host.mapper === "bigsa1rom") {
      if ((addr & 0xC00000) === 0xC00000) {
        return (addr & 0x3FFFFF) | 0x400000;
      }
      if ((addr & 0xC00000) === 0x000000 || (addr & 0xC00000) === 0x800000) {
        if ((addr & 0x008000) === 0) {
          return -1;
        }
        return ((addr & 0x800000) >> 2) | ((addr & 0x3F0000) >> 1) | (addr & 0x7FFF);
      }
      return -1;
    }

    if (this.host.mapper === "norom") {
      return addr;
    }

    return -1;
  }

  /**
   * Converts a PC offset to a SNES address.
   * @param {number} addr The PC offset to convert.
   * @returns {number} The SNES address.
   */
  pctosnes(addr: number): number {
    if (addr < 0) return -1;

    if (this.host.mapper === "lorom") {
      if (addr >= 0x400000) return -1;
      addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
      return addr | 0x800000;
    }

    if (this.host.mapper === "hirom") {
      if (addr >= 0x400000) return -1;
      return addr | 0xC00000;
    }

    if (this.host.mapper === "exlorom") {
      if (addr >= 0x800000) return -1;
      if (addr & 0x400000) {
        addr -= 0x400000;
        addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
        return addr;
      }
      addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
      return addr | 0x800000;
    }

    if (this.host.mapper === "exhirom") {
      if (addr >= 0x800000) return -1;
      return addr & 0x400000 ? addr : addr | 0xC00000;
    }

    if (this.host.mapper === "sa1rom") {
      if (addr >= 0x800000) return -1;
      for (let i = 0; i < 8; i++) {
        if (this.host.sa1banks[i] === (addr & 0x700000)) {
          return 0x008000 | (i << 21) | ((addr & 0x0F8000) << 1) | (addr & 0x7FFF);
        }
      }
      return -1;
    }

    if (this.host.mapper === "bigsa1rom") {
      if (addr >= 0x800000) return -1;
      if ((addr & 0x400000) === 0x400000) {
        return addr | 0xC00000;
      }
      if ((addr & 0x600000) === 0x000000) {
        return ((addr << 1) & 0x3F0000) | 0x8000 | (addr & 0x7FFF);
      }
      if ((addr & 0x600000) === 0x200000) {
        return 0x800000 | ((addr << 1) & 0x3F0000) | 0x8000 | (addr & 0x7FFF);
      }
      return -1;
    }

    if (this.host.mapper === "sfxrom") {
      if (addr >= 0x200000) return -1;
      return (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
    }

    if (this.host.mapper === "norom") {
      return addr;
    }

    return -1;
  }

  /**
   * Verifies the SNES position.
   */
  verifysnespos(): void {
    if (this.host.snespos < 0 || this.host.realsnespos < 0) {
      this.host.setWritePosition(0x008000);
    }
  }

  /**
   * Fixes the SNES position.
   * @param {number} inaddr The address to fix.
   * @param {number} step The number of bytes to step.
   * @returns {number} The fixed address.
   */
  fixsnespos(inaddr: number, step = 0): number {
    const newAddr = inaddr + step;

    if ((inaddr & 0xFF0000) !== (newAddr & 0xFF0000)) {
      switch (this.host.mapper) {
        case "lorom":
          return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
        case "hirom":
        case "exhirom":
        case "sfxrom":
        case "sa1rom":
          if ((inaddr & 0x400000) === 0) {
            return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
          }
          return newAddr;
        case "exlorom":
        case "bigsa1rom":
          return this.pctosnes(this.snestopc(inaddr) + step);
        case "norom":
          return newAddr;
        default:
          throw new Error(`Unknown mapper type: ${this.host.mapper}`);
      }
    }

    return newAddr;
  }
}
