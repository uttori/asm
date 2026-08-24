import { performance } from "node:perf_hooks";

export type InternalInstrumentationSnapshot = {
  counters: {
    passProgramCacheHits: number;
    passProgramCacheMisses: number;
    passProgramCachePeakSize: number;
    normalizedCommandClones: number;
    actualReparses: number;
    includeReads: number;
    includeBytesRead: number;
    includeTextCacheHits: number;
    includeResolutionCacheHits: number;
    expressionEvaluations: number;
    expressionStringEvaluations: number;
    expressionUniqueStringEvaluations: number;
    expressionNodeEvaluations: number;
    expressionUniqueNodeEvaluations: number;
    pureExpressionEvaluations: number;
    pureExpressionUniqueNodes: number;
    pureStringExpressionEvaluations: number;
    pureStringExpressionUniqueValues: number;
    pureStringExpressionCacheHits: number;
    pureStringExpressionCacheMisses: number;
    macroExpansions: number;
    macroLinesProcessed: number;
    passthroughDispatches: number;
    loweredProgramBuilds: number;
    runtimeNodesLowered: number;
    referenceCollections: number;
    addressMappings: number;
  };
  phasesMs: Record<string, number>;
  peakRssBytes: number;
  peakHeapUsedBytes: number;
};

type CounterName = keyof InternalInstrumentationSnapshot["counters"];

type ActiveInstrumentation = InternalInstrumentationSnapshot;

let activeInstrumentation: ActiveInstrumentation | undefined;

function sampleMemory(metrics: ActiveInstrumentation): void {
  const memory = process.memoryUsage();
  metrics.peakRssBytes = Math.max(metrics.peakRssBytes, memory.rss);
  metrics.peakHeapUsedBytes = Math.max(metrics.peakHeapUsedBytes, memory.heapUsed);
}

/**
 * Runs synchronous work with opt-in, run-scoped internal instrumentation.
 * This module is intentionally not exported from the package entry point.
 * @param {() => T} callback The instrumented work.
 * @returns {{ value: T; metrics: InternalInstrumentationSnapshot }} The callback result and metrics.
 */
export function runWithInternalInstrumentation<T>(callback: () => T): {
  value: T;
  metrics: InternalInstrumentationSnapshot;
} {
  if (activeInstrumentation) {
    throw new Error("Internal instrumentation runs cannot be nested.");
  }
  const metrics: ActiveInstrumentation = {
    counters: {
      passProgramCacheHits: 0,
      passProgramCacheMisses: 0,
      passProgramCachePeakSize: 0,
      normalizedCommandClones: 0,
      actualReparses: 0,
      includeReads: 0,
      includeBytesRead: 0,
      includeTextCacheHits: 0,
      includeResolutionCacheHits: 0,
      expressionEvaluations: 0,
      expressionStringEvaluations: 0,
      expressionUniqueStringEvaluations: 0,
      expressionNodeEvaluations: 0,
      expressionUniqueNodeEvaluations: 0,
      pureExpressionEvaluations: 0,
      pureExpressionUniqueNodes: 0,
      pureStringExpressionEvaluations: 0,
      pureStringExpressionUniqueValues: 0,
      pureStringExpressionCacheHits: 0,
      pureStringExpressionCacheMisses: 0,
      macroExpansions: 0,
      macroLinesProcessed: 0,
      passthroughDispatches: 0,
      loweredProgramBuilds: 0,
      runtimeNodesLowered: 0,
      referenceCollections: 0,
      addressMappings: 0,
    },
    phasesMs: {},
    peakRssBytes: 0,
    peakHeapUsedBytes: 0,
  };
  activeInstrumentation = metrics;
  sampleMemory(metrics);
  try {
    const value = callback();
    sampleMemory(metrics);
    return { value, metrics };
  } finally {
    activeInstrumentation = undefined;
  }
}

/**
 * Increments an internal counter when instrumentation is active.
 * @param {CounterName} name The counter to increment.
 * @param {number} [amount] The increment amount.
 */
export function incrementInternalCounter(name: CounterName, amount = 1): void {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] += amount;
  }
}

/**
 * Reports whether run-scoped internal instrumentation is active.
 * @returns {boolean} Whether instrumentation is collecting metrics.
 */
export function isInternalInstrumentationActive(): boolean {
  return activeInstrumentation !== undefined;
}

/**
 * Records the largest observed value for an internal counter.
 * @param {CounterName} name The counter to update.
 * @param {number} value The candidate peak value.
 */
export function recordInternalCounterPeak(name: CounterName, value: number): void {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] = Math.max(metrics.counters[name], value);
  }
}

/**
 * Measures a synchronous wall-clock phase when instrumentation is active.
 * @param {string} name The stable phase name.
 * @param {() => T} callback The phase work.
 * @returns {T} The callback result.
 */
export function measureInternalPhase<T>(name: string, callback: () => T): T {
  const metrics = activeInstrumentation;
  if (!metrics) {
    return callback();
  }
  const start = performance.now();
  try {
    return callback();
  } finally {
    metrics.phasesMs[name] = (metrics.phasesMs[name] ?? 0) + performance.now() - start;
    sampleMemory(metrics);
  }
}
