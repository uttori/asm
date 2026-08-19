import type { InternalInstrumentationSnapshot } from "../src/internal-instrumentation.js";

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
 * Aggregates benchmark samples into stable median, p95, and peak values.
 * @param {BenchmarkSample[]} samples The measured samples.
 * @returns {BenchmarkAggregate} The aggregated report values.
 */
export function aggregateSamples(samples: BenchmarkSample[]): BenchmarkAggregate {
  const stats = (values: number[]): BenchmarkStatistics => {
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
  };
  const phaseNames = [...new Set(samples.flatMap((sample) => Object.keys(sample.phasesMs)))].sort();
  const counterNames = Object.keys(samples[0]?.counters ?? {}) as Array<
    keyof BenchmarkSample["counters"]
  >;
  return {
    wallMs: stats(samples.map((sample) => sample.wallMs)),
    peakRssBytes: Math.max(0, ...samples.map((sample) => sample.peakRssBytes)),
    peakHeapUsedBytes: Math.max(0, ...samples.map((sample) => sample.peakHeapUsedBytes)),
    phasesMs: Object.fromEntries(
      phaseNames.map((name) => [name, stats(samples.map((sample) => sample.phasesMs[name] ?? 0))]),
    ),
    counters: Object.fromEntries(
      counterNames.map((name) => [name, stats(samples.map((sample) => sample.counters[name]))]),
    ) as BenchmarkAggregate["counters"],
  };
}
