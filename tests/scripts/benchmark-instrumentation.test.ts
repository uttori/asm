import {
  incrementInternalCounter,
  measureInternalPhase,
  recordInternalCounterPeak,
  runWithInternalInstrumentation,
} from "../../packages/core/src/internal-instrumentation.js";
import {
  aggregateOperationSamples,
  aggregateSamples,
  isBenchmarkSample,
  benchmarkStatistics,
  percentile,
  type BenchmarkSample,
  type OperationBenchmarkSample,
} from "../../scripts/benchmark-report.js";
import { test } from "../ava-helper.js";

const benchmarkSample = (
  wallMs: number,
  rss: number,
  heap: number,
  clones: number,
): BenchmarkSample => ({
  wallMs,
  peakRssBytes: rss,
  peakHeapUsedBytes: heap,
  phasesMs: { emitProgram: wallMs / 2 },
  counters: {
    expressionParses: 0,
    expressionParserCalls: 0,
    expressionInstrumentationParses: 0,
    expressionLegacyEvaluations: 0,
    expressionParseCacheHits: 0,
    expressionRawFallbackEvaluations: 0,
    assemblerConstructions: 0,
    sessionConstructions: 0,
    cacheWriteBytes: 0,
    passProgramCacheHits: 1,
    passProgramCacheMisses: 2,
    passProgramCachePeakSize: 3,
    normalizedCommandClones: clones,
    actualReparses: 2,
    includeReads: 4,
    includeBytesRead: 40,
    includeTextCacheHits: 2,
    includeResolutionCacheHits: 3,
    expressionEvaluations: 11,
    expressionStringEvaluations: 4,
    expressionUniqueStringEvaluations: 3,
    expressionNodeEvaluations: 7,
    expressionUniqueNodeEvaluations: 5,
    pureExpressionEvaluations: 3,
    pureExpressionUniqueNodes: 2,
    pureStringExpressionEvaluations: 3,
    pureStringExpressionUniqueValues: 2,
    pureStringExpressionCacheHits: 1,
    pureStringExpressionCacheMisses: 2,
    macroExpansions: 5,
    macroLinesProcessed: 50,
    passthroughDispatches: 6,
    loweredProgramBuilds: 7,
    runtimeNodesLowered: 8,
    referenceCollections: 9,
    addressMappings: 10,
  },
});

const operationSample = (
  wallMs: number,
  baselineRssBytes: number,
  endRssBytes: number,
): OperationBenchmarkSample => ({
  wallMs,
  baselineRssBytes,
  baselineHeapUsedBytes: baselineRssBytes / 2,
  endRssBytes,
  endHeapUsedBytes: endRssBytes / 2,
  boundaryMaxRssBytes: Math.max(baselineRssBytes, endRssBytes),
  boundaryMaxHeapUsedBytes: Math.max(baselineRssBytes, endRssBytes) / 2,
  rssDeltaBytes: endRssBytes - baselineRssBytes,
  heapUsedDeltaBytes: (endRssBytes - baselineRssBytes) / 2,
});

test("internal instrumentation is opt-in and run-scoped", (t) => {
  incrementInternalCounter("includeReads");
  const run = runWithInternalInstrumentation(() => {
    incrementInternalCounter("includeReads", 2);
    recordInternalCounterPeak("passProgramCachePeakSize", 3);
    recordInternalCounterPeak("passProgramCachePeakSize", 2);
    return measureInternalPhase("testPhase", () => 42);
  });
  incrementInternalCounter("includeReads");

  t.is(run.value, 42);
  t.is(run.metrics.counters.includeReads, 2);
  t.is(run.metrics.counters.passProgramCachePeakSize, 3);
  t.true(run.metrics.phasesMs.testPhase >= 0);
  t.true(run.metrics.peakRssBytes > 0);
  t.true(run.metrics.peakHeapUsedBytes > 0);
  // The child-process decoder must accept every counter the current runtime emits.
  t.true(isBenchmarkSample({ ...run.metrics, wallMs: 1 }));
});

test("benchmark aggregation reports nearest-rank percentiles and memory peaks", (t) => {
  const samples = [
    benchmarkSample(40, 100, 50, 4),
    benchmarkSample(10, 400, 20, 1),
    benchmarkSample(30, 200, 80, 3),
    benchmarkSample(20, 300, 60, 2),
  ];
  const aggregate = aggregateSamples(samples);

  t.is(percentile([], 0.95), 0);
  t.is(aggregate.wallMs.median, 20);
  t.is(aggregate.wallMs.p95, 40);
  t.is(aggregate.peakRssBytes, 400);
  t.is(aggregate.peakHeapUsedBytes, 80);
  t.deepEqual(aggregate.wallMs, {
    min: 10,
    median: 20,
    p95: 40,
    max: 40,
    medianAbsoluteDeviation: 10,
  });
  t.deepEqual(aggregate.phasesMs.emitProgram, {
    min: 5,
    median: 10,
    p95: 20,
    max: 20,
    medianAbsoluteDeviation: 5,
  });
  t.deepEqual(aggregate.counters.normalizedCommandClones, {
    min: 1,
    median: 2,
    p95: 4,
    max: 4,
    medianAbsoluteDeviation: 1,
  });
});

test("operation aggregation keeps boundary memory and signed deltas explicit", (t) => {
  const aggregate = aggregateOperationSamples([
    operationSample(30, 100, 140),
    operationSample(10, 120, 110),
    operationSample(20, 110, 130),
  ]);

  t.deepEqual(benchmarkStatistics([]), {
    min: 0,
    median: 0,
    p95: 0,
    max: 0,
    medianAbsoluteDeviation: 0,
  });
  t.is(aggregate.wallMs.median, 20);
  t.is(aggregate.boundaryMaxRssBytes.max, 140);
  t.is(aggregate.rssDeltaBytes.min, -10);
  t.is(aggregate.rssDeltaBytes.median, 20);
});

test("benchmark reports preserve bounded outcome distributions and historical samples", (t) => {
  const first = benchmarkSample(1, 10, 5, 0);
  first.expressionBoundaries = {
    parses: { "math-cache:native": 3 },
    fallbacks: {},
    passthrough: { labelDefinition: 2 },
  };
  const second = benchmarkSample(2, 10, 5, 0);
  second.expressionBoundaries = {
    parses: { "math-cache:native": 5 },
    fallbacks: { "numeric:invalid:operand": 1 },
    passthrough: {},
  };
  const aggregate = aggregateSamples([first, second]);
  t.is(aggregate.expressionBoundaries?.parses["math-cache:native"].max, 5);
  t.is(aggregate.expressionBoundaries?.fallbacks["numeric:invalid:operand"].min, 0);
  t.is(aggregate.expressionBoundaries?.passthrough.labelDefinition.max, 2);
  t.true(isBenchmarkSample(first));
  t.false(isBenchmarkSample({ ...first, expressionBoundaries: { parses: { bad: "source" } } }));
  const historical = benchmarkSample(1, 10, 5, 0);
  t.true(isBenchmarkSample(historical));
  t.is(aggregateSamples([historical]).expressionBoundaries, undefined);
});
