/** Pure sorted indexes for projecting native instruction annotations into debug-map spans. */
import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

/** Debug-map fields required for an exact logical/output range join. */
export interface InstructionAnnotationRange {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly start: number;
  readonly end: number;
  readonly outputStart?: number;
  readonly outputEnd?: number;
}

/** Immutable query surface built once per validated native project. */
export interface InstructionAnnotationIndex {
  readonly byAddressSpace: ReadonlyMap<string, readonly InstructionAnalysisAnnotation[]>;
  readonly byOutputOffset: readonly {
    readonly offset: number;
    readonly annotation: InstructionAnalysisAnnotation;
  }[];
}

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

const lowerBound = <Value>(
  values: readonly Value[],
  target: number,
  at: (value: Value) => number,
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
 * @param {readonly InstructionAnalysisAnnotation[]} instructions Projected native instructions.
 * @returns {InstructionAnnotationIndex} Reusable immutable lookup indexes.
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
    for (const offset of annotation.outputOffsets) byOutputOffset.push({ offset, annotation });
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
 * @param {InstructionAnnotationIndex} index Native instruction indexes.
 * @param {InstructionAnnotationRange} range Validated debug-map span.
 * @returns {readonly InstructionAnalysisAnnotation[]} Stable deduplicated annotations.
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
  return [...unique.values()].sort(
    (left, right) =>
      left.addressSpace.localeCompare(right.addressSpace) ||
      left.address - right.address ||
      left.id.localeCompare(right.id),
  );
};
