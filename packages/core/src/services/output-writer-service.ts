import { normalizeAddressForWidth } from "../address-width.js";
import type { AssemblerTraceWriteEvent } from "../debug-tracing.js";
import type {
  AssemblyStageName,
  TargetAddressSpace,
  TargetOutputFormat,
} from "../plugin/contracts.js";
import type { ModuleAssembly } from "./module-assembly.js";

export interface OutputWriterHost {
  readonly moduleAssembly?: ModuleAssembly;
  recordModuleWrite?(): void;
  traceStage: AssemblyStageName;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  arch: string;
  mode: "layout" | "emit";
  canEmitBytes: boolean;
  canFinalize: boolean;
  outputBytes: number[] | Uint8Array;
  outputFillByte: number;
  pluginAddressSpace: TargetAddressSpace;
  pluginOutputFormat: TargetOutputFormat;
  pluginState: Parameters<TargetOutputFormat["finalize"]>[0]["state"];
  fillOutputBytes(start: number, value: number, length: number): void;
  /** Optional owned-storage path; validation, ownership and trace hooks have already run. */
  writeOutputByte?(offset: number, value: number): void;
  setWritePosition(address: number): void;
  syncWriteStarts(): void;
  incrementBytesWritten(num: number): void;
  beforeWrite?(logicalAddress: number, width: number): void;
  /** Records one source-owned emitted byte for debug-map generation. */
  recordSourceWrite?(logicalAddress: number, outputOffset: number): void;
  /** Whether structured tracing is active for this assembly session. */
  readonly isTracing: boolean;
  /** Optional structured trace hook invoked once per emitted byte. */
  traceWrite?(event: Omit<AssemblerTraceWriteEvent, "type">): void;
}

export class OutputWriterService {
  constructor(readonly host: OutputWriterHost) {}

  /**
   * Advances the logical write position.
   * @param {number} num The number of bytes to step.
   */
  step(num: number): void {
    if (num === 0) {
      return;
    }
    if (num < 0) {
      throw new Error("step num is negative");
    }
    if (this.host.moduleAssembly) {
      const next = this.host.moduleAssembly.advance(num);
      this.host.currentTargetAddress = next;
      this.host.currentTargetBaseAddress = next;
      this.host.syncWriteStarts();
      this.host.incrementBytesWritten(num);
      return;
    }
    this.host.currentTargetAddress = this.host.pluginAddressSpace.advance(
      this.host.currentTargetAddress,
      num,
    );
    this.host.currentTargetBaseAddress = this.host.pluginAddressSpace.advance(
      this.host.currentTargetBaseAddress,
      num,
    );
    this.host.syncWriteStarts();
    this.host.incrementBytesWritten(num);
  }

  /**
   * Writes a single byte at the current logical position.
   * @param {number} num The value to write.
   */
  write1(num: number): void {
    if (Number.isNaN(num)) {
      throw new Error("write1 value is NaN");
    }
    // Section offsets are not mapped bus addresses. The linker owns mapper checks and placement.
    if (this.host.moduleAssembly) {
      this.host.moduleAssembly.write(num);
      this.host.recordModuleWrite?.();
      this.step(1);
      return;
    }

    this.verifyLogicalPosition();

    const newPos = this.host.pluginAddressSpace.normalizeForWrite(
      this.host.currentTargetBaseAddress,
    );
    const logicalAddress = normalizeAddressForWidth(
      newPos,
      this.host.pluginAddressSpace.addressWidth,
    );
    this.host.beforeWrite?.(logicalAddress, 1);
    const outputOffset = this.toOutputOffset(logicalAddress);
    if (this.host.canEmitBytes) {
      this.host.recordSourceWrite?.(logicalAddress, outputOffset);
    }

    // Emit tracing before the position advances so listeners see the exact byte
    // address that will be written for this stage.
    if (this.host.isTracing) {
      this.host.traceWrite?.({
        stage: this.host.traceStage,
        arch: this.host.arch,
        file: "",
        line: 0,
        raw: "",
        normalized: "",
        logicalAddress,
        addressWidth: this.host.pluginAddressSpace.addressWidth,
        outputOffset,
        value: num & 0xff,
      });
    }

    if (outputOffset < 0) {
      this.step(1);
      return;
    }

    if (this.host.canEmitBytes) {
      if (this.host.writeOutputByte) {
        this.host.writeOutputByte(outputOffset, num);
      } else {
        // Structural hosts may still supply their own plain/fixed output container.
        if (outputOffset > this.host.outputBytes.length) {
          this.host.fillOutputBytes(
            this.host.outputBytes.length,
            this.host.outputFillByte,
            outputOffset - this.host.outputBytes.length,
          );
        }
        this.host.outputBytes[outputOffset] = num & 0xff;
      }
    }

    this.step(1);
  }

