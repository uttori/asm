import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { withAstMigrationGuard } from "../src/internal-instrumentation.js";
import { parseExpressionNode } from "../src/ir/expression-node.js";
import { OperandResolver } from "../src/operand-resolver.js";

const forbidden = [
  "legacy-scanner",
  "legacy-evaluation",
  "reference-to-text",
  "define-to-text",
] as const;

test("numeric public entries share typed expressions and preserve lexical define precedence", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const resolver = assembler.operandResolver;
  withAstMigrationGuard(forbidden, () => {
    for (const [source, expected] of [
      ["#$0001", 1],
      ["%1010", 10],
      ["-3", -3],
      ["2*(3+4)", 14],
    ] as const) {
      t.is(resolver.getnum(source), expected);
      t.is(resolver.getnum(parseExpressionNode(source.replace(/^#/, ""))), expected);
    }
    assembler.defines.set("value", "1+2");
    t.is(resolver.getnum("#!value*3"), 7);
    assembler.defines.set("value", "2*(3+4)");
    t.is(resolver.getnum("#!value*3"), 42);
  });
});

test("reference resolution reads live values without rendering paths or caching results", (t) => {
  let value = 12;
  const seen: unknown[] = [];
  const resolver = new OperandResolver({
    resolveReference: (node) => {
      seen.push(node);
      return { kind: "resolved", value };
    },
    evaluateMath: () => {
      throw new Error("Unexpected math evaluation");
    },
    shouldDeferExpressionEvaluation: () => false,
    getCurrentAddress: () => 0x808000,
  });
  const node = parseExpressionNode("Rows[2].value");
  t.is(resolver.getnum(node), 12);
  value = 24;
  t.is(resolver.getnum(node), 24);
  t.deepEqual(seen, [node, node]);
  t.is(resolver.getCurrentAddress(), 0x808000);
});

test("missing and failed references preserve stage-specific deferral", (t) => {
  let deferred = true;
  let failure = false;
  const error = new Error("Invalid indexed reference");
  const resolver = new OperandResolver({
    resolveReference: () =>
      failure ? { kind: "error", error } : { kind: "missing", name: "Missing", deferred },
    evaluateMath: () => {
      throw error;
    },
    shouldDeferExpressionEvaluation: () => deferred,
    getCurrentAddress: () => 0,
  });
  t.is(resolver.getnum("Missing"), 0);
  failure = true;
  t.is(resolver.getnum("Missing"), 0);
  t.is(resolver.getnum("1/0"), 0);
  deferred = false;
  t.is(
    t.throws(() => resolver.getnum("Missing")),
    error,
  );
  t.is(
    t.throws(() => resolver.getnum("1/0")),
    error,
  );
  failure = false;
  t.throws(() => resolver.getnum("Missing"), { message: "Error: Label 'Missing' not found." });
  t.throws(() => resolver.getnum("1..2"), { message: /Range expression is not a numeric operand/ });
});
