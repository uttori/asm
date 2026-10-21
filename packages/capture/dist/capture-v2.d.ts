import { type CaptureNesBusAccessV2 } from "./capture-nes-ppu.js";
import type { CaptureNesTimelineV2 } from "./capture-nes-timeline.js";
import type { CaptureInstructionDetail } from "./instruction-detail.js";
import { type CaptureTargetPayload } from "./target-payload.js";
/** Exact counters crossing JavaScript/JSON boundaries. */
export type CaptureU64 = string;
/** Mutually exclusive streams. Bus scope does not contain fetched instruction bytes or registers. */
export type CaptureScopeV2 = "nes.cpu-bus-ppu" | "nes.2a03.instructions" | "snes.65816.instructions" | "snes.cpu-bus" | "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
export interface CaptureCapabilitiesV2 {
    readonly version: 2;
    readonly scope: CaptureScopeV2;
    readonly mode: "lossless";
    readonly ownership: "durable-prefix";
    readonly maxChunkBytes: 262144;
    readonly requiredReserveBytes: 71 | 64 | 80 | 88 | 91 | 128;
    readonly overheadBytes: 4194304;
    readonly resumeSession: false;
    /** Explicit native file capability. Omitted by streamed-only producers. */
    readonly nativeFile?: true;
}
export interface CapturePositionV2 {
    readonly session: string;
    /** Every producer confirms its session scope, including instruction-only captures. */
    readonly scope: CaptureScopeV2;
    readonly state: "armed" | "recording" | "throttled" | "stopping" | "draining" | "complete" | "incomplete";
    readonly producedThrough: CaptureU64;
    readonly deliveredThrough: CaptureU64;
    readonly acceptedThrough: CaptureU64;
    readonly durableThrough: CaptureU64;
    readonly releasedThrough: CaptureU64;
    readonly chunkThrough: CaptureU64;
    readonly producedChunks: CaptureU64;
    readonly bufferedBytes: number;
    readonly allocatedBytes: number;
    readonly throttleCount: CaptureU64;
    readonly clockNumerator: CaptureU64;
    readonly clockDenominator: CaptureU64;
    readonly droppedInScope: "0";
    readonly error: string;
}
/** Local runtime companion operations. Identity is checked against the launched
 * executable before any path or replay state reaches the emulator. */
export type CaptureContextRequest = {
    readonly operation: "context";
    readonly action: "prepare" | "replay" | "restore";
    readonly directory: string;
    /** Full iNES image identity, required for NES contexts. */
    readonly romFileSha256?: string;
    readonly romContentSha256: string;
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
} | {
    readonly operation: "context";
    readonly action: "start" | "stop";
    readonly session: string;
} | {
    readonly operation: "context";
    readonly action: "mark";
    readonly session: string;
    readonly label: string;
} | {
    readonly operation: "context";
    readonly action: "abort" | "status";
};
export type CaptureRequestV2 = CaptureContextRequest | {
    readonly operation: "file-capabilities";
    readonly scope?: CaptureScopeV2;
} | {
    readonly operation: "file-start";
    /** Optional native chunk/writer timings. Omitted for ordinary recording. */
    readonly measureStages?: boolean;
    readonly scope?: CaptureScopeV2;
    readonly bufferBytes: number;
    /** Absolute path on the verified local runtime host. No remote path translation. */
    readonly file: string;
    /** Full iNES identity; independent from the payload digest. */
    readonly romFileSha256?: string;
    readonly romContentSha256: string;
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
} | {
    readonly operation: "file-status" | "file-stop" | "file-abort" | "file-release";
    readonly session: string;
} | {
    readonly operation: "capabilities";
    readonly scope?: CaptureScopeV2;
} | {
    readonly operation: "start";
    readonly bufferBytes: number;
    readonly scope?: CaptureScopeV2;
} | {
    readonly operation: "status" | "stop" | "abort" | "release";
    readonly session: string;
} | {
    readonly operation: "read";
    readonly session: string;
    readonly chunk: CaptureU64;
} | {
    readonly operation: "ack";
    readonly session: string;
    readonly chunk: CaptureU64;
    readonly event: CaptureU64;
};
export type CaptureResultV2 = CaptureCapabilitiesV2 | CapturePositionV2 | {
    readonly hex: string;
} | {
    readonly contextState: string;
};
export type CaptureTransportV2 = (request: CaptureRequestV2) => Promise<CaptureResultV2>;
/**
 * Validate the explicit stream dictionary. Callers choose the instruction default only on omission.
 * @param {unknown} value Scope supplied by the caller or archive header.
 * @returns {CaptureScopeV2} Supported stream identity. Unknown values throw.
 */
