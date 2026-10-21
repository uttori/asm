import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  withAstMigrationGuard,
  runWithInternalInstrumentation,
} from "../../src/internal-instrumentation.js";
import { parseExpressionNode } from "../../src/ir/expression-node.js";
import { createMacroLineTemplate, bindNumericMacroTemplate } from "../../src/ir/macro-template.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";
import { sourceFragment, fragmentText } from "../../src/ir/source-fragment.js";

const make = (text: string) =>
  createMacroLineTemplate(
    createNormalizedCommand(text, text, ["db", text.slice(3)], "defs.asm", 1),
  );

const strict = [
  "legacy-generated-dispatch",
  "legacy-evaluation",
  "legacy-scanner",
  "reference-to-text",
  "function-to-text",
] as const;

test("capture nodes and ordered generated statements execute after JSON transport without generic dispatch", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const source = `lorom
org $808000
function twice(x) = x*2
struct Row $10
.value: skip 1
endstruct
macro Emit(name, ...)
!<name> = 3
if 0
db <...[999]>
endif
!i = 0
while !i < sizeof(...)
db <...[!i]>
!i #= !i+1
endwhile
db twice(!<name>), Row.value
endmacro
%Emit(count,$11,$22)
!statement = "db $33 : db $44"
!statement
`;
  const tree = assembler.buildProgramModel(source, "capture.asm");
  const snapshot = JSON.stringify(tree);
  t.deepEqual(
    tree.nodes.filter((node) => node.type === "capture").map((node) => node.captureKind),
    ["function", "struct", "macro"],
  );
  withAstMigrationGuard(strict, () => assembler.assembleProgram(JSON.parse(snapshot)));
  t.deepEqual([...assembler.getBinaryOutput()], [0x11, 0x22, 6, 0x10, 0x33, 0x44]);
  t.is(JSON.stringify(tree), snapshot);
});

test("grammar-changing defines use an explicit expression template and refresh values", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const node = parseExpressionNode("1 !operator 2");
  t.is(node.type, "template");
  withAstMigrationGuard(strict, () => {
    assembler.defines.set("operator", "+");
    t.is(assembler.mathCore.math(node), 3);
    assembler.defines.set("operator", "*");
    t.is(assembler.mathCore.math(node), 2);
    assembler.defines.set("operator", "*");
    const repeated = runWithInternalInstrumentation(() => assembler.mathCore.math(node));
    t.is(repeated.metrics.syntaxBoundaries["generated-fragment-parse"], undefined);
  });
});

test("direct macro binding requires every lexical site to be a numeric expression leaf", (t) => {
  const plain = make("db <x> + 1");
  const snapshot = JSON.stringify(plain);
  const args = new Map([["x", "7"]]);
  t.is(
    bindNumericMacroTemplate(plain, args, sourceFragment("db 7 + 1"))?.syntax?.kind,
    "numericData",
  );
  t.is(
    bindNumericMacroTemplate(
      make('db stringsequal("<x>","7")'),
      args,
      sourceFragment('db stringsequal("7","7")'),
    ),
    undefined,
  );
  args.set("x", "1, 2");
  t.is(bindNumericMacroTemplate(plain, args, sourceFragment("db 1, 2 + 1")), undefined);
  t.is(JSON.stringify(plain), snapshot);
});

test("concatenated macro fragments retain all argument and definition contributors", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.defineEngine.handleDefineCommand("!value = 7", {
    file: "defines.asm",
    line: 2,
    text: "!value = 7",
  });
  const text = "db <left><right>";
  const template = createMacroLineTemplate(
    createNormalizedCommand(text, text, ["db", "<left><right>"], "defs.asm", 1),
  );
  const args = [
    {
      index: 0,
      parameter: "left",
      text: "!value",
      location: { file: "main.asm", line: 4, text: "!value" },
    },
    { index: 1, parameter: "right", text: "2", location: { file: "main.asm", line: 4, text: "2" } },
  ];
  const fragment = assembler.macroEngine.expandMacroFragment(
    sourceFragment(text, [{ file: "defs.asm", line: 1, text }]),
    new Map([
      ["left", "!value"],
      ["right", "2"],
    ]),
    [],
    0,
    template,
    args,
  );
  t.is(fragmentText(fragment), "db 72");
  const contributors = fragment.segments.flatMap((segment) => segment.origins);
  t.true(contributors.some((origin) => origin.file === "defines.asm"));
  t.true(contributors.some((origin) => origin.text === "!value"));
  t.true(contributors.some((origin) => origin.text === "2"));
  t.is(fragmentText(JSON.parse(JSON.stringify(fragment))), fragmentText(fragment));
});

test("recursive expansion failure unwinds invocation state and leaves the session disposable", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  withAstMigrationGuard(["legacy-generated-dispatch"], () => {
    t.throws(
      () =>
        assembler.assembleSource("macro Again()\n%Again()\nendmacro\n%Again()", "recursive.asm"),
      { message: /Maximum call stack size exceeded/ },
    );
  });
  t.false(assembler.inMacroExpansion);
  t.is(assembler.currentMacroName, "");
  t.is(assembler.currentSourceOrigin, undefined);
  t.deepEqual(assembler.macroEngine.macroExpansionControlStack, []);
});
