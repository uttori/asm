import type { AssemblerTraceWriteEvent } from "../debug-tracing.js";
import type { AssemblyStageName, TargetAddressSpace, TargetOutputFormat } from "../plugin/contracts.js";
import type { ModuleAssembly } from "./module-assembly.js";
/** Assembler state and hooks the output writer reads and mutates. */
export interface OutputWriterHost {
    /** Relocatable module sink; when present, writes go to section storage instead of mapped output. */
    readonly moduleAssembly?: ModuleAssembly;
    /** Attributes the byte just written to the module's current source range. */
    recordModuleWrite?(): void;
    /** Stage reported in trace write events. */
    traceStage: AssemblyStageName;
    /** Logical address, offset by `base`; advanced by every step. */
    currentTargetAddress: number;
    /** Physical write address, unaffected by `base`; bytes are written here. */
    currentTargetBaseAddress: number;
    /** Active architecture name reported in trace events. */
    arch: string;
    /** Instruction mode of the active stage. */
    mode: "layout" | "emit";
    /** Whether the active stage stores bytes; otherwise writes only advance the cursor. */
    canEmitBytes: boolean;
    /** Whether the active stage may run the target output format's finalizer. */
    canFinalize: boolean;
    /** Assembled output bytes, indexed by output offset. */
    outputBytes: number[] | Uint8Array;
    /** Byte used when a write past the end leaves a gap. */
    outputFillByte: number;
    /** Maps between logical addresses and output offsets and advances addresses. */
    pluginAddressSpace: TargetAddressSpace;
    /** Target output format whose finalizer runs at the end of a pass. */
    pluginOutputFormat: TargetOutputFormat;
    /** Target plugin state passed to the output finalizer. */
    pluginState: Parameters<TargetOutputFormat["finalize"]>[0]["state"];
    /** Fills `length` output bytes starting at offset `start` with `value`. */
    fillOutputBytes(start: number, value: number, length: number): void;
    /** Optional owned-storage path; validation, ownership and trace hooks have already run. */
    writeOutputByte?(offset: number, value: number): void;
    /** Resets logical, physical and start cursors to `address`. */
    setWritePosition(address: number): void;
    /** Copies the current logical and physical addresses into the start cursors. */
    syncWriteStarts(): void;
    /** Adds `num` to the session's emitted-byte counter. */
    incrementBytesWritten(num: number): void;
    /** Lifecycle validation run before `width` bytes are written at `logicalAddress`; may throw. */
    beforeWrite?(logicalAddress: number, width: number): void;
    /** Records one source-owned emitted byte for debug-map generation. */
    recordSourceWrite?(logicalAddress: number, outputOffset: number): void;
    /** Whether structured tracing is active for this assembly session. */
    readonly isTracing: boolean;
    /** Optional structured trace hook invoked once per emitted byte. */
    traceWrite?(event: Omit<AssemblerTraceWriteEvent, "type">): void;
}
/** Writes bytes at the session cursor and maps them to output offsets. */
export declare class OutputWriterService {
    readonly host: OutputWriterHost;
    constructor(host: OutputWriterHost);
    /**
     * Advances the logical write position.
     * @param num The number of bytes to step.
     */
    step(num: number): void;
    /**
     * Writes a single byte at the current logical position.
     * @param num The value to write.
     */
    write1(num: number): void;
    /**
     * Writes a 16-bit value to output.
     * @param num The value to write.
     */
    write2(num: number): void;
    /**
     * Writes a 24-bit value to output.
     * @param num The value to write.
     */
    write3(num: number): void;
    /**
     * Writes a 32-bit value to output.
     * @param num The value to write.
     */
    write4(num: number): void;
    /**
     * Writes the low 1–4 bytes of a safe integer, using two's complement for negatives.
     * Invalid arguments throw before lifecycle hooks, output, or the cursor change.
     * @param num Safe integer; high bits outside the selected width are discarded.
     * @param width Integral byte width from 1 through 4; use writeBytes for wider values.
     * @param endianness Byte order, defaulting to little-endian.
     */
    writeValue(num: number, width: number, endianness?: "little" | "big"): void;
    /**
     * Writes a sequence of already encoded bytes.
     * @param values Bytes to write.
     */
    writeBytes(values: readonly number[]): void;
    /**
     * Runs active address-space and lifecycle validation for a write.
     * @param length The length of the value to write.
     */
    validateWrite(length: number): void;
    /**
     * Finishes the pass.
     */
    finishPass(): void;
    /**
     * Converts a logical address to an output offset.
     * @param addr The logical address.
     * @returns The mapped output offset.
     */
    toOutputOffset(addr: number): number;
    /**
     * Converts an output offset to a logical address.
     * @param addr The output offset.
     * @returns The mapped logical address.
     */
    fromOutputOffset(addr: number): number;
    /**
     * Verifies the logical position.
     */
    verifyLogicalPosition(): void;
    /**
     * Advances and normalizes a logical position.
     * @param inaddr The logical address to advance.
     * @param step The number of bytes to step.
     * @returns The fixed address.
     */
    advanceLogicalAddress(inaddr: number, step?: number): number;
}
//# sourceMappingURL=output-writer-service.d.ts.map