export declare const captureScope: (value: unknown) => CaptureScopeV2;
export declare const captureU64: (value: unknown) => bigint;
export declare const captureSession: (value: unknown) => string;
export declare function validateCaptureRequest(value: unknown): asserts value is CaptureRequestV2;
/**
 * Require the requested scope and its reservation size. Never downgrade to a different stream.
 * @param {unknown} value Native capability reply.
 * @param {CaptureScopeV2} scope Requested stream, defaulting to instructions for older callers.
 * @returns {CaptureCapabilitiesV2} Verified lossless ownership and allocation contract.
 */
export declare const validateCaptureCapabilities: (value: unknown, scope?: CaptureScopeV2) => CaptureCapabilitiesV2;
export declare const validateCapturePosition: (value: unknown, session?: string, scope?: CaptureScopeV2) => CapturePositionV2;
/**
 * Accept one wire result after the matching request validator has already run.
 * Capability replies are rebuilt from the negotiated contract; other results keep
 * their validated fields, including native file counters carried beside a position.
 * @param {unknown} value Sidecar or backend capture reply.
 * @returns {CaptureResultV2} A capabilities, position, hex, or context-state result.
 */
export declare function validateCaptureResult(value: unknown): CaptureResultV2;
/**
 * CRC-32C of an ACT2 envelope or archive JSON frame, without changing caller storage.
 * @param {Uint8Array} bytes Byte view; checksum positions are relative to this view.
 * @param {boolean} zeroChecksum Treat ACT2 bytes 56–59 as zero. Defaults to false for JSON frames.
 * @returns {number} Unsigned Castagnoli checksum.
 */
export declare const captureCrc32c: (bytes: Uint8Array, zeroChecksum?: boolean) => number;
export interface CaptureInstructionV2 {
    readonly sequence: CaptureU64;
    readonly ordinal: CaptureU64;
    readonly cycle: CaptureU64;
    readonly address: number;
    readonly detail: CaptureInstructionDetail;
    /** Validated profile identity, independent of debugger register presentation. */
    readonly target: CaptureTargetPayload;
}
/** Actual PPU write decision, attached to the completing CPU-bus access.
 * Byte destinations are physical offsets. Duplicate offsets retain write order.
 * The two raster counters describe the PPU decision, which may differ from the CPU counter.
 */
