import { test } from "../ava-helper.js";
import {
  handleAssert,
  handleError,
  handleWarnpc,
  registerMiscDirectives,
} from "../../src/directives/misc.js";
import type { DiagnosticDirectiveContext } from "../../src/directives/types.js";
import type { ExpressionNode } from "../../src/ir/expression-node.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";

const parseStubNumber = (input: string): number => {
  const text = input.trim();
  if (/^\$[\da-f]+$/i.test(text)) {
    return Number.parseInt(text.slice(1), 16);
  }
  return Number(text);
};

const createDiagnosticContext = (
  evaluateExpression: (expression: string | ExpressionNode) => boolean,
  currentTargetAddress = 0,
): DiagnosticDirectiveContext => ({
  session: {
    evaluateExpression,
    resolvedefines: (input) => input,
    currentTargetAddress,
    operandResolver: { getnum: parseStubNumber },
  },
});

test("assert passes a nonzero condition and ignores the message", t => {
  const seen: string[] = [];
  const ctx = createDiagnosticContext((expression) => {
    seen.push(String(expression));
    return true;
  });

  handleAssert(
    ctx,
    ["assert", "1"],
    'assert 1, "unused"',
  );

  t.deepEqual(seen, ["1"]);
});

test("assert splits the message at the first top-level comma", t => {
  const seen: string[] = [];
  const ctx = createDiagnosticContext((expression) => {
    seen.push(String(expression));
    return true;
  });

  handleAssert(
    ctx,
    ["assert"],
    'assert 0 == select(1, 1, 0), "Oh no, commas!", bin(%01010101, 8)',
  );

  t.deepEqual(seen, ["0 == select(1, 1, 0)"]);
});

test("assert fails with asar's default message", t => {
  const ctx = createDiagnosticContext(() => false);

  t.throws(() => handleAssert(ctx, ["assert", "0"], "assert 0"), {
    message: "Assertion failed.",
  });
});

test("assert fails with a dequoted custom message", t => {
  const ctx = createDiagnosticContext(() => false);

  t.throws(
    () => handleAssert(ctx, ["assert"], 'assert 0, "You must put a BANK_END"'),
    { message: "Assertion failed: You must put a BANK_END" },
  );
});

test("assert rejects a missing condition", t => {
  const ctx = createDiagnosticContext(() => true);

  t.throws(() => handleAssert(ctx, ["assert"], "assert"), {
    message: "Broken conditional: assert",
  });
});

test("error throws asar's default and quoted messages", t => {
  const ctx = createDiagnosticContext(() => true);

  t.throws(() => handleError(ctx, ["error"], "error"), {
    message: "error command.",
  });
  t.throws(() => handleError(ctx, ["error"], 'error "Bank $FF is beyond"'), {
    message: "error command: Bank $FF is beyond",
  });
});

test("warnpc passes when PC is at or below the bound", t => {
  const ctx = createDiagnosticContext(() => true, 0x8000);

  handleWarnpc(ctx, ["warnpc", "$8001"], "warnpc $8001");
  handleWarnpc(ctx, ["warnpc", "$8000"], "warnpc $8000");
  t.pass();
});

test("warnpc fails when PC is past the bound", t => {
  const ctx = createDiagnosticContext(() => true, 0x8002);

  t.throws(() => handleWarnpc(ctx, ["warnpc", "$8001"], "warnpc $8001"), {
    message: "warnpc failed: Current pc = $008002, wanted <= $008001",
  });
});

test("misc registry dispatches assert, error, warn, and warnpc", t => {
  const registry = new DirectiveRegistry();
  let evaluated = "";
  registerMiscDirectives(registry, {
    table: {
      session: {
        tableStack: [],
        characterMappings: new Map(),
        currentTable: null,
      },
    },
    diagnostic: {
      session: {
        evaluateExpression: (expression) => {
          evaluated = String(expression);
          return true;
        },
        resolvedefines: (input) => input,
        currentTargetAddress: 0x8000,
        operandResolver: { getnum: parseStubNumber },
      },
    },
  });

  t.true(registry.dispatch("assert", ["assert", "1"], "assert 1"));
  t.is(evaluated, "1");
  t.true(registry.dispatch("warn", ["warn"], "warn"));
  t.true(registry.dispatch("warnpc", ["warnpc", "$8001"], "warnpc $8001"));
  t.throws(() => registry.dispatch("error", ["error"], "error"));
});
