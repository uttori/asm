import { type ExpressionParseOutcome, type ExpressionParseSite, type ExpressionFallbackSite, type ExpressionOutcomeKey } from "./ir/expression-parse-state.js";
/** Operand parser compatibility buckets counted separately from expression fallbacks. */
type OperandSyntaxFallback = "empty-or-register" | "relative-label" | "macro-template" | "indirect-or-compound" | "expression-grammar" | "function-evaluation-order" | "unresolved-define" | "noncanonical-expanded-number" | "grouped-atom-resolution";
/** Historical counter keys remain readable in pre-migration benchmark receipts. */
export type PassthroughReason = "characterMapping" | "commentOrEmpty" | "dataDirective" | "defineCommand" | "functionDefinition" | "labelDefinition" | "macroDefinitionOrInvoke" | "bareMacroCandidate" | "macroPlaceholder" | "registeredPreprocessDirective" | "staticAssignment" | "structCommand" | "unknown";
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
/**
 * Runs synchronous work with opt-in, run-scoped internal instrumentation.
 * This module is intentionally not exported from the package entry point.
 * @param callback The instrumented work.
 * @returns The callback result and metrics.
 */
export declare function runWithInternalInstrumentation<T>(callback: () => T): {
    value: T;
    metrics: InternalInstrumentationSnapshot;
};
/**
 * Increments an internal counter when instrumentation is active.
 * @param name The counter to increment.
 * @param [amount] The increment amount.
 */
export declare function incrementInternalCounter(name: CounterName, amount?: number): void;
/**
 * Reports whether run-scoped internal instrumentation is active.
 * @returns Whether instrumentation is collecting metrics.
 */
export declare function isInternalInstrumentationActive(): boolean;
/**
 * Records the largest observed value for an internal counter.
 * @param name The counter to update.
 * @param value The candidate peak value.
 */
export declare function recordInternalCounterPeak(name: CounterName, value: number): void;
/**
 * Measures a synchronous wall-clock phase when instrumentation is active.
 * @param name The stable phase name.
 * @param callback The phase work.
 * @returns The callback result.
 */
export declare function measureInternalPhase<T>(name: string, callback: () => T): T;
/** Count completed parse attempts, including fallback results, at the actual parser boundary. */
export declare function recordExpressionParse(site: ExpressionParseSite, outcome: ExpressionParseOutcome): void;
/** Count fallback attempts before evaluation so failures remain visible. */
export declare function recordExpressionFallback(site: ExpressionFallbackSite, outcome: ExpressionParseOutcome): void;
/** Historical boundary probe retained for regression guards and benchmark receipt compatibility. */
export declare function recordPassthroughDispatch(reason: PassthroughReason): void;
/** Record an unmigrated operand family without retaining source text. */
export declare function recordOperandSyntaxFallback(reason: OperandSyntaxFallback): void;
/** Closed vocabulary: source text and plugin identities never become metric keys. */
export type SyntaxBoundary = "execution-expression-parse" | "execution-operand-parse" | "execution-directive-parse" | "physical-source-parse" | "generated-fragment-parse" | "source-cache-miss" | "legacy-scanner" | "legacy-generated-dispatch" | "legacy-evaluation" | "legacy-command" | "reference-to-text" | "define-to-text" | "function-to-text" | "command-passthrough" | `passthrough:${PassthroughReason}`;
/** Records real boundary work without parsing an extra probe or retaining source text. */
export declare function recordSyntaxBoundary(boundary: SyntaxBoundary): void;
/**
 * Test-only synchronous assertion for a migrated grammar slice. Check on exit so deferred
 * diagnostics and internal recovery cannot swallow a violation. Nested guards inherit bans.
 * The guard has no production effect unless explicitly enabled by a test.
 */
export declare function withAstMigrationGuard<T>(forbidden: readonly SyntaxBoundary[], run: () => T): T;
/** Execution scopes override an enclosing source scope, including includes and generated macro bodies. */
export declare function withTypedExecution<T>(run: () => T): T;
/** Explicit source-valued bindings may create grammar; nested typed executors regain their own scope. */
export declare function withSourceSyntax<T>(run: () => T): T;
/** Count actual target/directive parser entries, including speculative failures. */
export declare function recordExecutionParser(kind: "operand" | "directive"): void;
/** Complete cutover guard, shared by fixture tests and opt-in CLI/worker qualification. */
export declare const AST_COMPLETION_FORBIDDEN: readonly ["legacy-scanner", "legacy-evaluation", "legacy-command", "legacy-generated-dispatch", "command-passthrough", "reference-to-text", "define-to-text", "function-to-text", "execution-expression-parse", "execution-operand-parse", "execution-directive-parse"];
/** Environment opt-in is browser safe; ordinary builds do not collect instrumentation. */
export declare function withAstQualification<T>(run: () => T): T;
export {};
//# sourceMappingURL=internal-instrumentation.d.ts.map