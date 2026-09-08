import type { AnalysisProject, AnalysisProjectShards } from "./project-types.js";
import { type RuntimeEvidenceMergeResult } from "./runtime-evidence.js";
import { type RuntimeInstructionTraceArtifact } from "./runtime-trace.js";
export declare const BEHAVIOR_CAPTURE_FORMAT: "uttori-asm-behavior-capture";
export declare const MAX_CAPTURE_EVENTS = 1000000;
export declare const MAX_CAPTURE_TOTAL_EVENTS = 2000000;
export declare const MAX_CAPTURE_WINDOWS = 9;
export declare const MAX_CAPTURE_MILLISECONDS = 60000;
export declare const MAX_CAPTURE_FILE_BYTES: number;
/** Build identities are immutable for the lifetime of the recording debug session. */
export interface BehaviorCaptureIdentity {
    readonly target: string;
    readonly binarySha256: string;
    readonly debugMapFingerprint: string;
    readonly project?: {
        readonly romContentSha256: string;
        readonly manifestSha256: string;
    };
}
/** Address stops include the matching event; source/label choices resolve to these addresses. */
export type BehaviorCaptureStop = {
    readonly kind: "manual" | "breakpoint" | "elapsed" | "instruction-limit";
} | {
    readonly kind: "address";
    readonly addresses: readonly number[];
    readonly description: string;
};
export type BehaviorCaptureStopReason = BehaviorCaptureStop["kind"] | "session-ended" | "producer-stopped" | "error";
/** An instruction-observation window, not an emulator save state or a causal slice. */
export interface BehaviorCaptureWindow {
    readonly role: "baseline" | "action";
    readonly label: string;
    readonly startedAt: string;
    readonly elapsedMilliseconds: number;
    readonly limits: {
        readonly maxEvents: number;
        readonly maxMilliseconds: number;
    };
    readonly stop: BehaviorCaptureStop;
    readonly stopReason: BehaviorCaptureStopReason;
    readonly excludedPolledEvents: number;
    readonly trace: RuntimeInstructionTraceArtifact;
}
/** Self-contained, bounded inputs; rankings are always recomputed, never trusted from disk. */
export interface BehaviorCaptureArtifact {
    readonly format: typeof BEHAVIOR_CAPTURE_FORMAT;
    readonly schemaVersion: 1;
    readonly identity: BehaviorCaptureIdentity;
    readonly windows: readonly BehaviorCaptureWindow[];
}
export interface BehaviorCandidate {
    readonly address: number;
    readonly actionCount: number;
    readonly baselineCount: number;
    readonly baselineWindows: number;
    readonly actionRate: number;
    readonly maximumBaselineRate: number;
    readonly enrichment: number | null;
    readonly classification: "action-only" | "enriched" | "shared";
    readonly score: number;
    readonly newIncomingTransitions: readonly number[];
    readonly explanation: string;
}
/** Sequential PC observations, deliberately not certified call/control-flow targets. */
export interface BehaviorTransition {
    readonly from: number;
    readonly to: number;
    readonly count: number;
    readonly baselineCount: number;
}
export interface BehaviorFunctionGroup {
    readonly id: string;
    readonly name: string;
    readonly addresses: readonly number[];
    readonly score: number;
    readonly actionSpecificEntries: readonly BehaviorTransition[];
}
export interface BehaviorCaptureReview {
    readonly captureSha256: string;
    readonly label: string;
    readonly candidates: readonly BehaviorCandidate[];
    readonly transitions: readonly BehaviorTransition[];
    readonly functions: readonly BehaviorFunctionGroup[];
    readonly warnings: readonly string[];
    readonly observedEvents: number;
    readonly droppedEvents: number;
}
/**
 * Parses a capture with event limits before interpreting its trace chunks.
 * @param {unknown} value Untrusted capture.
 * @returns {BehaviorCaptureArtifact} Normalized capture.
 */
export declare const validateBehaviorCapture: (value: unknown) => BehaviorCaptureArtifact;
/**
 * Deterministic differential execution profiles; scores are heuristics, not probabilities.
 * @param {unknown} value Untrusted capture.
 * @param {AnalysisProjectShards} [shards] Optional static ownership facts.
 * @returns {BehaviorCaptureReview} Ranked observations and limitations.
 */
export declare const reviewBehaviorCapture: (value: unknown, shards?: AnalysisProjectShards) => BehaviorCaptureReview;
/**
 * Adds reviewed comments and execution; existing facts/targets are never replaced.
 * @param {AnalysisProject} project Current validated project.
 * @param {unknown} value Untrusted capture.
 * @param {readonly number[]} selectedAddresses Explicitly reviewed action instructions.
 * @returns {RuntimeEvidenceMergeResult} Merge ready for an optimistic transaction.
 */
export declare const applyBehaviorCapture: (project: AnalysisProject, value: unknown, selectedAddresses: readonly number[]) => RuntimeEvidenceMergeResult;
//# sourceMappingURL=behavior-capture.d.ts.map