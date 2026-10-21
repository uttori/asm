import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { runWithInternalInstrumentation } from "../../src/internal-instrumentation.js";
import {
  inheritExpressionOccurrence,
  parseExpressionNode,
  parseExpressionResult,
  parseLeadingReferenceExpression,
} from "../../src/ir/expression-node.js";
import {
  getRawExpressionOutcome,
  type ExpressionParseOutcome,
} from "../../src/ir/expression-parse-state.js";
import { MathCore } from "../../src/mathcore.js";
import { B11MathOracle } from "../fixtures/b11-math-oracle.js";

test("parse outcomes distinguish native, known dialect forms, malformed and unknown syntax", (t) => {
  const cases: [string, ExpressionParseOutcome][] = [
    ["(2 + 3) * 4", { kind: "native" }],
    ["Player[2].hp", { kind: "native" }],
    ["++", { kind: "native" }],
    ["---", { kind: "native" }],
    [":++", { kind: "native" }],
    ["<argument>", { kind: "native" }],
    ["!a < sizeof(...)", { kind: "native" }],
    ["sizeof(...) - 1", { kind: "native" }],
    ["", { kind: "invalid", reason: "empty" }],
    ["$", { kind: "invalid", reason: "literal" }],
    ['"unterminated', { kind: "invalid", reason: "string" }],
    ["!{open", { kind: "invalid", reason: "define" }],
    ["2 +", { kind: "invalid", reason: "operand" }],
    ["<argument> +", { kind: "invalid", reason: "operand" }],
    ["(2 + 3", { kind: "invalid", reason: "delimiter" }],
    ["Player.", { kind: "invalid", reason: "member" }],
    ["2 3", { kind: "invalid", reason: "trailing-tokens" }],
    ["`unknown`", { kind: "unsupported", reason: "token" }],
    ["2[3]", { kind: "unsupported", reason: "postfix" }],
  ];
  for (const [source, expected] of cases) {
    const { node, outcome } = parseExpressionResult(source);
    t.deepEqual(outcome, expected, source);
    t.deepEqual(node, parseExpressionNode(source), "public shape stays unchanged");
    if (outcome.kind !== "native") {
      t.is(node.type, "error");
      t.deepEqual(getRawExpressionOutcome(node), expected);
    }
  }
  t.deepEqual(parseExpressionResult("1..$").outcome, { kind: "invalid", reason: "literal" });
  t.is(parseExpressionResult("sizeof(...) +").outcome.kind, "invalid");
});

test("native templates avoid compatibility probes and preserve instrumentation attribution", (t) => {
  const { metrics } = runWithInternalInstrumentation(() => {
    parseExpressionResult("!a < sizeof(...)", "command");
    parseExpressionResult("sizeof(...)", "instrumentation");
  });
  t.is(metrics.counters.expressionParserCalls, 2);
  t.is(metrics.counters.expressionInstrumentationParses, 1);
  t.deepEqual(metrics.expressionBoundaries.parses, {
    "command:native": 1,
    "instrumentation:native": 1,
  });
});

test("parser calls include recursive slices and distinguish cache misses from measurement work", (t) => {
  const { metrics } = runWithInternalInstrumentation(() => {
    const math = new MathCore();
    t.is(math.math("2 + 3"), 5);
    t.is(math.math("2 + 3"), 5);
    parseExpressionNode("#1..2");
    parseLeadingReferenceExpression("Player[2].hp + 1");
  });
  t.is(metrics.counters.expressionParserCalls, 7);
  t.is(metrics.counters.expressionInstrumentationParses, 1);
  t.is(metrics.counters.expressionParses, 1);
  t.is(metrics.counters.expressionParseCacheHits, 1);
  t.is(metrics.counters.expressionLegacyEvaluations, 0);
  t.deepEqual(metrics.expressionBoundaries.parses, {
    "instrumentation:native": 1,
    "math-cache:native": 1,
    "public:native": 4,
    "reference:native": 1,
  });
});

test("error nodes preserve legacy diagnostics without invoking the legacy evaluator", (t) => {
  const corpus = ["", "$", "(2 + 3", "2 +", "2 3", "`unknown`"];
  for (const source of corpus) {
    const legacy = t.throws(() => new B11MathOracle().evaluateStringExpression(source));
    const { metrics } = runWithInternalInstrumentation(() => {
      const error = t.throws(() => new MathCore().math(source));
      t.is(error.constructor, legacy.constructor, source);
      t.is(error.message, legacy.message, source);
      t.deepEqual(error, legacy, source);
    });
    t.is(metrics.counters.expressionRawFallbackEvaluations, 0, source);
    t.is(metrics.counters.expressionLegacyEvaluations, 0, source);
  }
  const { metrics } = runWithInternalInstrumentation(() => {
    const math = new MathCore();
    t.throws(() => math.math({ type: "raw", value: "16" }), {
      message: /Raw expression nodes are not executable/,
    });
    t.throws(() => math.math("missingFunction(1)"));
  });
  t.is(metrics.counters.expressionRawFallbackEvaluations, 0);
  t.is(
    metrics.counters.expressionLegacyEvaluations,
    0,
    "typed evaluation errors never trigger a legacy retry",
  );
  t.deepEqual(metrics.expressionBoundaries.fallbacks, {});
});

