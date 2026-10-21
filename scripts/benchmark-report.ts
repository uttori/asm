import type { InternalInstrumentationSnapshot } from "../packages/core/src/internal-instrumentation.js";

export type BenchmarkSample = {
  wallMs: number;
  peakRssBytes: number;
  peakHeapUsedBytes: number;
  phasesMs: Record<string, number>;
  counters: InternalInstrumentationSnapshot["counters"];
  /** Optional so historical benchmark receipts remain readable. */
  expressionBoundaries?: InternalInstrumentationSnapshot["expressionBoundaries"];
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
 * `boundaryMax*` is the larger of the before/after samples. It is not an in-operation peak. Signed
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
  expressionBoundaries?: Record<
    keyof InternalInstrumentationSnapshot["expressionBoundaries"],
    Record<string, BenchmarkStatistics>
  >;
};

const COUNTER_NAMES: readonly (keyof BenchmarkSample["counters"])[] = [
  "passProgramCacheHits",
  "passProgramCacheMisses",
  "passProgramCachePeakSize",
  "normalizedCommandClones",
  "actualReparses",
  "includeReads",
  "includeBytesRead",
  "includeTextCacheHits",
  "includeResolutionCacheHits",
  "expressionParses",
  "operandLexicalParses",
  "operandSyntaxCacheHits",
  "operandSyntaxCacheMisses",
  "expressionParserCalls",
  "expressionInstrumentationParses",
  "expressionLegacyEvaluations",
  "expressionParseCacheHits",
  "expressionEvaluations",
  "expressionStringEvaluations",
  "expressionRawFallbackEvaluations",
  "expressionUniqueStringEvaluations",
  "expressionNodeEvaluations",
  "expressionUniqueNodeEvaluations",
  "pureExpressionEvaluations",
  "pureExpressionUniqueNodes",
  "pureStringExpressionEvaluations",
  "pureStringExpressionUniqueValues",
  "pureStringExpressionCacheHits",
  "pureStringExpressionCacheMisses",
  "macroExpansions",
  "macroLinesProcessed",
  "passthroughDispatches",
  "loweredProgramBuilds",
  "runtimeNodesLowered",
  "referenceCollections",
  "referencePlanBuilds",
  "instructionReferencePlanBuilds",
  "addressMappings",
  "assemblerConstructions",
  "sessionConstructions",
  "cacheWriteBytes",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isCounterName(value: string): value is keyof BenchmarkSample["counters"] {
  return COUNTER_NAMES.some((name) => name === value);
}

function isStatistics(value: unknown): value is BenchmarkStatistics {
  return (
    isRecord(value) &&
    typeof value.min === "number" &&
    typeof value.median === "number" &&
    typeof value.p95 === "number" &&
    typeof value.max === "number" &&
    typeof value.medianAbsoluteDeviation === "number"
  );
}

/** Present keys must be known counters. Missing keys stay absent, matching partial fixtures. */
function isCounterAggregate(
  value: Partial<BenchmarkAggregate["counters"]>,
): value is BenchmarkAggregate["counters"] {
  return Object.entries(value).every(
    ([name, statistics]) => isCounterName(name) && isStatistics(statistics),
  );
}

export function isBenchmarkSample(value: unknown): value is BenchmarkSample {
  if (
    !isRecord(value) ||
    typeof value.wallMs !== "number" ||
    typeof value.peakRssBytes !== "number" ||
    typeof value.peakHeapUsedBytes !== "number" ||
    !isRecord(value.phasesMs) ||
    !isRecord(value.counters)
  ) {
    return false;
  }
  if (value.expressionBoundaries !== undefined) {
    if (!isRecord(value.expressionBoundaries)) {
      return false;
    }
    const categories = ["parses", "fallbacks", "passthrough"];
    // Earlier receipts predate operand routing metrics and remain valid evidence.
    if (value.expressionBoundaries.operandFallbacks !== undefined) {
      categories.push("operandFallbacks");
    }
    for (const category of categories) {
      const bucket = value.expressionBoundaries[category];
      if (!isRecord(bucket) || !Object.values(bucket).every((count) => typeof count === "number")) {
        return false;
      }
    }
  }
  if (!Object.values(value.phasesMs).every((entry) => typeof entry === "number")) {
    return false;
  }
  return Object.entries(value.counters).every(
    ([name, entry]) => isCounterName(name) && typeof entry === "number",
  );
}

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
  const sorted = values.toSorted((left, right) => left - right);
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
  // Sample counts are input-sized. Binary folds preserve Math's NaN/signed-zero behavior
  // without converting every sample into a separate function argument.
  return {
    min: values.reduce((minimum, value) => Math.min(minimum, value), Infinity),
    median,
    p95: percentile(values, 0.95),
    max: values.reduce((maximum, value) => Math.max(maximum, value), -Infinity),
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
  const statistics = (field: keyof OperationBenchmarkSample): BenchmarkStatistics =>
    benchmarkStatistics(samples.map((sample) => sample[field]));
  return {
    wallMs: statistics("wallMs"),
    baselineRssBytes: statistics("baselineRssBytes"),
    baselineHeapUsedBytes: statistics("baselineHeapUsedBytes"),
    endRssBytes: statistics("endRssBytes"),
    endHeapUsedBytes: statistics("endHeapUsedBytes"),
    boundaryMaxRssBytes: statistics("boundaryMaxRssBytes"),
    boundaryMaxHeapUsedBytes: statistics("boundaryMaxHeapUsedBytes"),
    rssDeltaBytes: statistics("rssDeltaBytes"),
    heapUsedDeltaBytes: statistics("heapUsedDeltaBytes"),
  };
}

/**
 * Aggregates benchmark samples into stable median, p95, and peak values.
 * @param {BenchmarkSample[]} samples The measured samples.
 * @returns {BenchmarkAggregate} The aggregated report values.
 */
export function aggregateSamples(samples: BenchmarkSample[]): BenchmarkAggregate {
  const phaseNames = [
    ...new Set(samples.flatMap((sample) => Object.keys(sample.phasesMs))),
  ].toSorted();
  const counters: Partial<BenchmarkAggregate["counters"]> = {};
  for (const name of Object.keys(samples[0]?.counters ?? {})) {
    if (!isCounterName(name)) {
      throw new Error(`Unknown benchmark counter '${name}'.`);
    }
    counters[name] = benchmarkStatistics(samples.map((sample) => sample.counters[name]));
  }
  if (!isCounterAggregate(counters)) {
    throw new Error("Benchmark counters must be numeric distributions.");
  }
  return {
    wallMs: benchmarkStatistics(samples.map((sample) => sample.wallMs)),
    peakRssBytes: samples.reduce((maximum, sample) => Math.max(maximum, sample.peakRssBytes), 0),
    peakHeapUsedBytes: samples.reduce(
      (maximum, sample) => Math.max(maximum, sample.peakHeapUsedBytes),
      0,
    ),
    phasesMs: Object.fromEntries(
      phaseNames.map((name) => [
        name,
        benchmarkStatistics(samples.map((sample) => sample.phasesMs[name] ?? 0)),
      ]),
    ),
    counters,
    ...(samples.some((sample) => sample.expressionBoundaries) && {
      expressionBoundaries: aggregateExpressionBoundaries(samples),
    }),
  };
}

/** Missing buckets are zero within a measured run; older receipts can omit the entire section. */
function aggregateExpressionBoundaries(
  samples: BenchmarkSample[],
): NonNullable<BenchmarkAggregate["expressionBoundaries"]> {
  const aggregate = (
    category: keyof InternalInstrumentationSnapshot["expressionBoundaries"],
  ): Record<string, BenchmarkStatistics> => {
    const buckets: Record<string, number>[] = samples.map(
      (sample) => sample.expressionBoundaries?.[category] ?? {},
    );
    const keys = [...new Set(buckets.flatMap((bucket) => Object.keys(bucket)))].toSorted();
    return Object.fromEntries(
      keys.map((key) => [key, benchmarkStatistics(buckets.map((bucket) => bucket[key] ?? 0))]),
    );
  };
  return {
    parses: aggregate("parses"),
    fallbacks: aggregate("fallbacks"),
    passthrough: aggregate("passthrough"),
    operandFallbacks: aggregate("operandFallbacks"),
  };
}
