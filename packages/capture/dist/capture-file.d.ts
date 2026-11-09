import { type CaptureChunkV2, type CapturePositionV2, type CaptureScopeV2 } from "./capture-v2.js";
/** Immutable ROM and producer identity shared by an archive and its optional JSON export. */
export interface CaptureFileMetadata {
    /** CPU architecture: `snes.65816` or `65xx.2a03`. */
    readonly architecture: string;
    /** Address space paired with the architecture: `snes.cpu` or `nes.cpu`. */
    readonly addressSpace: string;
    /** Lowercase hex SHA-256 of the ROM payload. */
    readonly romContentSha256: string;
    /** Complete cartridge identity, including iNES mapper/header bytes. */
    readonly romFileSha256?: string;
    /** Emulator build that recorded the capture; both fields nonempty. */
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
}
/** Checksummed ACS2 session header that opens every ACT2 archive. */
export interface CaptureFileHeader extends CaptureFileMetadata {
    /** Archive format identity. */
    readonly format: "uttori-ares-capture";
    /** Archive format generation. */
    readonly version: 2;
    /** 32-hex-digit session identity repeated in every chunk and checkpoint. */
    readonly session: string;
    /** Stream for every chunk; NES scopes require the NES architecture. */
    readonly scope: CaptureScopeV2;
    /** Only checkpointed chunks are durable. */
    readonly ownership: "durable-prefix";
    /** Zstandard sessions permit independently compressed chunks and raw fallback. */
    readonly compression: "none" | "zstd";
    /** Frame and chunk checksum algorithm. */
    readonly checksum: "crc32c";
    /** Upper bound on one encoded chunk, in bytes. */
    readonly maxChunkBytes: 262144;
    /** Producer buffer allocation in bytes, 4718656..64 MiB. */
    readonly allocatedBytes: number;
    /** Rational clock domain for record cycles. */
    readonly clock: {
        /** Master clock of the session architecture. */
        readonly id: "snes.master" | "nes.master";
        /** Nonzero canonical decimal numerator. */
        readonly numerator: string;
        /** Nonzero canonical decimal denominator. */
        readonly denominator: string;
    };
}
/**
 * Sequential recorder stages, measured only when explicitly requested. Transport
 * spans include request queueing, native servicing, RSP and sidecar/DAP forwarding.
 */
export type CaptureFileTimingStage = "read" | "decode" | "dataWrite" | "dataSync" | "checkpointWrite" | "checkpointSync" | "ack" | "status" | "idle" | "finalize";
/** Wall-clock stage timings excluded from archive identity. */
export interface CaptureFileTimings {
    /** Total elapsed milliseconds for the timed operation. */
    readonly elapsedMs: number;
    /** Byte length or payload size bound. */
    readonly bytes: number;
    /** Per-stage call counts and latency aggregates. */
    readonly stages: Readonly<Record<CaptureFileTimingStage, {
        readonly calls: number;
        readonly totalMs: number;
        readonly maxMs: number;
    }>>;
}
/** Result of writing or converting a capture archive, including the validated durable prefix. */
export interface CaptureFileSummary {
    /** Diagnostic wall-clock spans. Excluded from archive identity and durable accounting. */
    readonly timings?: CaptureFileTimings;
    /** Selected output: ACT2 directly, or legacy JSON when explicitly requested. */
    readonly file: string;
    /** Capture archive path paired with the output. */
    readonly archive: string;
    /** Sibling directory with a verified context manifest, when context is enabled. */
    readonly contextDirectory?: string;
    /** Capture or analysis scope identifier. */
    readonly scope: CaptureScopeV2;
    /** Observed event count in the consumed prefix. */
    readonly observedEvents: number;
    /** Dropped event count; zero for validated archives. */
    readonly droppedEvents: 0;
    /** Number of checkpointed chunks consumed. */
    readonly chunks: number;
    /** Whether the durable prefix includes a terminal frame. */
    readonly complete: boolean;
    /** Validated capture cursor within the session. */
    readonly position: CapturePositionV2;
}
/** Reject capture metadata that lacks a supported CPU scope or exact ROM/producer identity. */
export declare function validateCaptureMetadata(m: unknown): void;
/** Durable prefix recovered from a truncated capture, never an inferred suffix. */
export interface CaptureRecovery {
    /** Parsed or declared header bytes. */
    readonly header: CaptureFileHeader;
    /** Whether the durable prefix includes a terminal frame. */
    readonly complete: boolean;
    /** Last durable chunk identity included in recovery. */
    readonly chunkThrough: string;
    /** Last durable event identity included in recovery. */
    readonly eventThrough: string;
    /** Human-readable recovery or truncation reason. */
    readonly reason?: string;
    /** Present only when a bounded frame component extended past the initial file snapshot. */
    readonly reasonCode?: "truncated";
}
/** Input byte budget and cooperative cancellation apply to both header reads and archive scans. */
export interface CaptureFileReadOptions {
    /** Optional maximum bytes to read from the archive. */
    readonly maxBytes?: number;
    /** Optional cooperative cancellation. */
    readonly signal?: AbortSignal;
    /** Optional progress callback for long reads. */
    readonly onProgress?: (readBytes: number, totalBytes: number) => void;
    /** Opt-in chunk/frame timings in milliseconds. No clock reads when omitted. */
    readonly onTiming?: (stage: "read" | "decode" | "consume", milliseconds: number) => void;
}
/**
 * Read only the checksummed session header, without scanning the archive's event chunks.
 * @param file ACT2 archive path.
 * @param options Byte budget and cancellation.
 * @returns Validated identity. Completion is checked during consumption.
 */