test("fallback metadata and physical root spans survive immutable define substitution", (t) => {
  const assembler = new Assembler();
  assembler.defines.set("VALUE", "++");
  const text = "    (!VALUE)";
  const occurrence = parseExpressionNode(text.slice(4), { text, offset: 4, line: 12 });
  const replacement = assembler.resolveExpressionNode(occurrence);
  t.is(replacement.type, "relativeReference");
  t.true(replacement.parenthesized);
  t.deepEqual(replacement.span, occurrence.span);
  const raw = parseExpressionNode("  $", { text: "prefix  $", offset: 6, line: 4 });
  t.is(raw.span?.start, 8);
  t.is(raw.span?.line, 4);
  const cloned = inheritExpressionOccurrence(raw, occurrence);
  t.deepEqual(getRawExpressionOutcome(cloned), { kind: "invalid", reason: "literal" });
  t.not(cloned, raw);
  t.is(raw.span?.start, 8);
});

test("metric buckets are bounded, contain no source text, and reset after a failed run", (t) => {
  const first = runWithInternalInstrumentation(() => {
    for (let index = 0; index < 1000; index++) {
      parseExpressionNode(`private_symbol_${index} ?`);
    }
  });
  t.deepEqual(first.metrics.expressionBoundaries.parses, { "public:unsupported:token": 1000 });
  t.false(JSON.stringify(first.metrics).includes("private_symbol"));
  t.throws(() =>
    runWithInternalInstrumentation(() => {
      parseExpressionNode("$");
      throw new Error("failed work");
    }),
  );
  const next = runWithInternalInstrumentation(() => parseExpressionNode("2"));
  t.deepEqual(next.metrics.expressionBoundaries.parses, { "public:native": 1 });
  t.deepEqual(first.metrics.expressionBoundaries.parses, { "public:unsupported:token": 1000 });
});

test("assembly labels parser sites and preprocessing dispatch reasons", (t) => {
  const { value, metrics } = runWithInternalInstrumentation(() =>
    new Assembler().analyzeSource(
      ["lorom", "org $808000", "!answer = 42", "Main:", "if 1", "db !answer", "endif"].join("\n"),
      "boundary.asm",
      0,
    ),
  );
  t.deepEqual(value.diagnostics, []);
  t.true((metrics.expressionBoundaries.parses["command:native"] ?? 0) > 0);
  // Analysis walks the existing directive payload instead of parsing its arguments again.
  t.is(metrics.expressionBoundaries.parses["assembler:native"] ?? 0, 0);
  t.is(metrics.expressionBoundaries.passthrough.defineCommand, undefined);
  t.is(metrics.expressionBoundaries.passthrough.labelDefinition, undefined);
  t.is(metrics.expressionBoundaries.passthrough.dataDirective, undefined);
  t.true((metrics.expressionBoundaries.parses["statement:native"] ?? 0) > 0);
  t.is(
    Object.values(metrics.expressionBoundaries.passthrough).reduce((a, b) => a + b, 0),
    metrics.counters.passthroughDispatches,
  );
});

test("source boundary counts distinguish cached physical programs from generated fragments", async (t) => {
  const { withAstMigrationGuard } = await import("../../src/internal-instrumentation.js");
  const assembler = new Assembler();
  const { metrics } = runWithInternalInstrumentation(() => {
    assembler.analyzeSource("org $808000\nMain: db (2 + 3) * 4", "slice.asm", 0);
    assembler.processCommand("db 7");
  });
  t.true((metrics.syntaxBoundaries["physical-source-parse"] ?? 0) > 0);
  t.true((metrics.syntaxBoundaries["source-cache-miss"] ?? 0) > 0);
  t.is(metrics.syntaxBoundaries["generated-fragment-parse"], 1);
  t.notThrows(() =>
    withAstMigrationGuard(
      ["legacy-evaluation", "passthrough:dataDirective", "passthrough:labelDefinition"],
      () => {
        assembler.analyzeSource("org $808000\nMain: db (2 + 3) * 4", "slice.asm", 0);
      },
    ),
  );
  // Recovery can catch expression errors, but cannot hide a forbidden boundary from the guard.
  t.throws(
    () =>
      withAstMigrationGuard(["legacy-evaluation"], () => {
        try {
          new B11MathOracle().evaluateStringExpression("$");
        } catch {
          /* deliberate recovery */
        }
      }),
    { message: /AST migration guard/ },
  );
  t.notThrows(() =>
    withAstMigrationGuard(["legacy-evaluation"], () => new MathCore().math("2 + 3")),
  );
  assembler.dispose();
});
