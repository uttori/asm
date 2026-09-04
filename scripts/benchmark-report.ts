import type { InternalInstrumentationSnapshot } from "../packages/core/src/internal-instrumentation.js";

export type BenchmarkSample = {
  wallMs: number;
  peakRssBytes: number;
  peakHeapUsedBytes: number;
  phasesMs: Record<string, number>;
  counters: InternalInstrumentationSnapshot["counters"];
};

export type BenchmarkStatistics = {
  min: number;
  median: number;
  p95: number;
  max: number;
  medianAbsoluteDeviation: number;
};

/**
 * Timing and memory observed at the boundaries of one isolated synchronous operation.
 *
 * `boundaryMax*` is the larger of the before/after samples; it is not an in-operation peak. Signed
 * deltas remain available so a benchmark can distinguish retained growth from a high prerequisite
 * baseline. Keep both absolute boundaries and deltas: using only deltas would hide regressions when
 * an operation legitimately starts with a large retained project.
 */
export type OperationBenchmarkSample = {
  wallMs: number;
  baselineRssBytes: number;
  baselineHeapUsedBytes: number;
  endRssBytes: number;
  endHeapUsedBytes: number;
  boundaryMaxRssBytes: number;
  boundaryMaxHeapUsedBytes: number;
  rssDeltaBytes: number;
  heapUsedDeltaBytes: number;
};

/**
 * Independent stable distributions for every timing and boundary-memory field.
 * Budgets currently consume median wall time and maximum boundary RSS, while the remaining fields
 * preserve enough evidence to diagnose whether a failure is setup pressure or retained output.
 */
export type OperationBenchmarkAggregate = {
  [Field in keyof OperationBenchmarkSample]: BenchmarkStatistics;
};

export type BenchmarkAggregate = {
  wallMs: BenchmarkStatistics;
  peakRssBytes: number;
  peakHeapUsedBytes: number;
  phasesMs: Record<string, BenchmarkStatistics>;
  counters: Record<keyof BenchmarkSample["counters"], BenchmarkStatistics>;
};

/**
 * Computes a nearest-rank percentile from numeric samples.
 * @param {number[]} values The sample values.
 * @param {number} percentileValue The percentile in the inclusive range zero to one.
 * @returns {number} The selected percentile value.
 */
export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? 0;
}

/**
 * Builds stable distribution statistics for an arbitrary numeric sample.
 * @param {number[]} values Sample values.
 * @returns {BenchmarkStatistics} Minimum, median, nearest-rank p95, maximum, and MAD.
 */
export function benchmarkStatistics(values: number[]): BenchmarkStatistics {
  if (values.length === 0) {
    return { min: 0, median: 0, p95: 0, max: 0, medianAbsoluteDeviation: 0 };
  }
  const median = percentile(values, 0.5);
  return {
    min: Math.min(...values),
    median,
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    medianAbsoluteDeviation: percentile(
      values.map((value) => Math.abs(value - median)),
      0.5,
    ),
  };
}

/**
 * Aggregates isolated operation timings and boundary-sampled memory.
 * @param {OperationBenchmarkSample[]} samples Measured samples.
 * @returns {OperationBenchmarkAggregate} Distribution for every sample field.
 */
export function aggregateOperationSamples(
  samples: OperationBenchmarkSample[],
): OperationBenchmarkAggregate {
  // Keep the field list explicit so a newly added measurement cannot silently enter or disappear
  // from retained reports through Object.keys ordering or an accidental non-numeric property.
  const fields: readonly (keyof OperationBenchmarkSample)[] = [
    "wallMs",
    "baselineRssBytes",
    "baselineHeapUsedBytes",
    "endRssBytes",
    "endHeapUsedBytes",
    "boundaryMaxRssBytes",
    "boundaryMaxHeapUsedBytes",
    "rssDeltaBytes",
    "heapUsedDeltaBytes",
  ];
  return Object.fromEntries(
    fields.map((field) => [field, benchmarkStatistics(samples.map((sample) => sample[field]))]),
  ) as OperationBenchmarkAggregate;
}

/**
 * Aggregates benchmark samples into stable median, p95, and peak values.
 * @param {BenchmarkSample[]} samples The measured samples.
 * @returns {BenchmarkAggregate} The aggregated report values.
 */
export function aggregateSamples(samples: BenchmarkSample[]): BenchmarkAggregate {
  const phaseNames = [...new Set(samples.flatMap((sample) => Object.keys(sample.phasesMs)))].sort();
  const counterNames = Object.keys(samples[0]?.counters ?? {}) as Array<
    keyof BenchmarkSample["counters"]
  >;
  return {
    wallMs: benchmarkStatistics(samples.map((sample) => sample.wallMs)),
    peakRssBytes: Math.max(0, ...samples.map((sample) => sample.peakRssBytes)),
    peakHeapUsedBytes: Math.max(0, ...samples.map((sample) => sample.peakHeapUsedBytes)),
    phasesMs: Object.fromEntries(
      phaseNames.map((name) => [
        name,
        benchmarkStatistics(samples.map((sample) => sample.phasesMs[name] ?? 0)),
      ]),
    ),
    counters: Object.fromEntries(
      counterNames.map((name) => [
        name,
        benchmarkStatistics(samples.map((sample) => sample.counters[name])),
      ]),
    ) as BenchmarkAggregate["counters"],
  };
}