  /**
   * Writes a 16-bit value to output.
   * @param {number} num The value to write.
   */
  write2(num: number): void {
    this.validateWrite(2);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
  }

  /**
   * Writes a 24-bit value to output.
   * @param {number} num The value to write.
   */
  write3(num: number): void {
    this.validateWrite(3);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
  }

  /**
   * Writes a 32-bit value to output.
   * @param {number} num The value to write.
   */
  write4(num: number): void {
    this.validateWrite(4);
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
    this.write1((num >> 24) & 0xff);
  }

  /**
   * Writes the low 1–4 bytes of a safe integer, using two's complement for negatives.
   * Invalid arguments throw before lifecycle hooks, output, or the cursor change.
   * @param {number} num Safe integer; high bits outside the selected width are discarded.
   * @param {number} width Integral byte width from 1 through 4; use writeBytes for wider values.
   * @param {"little" | "big"} endianness Byte order, defaulting to little-endian.
   */
  writeValue(num: number, width: number, endianness: "little" | "big" = "little"): void {
    // JavaScript shifts wrap at 32 bits, so accepting a wider number would repeat low bytes.
    if (!Number.isInteger(width) || width < 1 || width > 4) {
      throw new Error(`Invalid write width: ${width}`);
    }
    if (!Number.isSafeInteger(num)) {
      throw new Error(`Write value must be a safe integer: ${num}`);
    }
    if (!["little", "big"].includes(endianness)) {
      throw new Error(`Invalid write endianness: ${endianness}`);
    }
    this.validateWrite(width);
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
    this.validateWrite(values.length);
    for (const value of values) {
      this.write1(value);
    }
  }

  /**
   * Runs active address-space and lifecycle validation for a write.
   * @param {number} length The length of the value to write.
   */
  validateWrite(length: number): void {
    if (this.host.moduleAssembly) {
      return;
    }
    this.host.beforeWrite?.(this.host.currentTargetBaseAddress, length);
  }

  /**
   * Finishes the pass.
   */
  finishPass(): void {
    if (this.host.canFinalize && !this.host.moduleAssembly) {
      this.host.pluginOutputFormat.finalize({
        state: this.host.pluginState,
        outputBytes: this.host.outputBytes,
      });
    }
  }

  /**
   * Converts a logical address to an output offset.
   * @param {number} addr The logical address.
   * @returns {number} The mapped output offset.
   */
  toOutputOffset(addr: number): number {
    if (this.host.moduleAssembly) {
      return -1;
    }
    return this.host.pluginAddressSpace.toOutputOffset(addr);
  }

  /**
   * Converts an output offset to a logical address.
   * @param {number} addr The output offset.
   * @returns {number} The mapped logical address.
   */
  fromOutputOffset(addr: number): number {
    return this.host.pluginAddressSpace.fromOutputOffset(addr);
  }

  /**
   * Verifies the logical position.
   */
  verifyLogicalPosition(): void {
    if (this.host.currentTargetAddress < 0 || this.host.currentTargetBaseAddress < 0) {
      this.host.setWritePosition(this.host.pluginAddressSpace.defaultOrigin);
    }
  }

  /**
   * Advances and normalizes a logical position.
   * @param {number} inaddr The logical address to advance.
   * @param {number} step The number of bytes to step.
   * @returns {number} The fixed address.
   */
  advanceLogicalAddress(inaddr: number, step = 0): number {
    return this.host.pluginAddressSpace.advance(inaddr, step);
  }
}