export interface CapturePPUEffectV2 {
    readonly target: "vram" | "cgram" | "oam";
    readonly outcome: "written" | "blocked" | "latched";
    readonly forcedBlank: boolean;
    readonly renderingRestricted: boolean;
    readonly implementation: "accurate" | "performance";
    readonly vramBytes: 65536 | 131072 | null;
    readonly bytes: readonly {
        readonly address: number;
        readonly value: number;
    }[];
    readonly hcounter: number;
    readonly vcounter: number;
}
/** Actual CPU-bus operation, with exact counters and optional instruction ownership. */
export interface CaptureBusAccessV2 {
    /** Present only on data-port writes in the explicitly negotiated PPU scope. */
    readonly ppu?: CapturePPUEffectV2;
    readonly sequence: CaptureU64;
    /** Zero means no observed instruction owns the access. This is not an instruction event count. */
    readonly ordinal: CaptureU64;
    /** Monotonic SNES master-clock ticks in the archive's rational clock domain. */
    readonly cycle: CaptureU64;
    readonly address: number;
    /** Owning instruction's starting PC, or the current PC when ordinal is zero. */
    readonly pc: number;
    readonly value: number;
    readonly direction: "read" | "write";
    readonly actor: "cpu" | "dma" | "hdma";
    /** DMA/HDMA channel 0..7. CPU accesses have no channel. */
    readonly channel: number | null;
    readonly phase: "cpu" | "dma" | "hdma-table" | "hdma-indirect" | "hdma-transfer";
    /** CPU execution context, not a claim that an instruction caused asynchronous HDMA. */
    readonly context: "unattributed" | "instruction" | "interrupt" | "wait" | "stop";
    /** Horizontal counter in master clocks, 0..1367. */
    readonly hcounter: number;
    /** Zero-based scanline, 0..312 for the supported NTSC/PAL cores. */
    readonly vcounter: number;
}
/** Native DMA run / HDMA payload-burst boundary. End snapshots may lack an observed begin. */
export interface CaptureTransferV2 {
    readonly kind: "transfer";
    readonly sequence: CaptureU64;
    readonly ordinal: CaptureU64;
    readonly cycle: CaptureU64;
    /** Begin event sequence in this session, or zero for an unobserved begin. */
    readonly transferId: CaptureU64;
    readonly pc: number;
    readonly boundary: "begin" | "complete" | "interrupted";
    readonly actor: "dma" | "hdma";
    readonly channel: number;
    readonly context: CaptureBusAccessV2["context"];
    readonly hcounter: number;
    readonly vcounter: number;
    /** Attempted byte slots, including hardware-suppressed accesses. Zero on begin markers. */
    readonly transferred: number;
    /** Raw channel registers at this boundary: DMAP control, BBAD port offset, A1B:A1T source,
     * DAS size/indirect address, DASB indirect bank, A2A table address, and NTLR line counter.
     */
    readonly configuration: {
        readonly dmap: number;
        readonly bbad: number;
        readonly a1t: number;
        readonly a1b: number;
        readonly das: number;
        readonly dasb: number;
        readonly a2a: number;
        readonly ntlr: number;
        /** Bits: DMA enabled, HDMA enabled, HDMA completed, HDMA do-transfer. */
        readonly flags: number;
    };
}
export interface CaptureNesBusChunkV2 extends CaptureChunkBaseV2 {
    readonly scope: "nes.cpu-bus-ppu";
    readonly events: readonly (CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
}
export interface CaptureTransferChunkV2 extends CaptureChunkBaseV2 {
    readonly scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
    readonly events: readonly (CaptureBusAccessV2 | CaptureTransferV2)[];
}
interface CaptureChunkBaseV2 {
    readonly session: string;
    readonly sequence: CaptureU64;
    readonly first: CaptureU64;
    readonly through: CaptureU64;
}
export interface CaptureInstructionChunkV2 extends CaptureChunkBaseV2 {
    readonly scope: "snes.65816.instructions" | "nes.2a03.instructions";
    readonly instructions: readonly CaptureInstructionV2[];
}
export interface CaptureBusChunkV2 extends CaptureChunkBaseV2 {
    readonly scope: "snes.cpu-bus";
    readonly accesses: readonly CaptureBusAccessV2[];
}
/** Scope discrimination prevents bus-only evidence from entering the instruction importer. */
export type CaptureChunkV2 = CaptureInstructionChunkV2 | CaptureBusChunkV2 | CaptureTransferChunkV2 | CaptureNesBusChunkV2;
/**
 * Common ordering fields without converting bus accesses into instruction records.
 * @param {CaptureChunkV2} chunk Validated nonempty chunk.
 * @returns {readonly (CaptureInstructionV2 | CaptureBusAccessV2 | CaptureTransferV2 | CaptureNesBusAccessV2)[]} Original ordered record array.
 */
export declare const captureChunkRecords: (chunk: CaptureChunkV2) => readonly (CaptureInstructionV2 | CaptureBusAccessV2 | CaptureTransferV2 | CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
/**
 * Validate the entire envelope and every record before accepting any event.
 * @param {Uint8Array} bytes Bounded encoded chunk.
 * @param {string} session Negotiated session identity.
 * @param {CaptureScopeV2} scope Negotiated stream. Omission preserves instruction-only callers.
 * @returns {CaptureChunkV2} Fully validated ordered records in exactly the requested scope.
 */
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope?: "snes.65816.instructions" | "nes.2a03.instructions"): CaptureInstructionChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "snes.cpu-bus"): CaptureBusChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu"): CaptureTransferChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "nes.cpu-bus-ppu"): CaptureNesBusChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: CaptureScopeV2): CaptureChunkV2;
export {};
//# sourceMappingURL=capture-v2.d.ts.map