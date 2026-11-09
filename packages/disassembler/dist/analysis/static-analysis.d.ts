import { type ResearchMapping } from "../model/research-mapping.js";
/**
 * Target-neutral control-flow kinds emitted by a static-analysis adapter.
 * `stop` / `wait` do not fall through. `return` pops the call context when present.
 */
export type StaticControlFlowKind = "call" | "conditionalBranch" | "fallthrough" | "interrupt" | "jump" | "return" | "stop" | "wait";
/** Control-edge kinds that can carry a resolved or indirect target address. */
export type StaticControlTargetKind = "branch" | "call" | "interrupt" | "jump";
/** One outgoing control-flow target from a decoded instruction. */
export interface StaticControlTarget {
    /** Control-flow category used when scheduling successors. */
    readonly kind: StaticControlTargetKind;
    /** Absolute CPU address when known statically. */
    readonly address?: number;
    /** True when the destination requires manual resolution or runtime state. */
    readonly indirect?: boolean;
    /** Optional note retained on edges and unresolved-flow records. */
    readonly explanation?: string;
}
/** Memory operand of an instruction, with enough detail to explain ROM vs MMIO vs unresolved. */
export interface StaticEffectiveAddress {
    /** Zero-based operand index within the decoded instruction. */
    readonly operandIndex: number;
    /** Final address when it is statically known and not indexed/indirect. */
    readonly address?: number;
    /** Encoded base when an index or indirection prevents a final address. */
    readonly baseAddress?: number;
    /** Hardware or project symbol, when identified. */
    readonly symbol?: string;
    /** True for MMIO and other locations that must not be treated as ROM. */
    readonly volatile: boolean;
    /** Headerless file offset when `address` maps into the loaded ROM. */
    readonly romOffset?: number;
    /** Human-readable summary of how the effective address was obtained. */
    readonly explanation: string;
}
/**
 * Serializable target-neutral state effect copied from a decoded instruction.
 * Plugins interpret `target` / `source` names (`p`, `dbr`, `a`, …).
 */
export type StaticStateEffect = {
    readonly kind: "clearBits";
    readonly target: string;
    readonly mask: number;
} | {
    readonly kind: "setBits";
    readonly target: string;
    readonly mask: number;
} | {
    readonly kind: "copy";
    readonly from: string;
    readonly to: string;
} | {
    readonly kind: "exchange";
    readonly left: string;
    readonly right: string;
} | {
    readonly kind: "push";
    readonly source: string;
} | {
    readonly kind: "pull";
    readonly target: string;
} | {
    readonly kind: "unknown";
    readonly target: string;
} | {
    readonly kind: "custom";
    readonly name: string;
    readonly details?: Readonly<Record<string, unknown>>;
};
/** Normalized instruction information consumed by the generic worklist engine. */
export interface StaticInstruction {
    /** Architecture specification id that decoded this instruction. */
    readonly specificationId: string;
    /** CPU-space address of the opcode. */
    readonly address: number;
    /** Headerless ROM file offset of the opcode. */
    readonly fileOffset: number;
    /** Instruction length in bytes at this address. */
    readonly size: number;
    /** Primary opcode byte value. */
    readonly opcode: number;
    /** Decoded mnemonic string for presentation. */
    readonly mnemonic: string;
    /** Addressing mode name from the specification. */
    readonly mode: string;
    /** Abstract-state effects applied after decode. */
    readonly effects: readonly StaticStateEffect[];
    /** State, target, or classification evidence consumed while decoding this node. */
    readonly evidence?: readonly string[];
    /** Decoded control-flow behavior governing fallthrough and successor scheduling. */
    readonly flow: {
        /** Primary control-flow kind emitted by the adapter for this opcode. */
        readonly kind: StaticControlFlowKind;
        /** When true, the next sequential instruction is also enqueued. */
        readonly fallthrough: boolean;
        /** True when control flow depends on indirect addressing or runtime state. */
        readonly indirect?: boolean;
    };
    /** Outgoing control-flow targets scheduled from this instruction. */
    readonly targets: readonly StaticControlTarget[];
    /** Operand effective-address explanations when supplied by the adapter. */
    readonly effectiveAddresses?: readonly StaticEffectiveAddress[];
}
/**
 * Adapter decode outcome. `ambiguous` needs more CPU state. `blocked` hit a
 * data-classified interval. `error` is an unmapped or invalid fetch.
 */
