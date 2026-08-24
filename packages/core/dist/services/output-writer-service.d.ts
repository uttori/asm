import type { AssemblerTraceWriteEvent } from "../debug-tracing.js";
import type { AssemblyStageName, TargetAddressSpace, TargetOutputFormat } from "../plugin/contracts.js";
export interface OutputWriterHost {
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
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
    beforeWrite?(logicalAddress: number, width: number): void;
    /** Optional structured trace hook invoked once per emitted byte. */
    traceWrite?(event: Omit<AssemblerTraceWriteEvent, "type">): void;
}
export declare class OutputWriterService {
    readonly host: OutputWriterHost;
    constructor(host: OutputWriterHost);
    /**
     * Advances the logical write position.
     * @param {number} num The number of bytes to step.
     */
    step(num: number): void;
    /**
     * Writes a single byte at the current logical position.
     * @param {number} num The value to write.
     */
    write1(num: number): void;
    /**
     * Writes a 16-bit value to output.
     * @param {number} num The value to write.
     */
    write2(num: number): void;
    /**
     * Writes a 24-bit value to output.
     * @param {number} num The value to write.
     */
    write3(num: number): void;
    /**
     * Writes a 32-bit value to output.
     * @param {number} num The value to write.
     */
    write4(num: number): void;
    /**
     * Writes an arbitrary-width value for architecture extensions.
     * @param {number} num Value to write.
     * @param {number} width Width in bytes.
     * @param {"little" | "big"} endianness Byte order.
     */
    writeValue(num: number, width: number, endianness?: "little" | "big"): void;
    /**
     * Writes a sequence of already encoded bytes.
     * @param {readonly number[]} values Bytes to write.
     */
    writeBytes(values: readonly number[]): void;
    /**
     * Runs active address-space and lifecycle validation for a write.
     * @param {number} length The length of the value to write.
     */
    validateWrite(length: number): void;
    /**
     * Finishes the pass.
     */
    finishPass(): void;
    /**
     * Converts a logical address to an output offset.
     * @param {number} addr The logical address.
     * @returns {number} The mapped output offset.
     */
    toOutputOffset(addr: number): number;
    /**
     * Converts an output offset to a logical address.
     * @param {number} addr The output offset.
     * @returns {number} The mapped logical address.
     */
    fromOutputOffset(addr: number): number;
    /**
     * Verifies the logical position.
     */
    verifyLogicalPosition(): void;
    /**
     * Advances and normalizes a logical position.
     * @param {number} inaddr The logical address to advance.
     * @param {number} step The number of bytes to step.
     * @returns {number} The fixed address.
     */
    advanceLogicalAddress(inaddr: number, step?: number): number;
}
//# sourceMappingURL=output-writer-service.d.ts.map