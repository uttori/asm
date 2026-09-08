import { type BehaviorCaptureWindow, type BehaviorCaptureStopReason } from "./behavior-capture.js";
import { type RuntimeInstructionTraceChunk, type RuntimeInstructionTraceArtifact } from "./runtime-trace.js";
type EditorTraceMetadata = Pick<RuntimeInstructionTraceArtifact, "architecture" | "addressSpace" | "romContentSha256" | "producer">;
interface EditorTraceBatch extends RuntimeInstructionTraceChunk {
    readonly architecture: string;
    readonly addressSpace: string;
}
export interface BehaviorRecorderOptions extends EditorTraceMetadata {
    readonly role: BehaviorCaptureWindow["role"];
    readonly label: string;
    readonly stop: BehaviorCaptureWindow["stop"];
    readonly limits: BehaviorCaptureWindow["limits"];
    readonly maxBatchEvents: number;
    readonly readTrace: (maxEvents: number) => Promise<EditorTraceBatch>;
    readonly stopTrace: () => Promise<void>;
    readonly now?: () => number;
}
/** A bounded observation window. A polled address limit trims the batch, not CPU execution. */
export declare class BehaviorCaptureRecorder {
    #private;
    readonly completion: Promise<BehaviorCaptureWindow>;
    constructor(options: BehaviorRecorderOptions);
    requestStop(reason?: BehaviorCaptureStopReason): void;
}
export {};
//# sourceMappingURL=behavior-capture-recorder.d.ts.map