import type {
  AnalysisControlFlowNodeRecord,
  AnalysisProjectManifest,
  AnalysisProjectShards,
  IntervalAnnotation,
  ProjectComment,
  RuntimeCoverageRecord,
  RuntimeCpuStateRecord,
  RuntimeMemoryAccessRecord,
  RuntimeStateValue,
} from "./project-types.js";

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

type EffectiveMutable = {
  value: Omit<InstructionEffectiveAddressAnnotation, "nodeIds" | "evidence">;
  nodeIds: Set<string>;
  evidence: Set<string>;
};

type TransitionMutable = {
  field: string;
  beforeKey: string;
  afterKey: string;
  before?: unknown;
  after?: unknown;
  nodeIds: Set<string>;
  evidence: Set<string>;
};

type StateMutable = {
  source: InstructionStateObservationAnnotation["source"];
  architecture: string;
  state: Readonly<Record<string, unknown>>;
  stateKey: string;
  count?: number;
  recordIds: Set<string>;
  evidence: Set<string>;
};

type MemoryMutable = {
  value: Omit<InstructionMemoryAccessAnnotation, "count" | "recordIds" | "evidence">;
  count: number;
  recordIds: Set<string>;
  evidence: Set<string>;
};

type InstructionMutable = {
  comments?: ProjectComment[];
  addressSpace: string;
  address: number;
  // Evidence collections are deliberately lazy. Most instructions have none of these annotations;
  // eagerly allocating every Set/Map multiplied into hundreds of megabytes on production ROMs.
  outputOffsets?: Set<number>;
  architectures?: Set<string>;
  nodeIds?: Set<string>;
  effectiveAddresses?: Map<string, EffectiveMutable>;
  stateTransitions?: Map<string, TransitionMutable>;
  stateObservations?: Map<string, StateMutable>;
  executionCount: number;
  executionRecordIds?: Set<string>;
  coverageRecordIds?: Set<string>;
  memoryAccesses?: Map<string, MemoryMutable>;
  evidence?: Set<string>;
};

const sortedStrings = (values?: Iterable<string>): readonly string[] =>
  values ? [...new Set(values)].sort((left, right) => left.localeCompare(right)) : [];

const sortedNumbers = (values?: Iterable<number>): readonly number[] =>
  values ? [...new Set(values)].sort((left, right) => left - right) : [];

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
};

const valueKey = (value: unknown, present: boolean): string =>
  present ? JSON.stringify(canonicalValue(value)) : "<absent>";

const locationKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

/**
 * Adds one value while preserving lazy allocation for the common empty case.
 * @param {Set<Value> | undefined} target Existing lazy set, if allocated.
 * @param {Value} value Value to add.
 * @returns {Set<Value>} Existing or newly allocated set containing the value.
 */
const addValue = <Value>(target: Set<Value> | undefined, value: Value): Set<Value> => {
  const values = target ?? new Set<Value>();
  values.add(value);
  return values;
};

/**
 * Merges evidence strings without allocating a set when the input contributes nothing.
 * @param {Set<string> | undefined} target Existing lazy evidence set, if allocated.
 * @param {readonly string[]} values Evidence identifiers to merge.
 * @returns {Set<string> | undefined} Updated set, or the original undefined value for empty input.
 */
const addAll = (
  target: Set<string> | undefined,
  values: readonly string[],
): Set<string> | undefined => {
  if (values.length === 0) return target;
  target ??= new Set<string>();
  for (const value of values) target.add(value);
  return target;
};

const numberField = (
  record: Readonly<Record<string, unknown>>,
  name: string,
): number | undefined => {
  const value = record[name];
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
};

