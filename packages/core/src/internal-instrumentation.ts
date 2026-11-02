import {
  expressionOutcomeKey,
  type ExpressionParseOutcome,
  type ExpressionParseSite,
  type ExpressionFallbackSite,
  type ExpressionOutcomeKey,
} from "./ir/expression-parse-state.js";
/** Operand parser compatibility buckets counted separately from expression fallbacks. */
type OperandSyntaxFallback =
  | "empty-or-register"
  | "relative-label"
  | "macro-template"
  | "indirect-or-compound"
  | "expression-grammar"
  | "function-evaluation-order"
  | "unresolved-define"
  | "noncanonical-expanded-number"
  | "grouped-atom-resolution";
/** Historical counter keys remain readable in pre-migration benchmark receipts. */
export type PassthroughReason =
  | "characterMapping"
  | "commentOrEmpty"
  | "dataDirective"
  | "defineCommand"
  | "functionDefinition"
  | "labelDefinition"
  | "macroDefinitionOrInvoke"
  | "bareMacroCandidate"
  | "macroPlaceholder"
  | "registeredPreprocessDirective"
  | "staticAssignment"
  | "structCommand"
  | "unknown";

/** Run-scoped, bounded buckets. Keys never include source text or diagnostic messages. */
export type ExpressionBoundaryMetrics = {
  /** Successful parse attempts keyed by site and outcome. */
  parses: Partial<Record<`${ExpressionParseSite}:${ExpressionOutcomeKey}`, number>>;
  /** Compatibility fallback parses keyed by site and outcome. */
  fallbacks: Partial<Record<`${ExpressionFallbackSite}:${ExpressionOutcomeKey}`, number>>;
  /** Operand grammar compatibility fallbacks counted by reason. */
  operandFallbacks: Partial<Record<OperandSyntaxFallback, number>>;
  /** Command dispatch passthrough reasons bypassing full parsing. */
  passthrough: Partial<Record<PassthroughReason, number>>;
};

/** Run-scoped internal metrics snapshot returned after instrumented work. */
export type InternalInstrumentationSnapshot = {
  /** Actual source parsing and semantic conversions; independent of expression probes. */
  syntaxBoundaries: Partial<Record<SyntaxBoundary, number>>;
  /** Scalar counters for caches, parses, and construction events. */
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
    /** MathCore string-cache misses; retained for historical benchmark comparisons. */
    expressionParses: number;
    /** Parsed operand cache stores syntax only and is cleared at assembly boundaries. */
    operandLexicalParses: number;
    operandSyntaxCacheHits: number;
    operandSyntaxCacheMisses: number;
    /** All parser entry calls, including recursive slices, compatibility probes and instrumentation. */
    expressionParserCalls: number;
    /** Subset of parser calls performed only to classify instrumentation inputs. */
    expressionInstrumentationParses: number;
    /** Entries into the legacy evaluator, including failures and direct callers. */
    expressionLegacyEvaluations: number;
    expressionParseCacheHits: number;
    expressionEvaluations: number;
    expressionStringEvaluations: number;
    expressionRawFallbackEvaluations: number;
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
    /** Syntax-only expression walks compiled, excluding scalar literals. */
    referencePlanBuilds: number;
    /** Instruction occurrence projections compiled for the active grammar and source. */
    instructionReferencePlanBuilds: number;
    addressMappings: number;
    /** Number of times the Assembler constructor completed (outer + session). */
    assemblerConstructions: number;
    /** Number of times createToolingSession() completed. */
    sessionConstructions: number;
    /** Total bytes written to cache JSON files. */
    cacheWriteBytes: number;
  };
  /** Aggregated expression parse and fallback boundary counts. */
  expressionBoundaries: ExpressionBoundaryMetrics;
  /** Wall-clock milliseconds spent in named internal phases. */
  phasesMs: Record<string, number>;
  /** Peak resident set size observed during the instrumented run. */
  peakRssBytes: number;
  /** Peak V8 heap used observed during the instrumented run. */
  peakHeapUsedBytes: number;
};

/** Valid counter keys within the instrumentation snapshot. */
type CounterName = keyof InternalInstrumentationSnapshot["counters"];

/** Mutable instrumentation state accumulated for one run. */
type ActiveInstrumentation = InternalInstrumentationSnapshot;

let activeInstrumentation: ActiveInstrumentation | undefined;

/** Updates peak memory fields from the current process memory usage. */
function sampleMemory(metrics: ActiveInstrumentation): void {
  const memory = process.memoryUsage();
  metrics.peakRssBytes = Math.max(metrics.peakRssBytes, memory.rss);
  metrics.peakHeapUsedBytes = Math.max(metrics.peakHeapUsedBytes, memory.heapUsed);
}

/**
 * Runs synchronous work with opt-in, run-scoped internal instrumentation.
 * This module is intentionally not exported from the package entry point.
 * @param callback The instrumented work.
 * @returns The callback result and metrics.
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
  } finally {
    activeInstrumentation = undefined;
  }
}

/**
 * Increments an internal counter when instrumentation is active.
 * @param name The counter to increment.
 * @param [amount] The increment amount.
 */
export function incrementInternalCounter(name: CounterName, amount = 1): void {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] += amount;
  }
}

