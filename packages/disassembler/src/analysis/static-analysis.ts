import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { EvidencePool } from "../model/evidence-pool.js";
import { matchesResearchMapping, type ResearchMapping } from "../model/research-mapping.js";
/**
 * Target-neutral control-flow kinds emitted by a static-analysis adapter.
 * `stop` / `wait` do not fall through. `return` pops the call context when present.
 */
export type StaticControlFlowKind =
  | "call"
  | "conditionalBranch"
  | "fallthrough"
  | "interrupt"
  | "jump"
  | "return"
  | "stop"
  | "wait";

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
export type StaticStateEffect =
  | { readonly kind: "clearBits"; readonly target: string; readonly mask: number }
  | { readonly kind: "setBits"; readonly target: string; readonly mask: number }
  | { readonly kind: "copy"; readonly from: string; readonly to: string }
  | { readonly kind: "exchange"; readonly left: string; readonly right: string }
  | { readonly kind: "push"; readonly source: string }
  | { readonly kind: "pull"; readonly target: string }
  | { readonly kind: "unknown"; readonly target: string }
  | {
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
export type StaticDecodeResult =
  | { readonly kind: "instruction"; readonly instruction: StaticInstruction }
  | {
      readonly kind: "ambiguous";
      readonly reason: string;
      readonly requiredState: readonly string[];
    }
  | { readonly kind: "blocked"; readonly reason: string; readonly evidence: readonly string[] }
  | { readonly kind: "error"; readonly reason: string };

/** Justified worklist entry with its initial abstract state. */
export interface StaticAnalysisSeed<State> {
  readonly id: string;
  readonly address: number;
  readonly kind:
    | "configured"
    | "imported-label"
    | "manual"
    | "observation"
    | "target-set"
    | "vector";
  readonly state: State;
  readonly evidence: readonly string[];
  readonly detail?: string;
}

/** Manual resolution of an indirect site. At most one selector may match an instruction. */
export interface StaticTargetOverride {
  readonly mapping?: ResearchMapping;
  readonly id: string;
  readonly address: number;
  readonly targets: readonly number[];
  readonly evidence: readonly string[];
}

/** Default work-item budget when `analyzeStaticControlFlow` omits `maxWorkItems`. */
export const DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS = 1_000_000;

/** Default call-context depth when `analyzeStaticControlFlow` omits `maxCallDepth`. */
export const DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH = 16;

/**
 * Deterministic worklist caps.
 * Omitted limits use {@link DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS} and
 * {@link DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH}.
 */
export interface StaticAnalysisLimits {
  /** Positive safe integer work budget. Reaching it returns an incomplete result with a reason. */
  readonly maxWorkItems?: number;
  /** Nonnegative call-context depth. Zero discards call history, and deeper calls report a bound. */
  readonly maxCallDepth?: number;
  /** Cumulative explored work and remaining queue, reported at bounded intervals and completion.
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

export type StaticAnalysisEdgeKind =
  | "branch"
  | "call"
  | "fallthrough"
  | "interrupt"
  | "jump"
  | "return"
  | "unresolved";

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
  readonly kind:
    | "blocked"
    | "decode"
    | "instruction-boundary"
    | "invalid-mapping"
    | "state-ambiguity";
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

interface CallFrame {
  readonly callSite: number;
  /** The caller mapping distinguishes identical call stacks from different physical banks. */
  readonly executionContext?: string;
  readonly returnAddress: number;
}

interface WorkItem<State> {
  readonly address: number;
  readonly state: State;
  readonly context: readonly CallFrame[];
  readonly entryPoint: string;
  readonly evidence: readonly string[];
  readonly path: readonly string[];
  readonly edgeKind?: StaticAnalysisEdgeKind;
  readonly predecessor?: string;
  readonly indirect?: boolean;
  readonly override?: string;
  readonly explanation?: string;
}

const hexAddress = (address: number): string => address.toString(16).padStart(6, "0");
const contextKey = (context: readonly CallFrame[]): string =>
  context
    .map(
      (frame) =>
        `${hexAddress(frame.callSite)}>${hexAddress(frame.returnAddress)}${frame.executionContext ?? ""}`,
    )
    .join("/");
const nodeIdFor = (address: number, context: readonly CallFrame[]): string =>
  `cfg:${hexAddress(address)}${context.length === 0 ? "" : `:${contextKey(context)}`}`;

/**
 * Semantic priority shared by the work heap and historical deterministic traversal.
 * Do not add insertion order here: the heap supplies it only as a final stability tie-breaker, so
 * addresses, call contexts, entry points, and predecessors retain their documented precedence.
 * @param {WorkItem<State>} left Left queued work item.
 * @param {WorkItem<State>} right Right queued work item.
 * @returns {number} Negative, zero, or positive semantic priority comparison.
 */
const sortWork = <State>(left: WorkItem<State>, right: WorkItem<State>): number =>
  left.address - right.address ||
  contextKey(left.context).localeCompare(contextKey(right.context)) ||
  left.entryPoint.localeCompare(right.entryPoint) ||
  (left.predecessor ?? "").localeCompare(right.predecessor ?? "");

type QueuedWork<State> = {
  readonly item: WorkItem<State>;
  /** Monotonic insertion order used only when every semantic sort field ties. */
  readonly sequence: number;
};

/**
 * Stable binary min-heap for deterministic static-analysis work scheduling.
 *
 * The analyzer previously appended every item and sorted the complete queue after every enqueue.
 * That made large control-flow traversals approach quadratic work. This heap keeps insertion and
 * removal at O(log n), while `sequence` preserves the stable-order behavior of the former array
 * sort whenever `sortWork()` considers two items equal. Do not remove that tie-breaker or replace
 * this with an unordered queue: traversal order affects limit diagnostics and serialized evidence.
 */
class StaticWorkQueue<State> {
  readonly #values: QueuedWork<State>[] = [];
  #nextSequence = 0;

  constructor(items: readonly WorkItem<State>[]) {
    for (const item of items) {
      this.push(item);
    }
  }

  get length(): number {
    return this.#values.length;
  }

  peek(): WorkItem<State> | undefined {
    return this.#values[0]?.item;
  }

  push(item: WorkItem<State>): void {
    const queued = { item, sequence: this.#nextSequence++ };
    this.#values.push(queued);
    // Performance invariant: sift up only the appended item. Sorting #values here reintroduces
    // the full-queue O(n log n) cost that dominated large ROM analysis.
    let index = this.#values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#compare(this.#values[parent], queued) <= 0) {
        break;
      }
      this.#values[index] = this.#values[parent];
      index = parent;
    }
    this.#values[index] = queued;
  }

  shift(): WorkItem<State> | undefined {
    const firstSlot = this.#values.length > 0 ? this.#values[0] : undefined;
    const last = this.#values.pop();
    if (!firstSlot || !last) {
      return undefined;
    }
    if (this.#values.length > 0) {
      // Restore the heap by sifting the former tail down. Assigning parents/children in place also
      // avoids allocating a replacement queue on every processed CFG edge.
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= this.#values.length) {
          break;
        }
        const right = left + 1;
        const child =
          right < this.#values.length && this.#compare(this.#values[right], this.#values[left]) < 0
            ? right
            : left;
        if (this.#compare(last, this.#values[child]) <= 0) {
          break;
        }
        this.#values[index] = this.#values[child];
        index = child;
      }
      this.#values[index] = last;
    }
    return firstSlot.item;
  }

  #compare(left: QueuedWork<State>, right: QueuedWork<State>): number {
    return sortWork(left.item, right.item) || left.sequence - right.sequence;
  }
}

