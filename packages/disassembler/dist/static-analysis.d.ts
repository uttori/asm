/**
 * Target-neutral control-flow kinds emitted by a static-analysis adapter.
 * `stop` / `wait` do not fall through. `return` pops the call context when present.
 */
export type StaticControlFlowKind = "call" | "conditionalBranch" | "fallthrough" | "interrupt" | "jump" | "return" | "stop" | "wait";
/** Control-edge kinds that can carry a resolved or indirect target address. */
export type StaticControlTargetKind = "branch" | "call" | "interrupt" | "jump";
/** One outgoing control-flow target from a decoded instruction. */
export interface StaticControlTarget {
    readonly kind: StaticControlTargetKind;
    /** Absolute CPU address when known statically. */
    readonly address?: number;
    readonly indirect?: boolean;
    readonly explanation?: string;
}
/** Memory operand of an instruction, with enough detail to explain ROM vs MMIO vs unresolved. */
export interface StaticEffectiveAddress {
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
    readonly specificationId: string;
    /** CPU-space address of the opcode. */
    readonly address: number;
    /** Headerless ROM file offset of the opcode. */
    readonly fileOffset: number;
    readonly size: number;
    readonly opcode: number;
    readonly mnemonic: string;
    readonly mode: string;
    readonly effects: readonly StaticStateEffect[];
    /** State, target, or classification evidence consumed while decoding this node. */
    readonly evidence?: readonly string[];
    readonly flow: {
        readonly kind: StaticControlFlowKind;
        /** When true, the next sequential instruction is also enqueued. */
        readonly fallthrough: boolean;
        readonly indirect?: boolean;
    };
    readonly targets: readonly StaticControlTarget[];
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
    readonly id: string;
    readonly address: number;
    readonly kind: "configured" | "imported-label" | "manual" | "observation" | "target-set" | "vector";
    readonly state: State;
    readonly evidence: readonly string[];
    readonly detail?: string;
}
/** Manual resolution of an indirect control-flow site. At most one per address. */
export interface StaticTargetOverride {
    readonly id: string;
    readonly address: number;
    readonly targets: readonly number[];
    readonly evidence: readonly string[];
}
/**
 * Deterministic worklist caps.
 * Defaults inside `analyzeStaticControlFlow` are 100_000 items and call depth 8.
 */
export interface StaticAnalysisLimits {
    /** Positive safe integer work budget. Reaching it returns an incomplete result with a reason. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Zero discards call history, and deeper calls report a bound. */
    readonly maxCallDepth?: number;
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
    /** Applies address-derived state such as a program bank before decode. */
    enterAddress?(state: State, address: number): State;
}
/** Accepted CFG instruction, keyed by address plus call context. */
export interface StaticAnalysisNode<State> {
    readonly id: string;
    readonly address: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly opcode: number;
    readonly specificationId: string;
    readonly mnemonic: string;
    readonly mode: string;
    /** Call-site addresses from the seed to this node, innermost last. */
    readonly context: readonly number[];
    readonly incomingState: State;
    readonly outgoingState: State;
    readonly effectiveAddresses: readonly StaticEffectiveAddress[];
    readonly entryPoint: string;
    readonly evidence: readonly string[];
    /** Node ids from the seed to this instruction, inclusive. */
    readonly evidencePath: readonly string[];
}
export type StaticAnalysisEdgeKind = "branch" | "call" | "fallthrough" | "interrupt" | "jump" | "return" | "unresolved";
/** Directed CFG edge. `to` is omitted for unresolved targets. */
export interface StaticAnalysisEdge {
    readonly id: string;
    readonly from: string;
    readonly fromAddress: number;
    readonly to?: string;
    readonly toAddress?: number;
    readonly kind: StaticAnalysisEdgeKind;
    readonly indirect: boolean;
    /** Target-override id when this edge was supplied by the user. */
    readonly override?: string;
    readonly evidence: readonly string[];
    readonly explanation?: string;
}
/** Function-entry candidate from a seed, a discovered call, or an interrupt. */
export interface StaticFunctionCandidate {
    readonly id: string;
    readonly address: number;
    readonly source: "call" | "entry" | "interrupt";
    readonly evidence: readonly string[];
    readonly evidencePath: readonly string[];
}
/** Site where decode, mapping, or instruction bytes could not be accepted. */
export interface StaticAnalysisConflict {
    readonly id: string;
    readonly kind: "blocked" | "decode" | "instruction-boundary" | "invalid-mapping" | "state-ambiguity";
    readonly address: number;
    readonly message: string;
    readonly nodes: readonly string[];
    readonly evidence: readonly string[];
}
/** Control-flow target that could not be resolved statically. */
export interface StaticUnresolvedFlow {
    readonly id: string;
    readonly address: number;
    readonly kind: StaticAnalysisEdgeKind;
    readonly indirect: boolean;
    readonly reason: string;
    readonly evidence: readonly string[];
}
/** Coverage of accepted instruction bytes against `adapter.backingSize`. */
export interface StaticCoverageSummary {
    readonly instructionCount: number;
    readonly functionCount: number;
    readonly reachedBytes: number;
    readonly totalBytes: number;
    /** `reachedBytes / totalBytes * 100`, or `0` when `totalBytes` is 0. */
    readonly reachedPercent: number;
}
/** Why the run stopped before the worklist emptied. */
export interface StaticAnalysisIncompleteReason {
    readonly kind: "call-context-limit" | "work-limit";
    readonly address: number;
    readonly limit: number;
    readonly message: string;
}
/** Worklist output: accepted CFG plus conflicts, unresolved flow, and coverage. */
export interface StaticAnalysisResult<State> {
    /** `incomplete` when a work or call-depth cap fired. */
    readonly status: "complete" | "incomplete";
    readonly nodes: readonly StaticAnalysisNode<State>[];
    readonly edges: readonly StaticAnalysisEdge[];
    readonly functions: readonly StaticFunctionCandidate[];
    readonly conflicts: readonly StaticAnalysisConflict[];
    readonly unresolved: readonly StaticUnresolvedFlow[];
    readonly coverage: StaticCoverageSummary;
    readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
    readonly processedWorkItems: number;
}
/**
 * Deterministic conservative worklist traversal. Architecture-specific decoding
 * and state transfer stay behind the adapter boundary. Duplicate target overrides
 * at the same address are rejected. Call context is truncated at `maxCallDepth`.
 * @param {StaticAnalysisAdapter<State>} adapter Architecture-specific decode and abstract-state operations.
 * @param {readonly StaticAnalysisSeed<State>[]} seeds Justified entry points with their initial states and evidence.
 * @param {StaticAnalysisLimits & { readonly targetOverrides?: readonly StaticTargetOverride[] }} [options] Work, context, and target-override configuration.
 * @returns {StaticAnalysisResult<State>} Accepted CFG plus conflicts, unresolved flow, coverage, and completion status.
 */
export declare const analyzeStaticControlFlow: <State>(adapter: StaticAnalysisAdapter<State>, seeds: readonly StaticAnalysisSeed<State>[], options?: StaticAnalysisLimits & {
    readonly targetOverrides?: readonly StaticTargetOverride[];
}) => StaticAnalysisResult<State>;
//# sourceMappingURL=static-analysis.d.ts.map