import { type CaptureNesBusAccessV2 } from "./capture-nes-ppu.js";
import type { CaptureNesTimelineV2 } from "./capture-nes-timeline.js";
import type { CaptureInstructionDetail } from "./instruction-detail.js";
import { type CaptureTargetPayload } from "./target-payload.js";
/** Exact counters crossing JavaScript/JSON boundaries. */
export type CaptureU64 = string;
/** Mutually exclusive streams. Bus scope does not contain fetched instruction bytes or registers. */
export type CaptureScopeV2 = "nes.cpu-bus-ppu" | "nes.2a03.instructions" | "snes.65816.instructions" | "snes.cpu-bus" | "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
/** Native capability reply. Every field except `nativeFile` must match the negotiated contract exactly. */
export interface CaptureCapabilitiesV2 {
    /** Wire protocol generation; only ACT2 version 2 is accepted. */
    readonly version: 2;
    /** Stream the producer will record; never downgraded to another scope. */
    readonly scope: CaptureScopeV2;
    /** Producers must never drop in-scope events. */
    readonly mode: "lossless";
    /** Producer retains events until the consumer acknowledges them as durable. */
    readonly ownership: "durable-prefix";
    /** Upper bound on one encoded chunk, in bytes. */
    readonly maxChunkBytes: 262144;
    /** Per-record ring reservation in bytes, fixed by scope (71 SNES instructions, 91 NES instructions, 64/80/88 SNES bus scopes, 128 NES bus). */
    readonly requiredReserveBytes: 71 | 64 | 80 | 88 | 91 | 128;
    /** Fixed producer allocation overhead in bytes, beyond the requested buffer. */
    readonly overheadBytes: 4194304;
    /** Sessions cannot be resumed after a disconnect; a new session must start. */
    readonly resumeSession: false;
    /** Explicit native file capability. Omitted by streamed-only producers. */
    readonly nativeFile?: true;
}
/**
 * Producer status snapshot. Event boundaries are non-decreasing in the order
 * released ≤ durable ≤ accepted ≤ delivered ≤ produced.
 */
export interface CapturePositionV2 {
    /** 32-hex-digit session identity. */
    readonly session: string;
    /** Every producer confirms its session scope, including instruction-only captures. */
    readonly scope: CaptureScopeV2;
    /** Session lifecycle state. `complete` requires reconciled totals; `incomplete` marks a failed or truncated session. */
    readonly state: "armed" | "recording" | "throttled" | "stopping" | "draining" | "complete" | "incomplete";
    /** Last event sequence the producer has recorded. */
    readonly producedThrough: CaptureU64;
    /** Last event sequence handed to the consumer in a chunk. */
    readonly deliveredThrough: CaptureU64;
    /** Last event sequence the consumer has acknowledged receiving. */
    readonly acceptedThrough: CaptureU64;
    /** Last event sequence the consumer has persisted durably. */
    readonly durableThrough: CaptureU64;
    /** Last event sequence whose buffer space the producer has reclaimed. */
    readonly releasedThrough: CaptureU64;
    /** Last delivered chunk sequence; never exceeds `producedChunks`. */
    readonly chunkThrough: CaptureU64;
    /** Number of chunks the producer has sealed. */
    readonly producedChunks: CaptureU64;
    /** Bytes currently held in the producer buffer, 0..allocatedBytes; zero once complete. */
    readonly bufferedBytes: number;
    /** Producer buffer allocation in bytes, at most 64 MiB. */
    readonly allocatedBytes: number;
    /** Times the producer stalled emulation to avoid dropping events. */
    readonly throttleCount: CaptureU64;
    /** Numerator of the rational clock domain for record `cycle` values; nonzero. */
    readonly clockNumerator: CaptureU64;
    /** Denominator of the rational clock domain for record `cycle` values; nonzero. */
    readonly clockDenominator: CaptureU64;
    /** Lossless contract: always zero. */
    readonly droppedInScope: "0";
    /** Producer failure text, at most 256 characters; empty when healthy and required empty when complete. */
    readonly error: string;
}
/**
 * Local runtime companion operations. Identity is checked against the launched
 * executable before any path or replay state reaches the emulator.
 */
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
/**
 * Every request accepted by a capture transport. Native file operations write
 * ACT2 directly on the runtime host; streamed operations deliver chunks for
 * `read`/`ack` ownership transfer.
 */
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
/** Transport reply: capabilities, a position, hex-encoded chunk bytes from `read`, or a context state. */
export type CaptureResultV2 = CaptureCapabilitiesV2 | CapturePositionV2 | {
    readonly hex: string;
} | {
    readonly contextState: string;
};
/** Sends one validated request to the producer; callers validate the reply with `validateCaptureResult`. */
export type CaptureTransportV2 = (request: CaptureRequestV2) => Promise<CaptureResultV2>;
/**
 * Validate the explicit stream dictionary. Callers choose the instruction default only on omission.
 * @param value Scope supplied by the caller or archive header.
 * @returns Supported stream identity. Unknown values throw.
 */
