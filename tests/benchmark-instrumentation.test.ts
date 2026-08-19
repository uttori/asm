import { test } from "./ava-helper.js";
import {
  incrementInternalCounter,
  measureInternalPhase,
  recordInternalCounterPeak,
  runWithInternalInstrumentation,
} from "../src/internal-instrumentation.js";
import { aggregateSamples, percentile, type BenchmarkSample } from "../scripts/benchmark-report.js";

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
});

test("benchmark aggregation reports nearest-rank percentiles and memory peaks", (t) => {
  const sample = (wallMs: number, rss: number, heap: number, clones: number): BenchmarkSample => ({
    wallMs,
    peakRssBytes: rss,
    peakHeapUsedBytes: heap,
    phasesMs: { emitProgram: wallMs / 2 },
    counters: {
      passProgramCacheHits: 1,
      passProgramCacheMisses: 2,
      passProgramCachePeakSize: 3,
      normalizedCommandClones: clones,
      actualReparses: 2,
      includeReads: 4,
      includeBytesRead: 40,
      macroExpansions: 5,
      macroLinesProcessed: 50,
      passthroughDispatches: 6,
      loweredProgramBuilds: 7,
      runtimeNodesLowered: 8,
      referenceCollections: 9,
      addressMappings: 10,
    },
  });
  const samples = [
    sample(40, 100, 50, 4),
    sample(10, 400, 20, 1),
    sample(30, 200, 80, 3),
    sample(20, 300, 60, 2),
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