const edgeIdFor = (
  from: string,
  kind: StaticAnalysisEdgeKind,
  toAddress: number | undefined,
  override: string | undefined,
): string =>
  `edge:${from}:${kind}:${toAddress === undefined ? "unresolved" : hexAddress(toAddress)}${override ? `:${override}` : ""}`;

const conflictKindFor = (
  decoded: Exclude<StaticDecodeResult, { readonly kind: "instruction" }>,
): StaticAnalysisConflict["kind"] => {
  if (decoded.kind === "ambiguous") {
    return "state-ambiguity";
  }
  if (decoded.kind === "blocked") {
    return "blocked";
  }
  return decoded.reason.includes("map") ? "invalid-mapping" : "decode";
};

const overriddenTargetKind = (flow: StaticControlFlowKind): StaticControlTargetKind => {
  if (flow === "call") {
    return "call";
  }
  if (flow === "interrupt") {
    return "interrupt";
  }
  if (flow === "conditionalBranch") {
    return "branch";
  }
  return "jump";
};

/**
 * Deterministic conservative worklist traversal. Architecture-specific decoding
 * and state transfer stay behind the adapter boundary. Duplicate target overrides
 * at the same address are rejected. Call context is truncated at `maxCallDepth`.
 * @param {StaticAnalysisAdapter<State>} adapter Architecture-specific decode and abstract-state operations.
 * @param {readonly StaticAnalysisSeed<State>[]} seeds Justified entry points with their initial states and evidence.
 * @param {StaticAnalysisLimits & { readonly targetOverrides?: readonly StaticTargetOverride[] }} [options] Work, context, and target-override configuration.
 * @returns {StaticAnalysisResult<State>} Accepted CFG plus conflicts, unresolved flow, coverage, and completion status.
 */
