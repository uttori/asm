import { normalizeAddressForWidth } from "../address-width.js";
export class OutputWriterService {
    host;
    constructor(host) {
        this.host = host;
    }
    /**
     * Advances the logical write position.
     * @param {number} num The number of bytes to step.
     */
    step(num) {
        if (num === 0) {
            return;
        }
        if (num < 0) {
            throw new Error("step num is negative");
        }
        this.host.currentTargetAddress = this.host.pluginAddressSpace.advance(this.host.currentTargetAddress, num);
        this.host.currentTargetBaseAddress = this.host.pluginAddressSpace.advance(this.host.currentTargetBaseAddress, num);
        this.host.syncWriteStarts();
        this.host.incrementBytesWritten(num);
    }
    /**
     * Writes a single byte at the current logical position.
     * @param {number} num The value to write.
     */
    write1(num) {
        if (Number.isNaN(num)) {
            throw new Error("write1 value is NaN");
        }
        this.verifyLogicalPosition();
        const newPos = this.host.pluginAddressSpace.normalizeForWrite(this.host.currentTargetBaseAddress);
        const logicalAddress = normalizeAddressForWidth(newPos, this.host.pluginAddressSpace.addressWidth);
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
            if (outputOffset >= this.host.outputBytes.length &&
                outputOffset - this.host.outputBytes.length > 0) {
                this.host.fillOutputBytes(this.host.outputBytes.length, this.host.outputFillByte, outputOffset - this.host.outputBytes.length);
            }
            this.host.outputBytes[outputOffset] = num & 0xff;
        }
        this.step(1);
    }
    /**
     * Writes a 16-bit value to output.
     * @param {number} num The value to write.
     */
    write2(num) {
        this.validateWrite(2);
        this.write1(num & 0xff);
        this.write1((num >> 8) & 0xff);
    }
    /**
     * Writes a 24-bit value to output.
     * @param {number} num The value to write.
     */
    write3(num) {
        this.validateWrite(3);
        this.write1(num & 0xff);
        this.write1((num >> 8) & 0xff);
        this.write1((num >> 16) & 0xff);
    }
    /**
     * Writes a 32-bit value to output.
     * @param {number} num The value to write.
     */
    write4(num) {
        this.validateWrite(4);
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
    writeValue(num, width, endianness = "little") {
        if (!Number.isInteger(width) || width < 1) {
            throw new Error(`Invalid write width: ${width}`);
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
    writeBytes(values) {
        this.validateWrite(values.length);
        for (const value of values) {
            this.write1(value);
        }
    }
    /**
     * Runs active address-space and lifecycle validation for a write.
     * @param {number} length The length of the value to write.
     */
    validateWrite(length) {
        this.host.beforeWrite?.(this.host.currentTargetBaseAddress, length);
    }
    /**
     * Finishes the pass.
     */
    finishPass() {
        if (this.host.canFinalize) {
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
    toOutputOffset(addr) {
        return this.host.pluginAddressSpace.toOutputOffset(addr);
    }
    /**
     * Converts an output offset to a logical address.
     * @param {number} addr The output offset.
     * @returns {number} The mapped logical address.
     */
    fromOutputOffset(addr) {
        return this.host.pluginAddressSpace.fromOutputOffset(addr);
    }
    /**
     * Verifies the logical position.
     */
    verifyLogicalPosition() {
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
    advanceLogicalAddress(inaddr, step = 0) {
        return this.host.pluginAddressSpace.advance(inaddr, step);
    }
}
//# sourceMappingURL=output-writer-service.js.map