export declare const captureScope: (value: unknown) => CaptureScopeV2;
/**
 * Parse an exact counter without leading zeros or precision loss.
 * @param value Canonical decimal string.
 * @returns Counter in 0..2^64-1. Anything else throws.
 */
export declare const captureU64: (value: unknown) => bigint;
/**
 * Validate a session identity.
 * @param value Candidate identity.
 * @returns The same 32-digit lowercase hex string. Anything else throws.
 */
export declare const captureSession: (value: unknown) => string;
/**
 * Reject unknown operations, unknown fields and out-of-contract values before a request reaches a producer.
 * @param value Candidate request from a caller or wire peer.
 */
export declare function validateCaptureRequest(value: unknown): asserts value is CaptureRequestV2;
/**
 * Require the requested scope and its reservation size. Never downgrade to a different stream.
 * @param value Native capability reply.
 * @param scope Requested stream, defaulting to instructions for older callers.
 * @returns Verified lossless ownership and allocation contract.
 */
export declare const validateCaptureCapabilities: (value: unknown, scope?: CaptureScopeV2) => CaptureCapabilitiesV2;
/**
 * Validate a producer position and return it typed.
 * @param value Native status or archive terminal frame.
 * @param session Expected identity when an active session is already known.
 * @param scope Expected stream, when known.
 * @returns The same value after all boundary, clock and integrity checks.
 */
export declare const validateCapturePosition: (value: unknown, session?: string, scope?: CaptureScopeV2) => CapturePositionV2;
/**
 * Accept one wire result after the matching request validator has already run.
 * Capability replies are rebuilt from the negotiated contract; other results keep
 * their validated fields, including native file counters carried beside a position.
 * @param value Sidecar or backend capture reply.
 * @returns A capabilities, position, hex, or context-state result.
 */
export declare function validateCaptureResult(value: unknown): CaptureResultV2;
/**
 * CRC-32C of an ACT2 envelope or archive JSON frame, without changing caller storage.
 * @param bytes Byte view; checksum positions are relative to this view.
 * @param zeroChecksum Treat ACT2 bytes 56–59 as zero. Defaults to false for JSON frames.
 * @returns Unsigned Castagnoli checksum.
 */
export declare const captureCrc32c: (bytes: Uint8Array, zeroChecksum?: boolean) => number;
/** One executed CPU instruction from an instruction scope. */
export interface CaptureInstructionV2 {
    /** Global event sequence in the session, starting at one. */
    readonly sequence: CaptureU64;
    /** Instruction ordinal; equal to `sequence` in instruction scopes. */
    readonly ordinal: CaptureU64;
    /** Monotonic clock ticks in the archive's rational clock domain. */
    readonly cycle: CaptureU64;
    /** Starting PC: 24-bit PB:PC on SNES, 16-bit on NES. */
    readonly address: number;
    /** Fetched opcode/operand bytes and the pre-execution register/mapper state. */
    readonly detail: CaptureInstructionDetail;
    /** Validated profile identity, independent of debugger register presentation. */
    readonly target: CaptureTargetPayload;
}
/**
 * Actual PPU write decision, attached to the completing CPU-bus access.
 * Byte destinations are physical offsets. Duplicate offsets retain write order.
 * The two raster counters describe the PPU decision, which may differ from the CPU counter.
 */
