/** Default work-item budget when `analyzeStaticControlFlow` omits `maxWorkItems`. */
export const DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS = 1_000_000;
/** Default call-context depth when `analyzeStaticControlFlow` omits `maxCallDepth`. */
export const DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH = 16;
const hexAddress = (address) => address.toString(16).padStart(6, "0");
const contextKey = (context) => context
    .map((frame) => `${hexAddress(frame.callSite)}>${hexAddress(frame.returnAddress)}`)
    .join("/");
const nodeIdFor = (address, context) => `cfg:${hexAddress(address)}${context.length === 0 ? "" : `:${contextKey(context)}`}`;
const sortedUnique = (values) => [...new Set(values)].toSorted();
/**
 * Semantic priority shared by the work heap and historical deterministic traversal.
 * Do not add insertion order here: the heap supplies it only as a final stability tie-breaker, so
 * addresses, call contexts, entry points, and predecessors retain their documented precedence.
 * @param {WorkItem<State>} left Left queued work item.
 * @param {WorkItem<State>} right Right queued work item.
 * @returns {number} Negative, zero, or positive semantic priority comparison.
 */
const sortWork = (left, right) => left.address - right.address ||
    contextKey(left.context).localeCompare(contextKey(right.context)) ||
    left.entryPoint.localeCompare(right.entryPoint) ||
    (left.predecessor ?? "").localeCompare(right.predecessor ?? "");
/**
 * Stable binary min-heap for deterministic static-analysis work scheduling.
 *
 * The analyzer previously appended every item and sorted the complete queue after every enqueue.
 * That made large control-flow traversals approach quadratic work. This heap keeps insertion and
 * removal at O(log n), while `sequence` preserves the stable-order behavior of the former array
 * sort whenever `sortWork()` considers two items equal. Do not remove that tie-breaker or replace
 * this with an unordered queue: traversal order affects limit diagnostics and serialized evidence.
 */
