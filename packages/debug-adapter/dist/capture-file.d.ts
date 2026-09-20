import { type CaptureChunkV2, type CapturePositionV2, type CaptureTransportV2, type CaptureScopeV2 } from "./capture-v2.js";
/** Immutable ROM and producer identity shared by an archive and its optional JSON export. */
export interface CaptureFileMetadata {
    readonly architecture: string;
    readonly addressSpace: string;
    readonly romContentSha256: string;
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
}
export interface CaptureFileHeader extends CaptureFileMetadata {
    readonly format: "uttori-ares-capture";
    readonly version: 2;
    readonly session: string;
    readonly scope: CaptureScopeV2;
    readonly ownership: "durable-prefix";
    readonly compression: "none";
    readonly checksum: "crc32c";
    readonly maxChunkBytes: 262144;
    readonly allocatedBytes: number;
    readonly clock: {
        readonly id: "snes.master";
        readonly numerator: string;
        readonly denominator: string;
    };
}
/** Sequential recorder stages, measured only when explicitly requested. Transport
 * spans include request queueing, native servicing, RSP and sidecar/DAP forwarding.
 */
export type CaptureFileTimingStage = "read" | "decode" | "dataWrite" | "dataSync" | "checkpointWrite" | "checkpointSync" | "ack" | "status" | "idle" | "finalize";
export interface CaptureFileTimings {
    readonly elapsedMs: number;
    readonly bytes: number;
    readonly stages: Readonly<Record<CaptureFileTimingStage, {
        readonly calls: number;
        readonly totalMs: number;
        readonly maxMs: number;
    }>>;
}
export interface CaptureFileSummary {
    /** Diagnostic wall-clock spans. Excluded from archive identity and durable accounting. */
    readonly timings?: CaptureFileTimings;
    /** Selected output: ACT2 directly, or legacy JSON when explicitly requested. */
    readonly file: string;
    readonly archive: string;
    readonly scope: CaptureScopeV2;
    readonly observedEvents: number;
    readonly droppedEvents: 0;
    readonly chunks: number;
    readonly complete: boolean;
    readonly position: CapturePositionV2;
}
/** One bounded chunk at a time. Acceptance follows data sync AND checkpoint sync. */
export declare class LosslessCaptureFileRecorder {
    #private;
    readonly completion: Promise<CaptureFileSummary>;
    private constructor();
    /**
     * Reserve a new output and start lossless recording. ACT2 output publishes only the archive.
     * Legacy JSON output additionally exports a compatible trace after draining the producer.
     * @param {object} options Output format, identity and serialized producer transport.
     * @returns {Promise<LosslessCaptureFileRecorder>} Active recorder. Stop() drains and syncs it.
     */
    static create(options: CaptureFileMetadata & {
        readonly file: string;
        readonly transport: CaptureTransportV2;
        readonly bufferBytes?: number;
        /** Opt-in stage profiling. No clock reads or diagnostic allocations when omitted. */
        readonly measureStages?: boolean;
        /** Defaults to instructions. CPU/DMA/HDMA bus capture requires ACT2 output. */
        readonly scope?: CaptureScopeV2;
        /** Defaults to legacy JSON plus ACT2. Act2 skips all post-capture JSON conversion. */
        readonly format?: "json" | "act2";
    }): Promise<LosslessCaptureFileRecorder>;
    stop(): Promise<CaptureFileSummary>;
    finishIncomplete(): Promise<CaptureFileSummary>;
}
export interface CaptureRecovery {
    readonly header: CaptureFileHeader;
    readonly complete: boolean;
    readonly chunkThrough: string;
    readonly eventThrough: string;
    readonly reason?: string;
}
/** Input byte budget and cooperative cancellation apply to both header reads and archive scans. */
export interface CaptureFileReadOptions {
    readonly maxBytes?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (readBytes: number, totalBytes: number) => void;
    /** Opt-in chunk/frame timings in milliseconds. No clock reads when omitted. */
    readonly onTiming?: (stage: "read" | "decode" | "consume", milliseconds: number) => void;
}
/**
 * Read only the checksummed session header, without scanning the archive's event chunks.
 * @param {string} file ACT2 archive path.
 * @param {CaptureFileReadOptions} options Byte budget and cancellation.
 * @returns {Promise<CaptureFileHeader>} Validated identity. Completion is checked during consumption.
 */
export declare const readCaptureFileHeader: (file: string, options?: CaptureFileReadOptions) => Promise<CaptureFileHeader>;
/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param {string} file Archive or partial artifact.
 * @param {Function} accept Optional committed-chunk consumer.
 * @param {CaptureFileReadOptions} options Scan budget, cancellation and progress. Consumer failures propagate.
 * @returns {Promise<CaptureRecovery>} Validated prefix and terminal integrity.
 */
