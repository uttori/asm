/** Pure sorted indexes for projecting native instruction annotations into debug-map spans. */
import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

/** Debug-map fields required for an exact logical/output range join. */
export interface InstructionAnnotationRange {
  /** Architecture id for the indexed span. */
  readonly architecture: string;
  /** Address space containing the logical span. */
  readonly addressSpace: string;
  /** Inclusive logical range start. */
  readonly start: number;
  /** Exclusive logical range end. */
  readonly end: number;
  /** Inclusive mirrored ROM start when known. */
  readonly outputStart?: number;
  /** Exclusive mirrored ROM end when known. */
  readonly outputEnd?: number;
}

/** Immutable query surface built once per validated native project. */
export interface InstructionAnnotationIndex {
  /** Annotations grouped by address space id in stable insertion order. */
  readonly byAddressSpace: ReadonlyMap<string, readonly InstructionAnalysisAnnotation[]>;
  /** Annotations sorted by mirrored ROM offset for output joins. */
  readonly byOutputOffset: readonly {
    readonly offset: number;
    readonly annotation: InstructionAnalysisAnnotation;
  }[];
}

/**
 * Append an annotation to its per-key bucket without replacing earlier entries; mutates the
 * supplied map.
 * @param map Mutable buckets retaining insertion order.
 * @param key Bucket identity.
 * @param value Entry appended without replacing existing values.
 */
const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const entries = map.get(key);
  if (entries) {
    entries.push(value);
  } else {
    map.set(key, [value]);
  }
};

/**
 * Find the first index whose projected address is at least target, or the array length if none
 * exists.
 * The input must already be sorted in ascending projected-address order.
 * @param values Entries sorted by ascending projected address.
 * @param target Inclusive lower address threshold.
 * @param at Projection returning the address used by the sort.
 * @returns First qualifying index, or values.length when none qualifies.
 */
const lowerBound = <Value>(
  values: readonly Value[],
  target: number,
  at: (value: Value) => number,
): number => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (at(values[middle]) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * Select entries in the half-open address interval [start, end) from an array sorted by the
 * supplied address projection.
 * @param values Entries sorted by ascending projected address.
 * @param start Inclusive lower address bound.
 * @param end Exclusive upper address bound.
 * @param at Projection returning each entry’s address.
 * @returns Matching entries in their original sorted order.
 */
const valuesInRange = <Value>(
  values: readonly Value[],
  start: number,
  end: number,
  at: (value: Value) => number,
): readonly Value[] => {
  const matches: Value[] = [];
  for (
    let index = lowerBound(values, start, at);
    index < values.length && at(values[index]) < end;
    index++
  ) {
    matches.push(values[index]);
  }
  return matches;
};

/**
 * Builds deterministic logical-address and explicit-output indexes.
 * @param instructions Projected native instructions.
 * @returns Reusable immutable lookup indexes.
 */
export const createInstructionAnnotationIndex = (
  instructions: readonly InstructionAnalysisAnnotation[],
): InstructionAnnotationIndex => {
  const byAddressSpace = new Map<string, InstructionAnalysisAnnotation[]>();
  const byOutputOffset: Array<{
    readonly offset: number;
    readonly annotation: InstructionAnalysisAnnotation;
  }> = [];
  for (const annotation of instructions) {
    append(byAddressSpace, annotation.addressSpace, annotation);
    for (const offset of annotation.outputOffsets) {
      byOutputOffset.push({ offset, annotation });
    }
  }
  for (const annotations of byAddressSpace.values()) {
    annotations.sort(
      (left, right) => left.address - right.address || left.id.localeCompare(right.id),
    );
  }
  byOutputOffset.sort(
    (left, right) =>
      left.offset - right.offset || left.annotation.id.localeCompare(right.annotation.id),
  );
  return { byAddressSpace, byOutputOffset };
};

/**
 * Returns every architecture-compatible instruction explicitly contained by a debug-map span.
 * @param index Native instruction indexes.
 * @param range Validated debug-map span.
 * @returns Stable deduplicated annotations.
 */
export const instructionAnnotationsForDebugRange = (
  index: InstructionAnnotationIndex,
  range: InstructionAnnotationRange,
): readonly InstructionAnalysisAnnotation[] => {
  const matches = [
    ...valuesInRange(
      index.byAddressSpace.get(range.addressSpace) ?? [],
      range.start,
      range.end,
      ({ address }) => address,
    ),
    ...(range.outputStart === undefined || range.outputEnd === undefined
      ? []
      : valuesInRange(
          index.byOutputOffset,
          range.outputStart,
          range.outputEnd,
          ({ offset }) => offset,
        ).map(({ annotation }) => annotation)),
  ];
  const unique = new Map(
    matches
      .filter(
        (annotation) =>
          annotation.architectures.length === 0 ||
          annotation.architectures.includes(range.architecture),
      )
      .map((annotation) => [annotation.id, annotation]),
  );
  return [...unique.values()].toSorted(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.address - right.address ||
      left.id.localeCompare(right.id),
  );
};