class StaticWorkQueue {
    #values = [];
    #nextSequence = 0;
    constructor(items) {
        for (const item of items) {
            this.push(item);
        }
    }
    get length() {
        return this.#values.length;
    }
    peek() {
        return this.#values[0]?.item;
    }
    push(item) {
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
    shift() {
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
                const child = right < this.#values.length && this.#compare(this.#values[right], this.#values[left]) < 0
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
    #compare(left, right) {
        return sortWork(left.item, right.item) || left.sequence - right.sequence;
    }
}
const edgeIdFor = (from, kind, toAddress, override) => `edge:${from}:${kind}:${toAddress === undefined ? "unresolved" : hexAddress(toAddress)}${override ? `:${override}` : ""}`;
const conflictKindFor = (decoded) => {
    if (decoded.kind === "ambiguous") {
        return "state-ambiguity";
    }
    if (decoded.kind === "blocked") {
        return "blocked";
    }
    return decoded.reason.includes("map") ? "invalid-mapping" : "decode";
};
const overriddenTargetKind = (flow) => {
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
export const analyzeStaticControlFlow = (adapter, seeds, options = {}) => {
    const maxWorkItems = options.maxWorkItems ?? DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS;
    const maxCallDepth = options.maxCallDepth ?? DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH;
    if (!Number.isSafeInteger(maxWorkItems) || maxWorkItems <= 0) {
        throw new Error("maxWorkItems must be a positive safe integer.");
    }
    if (!Number.isSafeInteger(maxCallDepth) || maxCallDepth < 0) {
        throw new Error("maxCallDepth must be a non-negative safe integer.");
    }
    const overrides = new Map();
    for (const override of [...(options.targetOverrides ?? [])].toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id))) {
        if (overrides.has(override.address)) {
            throw new Error(`More than one target override exists at $${hexAddress(override.address)}.`);
        }
        overrides.set(override.address, override);
    }
    // Sort seeds once to retain the historical entry-point order. Every later insertion is ordered
    // incrementally by StaticWorkQueue instead of repeatedly sorting the complete pending worklist.
    const queue = new StaticWorkQueue([...seeds]
        .toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id))
        .map((seed) => ({
        address: seed.address,
        state: seed.state,
        context: [],
        entryPoint: seed.id,
        evidence: sortedUnique(seed.evidence),
        path: [],
    })));
    const states = new Map();
    const nodes = new Map();
    const edges = new Map();
    const functions = new Map();
    const conflicts = new Map();
    const unresolved = new Map();
    const ownership = new Map();
    const ownedByNode = new Map();
    const incompleteReasons = new Map();
    let processedWorkItems = 0;
    const addConflict = (conflict) => {
        conflicts.set(conflict.id, conflict);
    };
    const addIncomplete = (reason) => {
        incompleteReasons.set(`${reason.kind}:${reason.address}:${reason.limit}`, reason);
    };
    const enqueue = (item) => {
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
        functions.set(`function:${hexAddress(seed.address)}`, {
            id: `function:${hexAddress(seed.address)}`,
            address: seed.address,
            source: seed.kind === "vector" ? "interrupt" : "entry",
            evidence: sortedUnique(seed.evidence),
            evidencePath: [],
        });
    }
    while (queue.length > 0) {
        if (processedWorkItems >= maxWorkItems) {
            const next = queue.peek();
            addIncomplete({
                kind: "work-limit",
                address: next.address,
                limit: maxWorkItems,
                message: `Static analysis stopped after ${maxWorkItems} work items.`,
            });
            break;
        }
        const item = queue.shift();
        processedWorkItems++;
        const enteredState = adapter.enterAddress?.(item.state, item.address) ?? item.state;
        const nodeId = nodeIdFor(item.address, item.context);
        const previousState = states.get(nodeId);
        const incomingState = previousState ? adapter.join(previousState, enteredState) : enteredState;
        if (previousState && adapter.stateKey(previousState) === adapter.stateKey(incomingState)) {
            if (item.predecessor && item.edgeKind) {
                const edgeId = edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override);
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
            const message = decoded.kind === "ambiguous"
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
                const edgeId = edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override);
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
        const byteOffsets = Array.from({ length: instruction.size }, (_, index) => instruction.fileOffset + index);
        const overlapping = new Set();
        for (const offset of byteOffsets) {
            for (const owner of ownership.get(offset) ?? []) {
                const existing = nodes.get(owner);
                const compatibleBoundary = existing?.fileOffset === instruction.fileOffset && existing.size === instruction.size;
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
            const owners = ownership.get(offset) ?? new Set();
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
            const edgeId = edgeIdFor(item.predecessor, item.edgeKind, item.address, item.override);
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
        const fallthroughAddress = (instruction.address & 0xff0000) | ((instruction.address + instruction.size) & 0xffff);
        const override = overrides.get(instruction.address);
        const controlTargets = override
            ? override.targets.map((address) => ({
                kind: overriddenTargetKind(instruction.flow.kind),
                address,
                indirect: true,
                explanation: `Resolved by target override '${override.id}'.`,
            }))
            : instruction.targets;
        const scheduleTarget = (target, context) => {
            const kind = target.kind;
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
                const unresolvedId = `unresolved:${hexAddress(instruction.address)}:${target.kind}`;
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
                const functionId = `function:${hexAddress(target.address)}`;
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
                    { callSite: instruction.address, returnAddress: fallthroughAddress },
                ];
                if (nextContext.length > maxCallDepth) {
                    addIncomplete({
                        kind: "call-context-limit",
                        address: instruction.address,
                        limit: maxCallDepth,
                        message: `Call context at $${hexAddress(instruction.address)} exceeds depth ${maxCallDepth}.`,
                    });
                    scheduleTarget(target, maxCallDepth === 0 ? [] : nextContext.slice(-maxCallDepth));
                }
                else {
                    scheduleTarget(target, nextContext);
                }
            }
            else {
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
        }
        else if (instruction.flow.fallthrough) {
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
    const reachedOffsets = new Set();
    for (const offsets of ownedByNode.values()) {
        for (const offset of offsets) {
            reachedOffsets.add(offset);
        }
    }
    const sortedNodes = [...nodes.values()].toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id));
    const sortedFunctions = [...functions.values()].toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id));
    return {
        status: incompleteReasons.size === 0 ? "complete" : "incomplete",
        nodes: sortedNodes,
        edges: [...edges.values()].toSorted((left, right) => left.fromAddress - right.fromAddress || left.id.localeCompare(right.id)),
        functions: sortedFunctions,
        conflicts: [...conflicts.values()].toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id)),
        unresolved: [...unresolved.values()].toSorted((left, right) => left.address - right.address || left.id.localeCompare(right.id)),
        coverage: {
            instructionCount: sortedNodes.length,
            functionCount: sortedFunctions.length,
            reachedBytes: reachedOffsets.size,
            totalBytes: adapter.backingSize,
            reachedPercent: adapter.backingSize === 0
                ? 0
                : Number(((reachedOffsets.size / adapter.backingSize) * 100).toFixed(6)),
        },
        incompleteReasons: [...incompleteReasons.values()].toSorted((left, right) => left.address - right.address || left.kind.localeCompare(right.kind)),
        processedWorkItems,
    };
};
//# sourceMappingURL=static-analysis.js.map