const effectiveAddress = (
  value: Readonly<Record<string, unknown>>,
): Omit<InstructionEffectiveAddressAnnotation, "nodeIds" | "evidence"> | undefined => {
  const operandIndex = numberField(value, "operandIndex");
  if (
    operandIndex === undefined ||
    typeof value.volatile !== "boolean" ||
    typeof value.explanation !== "string"
  ) {
    return undefined;
  }
  const address = numberField(value, "address");
  const baseAddress = numberField(value, "baseAddress");
  const romOffset = numberField(value, "romOffset");
  const symbol =
    typeof value.symbol === "string" && value.symbol.length > 0 ? value.symbol : undefined;
  return {
    operandIndex,
    ...(address === undefined ? {} : { address }),
    ...(baseAddress === undefined ? {} : { baseAddress }),
    ...(symbol === undefined ? {} : { symbol }),
    volatile: value.volatile,
    ...(romOffset === undefined ? {} : { romOffset }),
    explanation: value.explanation,
  };
};

const annotationState = (
  annotation: IntervalAnnotation,
): Readonly<Record<string, unknown>> | undefined => annotation.state;

const runtimeState = (record: RuntimeCpuStateRecord): Readonly<Record<string, RuntimeStateValue>> =>
  record.state;

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
 * @returns {InstructionAnalysisAnnotations} Stable instruction annotations and malformed-metadata notes.
 */
