import { test } from "../../../../tests/ava-helper.js";
import { parseExpressionNode } from "../../src/ir/expression-node.js";
import {
  compileLinkExpression,
  linkBinary,
  linkConstant,
  requireLinkConstant,
  type LinkExpressionContext,
} from "../../src/ir/link-expression.js";

const context: LinkExpressionContext = {
  literal: (node) => (node.type === "literal" ? Number(node.value.replace(/^\$/, "0x")) : NaN),
  current: () => ({ kind: "section", module: "unit", section: "Code", offset: 7 }),
  reference: (node) => {
    if (node.type !== "identifier") {
      throw new Error("Unexpected reference.");
    }
    return { kind: "symbol", module: "unit", name: node.name };
  },
};

test("link expressions retain symbol arithmetic, bank extraction and PC anchors without numeric lookup", (t) => {
  const expression = compileLinkExpression(parseExpressionNode("bank(Target + 2)"), context);
  t.deepEqual(expression, {
    kind: "unary",
    operator: "bank",
    argument: {
      kind: "binary",
      operator: "+",
      left: { kind: "symbol", module: "unit", name: "Target" },
      right: { kind: "constant", value: 2 },
    },
  });
  t.deepEqual(compileLinkExpression(parseExpressionNode("pc()"), context), context.current());
  t.throws(() => requireLinkConstant(expression, "Record count"), {
    message: /assembly-time constant/,
  });
});

test("link folding preserves same-section differences while retaining cross-section addresses", (t) => {
  const first = { kind: "section", module: "unit", section: "Code", offset: 2 } as const;
  const last = { ...first, offset: 10 };
  t.deepEqual(linkBinary("-", last, first), linkConstant(8));
  t.is(linkBinary("-", last, { ...first, section: "Data" }).kind, "binary");
  t.deepEqual(
    compileLinkExpression(parseExpressionNode("(17 / 3) + (1 << 40)"), context),
    linkConstant(1099511627781),
  );
});

test("link expressions reject effects, unsafe integers, excessive shifts and invalid arithmetic", (t) => {
  t.throws(() => compileLinkExpression(parseExpressionNode("read1(Target)"), context), {
    message: /unavailable in a link expression/,
  });
  t.throws(() => linkBinary("/", linkConstant(1), linkConstant(0)), { message: /zero/ });
  t.throws(() => linkBinary("<<", linkConstant(1), linkConstant(53)), { message: /0\.\.52/ });
  t.throws(() => linkBinary("+", linkConstant(Number.MAX_SAFE_INTEGER), linkConstant(1)), {
    message: /safe integer/,
  });
});

test("pure logical expressions short circuit consistently before and after placement", (t) => {
  t.deepEqual(compileLinkExpression(parseExpressionNode("0 && (1 / 0)"), context), linkConstant(0));
  t.deepEqual(compileLinkExpression(parseExpressionNode("1 || Missing"), context), linkConstant(1));
});
