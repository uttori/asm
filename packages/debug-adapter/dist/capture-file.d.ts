import { type CaptureChunkV2, type CapturePositionV2, type CaptureTransportV2 } from "./capture-v2.js";
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
    readonly scope: "snes.65816.instructions";
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
export interface CaptureFileSummary {
    readonly file: string;
    readonly archive: string;
    readonly observedEvents: number;
    readonly droppedEvents: 0;
    readonly chunks: number;
    readonly complete: boolean;
    readonly position: CapturePositionV2;
}
/** One bounded chunk at a time; acceptance follows data sync AND checkpoint sync. */
export declare class LosslessCaptureFileRecorder {
    #private;
    readonly completion: Promise<CaptureFileSummary>;
    private constructor();
    static create(options: CaptureFileMetadata & {
        readonly file: string;
        readonly transport: CaptureTransportV2;
        readonly bufferBytes?: number;
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
/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param {string} file Archive or partial artifact.
 * @param {Function} accept Optional committed-chunk consumer.
 * @returns {Promise<CaptureRecovery>} Validated prefix and terminal integrity.
 */
export declare const recoverCaptureFile: (file: string, accept?: (chunk: CaptureChunkV2) => void | Promise<void>) => Promise<CaptureRecovery>;
/**
 * Stream a verified complete archive into the existing instruction importer format.
 * @param {string} archive Complete ACT2 artifact.
 * @param {string} destination New JSON artifact.
 * @param {boolean} reserved Whether the recorder already reserved an empty destination.
 * @returns {Promise<void>} Settlement after the export is synced and closed.
 */
export declare const exportCaptureJson: (archive: string, destination: string, reserved?: boolean) => Promise<void>;
//# sourceMappingURL=capture-file.d.ts.map