export type StaticDecodeResult = {
    readonly kind: "instruction";
    readonly instruction: StaticInstruction;
} | {
    readonly kind: "ambiguous";
    readonly reason: string;
    readonly requiredState: readonly string[];
} | {
    readonly kind: "blocked";
    readonly reason: string;
    readonly evidence: readonly string[];
} | {
    readonly kind: "error";
    readonly reason: string;
};
/** Justified worklist entry with its initial abstract state. */
export interface StaticAnalysisSeed<State> {
    /** Stable seed identifier used as the initial entryPoint label. */
    readonly id: string;
    /** CPU-space address where analysis begins for this seed. */
    readonly address: number;
    /** Provenance channel describing how this seed was introduced. */
    readonly kind: "configured" | "imported-label" | "manual" | "observation" | "target-set" | "vector";
    /** Initial abstract CPU state before the first decode at the seed address. */
    readonly state: State;
    /** Evidence identifiers justifying exploration from this seed. */
    readonly evidence: readonly string[];
    /** Optional human-readable note retained for diagnostics. */
    readonly detail?: string;
}
/** Manual resolution of an indirect site. At most one selector may match an instruction. */
export interface StaticTargetOverride {
    /** Optional bank or file selector limiting when this override applies. */
    readonly mapping?: ResearchMapping;
    /** Stable override identifier referenced by generated edges. */
    readonly id: string;
    /** Instruction address where indirect targets are replaced. */
    readonly address: number;
    /** Allowed destination addresses for the indirect site. */
    readonly targets: readonly number[];
    /** Evidence identifiers justifying this override. */
    readonly evidence: readonly string[];
}
/** Default work-item budget when `analyzeStaticControlFlow` omits `maxWorkItems`. */
export declare const DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS = 1000000;
/** Default call-context depth when `analyzeStaticControlFlow` omits `maxCallDepth`. */
export declare const DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH = 16;
/**
 * Deterministic worklist caps.
 * Omitted limits use {@link DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS} and
 * {@link DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH}.
 */
