import type { AssemblyStageName } from "../assembler.js";
import { shouldAutoCloseSpcblock } from "../compatibility/asar-compatibility-profile.js";
import type { AssemblerTraceWriteEvent } from "../debug-tracing.js";
import type { DirectiveRuntimeService } from "./directive-runtime-service.js";
import type { TargetProfile } from "../target-profile.js";

export interface RomWriterHost {
  traceStage: AssemblyStageName;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  arch: string;
  mode: "layout" | "emit";
  canEmitBytes: boolean;
  canFinalize: boolean;
  mapper: string;
  sa1banks: number[];
  romdata: number[] | Uint8Array;
  defaultFreespaceByte: number;
  bankCrossCheckMode: "off" | "full" | "half";
  spcInlineCompatMode: boolean;
  inSpcblock: boolean;
  activeFreespaceStartPc: number | null;
  activeFreespaceContentStartPc: number | null;
  checksumFixEnabled: boolean;
  targetProfile: TargetProfile;
  fillRomData(start: number, value: number, length: number): void;
  writeDataBytes(start: number, value: number, length?: number): void;
  updateHeaderAndCRC32(): void;
  directiveRuntime: Pick<DirectiveRuntimeService, "handleEndSpcblock">;
  setWritePosition(address: number): void;
  syncWriteStarts(): void;
  incrementBytesWritten(num: number): void;
  beforeWrite?(logicalAddress: number, width: number): void;
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
    this.host.currentTargetAddress = this.host.targetProfile.addressSpace.advance(
      this.host.currentTargetAddress,
      num,
      this.host,
    );
    this.host.currentTargetBaseAddress = this.host.targetProfile.addressSpace.advance(
      this.host.currentTargetBaseAddress,
      num,
      this.host,
    );
    this.host.syncWriteStarts();
    this.host.incrementBytesWritten(num);
  }

  /**
   * Writes a single byte at the current position using 65816/ROM addressing.
   * @param {number} num The value to write.
   */
  write1(num: number): void {
    if (Number.isNaN(num)) {
      throw new Error("write1_65816 num is NaN");
    }

    this.verifysnespos();

    const newPos = this.host.targetProfile.addressSpace.normalizeForWrite(
      this.host.currentTargetBaseAddress,
      this.host,
    );
    const addressWidth = this.host.targetProfile.addressSpace.addressWidth;
    const logicalMask = addressWidth < 32 ? 2 ** addressWidth - 1 : 0xffffffff;
    const logicalAddress = newPos & logicalMask;
    this.host.beforeWrite?.(logicalAddress, 1);
    const pcpos = this.convertTargetAddressToRomOffset(logicalAddress);
    if (pcpos < 0 && this.host.targetProfile.addressSpace.unmappedWriteBehavior === "throw") {
      throw new Error(
        `Address $${newPos.toString(16).toUpperCase()} does not map to ${this.host.targetProfile.addressSpace.name} output.`,
      );
    }

    // Emit tracing before the position advances so listeners see the exact byte
    // address that will be written for this stage.
    this.host.traceWrite?.({
      stage: this.host.traceStage,
      arch: this.host.inSpcblock ? "spc700" : this.host.arch,
      file: "",
      line: 0,
      raw: "",
      normalized: "",
      snesAddress: logicalAddress,
      pcAddress: pcpos,
      value: num & 0xff,
    });

    if (this.host.canEmitBytes) {
      if (pcpos >= this.host.romdata.length && pcpos - this.host.romdata.length > 0) {
        this.host.fillRomData(
          this.host.romdata.length,
          this.host.defaultFreespaceByte,
          pcpos - this.host.romdata.length,
        );
      }

      this.host.romdata[pcpos] = num & 0xff;
    }

    this.step(1);
  }

  /**
   * Writes a 16-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write2(num: number): void {
    this.assertBankCrossAllowed(2);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
  }

  /**
   * Writes a 24-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write3(num: number): void {
    this.assertBankCrossAllowed(3);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
  }

  /**
   * Writes a 32-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write4(num: number): void {
    this.assertBankCrossAllowed(4);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
    this.write1((num >> 24) & 0xff);
  }

  /**
   * Writes an arbitrary-width value for architecture extensions.
   * @param {number} num Value to write.
   * @param {number} width Width in bytes.
   * @param {"little" | "big"} endianness Byte order.
   */
  writeValue(num: number, width: number, endianness: "little" | "big" = "little"): void {
    if (!Number.isInteger(width) || width < 1) {
      throw new Error(`Invalid write width: ${width}`);
    }
    this.assertBankCrossAllowed(width);
    for (let index = 0; index < width; index++) {
      const shift = endianness === "little" ? index : width - index - 1;
      this.write1((num >> (shift * 8)) & 0xff);
    }
  }

  /**
   * Writes a sequence of already encoded bytes.
   * @param {readonly number[]} values Bytes to write.
   */
  writeBytes(values: readonly number[]): void {
    this.assertBankCrossAllowed(values.length);
    for (const value of values) {
      this.write1(value);
    }
  }

  /**
   * Asserts that bank cross is allowed.
   * @param {number} length The length of the value to write.
   */
  assertBankCrossAllowed(length: number): void {
    if (this.host.bankCrossCheckMode === "off" || length <= 1) {
      return;
    }

    const start = this.host.currentTargetBaseAddress & 0xffffff;
    const end = (start + length - 1) & 0xffffff;
    const mask = this.host.bankCrossCheckMode === "half" ? 0x7fff8000 : 0x7fff0000;

    if (((start ^ end) & mask) !== 0) {
      const errorAddr = (start + length) & 0xffffff;
      throw new Error(
        `Ebank_border_crossed: A bank border was crossed, SNES address $${errorAddr.toString(16).toUpperCase().padStart(6, "0")}.`,
      );
    }
  }

  /**
   * Finishes the pass.
   */
  finishPass(): void {
    if (shouldAutoCloseSpcblock(this.host.spcInlineCompatMode, this.host.inSpcblock)) {
      this.host.directiveRuntime.handleEndSpcblock(["endspcblock", "execute", "0"]);
    }
    if (this.host.inSpcblock) {
      throw new Error("Missing endspcblock before end of pass.");
    }
    if (
      this.host.canFinalize &&
      this.host.activeFreespaceStartPc !== null &&
      this.host.activeFreespaceContentStartPc !== null
    ) {
      const contentEndPc =
        this.convertTargetAddressToRomOffset(this.host.currentTargetBaseAddress & 0xffffff) - 1;
      if (contentEndPc >= this.host.activeFreespaceContentStartPc) {
        const contentLen = contentEndPc - this.host.activeFreespaceContentStartPc + 1;
        const ratsLenMinusOne = Math.max(0, contentLen - 1) & 0xffff;
        const ratsComp = ~ratsLenMinusOne & 0xffff;

        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 4, ratsLenMinusOne & 0xff, 1);
        this.host.writeDataBytes(
          this.host.activeFreespaceStartPc + 5,
          (ratsLenMinusOne >> 8) & 0xff,
          1,
        );
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 6, ratsComp & 0xff, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 7, (ratsComp >> 8) & 0xff, 1);
      }
    }
    if (this.host.canFinalize) {
      this.host.targetProfile.outputFormat.finalize({
        canFinalize: true,
        checksumFixEnabled: this.host.checksumFixEnabled,
        bytes: this.host.romdata,
        updateChecksum: () => this.host.updateHeaderAndCRC32(),
      });
    }
  }

  /**
   * Converts a SNES address to a PC offset.
   * @param {number} addr The SNES address to convert.
   * @returns {number} The PC offset.
   */
  convertTargetAddressToRomOffset(addr: number): number {
    return this.host.targetProfile.addressSpace.toOutputOffset(addr, this.host);
  }

  /**
   * Converts a PC offset to a SNES address.
   * @param {number} addr The PC offset to convert.
   * @returns {number} The SNES address.
   */
  pctosnes(addr: number): number {
    return this.host.targetProfile.addressSpace.fromOutputOffset(addr, this.host);
  }

  /**
   * Verifies the SNES position.
   */
  verifysnespos(): void {
    if (this.host.currentTargetAddress < 0 || this.host.currentTargetBaseAddress < 0) {
      this.host.setWritePosition(this.host.targetProfile.addressSpace.defaultOrigin);
    }
  }

  /**
   * Fixes the SNES position.
   * @param {number} inaddr The address to fix.
   * @param {number} step The number of bytes to step.
   * @returns {number} The fixed address.
   */
  fixsnespos(inaddr: number, step = 0): number {
    return this.host.targetProfile.addressSpace.advance(inaddr, step, this.host);
  }
}
