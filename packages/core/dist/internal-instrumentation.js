let activeInstrumentation;
function sampleMemory(metrics) {
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
export function runWithInternalInstrumentation(callback) {
    if (activeInstrumentation) {
        throw new Error("Internal instrumentation runs cannot be nested.");
    }
    const metrics = {
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
            assemblerConstructions: 0,
            sessionConstructions: 0,
            cacheWriteBytes: 0,
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
    }
    finally {
        activeInstrumentation = undefined;
    }
}
/**
 * Increments an internal counter when instrumentation is active.
 * @param {CounterName} name The counter to increment.
 * @param {number} [amount] The increment amount.
 */
export function incrementInternalCounter(name, amount = 1) {
    const metrics = activeInstrumentation;
    if (metrics) {
        metrics.counters[name] += amount;
    }
}
/**
 * Reports whether run-scoped internal instrumentation is active.
 * @returns {boolean} Whether instrumentation is collecting metrics.
 */
export function isInternalInstrumentationActive() {
    return activeInstrumentation !== undefined;
}
/**
 * Records the largest observed value for an internal counter.
 * @param {CounterName} name The counter to update.
 * @param {number} value The candidate peak value.
 */
export function recordInternalCounterPeak(name, value) {
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
export function measureInternalPhase(name, callback) {
    const metrics = activeInstrumentation;
    if (!metrics) {
        return callback();
    }
    const start = performance.now();
    try {
        return callback();
    }
    finally {
        metrics.phasesMs[name] = (metrics.phasesMs[name] ?? 0) + performance.now() - start;
        sampleMemory(metrics);
    }
}
//# sourceMappingURL=internal-instrumentation.js.map