export interface StaticAnalysisLimits {
    /** Default false. Use SHA-256 call-context identities for compact native graphs; full call-site lists remain on nodes. */
    readonly compactContextIds?: boolean;
    /** Positive safe integer work budget. Reaching it returns an incomplete result with a reason. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Zero discards call history, and deeper calls report a bound. */
    readonly maxCallDepth?: number;
    /**
     * Cumulative explored work and remaining queue, reported at bounded intervals and completion.
     * The queue can grow during discovery; it is not a fixed total. Throwing aborts analysis.
     */
    readonly onProgress?: (progress: {
        readonly processedWorkItems: number;
        readonly queuedWorkItems: number;
        readonly instructions: number;
    }) => void;
}
/** Architecture-specific decode and abstract-state operations. */
export interface StaticAnalysisAdapter<State> {
    /** Size of the represented backing byte image used for coverage `totalBytes`. */
    readonly backingSize: number;
    /**
     * Fetch and classify the instruction at `address` under `state`.
     * Must not throw. Return `error` / `blocked` / `ambiguous` instead.
     */
    decode(address: number, state: State): StaticDecodeResult;
    /** Apply `instruction.effects` to produce the outgoing abstract state. */
    transfer(instruction: StaticInstruction, state: State): State;
    /** Lattice join at a CFG merge. Must converge under repeated joins and preserve both input states. */
    join(left: State, right: State): State;
    /** Stable identity for a state. Used to skip re-processing unchanged joins. */
    stateKey(state: State): string;
    /** Stable bank/mapping identity. Different contexts must never join solely because their bus PCs match. */
    executionContextKey?(address: number, state: State): string;
    /** Flat mapper registers used by generic research selectors; unknown values stay null/absent. */
    mappingState?(state: State): Readonly<Record<string, unknown>>;
    /** Applies address-derived state such as a program bank before decode. */
    enterAddress?(state: State, address: number): State;
}
/** Accepted CFG instruction, keyed by address plus call context. */
export interface StaticAnalysisNode<State> {
    /** Stable CFG node identifier including call context when present. */
    readonly id: string;
    /** CPU-space address of the accepted opcode. */
    readonly address: number;
    /** Headerless ROM file offset of the opcode. */
    readonly fileOffset: number;
    /** Instruction length in bytes at this address. */
    readonly size: number;
    /** Primary opcode byte value. */
    readonly opcode: number;
    /** Architecture specification id that decoded this instruction. */
    readonly specificationId: string;
    /** Decoded mnemonic string for presentation. */
    readonly mnemonic: string;
    /** Addressing mode name from the specification. */
    readonly mode: string;
    /** Call-site addresses from the seed to this node, innermost last. */
    readonly context: readonly number[];
    /** Abstract CPU state joined immediately before decode. */
    readonly incomingState: State;
    /** Abstract CPU state after applying instruction effects. */
    readonly outgoingState: State;
    /** Operand effective-address explanations attached to this node. */
    readonly effectiveAddresses: readonly StaticEffectiveAddress[];
    /** Seed id labeling the entry point that reached this instruction. */
    readonly entryPoint: string;
    /** Evidence identifiers consumed while accepting this node. */
    readonly evidence: readonly string[];
    /** Node ids from the seed to this instruction, inclusive; materialized only when read. */
    readonly evidencePath: readonly string[];
}
/** Serialized control-flow edge kinds emitted by the generic worklist engine. */
export type StaticAnalysisEdgeKind = "branch" | "call" | "fallthrough" | "interrupt" | "jump" | "return" | "unresolved";
/** Directed CFG edge. `to` is omitted for unresolved targets. */
export interface StaticAnalysisEdge {
    /** Stable edge identifier derived from endpoints and kind. */
    readonly id: string;
    /** Source CFG node id. */
    readonly from: string;
    /** Source instruction address for diagnostics without loading the node. */
    readonly fromAddress: number;
    /** Destination CFG node id when the target was accepted. */
    readonly to?: string;
    /** Destination instruction address when known statically. */
    readonly toAddress?: number;
    /** Serialized control-flow kind for this edge. */
    readonly kind: StaticAnalysisEdgeKind;
    /** True when the edge depends on indirect addressing or manual overrides. */
    readonly indirect: boolean;
    /** Target-override id when this edge was supplied by the user. */
    readonly override?: string;
    /** Evidence identifiers justifying this edge. */
    readonly evidence: readonly string[];
    /** Optional human-readable note explaining an indirect or overridden edge. */
    readonly explanation?: string;
}
/** Function-entry candidate from a seed, a discovered call, or an interrupt. */
export interface StaticFunctionCandidate {
    /** Stable function candidate identifier including mapping suffix when present. */
    readonly id: string;
    /** Entry instruction address for the function candidate. */
    readonly address: number;
    /** Origin channel distinguishing seeds, calls, and interrupt vectors. */
    readonly source: "call" | "entry" | "interrupt";
    /** Evidence identifiers supporting this function candidate. */
    readonly evidence: readonly string[];
    /** Discovery call site, absent for seed functions. Avoids expanding ancestry for publication. */
    readonly evidencePredecessor?: string;
    /** Lazy discovery path materialized only when read. */
    readonly evidencePath: readonly string[];
}
/** Site where decode, mapping, or instruction bytes could not be accepted. */
export interface StaticAnalysisConflict {
    /** Stable conflict identifier. */
    readonly id: string;
    /** Conflict category used for filtering and presentation. */
    readonly kind: "blocked" | "decode" | "instruction-boundary" | "invalid-mapping" | "state-ambiguity";
    /** Primary conflict address. */
    readonly address: number;
    /** Human-readable conflict description. */
    readonly message: string;
    /** CFG node ids involved in the conflict. */
    readonly nodes: readonly string[];
    /** Evidence identifiers attached to the conflict report. */
    readonly evidence: readonly string[];
}
/** Control-flow target that could not be resolved statically. */
export interface StaticUnresolvedFlow {
    /** Stable unresolved-flow identifier. */
    readonly id: string;
    /** Instruction address where flow could not be resolved. */
    readonly address: number;
    /** Serialized control-flow kind at the unresolved site. */
    readonly kind: StaticAnalysisEdgeKind;
    /** True when the site depends on indirect addressing or runtime state. */
    readonly indirect: boolean;
    /** Explanation of why static resolution failed. */
    readonly reason: string;
    /** Evidence identifiers collected at the unresolved site. */
    readonly evidence: readonly string[];
}
/** Coverage of accepted instruction bytes against `adapter.backingSize`. */
export interface StaticCoverageSummary {
    /** Count of accepted CFG instruction nodes. */
    readonly instructionCount: number;
    /** Count of discovered function-entry candidates. */
    readonly functionCount: number;
    /** Distinct ROM byte offsets covered by accepted instructions. */
    readonly reachedBytes: number;
    /** Backing image size reported by the adapter. */
    readonly totalBytes: number;
    /** `reachedBytes / totalBytes * 100`, or `0` when `totalBytes` is 0. */
    readonly reachedPercent: number;
}
/** Bounds that reduced call-history precision or stopped exploration before the worklist emptied. */
export interface StaticAnalysisIncompleteReason {
    /** A call-context bound truncates history and continues; a work bound stops traversal. */
    readonly kind: "call-context-limit" | "work-limit";
    /** Instruction address associated with the limiting event. */
    readonly address: number;
    /** Configured cap value that was exceeded. */
    readonly limit: number;
    /** Human-readable explanation retained in the incomplete result. */
    readonly message: string;
}
/** Worklist output: accepted CFG plus conflicts, unresolved flow, and coverage. */
export interface StaticAnalysisResult<State> {
    /** `incomplete` when a work or call-depth cap fired. */
    readonly status: "complete" | "incomplete";
    /** Accepted CFG nodes sorted by address and id. */
    readonly nodes: readonly StaticAnalysisNode<State>[];
    /** Directed edges between accepted and unresolved sites. */
    readonly edges: readonly StaticAnalysisEdge[];
    /** Function-entry candidates discovered during traversal. */
    readonly functions: readonly StaticFunctionCandidate[];
    /** Decode, mapping, and boundary conflicts encountered during traversal. */
    readonly conflicts: readonly StaticAnalysisConflict[];
    /** Indirect or unknown control-flow sites that could not be scheduled. */
    readonly unresolved: readonly StaticUnresolvedFlow[];
    /** Byte coverage summary against the adapter backing image. */
    readonly coverage: StaticCoverageSummary;
    /** Structured reasons when status is incomplete. */
    readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
    /** Work items processed when the pass stopped. */
    readonly processedWorkItems: number;
}
/**
 * Deterministic conservative worklist traversal. Architecture-specific decoding
 * and state transfer stay behind the adapter boundary. Duplicate target overrides
 * at the same address are rejected. Call context is truncated at `maxCallDepth`.
 * @param adapter Architecture-specific decode and abstract-state operations.
 * @param seeds Justified entry points with their initial states and evidence.
 * @param [options] Work, context, and target-override configuration.
 * @returns Accepted CFG plus conflicts, unresolved flow, coverage, and completion status.
 */
export declare const analyzeStaticControlFlow: <State>(adapter: StaticAnalysisAdapter<State>, seeds: readonly StaticAnalysisSeed<State>[], options?: StaticAnalysisLimits & {
    readonly targetOverrides?: readonly StaticTargetOverride[];
}) => StaticAnalysisResult<State>;
//# sourceMappingURL=static-analysis.d.ts.map