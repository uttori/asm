import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  inheritExpressionOccurrence,
  parseExpressionNode,
  renderExpressionNode,
  renderReferenceExpressionNode,
  type ExpressionNode,
} from "../../src/ir/expression-node.js";
import { MathCore } from "../../src/mathcore.js";
import { B11MathOracle } from "../fixtures/b11-math-oracle.js";

test("expression rendering preserves native arithmetic and explicit rounding groups", (t) => {
  const corpus = [
    "2 * (3 + 4)",
    "2 ** (3 ** 2)",
    "2 ** 3 ** 2",
    "(2.7) * 3",
    "2.7 * 3",
    "5 / 2 * 3",
    "5 / (2 * 3)",
    "-(2 + 3)",
    "~($0F | $10)",
    "2 - (3 - 4)",
    "8 / (4 / 2)",
    "max(2 * (3 + 4), (2.7) * 3)",
    "(2 + 3) << (1 + 1)",
    "((2.7)) * 3",
    "(1 + 2)..(3 * 4)",
  ];
  for (const source of corpus) {
    const parsed = parseExpressionNode(source);
    t.not(parsed.type, "raw", source);
    const rendered = renderExpressionNode(parsed);
    const reparsed = parseExpressionNode(rendered);
    t.is(renderExpressionNode(reparsed), rendered, `stable: ${source}`);
    if (parsed.type === "range") {
      continue;
    }
    for (const rounded of [false, true]) {
      const math = new MathCore();
      math.math_round = rounded;
      const oracle = new B11MathOracle();
      oracle.math_round = rounded;
      const expected = oracle.evaluateStringExpression(source);
      t.is(math.math(parsed), expected, `tree: ${source}, rounded=${rounded}`);
      t.is(math.math(reparsed), expected, `rendered: ${source}, rounded=${rounded}`);
    }
  }
  const math = new MathCore();
  t.is(math.math(renderExpressionNode(parseExpressionNode("2 * (3 + 4)"))), 14);
  t.is(math.math(renderExpressionNode(parseExpressionNode("2 ** (3 ** 2)"))), 512);
  math.math_round = true;
  t.is(math.math(renderExpressionNode(parseExpressionNode("(2.7) * 3"))), 6);
});

test("expression rendering supplies structural grouping for constructed trees", (t) => {
  const node: ExpressionNode = {
    type: "binary",
    operator: "*",
    left: {
      type: "binary",
      operator: "+",
      left: { type: "literal", value: "2" },
      right: { type: "literal", value: "3" },
    },
    right: {
      type: "binary",
      operator: "/",
      left: { type: "literal", value: "8" },
      right: { type: "literal", value: "4" },
    },
  };
  t.is(renderExpressionNode(node), "(2 + 3) * (8 / 4)");
  t.is(new MathCore().math(renderExpressionNode(node)), new MathCore().math(node));
});

test("numeric reference rendering preserves grouping without changing canonical lookup keys", (t) => {
  const node = parseExpressionNode("(Player[(2 + 3) * 4].hp)");
  if (node.type !== "member") {
    t.fail("Expected member reference");
    return;
  }
  t.is(renderExpressionNode(node), "(Player[(2 + 3) * 4].hp)");
  t.is(renderReferenceExpressionNode(node), "Player[(2 + 3) * 4].hp");
  t.is(
    renderReferenceExpressionNode(node, {
      renderIndex: (index) => new MathCore().math(index).toString(),
    }),
    "Player[20].hp",
  );
});

test("define substitution preserves occurrence grouping and does not mutate parsed input", (t) => {
  const assembler = new Assembler();
  assembler.defines.set("VALUE", "2.7");
  assembler.mathCore.math_round = true;
  const source = "      (!VALUE) * 3";
  const parsed = parseExpressionNode(source.slice(6), { text: source, offset: 6, line: 9 });
  const before = JSON.stringify(parsed);
  const resolved = assembler.resolveExpressionNode(parsed);
  t.is(assembler.mathCore.math(resolved), 6);
  t.is(renderExpressionNode(resolved), "(2.7) * 3");
  t.is(JSON.stringify(parsed), before);
  if (parsed.type !== "binary" || resolved.type !== "binary") {
    t.fail("Expected binary expressions");
    return;
  }
  t.deepEqual(resolved.left.span, parsed.left.span);
  t.is(resolved.span?.start, 6);
  t.is(resolved.span?.line, 9);
  assembler.defines.set("VALUE", "3.7");
  t.is(assembler.mathCore.math(assembler.resolveExpressionNode(parsed)), 9);
  t.is(assembler.mathCore.math(resolved), 6);
});

test("replacement descendants never inherit offsets belonging to replacement text", (t) => {
  const replacement = parseExpressionNode("max(Label, Player[(2 + 3) * 4].hp)", {
    text: "max(Label, Player[(2 + 3) * 4].hp)",
    offset: 0,
    line: 0,
  });
  const occurrence = parseExpressionNode("(!VALUE)", {
    text: "      (!VALUE)",
    offset: 6,
    line: 4,
  });
  const before = JSON.stringify(replacement);
  const result = inheritExpressionOccurrence(replacement, occurrence);
  t.deepEqual(result.span, occurrence.span);
  t.true(result.parenthesized);
  // The replacement root identifies the use; generated descendants have no physical source owner.
  let spans = 0;
  JSON.stringify(result, (key, value) => {
    if (key === "span") {
      spans++;
    }
    return value;
  });
  t.is(spans, 1);
  t.is(JSON.stringify(replacement), before);
  t.is(renderExpressionNode(result), "(max(Label, Player[(2 + 3) * 4].hp))");
});

test("loop bounds preserve grouped expressions through the rendering boundary", (t) => {
  const assembler = new Assembler();
  const source = [
    "lorom",
    "org $808000",
    "for i = 2 * (3 + 4)..16",
    "db !i",
    "endfor",
    "for j = 2 ** (3 ** 2)..514",
    "dw !j",
    "endfor",
  ].join("\n");
  assembler.assembleProgram(assembler.buildProgramModel(source, "grouped-loops.asm", 0));
  t.deepEqual([...assembler.getBinaryOutput()], [14, 15, 0, 2, 1, 2]);

  assembler.mathCore.math_round = true;
  t.deepEqual(
    assembler.resolveForLoopBounds({
      kind: "loop",
      loopType: "for",
      variable: "i",
      commands: [],
      startExpression: parseExpressionNode("(2.7) * 3"),
      endExpression: parseExpressionNode("8"),
    }),
    { variable: "i", start: 6, end: 8 },
  );
});

test("substitution retains node evaluation without introducing rounding boundaries", (t) => {
  const assembler = new Assembler();
  assembler.defines.set("VALUE", "2.7 + 1.7");
  assembler.mathCore.math_round = true;
  // Substitution is structural. A generated subtree without an explicit group
  // must not gain a rounding boundary merely to make its rendered precedence clear.
  const resolved = assembler.resolveExpressionInput("!VALUE * 3");
  t.is(assembler.mathCore.math(resolved), 11);
  t.is(assembler.mathCore.math(assembler.resolveExpressionInput("(!VALUE) * 3")), 9);
});