export interface CapturePPUEffectV2 {
    /** Memory selected by the data port: $2118/$2119 VRAM, $2122 CGRAM, $2104 OAM. */
    readonly target: "vram" | "cgram" | "oam";
    /** `written` commits bytes, `blocked` is a VRAM write refused during rendering, `latched` buffers a CGRAM/OAM low byte. */
    readonly outcome: "written" | "blocked" | "latched";
    /** Forced blank was active at the decision. */
    readonly forcedBlank: boolean;
    /** Active rendering restricted access; mutually exclusive with `forcedBlank`. */
    readonly renderingRestricted: boolean;
    /** PPU core that made the decision. */
    readonly implementation: "accurate" | "performance";
    /** Physical VRAM size for VRAM effects; null for CGRAM and OAM. */
    readonly vramBytes: 65536 | 131072 | null;
    /** Committed physical bytes in write order: one for VRAM, two for CGRAM, one or two for OAM; empty unless written. */
    readonly bytes: readonly {
        readonly address: number;
        readonly value: number;
    }[];
    /** PPU horizontal counter at the decision, 0..1367. */
    readonly hcounter: number;
    /** PPU scanline at the decision, 0..312. */
    readonly vcounter: number;
}
/** Actual CPU-bus operation, with exact counters and optional instruction ownership. */
export interface CaptureBusAccessV2 {
    /** Present only on data-port writes in the explicitly negotiated PPU scope. */
    readonly ppu?: CapturePPUEffectV2;
    /** Global event sequence in the session, starting at one. */
    readonly sequence: CaptureU64;
    /** Zero means no observed instruction owns the access. This is not an instruction event count. */
    readonly ordinal: CaptureU64;
    /** Monotonic SNES master-clock ticks in the archive's rational clock domain. */
    readonly cycle: CaptureU64;
    /** 24-bit CPU bus address. */
    readonly address: number;
    /** Owning instruction's starting PC, or the current PC when ordinal is zero. */
    readonly pc: number;
    /** Data byte read or written. */
    readonly value: number;
    /** Bus direction; HDMA table and indirect fetches are always reads. */
    readonly direction: "read" | "write";
    /** Bus master performing the access. */
    readonly actor: "cpu" | "dma" | "hdma";
    /** DMA/HDMA channel 0..7. CPU accesses have no channel. */
    readonly channel: number | null;
    /** Access purpose; determines `actor` (`cpu`, `dma`, or one of the HDMA phases). */
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
    /** Discriminates markers from bus accesses in mixed event streams. */
    readonly kind: "transfer";
    /** Global event sequence in the session, starting at one. */
    readonly sequence: CaptureU64;
    /** Owning instruction ordinal, or zero when no observed instruction owns the boundary. */
    readonly ordinal: CaptureU64;
    /** Monotonic SNES master-clock ticks in the archive's rational clock domain. */
    readonly cycle: CaptureU64;
    /** Begin event sequence in this session, or zero for an unobserved begin. */
    readonly transferId: CaptureU64;
    /** Owning instruction's starting PC, or the current PC when ordinal is zero. */
    readonly pc: number;
    /** Lifecycle point; HDMA bursts are never `interrupted`. */
    readonly boundary: "begin" | "complete" | "interrupted";
    /** Transfer engine. */
    readonly actor: "dma" | "hdma";
    /** DMA/HDMA channel 0..7. */
    readonly channel: number;
    /** CPU execution context at the boundary. */
    readonly context: CaptureBusAccessV2["context"];
    /** Horizontal counter in master clocks, 0..1367. */
    readonly hcounter: number;
    /** Zero-based scanline, 0..312. */
    readonly vcounter: number;
    /** Attempted byte slots, including hardware-suppressed accesses. Zero on begin markers. */
    readonly transferred: number;
    /**
     * Raw channel registers at this boundary: DMAP control, BBAD port offset, A1B:A1T source,
     * DAS size/indirect address, DASB indirect bank, A2A table address, and NTLR line counter.
     */
    readonly configuration: {
        /** DMAPn control byte ($43n0). */
        readonly dmap: number;
        /** BBADn B-bus port offset ($43n1). */
        readonly bbad: number;
        /** A1TnL/H 16-bit source address ($43n2–$43n3). */
        readonly a1t: number;
        /** A1Bn source bank ($43n4). */
        readonly a1b: number;
        /** DASnL/H 16-bit byte count or HDMA indirect address ($43n5–$43n6). */
        readonly das: number;
        /** DASBn HDMA indirect bank ($43n7). */
        readonly dasb: number;
        /** A2AnL/H 16-bit HDMA table address ($43n8–$43n9). */
        readonly a2a: number;
        /** NTRLn HDMA line counter ($43nA). */
        readonly ntlr: number;
        /** Bits: DMA enabled, HDMA enabled, HDMA completed, HDMA do-transfer. */
        readonly flags: number;
    };
}
/** Decoded NES CPU-bus chunk with interleaved PPU timeline events. */
export interface CaptureNesBusChunkV2 extends CaptureChunkBaseV2 {
    /** NES bus stream. */
    readonly scope: "nes.cpu-bus-ppu";
    /** Bus accesses and timeline events in sequence order. */
    readonly events: readonly (CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
}
/** Decoded SNES bus chunk that may interleave DMA/HDMA boundary markers. */
export interface CaptureTransferChunkV2 extends CaptureChunkBaseV2 {
    /** SNES bus scopes that permit transfer markers. */
    readonly scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
    /** Accesses and markers in sequence order. */
    readonly events: readonly (CaptureBusAccessV2 | CaptureTransferV2)[];
}
/** Envelope identity shared by every decoded chunk. */
interface CaptureChunkBaseV2 {
    /** Owning session; envelope bytes 8–23 as hex. */
    readonly session: string;
    /** Chunk sequence in the session, starting at one. */
    readonly sequence: CaptureU64;
    /** Event sequence of the first record. */
    readonly first: CaptureU64;
    /** Event sequence of the last record, inclusive. */
    readonly through: CaptureU64;
}
/** Decoded instruction chunk. */
export interface CaptureInstructionChunkV2 extends CaptureChunkBaseV2 {
    /** CPU instruction stream. */
    readonly scope: "snes.65816.instructions" | "nes.2a03.instructions";
    /** Instructions in sequence order, at most 3854 per SNES chunk. */
    readonly instructions: readonly CaptureInstructionV2[];
}
/** Decoded SNES bus chunk without transfer markers. */
export interface CaptureBusChunkV2 extends CaptureChunkBaseV2 {
    /** Plain SNES bus stream. */
    readonly scope: "snes.cpu-bus";
    /** Accesses in sequence order. */
    readonly accesses: readonly CaptureBusAccessV2[];
}
/** Scope discrimination prevents bus-only evidence from entering the instruction importer. */
export type CaptureChunkV2 = CaptureInstructionChunkV2 | CaptureBusChunkV2 | CaptureTransferChunkV2 | CaptureNesBusChunkV2;
/**
 * Common ordering fields without converting bus accesses into instruction records.
 * @param chunk Validated nonempty chunk.
 * @returns Original ordered record array.
 */
export declare const captureChunkRecords: (chunk: CaptureChunkV2) => readonly (CaptureInstructionV2 | CaptureBusAccessV2 | CaptureTransferV2 | CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
/**
 * Validate the entire envelope and every record before accepting any event.
 * @param bytes Bounded encoded chunk.
 * @param session Negotiated session identity.
 * @param scope Negotiated stream. Omission preserves instruction-only callers.
 * @returns Fully validated ordered records in exactly the requested scope.
 */
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope?: "snes.65816.instructions" | "nes.2a03.instructions"): CaptureInstructionChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "snes.cpu-bus"): CaptureBusChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu"): CaptureTransferChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: "nes.cpu-bus-ppu"): CaptureNesBusChunkV2;
export declare function decodeCaptureChunk(bytes: Uint8Array, session: string, scope: CaptureScopeV2): CaptureChunkV2;
export {};
//# sourceMappingURL=capture-v2.d.ts.map