export const analyzeStaticControlFlow = <State>(
  adapter: StaticAnalysisAdapter<State>,
  seeds: readonly StaticAnalysisSeed<State>[],
  options: StaticAnalysisLimits & {
    readonly targetOverrides?: readonly StaticTargetOverride[];
  } = {},
): StaticAnalysisResult<State> => {
  // Successors often consume no new provenance. Share their exact unions instead of retaining
  // another capture-sized array at every node, edge, work item and function candidate.
  const evidencePool = new EvidencePool();
  const sortedUnique = (values: readonly string[]): readonly string[] =>
    evidencePool.sorted(values);
  const maxWorkItems = options.maxWorkItems ?? DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS;
  const maxCallDepth = options.maxCallDepth ?? DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH;
  if (!Number.isSafeInteger(maxWorkItems) || maxWorkItems <= 0) {
    throw new Error("maxWorkItems must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(maxCallDepth) || maxCallDepth < 0) {
    throw new Error("maxCallDepth must be a non-negative safe integer.");
  }

  // The default preserves existing targets; banked adapters partition execution before state joins.
  const executionSuffix = (address: number, state: State): string => {
    const key = adapter.executionContextKey?.(address, state);
    return key === undefined ? "" : `:mapping:${encodeURIComponent(key)}`;
  };
  const overrides = new Map<number, StaticTargetOverride[]>();
  for (const override of [...(options.targetOverrides ?? [])].toSorted(
    (left, right) => left.address - right.address || left.id.localeCompare(right.id),
  )) {
    const previous = overrides.get(override.address) ?? [];
    if (
      previous.some(
        (item) => canonicalJson(item.mapping ?? null) === canonicalJson(override.mapping ?? null),
      )
    ) {
      throw new Error(`More than one target override exists at $${hexAddress(override.address)}.`);
    }
    overrides.set(override.address, [...previous, override]);
  }

  // Sort seeds once to retain the historical entry-point order. Every later insertion is ordered
  // incrementally by StaticWorkQueue instead of repeatedly sorting the complete pending worklist.
  const queue = new StaticWorkQueue(
    [...seeds]
      .toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id))
      .map((seed) => ({
        address: seed.address,
        state: seed.state,
        context: [],
        entryPoint: seed.id,
        evidence: sortedUnique(seed.evidence),
        path: [],
      })),
  );
  const states = new Map<string, State>();
  const nodes = new Map<string, StaticAnalysisNode<State>>();
  const edges = new Map<string, StaticAnalysisEdge>();
  const functions = new Map<string, StaticFunctionCandidate>();
  const conflicts = new Map<string, StaticAnalysisConflict>();
  const unresolved = new Map<string, StaticUnresolvedFlow>();
  const ownership = new Map<number, Set<string>>();
  const ownedByNode = new Map<string, readonly number[]>();
  const incompleteReasons = new Map<string, StaticAnalysisIncompleteReason>();
  let processedWorkItems = 0;

  const addConflict = (conflict: StaticAnalysisConflict): void => {
    conflicts.set(conflict.id, conflict);
  };
  const addIncomplete = (reason: StaticAnalysisIncompleteReason): void => {
    incompleteReasons.set(`${reason.kind}:${reason.address}:${reason.limit}`, reason);
  };
  const enqueue = (item: WorkItem<State>): void => {
    // Keep this wrapper: successors must enter through the stable heap so maxWorkItems observes the
    // same deterministic next item regardless of which adapter emitted them.
    queue.push(item);
  };

  for (const seed of seeds) {
    // A runtime PC proves that an instruction executed, not that it begins a function. Calls,
    // interrupts, and deliberate entry-point metadata remain the sources of function ownership.
    if (seed.kind === "observation") {
      continue;
    }
    const functionId = `function:${hexAddress(seed.address)}${executionSuffix(seed.address, seed.state)}`;
    functions.set(functionId, {
      id: functionId,
      address: seed.address,
      source: seed.kind === "vector" ? "interrupt" : "entry",
      evidence: sortedUnique(seed.evidence),
      evidencePath: [],
    });
  }

  while (queue.length > 0) {
    if (processedWorkItems >= maxWorkItems) {
      const next = queue.peek()!;
      addIncomplete({
        kind: "work-limit",
        address: next.address,
        limit: maxWorkItems,
        message: `Static analysis stopped after ${maxWorkItems} work items.`,
      });
      break;
    }
    const item = queue.shift()!;
    processedWorkItems++;
    // Report before early-continue paths so repeated state joins still show forward progress.
    if (processedWorkItems % 4096 === 0) {
      options.onProgress?.({
        processedWorkItems,
        queuedWorkItems: queue.length,
        instructions: nodes.size,
      });
    }
    const enteredState = adapter.enterAddress?.(item.state, item.address) ?? item.state;
    const suffix = executionSuffix(item.address, enteredState);
    const nodeId = nodeIdFor(item.address, item.context) + suffix;
    const previousState = states.get(nodeId);
    const incomingState = previousState ? adapter.join(previousState, enteredState) : enteredState;
    if (previousState && adapter.stateKey(previousState) === adapter.stateKey(incomingState)) {
      if (item.predecessor && item.edgeKind) {
        const edgeId =
          edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override) + suffix;
        edges.set(edgeId, {
          id: edgeId,
          from: item.predecessor,
          fromAddress: nodes.get(item.predecessor)?.address ?? item.address,
          to: nodeId,
          toAddress: item.address,
          kind: item.edgeKind,
          indirect: item.indirect ?? false,
          ...(item.override ? { override: item.override } : {}),
          evidence: item.evidence,
          ...(item.explanation ? { explanation: item.explanation } : {}),
        });
      }
      continue;
    }
    states.set(nodeId, incomingState);

    const previousOwned = ownedByNode.get(nodeId) ?? [];
    for (const offset of previousOwned) {
      const owners = ownership.get(offset);
      owners?.delete(nodeId);
      if (owners?.size === 0) {
        ownership.delete(offset);
      }
    }
    nodes.delete(nodeId);

    const decoded = adapter.decode(item.address, incomingState);
    if (decoded.kind !== "instruction") {
      const conflictKind = conflictKindFor(decoded);
      const evidence = sortedUnique([
        ...item.evidence,
        ...(decoded.kind === "blocked" ? decoded.evidence : []),
      ]);
      const message =
        decoded.kind === "ambiguous"
          ? `${decoded.reason} Required state: ${decoded.requiredState.join(", ")}.`
          : decoded.reason;
      addConflict({
        id: `conflict:${conflictKind}:${hexAddress(item.address)}:${nodeId}`,
        kind: conflictKind,
        address: item.address,
        message,
        nodes: [nodeId],
        evidence,
      });
      if (item.predecessor && item.edgeKind) {
        const edgeId =
          edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override) + suffix;
        edges.set(edgeId, {
          id: edgeId,
          from: item.predecessor,
          fromAddress: nodes.get(item.predecessor)?.address ?? item.address,
          toAddress: item.address,
          kind: item.edgeKind,
          indirect: item.indirect ?? false,
          ...(item.override ? { override: item.override } : {}),
          evidence,
          ...(item.explanation ? { explanation: item.explanation } : {}),
        });
      }
      continue;
    }

    const instruction = decoded.instruction;
    const nodeEvidence = sortedUnique([...item.evidence, ...(instruction.evidence ?? [])]);
    const byteOffsets = Array.from(
      { length: instruction.size },
      (_, index) => instruction.fileOffset + index,
    );
    const overlapping = new Set<string>();
    for (const offset of byteOffsets) {
      for (const owner of ownership.get(offset) ?? []) {
        const existing = nodes.get(owner);
        const compatibleBoundary =
          existing?.fileOffset === instruction.fileOffset && existing.size === instruction.size;
        if (owner !== nodeId && !compatibleBoundary) {
          overlapping.add(owner);
        }
      }
    }
    if (overlapping.size > 0) {
      const related = [...overlapping, nodeId].toSorted();
      addConflict({
        id: `conflict:instruction-boundary:${hexAddress(item.address)}:${related.join("+")}`,
        kind: "instruction-boundary",
        address: item.address,
        message: `Instruction at $${hexAddress(item.address)} overlaps an incompatible accepted instruction boundary.`,
        nodes: related,
        evidence: nodeEvidence,
      });
    }
    for (const offset of byteOffsets) {
      const owners = ownership.get(offset) ?? new Set<string>();
      owners.add(nodeId);
      ownership.set(offset, owners);
    }
    ownedByNode.set(nodeId, byteOffsets);

    const outgoingState = adapter.transfer(instruction, incomingState);
    const path = [...item.path, nodeId];
    nodes.set(nodeId, {
      id: nodeId,
      address: instruction.address,
      fileOffset: instruction.fileOffset,
      size: instruction.size,
      opcode: instruction.opcode,
      specificationId: instruction.specificationId,
      mnemonic: instruction.mnemonic,
      mode: instruction.mode,
      context: item.context.map((frame) => frame.callSite),
      incomingState,
      outgoingState,
      effectiveAddresses: instruction.effectiveAddresses ?? [],
      entryPoint: item.entryPoint,
      evidence: nodeEvidence,
      evidencePath: path,
    });

    if (item.predecessor && item.edgeKind) {
      const edgeId =
        edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override) + suffix;
      edges.set(edgeId, {
        id: edgeId,
        from: item.predecessor,
        fromAddress: nodes.get(item.predecessor)?.address ?? item.address,
        to: nodeId,
        toAddress: item.address,
        kind: item.edgeKind,
        indirect: item.indirect ?? false,
        ...(item.override ? { override: item.override } : {}),
        evidence: nodeEvidence,
        ...(item.explanation ? { explanation: item.explanation } : {}),
      });
    }

    const fallthroughAddress =
      (instruction.address & 0xff0000) | ((instruction.address + instruction.size) & 0xffff);
    const matchingOverrides = (overrides.get(instruction.address) ?? []).filter((entry) =>
      matchesResearchMapping(entry.mapping, {
        fileOffset: instruction.fileOffset,
        state: adapter.mappingState?.(incomingState),
      }),
    );
    // Overlapping selectors are an authoring conflict; ordering must never choose a bank silently.
    if (matchingOverrides.length > 1) {
      throw new Error(
        `Multiple target overrides match $${hexAddress(instruction.address)} in this mapping.`,
      );
    }
    const override = matchingOverrides.at(0);
    const controlTargets = override
      ? override.targets.map((address) => ({
          kind: overriddenTargetKind(instruction.flow.kind),
          address,
          indirect: true,
          explanation: `Resolved by target override '${override.id}'.`,
        }))
      : instruction.targets;

    const scheduleTarget = (target: StaticControlTarget, context: readonly CallFrame[]): void => {
      const kind: StaticAnalysisEdgeKind = target.kind;
      if (target.address === undefined) {
        const edgeId = edgeIdFor(nodeId, "unresolved", undefined, override?.id);
        edges.set(edgeId, {
          id: edgeId,
          from: nodeId,
          fromAddress: instruction.address,
          kind: "unresolved",
          indirect: target.indirect ?? false,
          ...(override ? { override: override.id } : {}),
          evidence: sortedUnique([...nodeEvidence, ...(override?.evidence ?? [])]),
          ...(target.explanation ? { explanation: target.explanation } : {}),
        });
        const unresolvedId = `unresolved:${hexAddress(instruction.address)}:${target.kind}${suffix}`;
        unresolved.set(unresolvedId, {
          id: unresolvedId,
          address: instruction.address,
          kind,
          indirect: target.indirect ?? false,
          reason: target.explanation ?? "The control-flow target is unresolved.",
          evidence: nodeEvidence,
        });
        return;
      }
      const targetEvidence = sortedUnique([...nodeEvidence, ...(override?.evidence ?? [])]);
      enqueue({
        address: target.address,
        state: outgoingState,
        context,
        entryPoint: item.entryPoint,
        evidence: targetEvidence,
        path,
        edgeKind: kind,
        predecessor: nodeId,
        indirect: target.indirect,
        override: override?.id,
        explanation: target.explanation,
      });
      if (kind === "call" || kind === "interrupt") {
        const functionId = `function:${hexAddress(target.address)}${executionSuffix(target.address, outgoingState)}`;
        if (!functions.has(functionId)) {
          functions.set(functionId, {
            id: functionId,
            address: target.address,
            source: kind === "call" ? "call" : "interrupt",
            evidence: targetEvidence,
            evidencePath: path,
          });
        }
      }
    };

    for (const target of controlTargets) {
      if (target.kind === "call") {
        const nextContext = [
          ...item.context,
          {
            callSite: instruction.address,
            returnAddress: fallthroughAddress,
            executionContext: executionSuffix(instruction.address, incomingState),
          },
        ];
        if (nextContext.length > maxCallDepth) {
          addIncomplete({
            kind: "call-context-limit",
            address: instruction.address,
            limit: maxCallDepth,
            message: `Call context at $${hexAddress(instruction.address)} exceeds depth ${maxCallDepth}.`,
          });
          scheduleTarget(target, maxCallDepth === 0 ? [] : nextContext.slice(-maxCallDepth));
        } else {
          scheduleTarget(target, nextContext);
        }
      } else {
        scheduleTarget(target, item.context);
      }
    }

    if (instruction.flow.kind === "return") {
      const frame = item.context.at(-1);
      if (frame) {
        enqueue({
          address: frame.returnAddress,
          state: outgoingState,
          context: item.context.slice(0, -1),
          entryPoint: item.entryPoint,
          evidence: nodeEvidence,
          path,
          edgeKind: "return",
          predecessor: nodeId,
        });
      }
    } else if (instruction.flow.fallthrough) {
      enqueue({
        address: fallthroughAddress,
        state: outgoingState,
        context: item.context,
        entryPoint: item.entryPoint,
        evidence: nodeEvidence,
        path,
        edgeKind: "fallthrough",
        predecessor: nodeId,
      });
    }
  }

  options.onProgress?.({
    processedWorkItems,
    queuedWorkItems: queue.length,
    instructions: nodes.size,
  });

  const reachedOffsets = new Set<number>();
  for (const offsets of ownedByNode.values()) {
    for (const offset of offsets) {
      reachedOffsets.add(offset);
    }
  }
  const sortedNodes = [...nodes.values()].toSorted(
    (left, right) => left.address - right.address || left.id.localeCompare(right.id),
  );
  const sortedFunctions = [...functions.values()].toSorted(
    (left, right) => left.address - right.address || left.id.localeCompare(right.id),
  );
  return {
    status: incompleteReasons.size === 0 ? "complete" : "incomplete",
    nodes: sortedNodes,
    edges: [...edges.values()].toSorted(
      (left, right) => left.fromAddress - right.fromAddress || left.id.localeCompare(right.id),
    ),
    functions: sortedFunctions,
    conflicts: [...conflicts.values()].toSorted(
      (left, right) => left.address - right.address || left.id.localeCompare(right.id),
    ),
    unresolved: [...unresolved.values()].toSorted(
      (left, right) => left.address - right.address || left.id.localeCompare(right.id),
    ),
    coverage: {
      instructionCount: sortedNodes.length,
      functionCount: sortedFunctions.length,
      reachedBytes: reachedOffsets.size,
      totalBytes: adapter.backingSize,
      reachedPercent:
        adapter.backingSize === 0
          ? 0
          : Number(((reachedOffsets.size / adapter.backingSize) * 100).toFixed(6)),
    },
    incompleteReasons: [...incompleteReasons.values()].toSorted(
      (left, right) => left.address - right.address || left.kind.localeCompare(right.kind),
    ),
    processedWorkItems,
  };
};
