import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  AST_COMPLETION_FORBIDDEN,
  withAstMigrationGuard,
  runWithInternalInstrumentation,
} from "../../src/internal-instrumentation.js";
import { parseDirectiveExpression } from "../../src/ir/directive-arguments.js";
import { parseExpressionNode } from "../../src/ir/expression-node.js";

/** Qualification uses the same bans as the CLI environment flag, including swallowed parser failures. */
const qualify = <T>(run: () => T) => withAstMigrationGuard(AST_COMPLETION_FORBIDDEN, run);

test("complete AST execution binds macro-local references without numeric source rewriting", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const { metrics } = runWithInternalInstrumentation(() =>
    qualify(() =>
      assembler.assembleSource(
        `norom
org $8000
macro emit()
?Root:
?.Child:
dl ?.Child
dl ?Root_Child
endmacro
%emit()`,
        "macro-reference.asm",
      ),
    ),
  );
  t.deepEqual(assembler.getBinaryOutput().slice(0x8000), Uint8Array.from([0, 0x80, 0, 0, 0x80, 0]));
  for (const boundary of AST_COMPLETION_FORBIDDEN) {
    t.falsy(metrics.syntaxBoundaries[boundary], boundary);
  }
  t.is(metrics.counters.expressionLegacyEvaluations, 0);
  t.is(metrics.counters.passthroughDispatches, 0);
  t.true((metrics.syntaxBoundaries["physical-source-parse"] ?? 0) > 0);
});

test("qualification detects parsers inside typed instruction execution even when errors are caught", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.architectureRegistry.register({
    name: "parser-probe",
    operandGrammar: { version: "1", parse: () => ({ operands: [] }) },
    encoder: {
      typed: {
        estimate(frame) {
          try {
            parseExpressionNode("1+");
          } catch {
            /* Speculative recovery must not hide parser ownership. */
          }
          frame.choose("probe", 0);
          return 0;
        },
        encode(frame) {
          frame.choose("probe", 0);
          return true;
        },
      },
    },
    unknownInstructionBehavior: "throw",
  });
  assembler.arch = "parser-probe";
  t.throws(() => qualify(() => assembler.assembleSource("probe")), {
    message: /execution-expression-parse/,
  });
});

test("qualification detects directive argument parsing after syntax has been selected", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.directiveRegistry.registerTyped(
    "parserprobe",
    () => true,
    (value): value is boolean => typeof value === "boolean",
    () => {
      parseDirectiveExpression("1");
    },
  );
  t.throws(() => qualify(() => assembler.assembleSource("parserprobe")), {
    message: /execution-directive-parse/,
  });
});

test("raw nodes cannot execute in collection, layout or emission", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    const node = { type: "raw", value: "!value + 1" } as const;
    t.throws(() => assembler.resolveExpressionNode(node), {
      message: /Raw expression nodes are not executable/,
    });
    t.throws(() => assembler.operandResolver.getnum(node), {
      message: /Raw expression nodes are not executable/,
    });
  }
});

test("an unterminated macro remains captured without installing or executing its body", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  qualify(() => assembler.assembleSource("macro pending()\ndb 1"));
  t.false(assembler.macros.has("pending"));
  t.is(assembler.getBinaryOutput().length, 0);
});