/**
 * Reports whether run-scoped internal instrumentation is active.
 * @returns Whether instrumentation is collecting metrics.
 */
export function isInternalInstrumentationActive(): boolean {
  return activeInstrumentation !== undefined;
}

/**
 * Records the largest observed value for an internal counter.
 * @param name The counter to update.
 * @param value The candidate peak value.
 */
export function recordInternalCounterPeak(name: CounterName, value: number): void {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] = Math.max(metrics.counters[name], value);
  }
}

/**
 * Measures a synchronous wall-clock phase when instrumentation is active.
 * @param name The stable phase name.
 * @param callback The phase work.
 * @returns The callback result.
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

/** Count completed parse attempts, including fallback results, at the actual parser boundary. */
export function recordExpressionParse(
  site: ExpressionParseSite,
  outcome: ExpressionParseOutcome,
): void {
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
  const key = `${site}:${expressionOutcomeKey(outcome)}` as const;
  metrics.expressionBoundaries.parses[key] = (metrics.expressionBoundaries.parses[key] ?? 0) + 1;
}

/** Count fallback attempts before evaluation so failures remain visible. */
export function recordExpressionFallback(
  site: ExpressionFallbackSite,
  outcome: ExpressionParseOutcome,
): void {
  const metrics = activeInstrumentation;
  if (!metrics) {
    return;
  }
  metrics.counters.expressionRawFallbackEvaluations++;
  const key = `${site}:${expressionOutcomeKey(outcome)}` as const;
  metrics.expressionBoundaries.fallbacks[key] =
    (metrics.expressionBoundaries.fallbacks[key] ?? 0) + 1;
}

/** Historical boundary probe retained for regression guards and benchmark receipt compatibility. */
export function recordPassthroughDispatch(reason: PassthroughReason): void {
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
export function recordOperandSyntaxFallback(reason: OperandSyntaxFallback): void {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.expressionBoundaries.operandFallbacks[reason] =
      (metrics.expressionBoundaries.operandFallbacks[reason] ?? 0) + 1;
  }
}

/** Closed vocabulary: source text and plugin identities never become metric keys. */
export type SyntaxBoundary =
  | "execution-expression-parse"
  | "execution-operand-parse"
  | "execution-directive-parse"
  | "physical-source-parse"
  | "generated-fragment-parse"
  | "source-cache-miss"
  | "legacy-scanner"
  | "legacy-generated-dispatch"
  | "legacy-evaluation"
  | "legacy-command"
  | "reference-to-text"
  | "define-to-text"
  | "function-to-text"
  | "command-passthrough"
  | `passthrough:${PassthroughReason}`;

/** Tracks forbidden syntax boundaries during migration-sensitive runs. */
type MigrationGuard = { forbidden: ReadonlySet<SyntaxBoundary>; violations: Set<SyntaxBoundary> };
let migrationGuard: MigrationGuard | undefined;

/** Records real boundary work without parsing an extra probe or retaining source text. */
export function recordSyntaxBoundary(boundary: SyntaxBoundary): void {
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
export function withAstMigrationGuard<T>(forbidden: readonly SyntaxBoundary[], run: () => T): T {
  const parent = migrationGuard;
  const guard: MigrationGuard = {
    forbidden: new Set([...(parent?.forbidden ?? []), ...forbidden]),
    violations: new Set(),
  };
  migrationGuard = guard;
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: run() };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    migrationGuard = parent;
    for (const violation of guard.violations) {
      if (parent?.forbidden.has(violation)) {
        parent.violations.add(violation);
      }
    }
  }
  if (guard.violations.size > 0) {
    throw new Error(
      `AST migration guard reached legacy boundaries: ${[...guard.violations].toSorted().join(", ")}`,
      { cause: outcome.ok ? undefined : outcome.error },
    );
  }
  if (!outcome.ok) {
    throw outcome.error;
  }
  return outcome.value;
}

/** A parser may run for physical/generated source, never to rediscover an executing node's grammar. */
let syntaxOwner: "source" | "execution" = "source";

/** Execution scopes override an enclosing source scope, including includes and generated macro bodies. */
export function withTypedExecution<T>(run: () => T): T {
  if (!migrationGuard) {
    return run();
  }
  const parent = syntaxOwner;
  syntaxOwner = "execution";
  try {
    return run();
  } finally {
    syntaxOwner = parent;
  }
}

/** Explicit source-valued bindings may create grammar; nested typed executors regain their own scope. */
export function withSourceSyntax<T>(run: () => T): T {
  if (!migrationGuard) {
    return run();
  }
  const parent = syntaxOwner;
  syntaxOwner = "source";
  try {
    return run();
  } finally {
    syntaxOwner = parent;
  }
}

/** Count actual target/directive parser entries, including speculative failures. */
export function recordExecutionParser(kind: "operand" | "directive"): void {
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
] as const satisfies readonly SyntaxBoundary[];

/** Environment opt-in is browser safe; ordinary builds do not collect instrumentation. */
export function withAstQualification<T>(run: () => T): T {
  if (typeof process === "undefined" || process.env.UTTORI_AST_QUALIFY !== "1") {
    return run();
  }
  return withAstMigrationGuard(AST_COMPLETION_FORBIDDEN, run);
}