export const buildInstructionAnalysisAnnotations = (
  manifest: Pick<AnalysisProjectManifest, "addressSpaces">,
  shards: AnalysisProjectShards,
): InstructionAnalysisAnnotations => {
  const fileAddressSpaces = new Set(
    manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id),
  );
  const instructions = new Map<string, InstructionMutable>();
  const diagnostics: InstructionAnnotationDiagnostic[] = [];
  const ensure = (addressSpace: string, address: number): InstructionMutable => {
    const key = locationKey(addressSpace, address);
    let instruction = instructions.get(key);
    if (!instruction) {
      instruction = {
        addressSpace,
        address,
        executionCount: 0,
      };
      instructions.set(key, instruction);
    }
    return instruction;
  };

  const addStateObservation = (
    instruction: InstructionMutable,
    source: InstructionStateObservationAnnotation["source"],
    architecture: string,
    state: Readonly<Record<string, unknown>>,
    recordId: string,
    evidence: readonly string[],
    count?: number,
  ): void => {
    const stateKey = JSON.stringify(canonicalValue(state));
    const key = `${source}:${architecture}:${stateKey}`;
    const observations = (instruction.stateObservations ??= new Map<string, StateMutable>());
    let observation = observations.get(key);
    if (!observation) {
      observation = {
        source,
        architecture,
        state,
        stateKey,
        ...(count === undefined ? {} : { count: 0 }),
        recordIds: new Set(),
        evidence: new Set(),
      };
      observations.set(key, observation);
    }
    if (count !== undefined) observation.count = (observation.count ?? 0) + count;
    observation.recordIds.add(recordId);
    addAll(observation.evidence, evidence);
    instruction.architectures = addValue(instruction.architectures, architecture);
    instruction.evidence = addAll(instruction.evidence, evidence);
  };

  const addNode = (node: AnalysisControlFlowNodeRecord): void => {
    const instruction = ensure(node.addressSpace, node.address);
    instruction.nodeIds = addValue(instruction.nodeIds, node.id);
    if (node.fileOffset !== undefined)
      instruction.outputOffsets = addValue(instruction.outputOffsets, node.fileOffset);
    instruction.evidence = addAll(instruction.evidence, node.evidence);
    for (const raw of node.effectiveAddresses) {
      const value = effectiveAddress(raw);
      if (!value) {
        diagnostics.push({
          recordId: node.id,
          message:
            "Ignored malformed effective-address metadata; required operandIndex, volatile, and explanation fields were not valid.",
        });
        continue;
      }
      const key = JSON.stringify(canonicalValue(value));
      const addresses = (instruction.effectiveAddresses ??= new Map<string, EffectiveMutable>());
      let entry = addresses.get(key);
      if (!entry) {
        entry = { value, nodeIds: new Set(), evidence: new Set() };
        addresses.set(key, entry);
      }
      entry.nodeIds.add(node.id);
      addAll(entry.evidence, node.evidence);
    }
    const before = node.incomingState;
    const after = node.outgoingState;
    for (const field of sortedStrings([...Object.keys(before), ...Object.keys(after)])) {
      const hasBefore = Object.hasOwn(before, field);
      const hasAfter = Object.hasOwn(after, field);
      const beforeValue = before[field];
      const afterValue = after[field];
      const beforeKey = valueKey(beforeValue, hasBefore);
      const afterKey = valueKey(afterValue, hasAfter);
      if (beforeKey === afterKey) continue;
      const key = `${field}:${beforeKey}:${afterKey}`;
      const transitions = (instruction.stateTransitions ??= new Map<string, TransitionMutable>());
      let transition = transitions.get(key);
      if (!transition) {
        transition = {
          field,
          beforeKey,
          afterKey,
          ...(hasBefore ? { before: beforeValue } : {}),
          ...(hasAfter ? { after: afterValue } : {}),
          nodeIds: new Set(),
          evidence: new Set(),
        };
        transitions.set(key, transition);
      }
      transition.nodeIds.add(node.id);
      addAll(transition.evidence, node.evidence);
    }
  };

  for (const record of shards.analysis) {
    if (record.kind === "cfg-node") addNode(record);
  }

  for (const annotation of shards.annotations) {
    if (annotation.classification !== "opcode") continue;
    const instruction = ensure(annotation.addressSpace, annotation.start);
    if (fileAddressSpaces.has(annotation.addressSpace)) {
      instruction.outputOffsets = addValue(instruction.outputOffsets, annotation.start);
    }
  }

  for (const record of shards.runtime) {
    if (record.kind === "runtime-execution") {
      const instruction = ensure(record.addressSpace, record.address);
      if (record.fileOffset !== undefined) {
        instruction.outputOffsets = addValue(instruction.outputOffsets, record.fileOffset);
      }
      instruction.architectures = addValue(instruction.architectures, record.architecture);
      instruction.executionCount += record.count;
      instruction.executionRecordIds = addValue(instruction.executionRecordIds, record.id);
      instruction.evidence = addAll(instruction.evidence, record.evidence);
    } else if (record.kind === "runtime-cpu-state") {
      const instruction = ensure(record.addressSpace, record.address);
      addStateObservation(
        instruction,
        "runtime",
        record.architecture,
        runtimeState(record),
        record.id,
        record.evidence,
        record.count,
      );
    } else if (record.kind === "runtime-memory-access") {
      const instruction = ensure(record.instructionAddressSpace, record.instructionAddress);
      instruction.architectures = addValue(instruction.architectures, record.architecture);
      const value = {
        accessedAddressSpace: record.accessedAddressSpace,
        accessedAddress: record.accessedAddress,
        access: record.access,
        width: record.width,
        ...(record.actor === undefined ? {} : { actor: record.actor }),
        ...(record.channel === undefined ? {} : { channel: record.channel }),
        ...(record.value === undefined ? {} : { value: record.value }),
      };
      const key = JSON.stringify(canonicalValue(value));
      const accesses = (instruction.memoryAccesses ??= new Map<string, MemoryMutable>());
      let access = accesses.get(key);
      if (!access) {
        access = { value, count: 0, recordIds: new Set(), evidence: new Set() };
        accesses.set(key, access);
      }
      access.count += record.count;
      access.recordIds.add(record.id);
      addAll(access.evidence, record.evidence);
      instruction.evidence = addAll(instruction.evidence, record.evidence);
    }
  }

  for (const comment of shards.comments) {
    const instruction = ensure(comment.addressSpace, comment.address);
    (instruction.comments ??= []).push(comment);
    for (const evidence of comment.evidence) (instruction.evidence ??= new Set()).add(evidence);
  }
  const mutable = [...instructions.values()];
  const directIndex = new Map<string, InstructionMutable[]>();
  const outputIndex: Array<{ readonly offset: number; readonly instruction: InstructionMutable }> =
    [];
  for (const instruction of mutable) {
    const direct = directIndex.get(instruction.addressSpace);
    // Performance invariant: these arrays are private construction state, so append in place.
    // Replacing push with `[...direct, instruction]` copies an ever-growing array per instruction and
    // makes index construction quadratic.
    if (direct) direct.push(instruction);
    else directIndex.set(instruction.addressSpace, [instruction]);
    for (const offset of instruction.outputOffsets ?? []) outputIndex.push({ offset, instruction });
  }
  for (const values of directIndex.values()) {
    values.sort((left, right) => left.address - right.address);
  }
  outputIndex.sort((left, right) => left.offset - right.offset);
  /**
   * Finds the first indexed value whose numeric key is at least `target`.
   * @param {readonly T[]} values Sorted indexed values.
   * @param {number} target Inclusive lower-bound key.
   * @param {(value: T) => number} at Numeric key selector.
   * @returns {number} First matching index, or `values.length` when none exists.
   */
  const lowerBound = <T>(
    values: readonly T[],
    target: number,
    at: (value: T) => number,
  ): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (at(values[middle]) < target) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const attachToRange = (
    addressSpace: string,
    start: number,
    end: number,
    callback: (instruction: InstructionMutable) => void,
  ): void => {
    const direct = directIndex.get(addressSpace) ?? [];
    // Start at the first possible direct address rather than revisiting every projected instruction.
    for (
      let index = lowerBound(direct, start, ({ address }) => address);
      index < direct.length && direct[index].address < end;
      index++
    ) {
      callback(direct[index]);
    }
    if (fileAddressSpaces.has(addressSpace)) {
      // Output-offset matches can refer to instructions in another logical address space. Avoid a
      // temporary Set for deduplication: only the exact direct file-space identity can be emitted by
      // both loops, so skip that one case explicitly.
      for (
        let index = lowerBound(outputIndex, start, ({ offset }) => offset);
        index < outputIndex.length && outputIndex[index].offset < end;
        index++
      ) {
        const instruction = outputIndex[index].instruction;
        if (
          instruction.addressSpace === addressSpace &&
          instruction.address >= start &&
          instruction.address < end
        ) {
          continue;
        }
        callback(instruction);
      }
    }
  };

  for (const annotation of shards.annotations) {
    attachToRange(annotation.addressSpace, annotation.start, annotation.end, (instruction) => {
      instruction.architectures = addValue(instruction.architectures, annotation.architecture);
      if (annotationState(annotation)) {
        addStateObservation(
          instruction,
          "project",
          annotation.architecture,
          annotationState(annotation)!,
          annotation.id,
          annotation.evidence,
        );
      }
    });
  }

  const coverageById = new Map<string, RuntimeCoverageRecord>();
  for (const record of shards.runtime) {
    if (record.kind !== "runtime-coverage") continue;
    coverageById.set(record.id, record);
    attachToRange(record.addressSpace, record.start, record.end, (instruction) => {
      instruction.architectures = addValue(instruction.architectures, record.architecture);
      instruction.coverageRecordIds = addValue(instruction.coverageRecordIds, record.id);
      instruction.evidence = addAll(instruction.evidence, record.evidence);
    });
  }

  const summaries = new Set(
    shards.analysis
      .filter((record) => record.kind === "summary")
      .map(({ architecture }) => architecture),
  );
  if (summaries.size === 1) {
    const [architecture] = summaries;
    for (const instruction of mutable) {
      if (architecture && (instruction.architectures?.size ?? 0) === 0) {
        instruction.architectures = addValue(instruction.architectures, architecture);
      }
    }
  }

  const finalized = mutable.map((instruction): InstructionAnalysisAnnotation => {
    const coverage = new Map<
      RuntimeCoverageRecord["coverage"],
      InstructionRuntimeCoverageAnnotation
    >();
    for (const recordId of instruction.coverageRecordIds ?? []) {
      const record = coverageById.get(recordId)!;
      const previous = coverage.get(record.coverage);
      coverage.set(record.coverage, {
        coverage: record.coverage,
        count: (previous?.count ?? 0) + record.count,
        recordIds: sortedStrings([...(previous?.recordIds ?? []), record.id]),
        evidence: sortedStrings([...(previous?.evidence ?? []), ...record.evidence]),
      });
    }
    // Every optional construction collection is normalized back to the original public shape here;
    // consumers never observe missing arrays, maps, or nondeterministic insertion order.
    return {
      id: `instruction:${instruction.addressSpace}:${instruction.address}`,
      addressSpace: instruction.addressSpace,
      address: instruction.address,
      outputOffsets: sortedNumbers(instruction.outputOffsets),
      architectures: sortedStrings(instruction.architectures),
      nodeIds: sortedStrings(instruction.nodeIds),
      effectiveAddresses: [...(instruction.effectiveAddresses?.values() ?? [])]
        .map(({ value, nodeIds, evidence }) => ({
          ...value,
          nodeIds: sortedStrings(nodeIds),
          evidence: sortedStrings(evidence),
        }))
        .sort(
          (left, right) =>
            left.operandIndex - right.operandIndex ||
            (left.address ?? left.baseAddress ?? -1) - (right.address ?? right.baseAddress ?? -1) ||
            left.explanation.localeCompare(right.explanation),
        ),
      stateTransitions: [...(instruction.stateTransitions?.values() ?? [])]
        // Reuse canonical keys from aggregation. Serializing states inside the comparator repeats
        // that work O(n log n) times and creates substantial garbage on full runtime captures.
        .sort(
          (left, right) =>
            left.field.localeCompare(right.field) ||
            left.beforeKey.localeCompare(right.beforeKey) ||
            left.afterKey.localeCompare(right.afterKey),
        )
        .map(({ field, before, after, nodeIds, evidence }) => ({
          field,
          ...(before === undefined ? {} : { before }),
          ...(after === undefined ? {} : { after }),
          nodeIds: sortedStrings(nodeIds),
          evidence: sortedStrings(evidence),
        })),
      stateObservations: [...(instruction.stateObservations?.values() ?? [])]
        .sort(
          (left, right) =>
            left.source.localeCompare(right.source) ||
            left.architecture.localeCompare(right.architecture) ||
            left.stateKey.localeCompare(right.stateKey),
        )
        .map(({ source, architecture, state, count, recordIds, evidence }) => ({
          source,
          architecture,
          state,
          ...(count === undefined ? {} : { count }),
          recordIds: sortedStrings(recordIds),
          evidence: sortedStrings(evidence),
        })),
      executionCount: instruction.executionCount,
      ...(instruction.comments
        ? { comments: [...instruction.comments].sort((a, b) => a.id.localeCompare(b.id)) }
        : {}),
      executionRecordIds: sortedStrings(instruction.executionRecordIds),
      runtimeCoverage: [...coverage.values()].sort((left, right) =>
        left.coverage.localeCompare(right.coverage),
      ),
      memoryAccesses: [...(instruction.memoryAccesses?.values() ?? [])]
        .map(({ value, count, recordIds, evidence }) => ({
          ...value,
          count,
          recordIds: sortedStrings(recordIds),
          evidence: sortedStrings(evidence),
        }))
        .sort(
          (left, right) =>
            left.accessedAddressSpace.localeCompare(right.accessedAddressSpace) ||
            left.accessedAddress - right.accessedAddress ||
            left.access.localeCompare(right.access) ||
            left.width - right.width ||
            (left.value ?? -1) - (right.value ?? -1),
        ),
      evidence: sortedStrings(instruction.evidence),
    };
  });

  return {
    instructions: finalized.sort(
      (left, right) =>
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.address - right.address ||
        left.id.localeCompare(right.id),
    ),
    diagnostics: diagnostics.sort(
      (left, right) =>
        left.recordId.localeCompare(right.recordId) || left.message.localeCompare(right.message),
    ),
  };
};