export declare const recoverCaptureFile: (file: string, accept?: (chunk: CaptureChunkV2) => void | Promise<void>, options?: CaptureFileReadOptions) => Promise<CaptureRecovery>;
/**
 * Stream a verified complete archive into the existing instruction importer format.
 * @param {string} archive Complete ACT2 artifact.
 * @param {string} destination New JSON artifact.
 * @param {boolean} reserved Whether the recorder already reserved an empty destination.
 * @returns {Promise<void>} Settlement after the export is synced and closed.
 */
export declare const exportCaptureJson: (archive: string, destination: string, reserved?: boolean) => Promise<void>;
/** Native writer state is separate from producer drain: publication can still fail
 * after the queue is empty. Counters describe synced file bytes/batches only.
 */
export interface NativeCaptureFilePosition extends CapturePositionV2 {
    readonly fileState: "preparing" | "writing" | "complete" | "incomplete";
    readonly fileBytes: string;
    readonly fileBatches: string;
    /** Nanosecond spans. Writer times overlap emulation and cannot be summed as wall shares. */
    readonly fileProfile?: Readonly<Record<"sealNs" | "copyNs" | "writeNs" | "syncNs", string>>;
}
/** Append-only native archive cursor. Reads only the producer's synced byte prefix,
 * retaining one bounded chunk and an open inode across no-clobber publication.
 * Every callback is provisional until END2 and the published path both validate.
 */
export declare class NativeCaptureFileCursor {
    #private;
    readonly header: CaptureFileHeader;
    private constructor();
    /** Open a prepared native partial file, or a completed archive for replay tests.
     * @param {string} file Native-owned append-only file path.
     * @param {CaptureFileReadOptions} options Byte budget and cancellation.
     * @returns {Promise<NativeCaptureFileCursor>} Cursor pinning the checksummed session header and inode.
     */
    static open(file: string, options?: CaptureFileReadOptions): Promise<NativeCaptureFileCursor>;
    /** Byte offset includes only the header and consumed, checkpointed chunks.
     * @returns {number} Consumed file bytes, for bounded backlog accounting.
     */
    get readBytes(): number;
    get observedEvents(): string;
    get complete(): boolean;
    /** Read at most maxChunks (default 16) from a validated native status. Growth beyond
     * that durable watermark is ignored even if an unsynced ACK2 is already visible.
     * A failure permanently poisons the cursor. Callers must discard staged facts.
     * @param {NativeCaptureFilePosition} value Native producer's latest durable watermark.
     * @param {Function} accept Provisional synchronous chunk consumer. Exceptions poison this cursor.
     * @param {number} maxChunks Maximum chunks per slice, in [1, 256].
     * @param {string} publishedFile Final path whose inode must agree before completion.
     * @returns {Promise<void>} Settlement of one bounded read slice.
     */
    readThrough(value: NativeCaptureFilePosition, accept: (chunk: CaptureChunkV2) => void, maxChunks?: number, publishedFile?: string): Promise<void>;
    /** Close the pinned inode. Pending analysis remains caller-owned and provisional. */
    close(): Promise<void>;
}
/** Controls a local native ACT2 writer. No event bytes cross RSP/DAP and no live
 * decoding occurs here. The existing bounded archive reader validates on import.
 */
export declare class NativeCaptureFileRecorder {
    #private;
    readonly completion: Promise<CaptureFileSummary>;
    /** Latest validated durable position. Observing it never reads or drains event bytes.
     * @returns {NativeCaptureFilePosition} Read-only status snapshot from the control pump.
     */
    get position(): NativeCaptureFilePosition;
    private constructor();
    /** Arm while the debugger is stopped, then await the durable session header.
     * The supplied path belongs to the native host, which must share this filesystem.
     * @param {object} options Destination, scope, verified identity and control transport.
     * @returns {Promise<NativeCaptureFileRecorder>} Armed recorder with a durable session header.
     */
    static create(options: CaptureFileMetadata & {
        readonly file: string;
        readonly transport: CaptureTransportV2;
        readonly scope?: CaptureScopeV2;
        readonly bufferBytes?: number;
        readonly measureStages?: boolean;
    }): Promise<NativeCaptureFileRecorder>;
    /** Fix the capture boundary, then wait for synced END2 and no-clobber publication.
     * @returns {Promise<CaptureFileSummary>} Published complete archive, or a writer failure.
     */
    stop(): Promise<CaptureFileSummary>;
    /** Leave a recoverable partial artifact. Never publish an interrupted session.
     * @returns {Promise<CaptureFileSummary>} Existing completion. Rejects on cancellation.
     */
    finishIncomplete(): Promise<CaptureFileSummary>;
}
//# sourceMappingURL=capture-file.d.ts.map