export declare const readCaptureFileHeader: (file: string, options?: CaptureFileReadOptions) => Promise<CaptureFileHeader>;
/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param file Archive or partial artifact.
 * @param accept Optional committed-chunk consumer.
 * @param options Scan budget, cancellation and progress. Consumer failures propagate.
 * @returns Validated prefix and terminal integrity.
 */
export declare const recoverCaptureFile: (file: string, accept?: (chunk: CaptureChunkV2) => void | Promise<void>, options?: CaptureFileReadOptions) => Promise<CaptureRecovery>;
/**
 * Stream a verified complete archive into the existing instruction importer format.
 * @param archive Complete ACT2 artifact.
 * @param destination New JSON artifact.
 * @param reserved Whether the recorder already reserved an empty destination.
 * @returns Settlement after the export is synced and closed.
 */
export declare const exportCaptureJson: (archive: string, destination: string, reserved?: boolean) => Promise<void>;
/**
 * Native writer state is separate from producer drain: publication can still fail
 * after the queue is empty. Counters describe synced file bytes/batches only.
 */
export interface NativeCaptureFilePosition extends CapturePositionV2 {
    /** Native writer publication state. */
    readonly fileState: "preparing" | "writing" | "complete" | "incomplete";
    /** Synced file bytes reported by the native writer. */
    readonly fileBytes: string;
    /** Synced batch count reported by the native writer. */
    readonly fileBatches: string;
    /** Nanosecond spans. Writer times overlap emulation and cannot be summed as wall shares. */
    readonly fileProfile?: Readonly<Record<"sealNs" | "copyNs" | "writeNs" | "syncNs", string>>;
}
/**
 * Append-only native archive cursor. Reads only the producer's synced byte prefix,
 * retaining one bounded chunk and an open inode across no-clobber publication.
 * Every callback is provisional until END2 and the published path both validate.
 */
export declare class NativeCaptureFileCursor {
    #private;
    /** Parsed or declared header bytes. */
    readonly header: CaptureFileHeader;
    private constructor();
    /**
     * Open a prepared native partial file, or a completed archive for replay tests.
     * @param file Native-owned append-only file path.
     * @param options Byte budget and cancellation.
     * @returns Cursor pinning the checksummed session header and inode.
     */
    static open(file: string, options?: CaptureFileReadOptions): Promise<NativeCaptureFileCursor>;
    /**
     * Byte offset includes only the header and consumed, checkpointed chunks.
     * @returns Consumed file bytes, for bounded backlog accounting.
     */
    get readBytes(): number;
    /** Derived observedEvents value for callers. */
    get observedEvents(): string;
    /** Derived complete value for callers. */
    get complete(): boolean;
    /**
     * Read at most maxChunks (default 16) from a validated native status. Growth beyond
     * that durable watermark is ignored even if an unsynced ACK2 is already visible.
     * A failure permanently poisons the cursor. Callers must discard staged facts.
     * @param value Native producer's latest durable watermark.
     * @param accept Provisional synchronous chunk consumer. Exceptions poison this cursor.
     * @param maxChunks Maximum chunks per slice, in [1, 256].
     * @param publishedFile Final path whose inode must agree before completion.
     * @returns Settlement of one bounded read slice.
     */
    readThrough(value: NativeCaptureFilePosition, accept: (chunk: CaptureChunkV2) => void, maxChunks?: number, publishedFile?: string): Promise<void>;
    /** Close the pinned inode. Pending analysis remains caller-owned and provisional. */
    close(): Promise<void>;
}
/** Map a capture cursor to the native writer position used for recovery. */
export declare const nativePosition: (value: unknown, session?: string, scope?: CaptureScopeV2) => NativeCaptureFilePosition;
//# sourceMappingURL=capture-file.d.ts.map