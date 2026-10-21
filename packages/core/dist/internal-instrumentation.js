import { expressionOutcomeKey, } from "./ir/expression-parse-state.js";
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
            expressionParses: 0,
            operandLexicalParses: 0,
            operandSyntaxCacheHits: 0,
            operandSyntaxCacheMisses: 0,
            expressionParserCalls: 0,
            expressionInstrumentationParses: 0,
            expressionLegacyEvaluations: 0,
            expressionParseCacheHits: 0,
            expressionEvaluations: 0,
            expressionStringEvaluations: 0,
            expressionRawFallbackEvaluations: 0,
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
            referencePlanBuilds: 0,
            instructionReferencePlanBuilds: 0,
            addressMappings: 0,
            assemblerConstructions: 0,
            sessionConstructions: 0,
            cacheWriteBytes: 0,
        },
        syntaxBoundaries: {},
        expressionBoundaries: { parses: {}, fallbacks: {}, passthrough: {}, operandFallbacks: {} },
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
/** Count completed parse attempts, including fallback results, at the actual parser boundary. */
export function recordExpressionParse(site, outcome) {
    if (syntaxOwner === "execution") {
        recordSyntaxBoundary("execution-expression-parse");
    }
    const metrics = activeInstrumentation;
    if (!metrics) {
        return;
    }
    metrics.counters.expressionParserCalls++;
    if (site === "instrumentation") {
        metrics.counters.expressionInstrumentationParses++;
    }
    const key = `${site}:${expressionOutcomeKey(outcome)}`;
    metrics.expressionBoundaries.parses[key] = (metrics.expressionBoundaries.parses[key] ?? 0) + 1;
}
/** Count fallback attempts before evaluation so failures remain visible. */
export function recordExpressionFallback(site, outcome) {
    const metrics = activeInstrumentation;
    if (!metrics) {
        return;
    }
    metrics.counters.expressionRawFallbackEvaluations++;
    const key = `${site}:${expressionOutcomeKey(outcome)}`;
    metrics.expressionBoundaries.fallbacks[key] =
        (metrics.expressionBoundaries.fallbacks[key] ?? 0) + 1;
}
/** Historical boundary probe retained for regression guards and benchmark receipt compatibility. */
export function recordPassthroughDispatch(reason) {
    recordSyntaxBoundary("command-passthrough");
    recordSyntaxBoundary(`passthrough:${reason}`);
    const metrics = activeInstrumentation;
    if (!metrics) {
        return;
    }
    metrics.counters.passthroughDispatches++;
    metrics.expressionBoundaries.passthrough[reason] =
        (metrics.expressionBoundaries.passthrough[reason] ?? 0) + 1;
}
/** Record an unmigrated operand family without retaining source text. */
export function recordOperandSyntaxFallback(reason) {
    const metrics = activeInstrumentation;
    if (metrics) {
        metrics.expressionBoundaries.operandFallbacks[reason] =
            (metrics.expressionBoundaries.operandFallbacks[reason] ?? 0) + 1;
    }
}
let migrationGuard;
/** Records real boundary work without parsing an extra probe or retaining source text. */
export function recordSyntaxBoundary(boundary) {
    if (migrationGuard?.forbidden.has(boundary)) {
        migrationGuard.violations.add(boundary);
    }
    const metrics = activeInstrumentation;
    if (metrics) {
        metrics.syntaxBoundaries[boundary] = (metrics.syntaxBoundaries[boundary] ?? 0) + 1;
    }
}
/**
 * Test-only synchronous assertion for a migrated grammar slice. Check on exit so deferred
 * diagnostics and internal recovery cannot swallow a violation. Nested guards inherit bans.
 * The guard has no production effect unless explicitly enabled by a test.
 */
export function withAstMigrationGuard(forbidden, run) {
    const parent = migrationGuard;
    const guard = {
        forbidden: new Set([...(parent?.forbidden ?? []), ...forbidden]),
        violations: new Set(),
    };
    migrationGuard = guard;
    let outcome;
    try {
        outcome = { ok: true, value: run() };
    }
    catch (error) {
        outcome = { ok: false, error };
    }
    finally {
        migrationGuard = parent;
        for (const violation of guard.violations) {
            if (parent?.forbidden.has(violation)) {
                parent.violations.add(violation);
            }
        }
    }
    if (guard.violations.size > 0) {
        throw new Error(`AST migration guard reached legacy boundaries: ${[...guard.violations].toSorted().join(", ")}`, { cause: outcome.ok ? undefined : outcome.error });
    }
    if (!outcome.ok) {
        throw outcome.error;
    }
    return outcome.value;
}
/** A parser may run for physical/generated source, never to rediscover an executing node's grammar. */
let syntaxOwner = "source";
/** Execution scopes override an enclosing source scope, including includes and generated macro bodies. */
export function withTypedExecution(run) {
    if (!migrationGuard) {
        return run();
    }
    const parent = syntaxOwner;
    syntaxOwner = "execution";
    try {
        return run();
    }
    finally {
        syntaxOwner = parent;
    }
}
/** Explicit source-valued bindings may create grammar; nested typed executors regain their own scope. */
export function withSourceSyntax(run) {
    if (!migrationGuard) {
        return run();
    }
    const parent = syntaxOwner;
    syntaxOwner = "source";
    try {
        return run();
    }
    finally {
        syntaxOwner = parent;
    }
}
/** Count actual target/directive parser entries, including speculative failures. */
export function recordExecutionParser(kind) {
    if (syntaxOwner === "execution") {
        recordSyntaxBoundary(`execution-${kind}-parse`);
    }
}
/** Complete cutover guard, shared by fixture tests and opt-in CLI/worker qualification. */
export const AST_COMPLETION_FORBIDDEN = [
    "legacy-scanner",
    "legacy-evaluation",
    "legacy-command",
    "legacy-generated-dispatch",
    "command-passthrough",
    "reference-to-text",
    "define-to-text",
    "function-to-text",
    "execution-expression-parse",
    "execution-operand-parse",
    "execution-directive-parse",
];
/** Environment opt-in is browser safe; ordinary builds do not collect instrumentation. */
export function withAstQualification(run) {
    if (typeof process === "undefined" || process.env.UTTORI_AST_QUALIFY !== "1") {
        return run();
    }
    return withAstMigrationGuard(AST_COMPLETION_FORBIDDEN, run);
}
//# sourceMappingURL=internal-instrumentation.js.map