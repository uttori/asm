import type { AnalysisProjectManifest, AnalysisProjectShards, ProjectComment, RuntimeCoverageRecord, RuntimeMemoryAccessRecord } from "./project-types.js";
/** One normalized static effective-address explanation at an instruction. */
export interface InstructionEffectiveAddressAnnotation {
    readonly operandIndex: number;
    readonly address?: number;
    readonly baseAddress?: number;
    readonly symbol?: string;
    readonly volatile: boolean;
    readonly romOffset?: number;
    readonly explanation: string;
    readonly nodeIds: readonly string[];
    readonly evidence: readonly string[];
}
/** One distinct top-level abstract-state transition, preserving context-specific alternatives. */
export interface InstructionStateTransitionAnnotation {
    readonly field: string;
    readonly before?: unknown;
    readonly after?: unknown;
    readonly nodeIds: readonly string[];
    readonly evidence: readonly string[];
}
/** Known project state or an observed runtime state immediately before the instruction. */
export interface InstructionStateObservationAnnotation {
    readonly source: "project" | "runtime";
    readonly architecture: string;
    readonly state: Readonly<Record<string, unknown>>;
    readonly count?: number;
    readonly recordIds: readonly string[];
    readonly evidence: readonly string[];
}
/** Aggregated runtime coverage that includes an instruction address or explicit file offset. */
export interface InstructionRuntimeCoverageAnnotation {
    readonly coverage: RuntimeCoverageRecord["coverage"];
    readonly count: number;
    readonly recordIds: readonly string[];
    readonly evidence: readonly string[];
}
/** Aggregated runtime memory access attributed to this instruction. */
export interface InstructionMemoryAccessAnnotation {
    readonly actor?: RuntimeMemoryAccessRecord["actor"];
    readonly channel?: number;
    readonly accessedAddressSpace: string;
    readonly accessedAddress: number;
    readonly access: RuntimeMemoryAccessRecord["access"];
    readonly width: number;
    readonly value?: number;
    readonly count: number;
    readonly recordIds: readonly string[];
    readonly evidence: readonly string[];
}
/** Target-neutral annotations for one qualified instruction location. */
export interface InstructionAnalysisAnnotation {
    /** The editor omitted some variants or runtime detail records; stored evidence is unchanged. */
    readonly detailsLimited?: boolean;
    readonly comments?: readonly ProjectComment[];
    readonly id: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly outputOffsets: readonly number[];
    readonly architectures: readonly string[];
    readonly nodeIds: readonly string[];
    readonly effectiveAddresses: readonly InstructionEffectiveAddressAnnotation[];
    readonly stateTransitions: readonly InstructionStateTransitionAnnotation[];
    readonly stateObservations: readonly InstructionStateObservationAnnotation[];
    readonly executionCount: number;
    readonly executionRecordIds: readonly string[];
    readonly runtimeCoverage: readonly InstructionRuntimeCoverageAnnotation[];
    readonly memoryAccesses: readonly InstructionMemoryAccessAnnotation[];
    readonly evidence: readonly string[];
}
/** Non-fatal malformed opaque CFG metadata retained as a visible diagnostic. */
export interface InstructionAnnotationDiagnostic {
    readonly recordId: string;
    readonly message: string;
}
/** Complete deterministic instruction-annotation projection for one native project. */
export interface InstructionAnalysisAnnotations {
    readonly instructions: readonly InstructionAnalysisAnnotation[];
    readonly diagnostics: readonly InstructionAnnotationDiagnostic[];
}
/**
 * Builds a conservative, target-neutral instruction annotation projection.
 * Exact logical addresses and explicit output offsets are joined; no mapper translation is attempted.
 *
 * Per-instruction evidence collections are allocated only on first use. Direct logical locations
 * and output offsets are indexed once, then interval evidence is attached with binary lower bounds
 * instead of scanning every instruction for every range. These are working-set invariants: callers
 * still receive concrete, sorted empty arrays and deterministic record order, so laziness must never
 * leak into the public result or weaken exact logical/output identity deduplication.
 * @param {Pick<AnalysisProjectManifest, "addressSpaces">} manifest Validated project address spaces.
 * @param {AnalysisProjectShards} shards Validated native project shards.
 * @param {Function} [runtime] Fresh iterator per pass: point facts establish locations before coverage is attached.
 * @returns {InstructionAnalysisAnnotations} Stable instruction annotations and malformed-metadata notes.
 */
export declare const buildInstructionAnalysisAnnotations: (manifest: Pick<AnalysisProjectManifest, "addressSpaces">, shards: AnalysisProjectShards, runtime?: () => Iterable<AnalysisProjectShards["runtime"][number]>) => InstructionAnalysisAnnotations;
//# sourceMappingURL=instruction-annotations.d.ts.map