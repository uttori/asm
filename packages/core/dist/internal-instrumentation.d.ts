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
        /** Number of times the Assembler constructor completed (outer + session). */
        assemblerConstructions: number;
        /** Number of times createToolingSession() completed. */
        sessionConstructions: number;
        /** Total bytes written to cache JSON files. */
        cacheWriteBytes: number;
    };
    phasesMs: Record<string, number>;
    peakRssBytes: number;
    peakHeapUsedBytes: number;
};
type CounterName = keyof InternalInstrumentationSnapshot["counters"];
/**
 * Runs synchronous work with opt-in, run-scoped internal instrumentation.
 * This module is intentionally not exported from the package entry point.
 * @param {() => T} callback The instrumented work.
 * @returns {{ value: T; metrics: InternalInstrumentationSnapshot }} The callback result and metrics.
 */
export declare function runWithInternalInstrumentation<T>(callback: () => T): {
    value: T;
    metrics: InternalInstrumentationSnapshot;
};
/**
 * Increments an internal counter when instrumentation is active.
 * @param {CounterName} name The counter to increment.
 * @param {number} [amount] The increment amount.
 */
export declare function incrementInternalCounter(name: CounterName, amount?: number): void;
/**
 * Reports whether run-scoped internal instrumentation is active.
 * @returns {boolean} Whether instrumentation is collecting metrics.
 */
export declare function isInternalInstrumentationActive(): boolean;
/**
 * Records the largest observed value for an internal counter.
 * @param {CounterName} name The counter to update.
 * @param {number} value The candidate peak value.
 */
export declare function recordInternalCounterPeak(name: CounterName, value: number): void;
/**
 * Measures a synchronous wall-clock phase when instrumentation is active.
 * @param {string} name The stable phase name.
 * @param {() => T} callback The phase work.
 * @returns {T} The callback result.
 */
export declare function measureInternalPhase<T>(name: string, callback: () => T): T;
export {};
//# sourceMappingURL=internal-instrumentation.d.ts.map