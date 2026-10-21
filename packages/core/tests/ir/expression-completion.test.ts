import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  withAstMigrationGuard,
  runWithInternalInstrumentation,
} from "../../src/internal-instrumentation.js";
import { parseExpressionNode, type ExpressionNode } from "../../src/ir/expression-node.js";
import { MathCore } from "../../src/mathcore.js";

const forbidden = [
  "legacy-evaluation",
  "legacy-scanner",
  "reference-to-text",
  "define-to-text",
  "function-to-text",
] as const;

test("digit-leading local labels retain their complete names in typed references", (t) => {
  for (const name of [".812A", ".8120", "..81D7"]) {
    const node = parseExpressionNode(name);
    t.like(node, { type: "identifier", name });
  }
  t.like(parseExpressionNode("1.5"), { type: "literal", value: "1.5" });
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  withAstMigrationGuard(forbidden, () => {
    assembler.assembleSource(
      "lorom\norg $808000\nentry:\nbra .812A\n.8120:\nnop\n.812A:\nbra .8120",
    );
  });
  t.deepEqual([...assembler.getBinaryOutput()], [0x80, 1, 0xea, 0x80, 0xfd]);
});

test("structured references refresh defines, indexes and relative streams after JSON transport", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.structs.set("Rows", {
    name: "Rows",
    base: 100,
    size: 3,
    offset: 3,
    align: 4,
    extensionSize: 2,
    labels: new Map([["value", 1]]),
  });
  assembler.defines.set("INDEX", "2");
  const parsed = parseExpressionNode("Rows[!INDEX].value + 1");
  const snapshot = JSON.stringify(parsed);
  const restored: ExpressionNode = JSON.parse(snapshot);
  withAstMigrationGuard(forbidden, () => {
    t.is(assembler.mathCore.math(restored), 114);
    assembler.defines.set("INDEX", "3");
    t.is(assembler.mathCore.math(restored), 120);
    assembler.defines.set("OFFSET", "$04 + Rows");
    t.is(assembler.mathCore.math(parseExpressionNode("!OFFSET.value")), 105);
    t.deepEqual(assembler.resolveStructuredReference({ type: "identifier", name: "Missing" }), {
      kind: "missing",
      name: "Missing",
      deferred: true,
    });
    assembler.activateStage("emitProgram");
    assembler.currentTargetAddress = 100;
    assembler.forwardLabels = { 0: [{ addr: 105 }, { addr: 110 }], 2: [{ addr: 115 }] };
    assembler.backwardLabels = { 0: [{ addr: 90 }, { addr: 95 }], 1: [{ addr: 98 }] };
    t.is(assembler.mathCore.math(":++ - :--"), 20);
    t.is(assembler.mathCore.math("++"), 115);
    t.is(assembler.mathCore.math("-"), 98);
    t.deepEqual(assembler.resolveStructuredReference({ type: "identifier", name: "Missing" }), {
      kind: "missing",
      name: "Missing",
      deferred: false,
    });
  });
  t.is(JSON.stringify(parsed), snapshot);
});

test("user functions preserve lexical substitution, rounded grouping and eager argument order", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const math = assembler.mathCore;
  // Expected results were characterized against the pre-migration function implementation.
  const cases: [string[], string, (number | string)[], number][] = [
    [["x"], "x**2", [-2], 4],
    [["x"], "(x)*3", [2.7], 6],
    [["x"], 'stringsequal(x,"cat")', ["cat"], 1],
    [["x"], 'stringsequal("x","2")', [2], 1],
    [["x", "y"], 'stringsequal(x,"y")', ["y", 2], 1],
  ];
  math.math_round = true;
  withAstMigrationGuard(forbidden, () => {
    for (const [args, content, values, expected] of cases) {
      math.userFunctions.set("f", { args, content });
      t.is(math.callUserFunction("f", values), expected);
    }
    math.userFunctions.set("f", { args: ["x"], content: 'stringsequal(x,"x")' });
    t.throws(() => math.callUserFunction("f", ["$&"]), {
      message: "Expected ',' or ')' in function call arguments: x\"\")",
    });
    const calls: number[] = [];
    math.registerExpressionFunction("tick", {
      minimumArguments: 1,
      maximumArguments: 1,
      evaluate: (args) => {
        calls.push(Number(args[0]));
        return Number(args[0]);
      },
    });
    math.userFunctions.set("sum", { args: ["a", "b"], content: "a + b + a" });
    t.is(math.math("sum(tick(2),tick(3))"), 7);
    t.deepEqual(calls, [2, 3]);
    const measured = runWithInternalInstrumentation(() => {
      t.is(math.callUserFunction("sum", [4, 5]), 13);
      t.is(math.callUserFunction("sum", [5, 6]), 16);
    });
    t.is(measured.metrics.syntaxBoundaries["generated-fragment-parse"], undefined);
  });
});

test("source-valued arguments and parser diagnostics remain portable without running an evaluator", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const seen: string[] = [];
  assembler.expressionHost.getFileSize = (path) => {
    seen.push(path);
    return 9;
  };
  const syntax = parseExpressionNode("filesize(data/64kb.bin)");
  t.deepEqual(seen, []);
  withAstMigrationGuard(forbidden, () => {
    const transported: ExpressionNode = JSON.parse(JSON.stringify(syntax));
    t.is(assembler.mathCore.math(transported), 9);
    for (const [input, message] of [
      ["", "Invalid input: empty expression."],
      ["2 +", "Missing right operand for operator '+'."],
      ["$", "Invalid number: NaN"],
      ["%", "Invalid number: NaN"],
      ["0x", "Invalid number: NaN"],
      ["( )", "Invalid number: )"],
      ["1 + * 2", "Invalid number: * 2"],
      ["(2 + 3", "Mismatched parentheses."],
    ]) {
      const node = parseExpressionNode(input);
      t.is(node.type, "error");
      const transportedError: ExpressionNode = JSON.parse(JSON.stringify(node));
      t.throws(() => new MathCore().math(transportedError), {
        message,
      });
    }
    t.is(parseExpressionNode("<argument>").type, "template");
  });
  t.deepEqual(seen, ["data/64kb.bin"]);
});
