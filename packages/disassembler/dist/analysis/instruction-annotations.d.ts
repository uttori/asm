import type { AnalysisProjectManifest, AnalysisProjectShards, ProjectComment, RuntimeCoverageRecord, RuntimeMemoryAccessRecord } from "../model/project-types.js";
/** One normalized static effective-address explanation at an instruction. */
export interface InstructionEffectiveAddressAnnotation {
    /** Zero-based operand index within the decoded instruction. */
    readonly operandIndex: number;
    /** Final resolved address when indexing and indirection are absent. */
    readonly address?: number;
    /** Encoded base when a final address cannot be resolved statically. */
    readonly baseAddress?: number;
    /** Hardware or project symbol when one was identified for the operand. */
    readonly symbol?: string;
    /** True when the location must not be treated as stable ROM content. */
    readonly volatile: boolean;
    /** Headerless file offset when the resolved address maps into loaded ROM. */
    readonly romOffset?: number;
    /** Human-readable summary of how the effective address was obtained. */
    readonly explanation: string;
    /** CFG node ids that contributed this effective-address variant. */
    readonly nodeIds: readonly string[];
    /** Evidence identifiers supporting this explanation. */
    readonly evidence: readonly string[];
}
/** One distinct top-level abstract-state transition, preserving context-specific alternatives. */
export interface InstructionStateTransitionAnnotation {
    /** Abstract-state field name that changed across the instruction. */
    readonly field: string;
    /** Value before the instruction when the field was present incoming. */
    readonly before?: unknown;
    /** Value after the instruction when the field is present outgoing. */
    readonly after?: unknown;
    /** CFG node ids observing this transition variant. */
    readonly nodeIds: readonly string[];
    /** Evidence identifiers supporting this transition. */
    readonly evidence: readonly string[];
}
/** Known project state or an observed runtime state immediately before the instruction. */
export interface InstructionStateObservationAnnotation {
    /** Whether the observation came from project annotations or runtime captures. */
    readonly source: "project" | "runtime";
    /** Target architecture id interpreting the flat state record. */
    readonly architecture: string;
    /** Compact register assumptions keyed by architecture-specific names. */
    readonly state: Readonly<Record<string, unknown>>;
    /** Aggregated observation count when multiple runtime records collapsed. */
    readonly count?: number;
    /** Source shard record ids contributing this observation variant. */
    readonly recordIds: readonly string[];
    /** Evidence identifiers supporting this observation. */
    readonly evidence: readonly string[];
}
/** Aggregated runtime coverage that includes an instruction address or explicit file offset. */
export interface InstructionRuntimeCoverageAnnotation {
    /** Coverage semantics shared by merged runtime coverage records. */
    readonly coverage: RuntimeCoverageRecord["coverage"];
    /** Sum of observation counts from merged coverage records. */
    readonly count: number;
    /** Runtime coverage record ids merged into this aggregate. */
    readonly recordIds: readonly string[];
    /** Evidence identifiers from merged coverage records. */
    readonly evidence: readonly string[];
}
/** Aggregated runtime memory access attributed to this instruction. */
export interface InstructionMemoryAccessAnnotation {
    /** Bus actor when the access was not performed by the CPU alone. */
    readonly actor?: RuntimeMemoryAccessRecord["actor"];
    /** DMA channel number when actor is dma or hdma. */
    readonly channel?: number;
    /** Address space of the accessed location. */
    readonly accessedAddressSpace: string;
    /** Accessed byte address within the accessed space. */
    readonly accessedAddress: number;
    /** Observed access direction or ambiguity. */
    readonly access: RuntimeMemoryAccessRecord["access"];
    /** Access width in bytes. */
    readonly width: number;
    /** Observed value when captures included data. */
    readonly value?: number;
    /** Sum of observation counts for this access signature. */
    readonly count: number;
    /** Runtime memory-access record ids merged into this aggregate. */
    readonly recordIds: readonly string[];
    /** Evidence identifiers from merged access records. */
    readonly evidence: readonly string[];
}
/** Target-neutral annotations for one qualified instruction location. */
export interface InstructionAnalysisAnnotation {
    /** The editor omitted some variants or runtime detail records. Stored evidence is unchanged. */
    readonly detailsLimited?: boolean;
    /** Project comments anchored at this instruction address. */
    readonly comments?: readonly ProjectComment[];
    /** Stable instruction annotation identifier derived from space and address. */
    readonly id: string;
    /** Logical address space containing the instruction. */
    readonly addressSpace: string;
    /** Instruction address within the logical space. */
    readonly address: number;
    /** Distinct headerless ROM offsets associated with this logical instruction. */
    readonly outputOffsets: readonly number[];
    /** Target architecture ids observed for this instruction. */
    readonly architectures: readonly string[];
    /** CFG node ids merged into this instruction projection. */
    readonly nodeIds: readonly string[];
    /** Static effective-address explanations deduplicated across nodes. */
    readonly effectiveAddresses: readonly InstructionEffectiveAddressAnnotation[];
    /** Distinct abstract-state transitions observed across CFG nodes. */
    readonly stateTransitions: readonly InstructionStateTransitionAnnotation[];
    /** Project and runtime state observations attached before execution. */
    readonly stateObservations: readonly InstructionStateObservationAnnotation[];
    /** Total runtime execution observations attributed to this instruction. */
    readonly executionCount: number;
    /** Runtime execution record ids contributing to executionCount. */
    readonly executionRecordIds: readonly string[];
    /** Aggregated runtime coverage intervals overlapping this instruction. */
    readonly runtimeCoverage: readonly InstructionRuntimeCoverageAnnotation[];
    /** Aggregated memory accesses attributed while this instruction runs. */
    readonly memoryAccesses: readonly InstructionMemoryAccessAnnotation[];
    /** Union of evidence identifiers referenced by nested annotations. */
    readonly evidence: readonly string[];
}
/** Non-fatal malformed opaque CFG metadata retained as a visible diagnostic. */
export interface InstructionAnnotationDiagnostic {
    /** CFG node or shard record id associated with the malformed metadata. */
    readonly recordId: string;
    /** Human-readable explanation of what was ignored or truncated. */
    readonly message: string;
}
/** Complete deterministic instruction-annotation projection for one native project. */
export interface InstructionAnalysisAnnotations {
    /** Instruction annotations sorted by address space, address, and id. */
    readonly instructions: readonly InstructionAnalysisAnnotation[];
    /** Non-fatal diagnostics emitted while building the projection. */
    readonly diagnostics: readonly InstructionAnnotationDiagnostic[];
}
/**
 * Builds a conservative, target-neutral instruction annotation projection.
 * Exact logical addresses and explicit output offsets are joined. No mapper translation is attempted.
 *
 * Per-instruction evidence collections are allocated only on first use. Direct logical locations
 * and output offsets are indexed once, then interval evidence is attached with binary lower bounds
 * instead of scanning every instruction for every range. These are working-set invariants: callers
 * still receive concrete, sorted empty arrays and deterministic record order, so laziness must never
 * leak into the public result or weaken exact logical/output identity deduplication.
 * @param manifest Validated project address spaces.
 * @param shards Validated native project shards.
 * @param [runtime] Fresh iterator per pass: point facts establish locations before coverage is attached.
 * @returns Stable instruction annotations and malformed-metadata notes.
 */
export declare const buildInstructionAnalysisAnnotations: (manifest: Pick<AnalysisProjectManifest, "addressSpaces">, shards: AnalysisProjectShards, runtime?: () => Iterable<AnalysisProjectShards["runtime"][number]>) => InstructionAnalysisAnnotations;
//# sourceMappingURL=instruction-annotations.d.ts.map