import { type CapturePositionV2, type CaptureTransportV2, type CaptureScopeV2, type CaptureFileMetadata, type CaptureFileSummary, type NativeCaptureFilePosition } from "@uttori/asm-capture";
import { type CaptureContextOptions } from "./capture-context.js";
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
    static create(options: CaptureFileMetadata & CaptureContextOptions & {
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
    /** Current producer session, for a paused user milestone.
     * @returns {CapturePositionV2} Latest verified position; querying does not drain the archive.
     */
    get position(): CapturePositionV2;
    stop(): Promise<CaptureFileSummary>;
    finishIncomplete(): Promise<CaptureFileSummary>;
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
    static create(options: CaptureFileMetadata & CaptureContextOptions & {
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