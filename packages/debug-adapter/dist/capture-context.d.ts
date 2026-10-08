import type { CaptureFileMetadata, CaptureFileSummary } from "./capture-file.js";
import type { CaptureTransportV2 } from "./capture-v2.js";
/** Context is enabled by default. The explicit false option is for trace-only
 * benchmarks and producers without the local context protocol. */
export interface CaptureContextOptions {
    readonly context?: boolean;
}
/** Coordinates paused context boundaries with either ACT2 sink. The native
 * companion writes into a newly reserved directory; manifest.json is published
 * only after the ACT2 archive and every companion file are complete and synced. */
export declare class CaptureContextRecorder {
    #private;
    readonly directory: string;
    readonly transport: CaptureTransportV2;
    constructor(archive: string, metadata: CaptureFileMetadata, transport: CaptureTransportV2);
    /** Publish integrity hashes and trace-relative boundaries after primary publication.
     * Failures retain all files without claiming a complete context bundle.
     * @param {CaptureFileSummary} summary Completed primary archive whose session/counters must match.
     */
    finish(summary: CaptureFileSummary): Promise<void>;
}
/** Verify the entire companion before feeding a save state to native code. Every
 * path is a flat, regular artifact, and every byte is bound to this ROM/build.
 * @param {string} directory Companion directory selected by the user.
 * @param {Pick<CaptureFileMetadata, "romContentSha256" | "romFileSha256" | "producer">} identity ROM and producer identity of the verified running emulator.
 */
export declare const verifyCaptureContext: (directory: string, identity: Pick<CaptureFileMetadata, "romContentSha256" | "romFileSha256" | "producer">, signal?: AbortSignal) => Promise<void>;
//# sourceMappingURL=capture-context.d.ts.map