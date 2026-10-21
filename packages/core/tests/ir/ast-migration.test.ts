import fs from "node:fs";

import {
  Assembler as CoreAssembler,
  parseExpressionNode,
  type ExpressionNode,
} from "@uttori/asm-core";
import sinon from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { createTraceCollector } from "../../../../tests/helpers/assembler-trace.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
} from "../../../plugin-65xx/src/index.js";
import { runWithInternalInstrumentation } from "../../src/internal-instrumentation.js";

const baseline = JSON.parse(
  fs.readFileSync(
    new URL("../fixtures/ast-b12-source-compatibility.json", import.meta.url),
    "utf8",
  ),
);

/** Compare with the frozen pre-B12 source receipt, independently of deleted production adapters. */
function assembleSnes(source: string, compatibility: boolean) {
  if (compatibility) {
    const entry = baseline.entries.find(
      (candidate: { source: string }) => candidate.source === source,
    );
    if (!entry) {
      throw new Error("Missing frozen source oracle.");
    }
    if (entry.error) {
      throw new Error(entry.error.message);
    }
    return { ...entry.result, metrics: undefined };
  }
  const assembler = new Assembler();
  const trace = createTraceCollector();
  assembler.setTraceListener(trace.listener);
  const measured = runWithInternalInstrumentation(() =>
    assembler.assembleSource(source, "migration.asm"),
  );
  const result = {
    bytes: [...assembler.getBinaryOutput()],
    definitions: JSON.parse(JSON.stringify(assembler.symbolDefinitions)),
    references: JSON.parse(JSON.stringify(assembler.symbolReferences)),
    mapping: JSON.parse(JSON.stringify(assembler.addressToLineMapping)),
    diagnostics: assembler.diagnostics,
    trace: JSON.parse(JSON.stringify(trace.events)),
    metrics: measured.metrics,
  };
  assembler.dispose();
  return result;
}

test("65816 typed operands preserve width, bank, struct, state and emission observations", (t) => {
  const source = `lorom
org $808000
struct Records $7e2000
  .value: dw
endstruct count 4
Start:
lda #2*(3+4)
lda $01
lda $0001
lda $808001
lda.w $01,x
lda.b $0001
lda Records[2].value,x
lda Forward+1,x
rep #$20
lda #$0001
sep #$20
for i = 1..3
  lda #!i+2
endfor
Forward:
lda Forward
lda Cross
base $818000
Cross:
lda Forward
base off
optimize dp always
lda 1
lda 1,x`;
  const native = assembleSnes(source, false);
  const legacy = assembleSnes(source, true);
  const { metrics: nativeMetrics, ...nativeOutput } = native;
  const { metrics: _legacyMetrics, ...legacyOutput } = legacy;
  t.deepEqual(nativeOutput, legacyOutput);
  t.deepEqual(native.bytes.slice(0, 9), [0xa9, 14, 0xa5, 1, 0xad, 1, 0, 0xaf, 1]);
  t.is(nativeMetrics.counters.operandSyntaxCacheHits, 0);
  t.is(nativeMetrics.counters.operandSyntaxCacheMisses, 0);
  t.is(nativeMetrics.counters.expressionLegacyEvaluations, 0);
});

test("65xx encoding consumes expression nodes and refreshes forward/indexed bindings", async (t) => {
  const environment = await create65xxAssemblerEnvironment();
  const assembler = new CoreAssembler({
    environment,
    target: RAW_65XX_TARGET_ID,
    targetOptions: { origin: 0x8000 },
  });
  t.teardown(() => assembler.dispose());
  const evaluate = sinon.spy(assembler.operandResolver, "getnum");
  assembler.assembleSource(
    "org $8000\nlda #2*(3+4)\nlda Next+1,x\nNext:\nsta $0001\nlda $01",
    "65xx.asm",
  );
  t.deepEqual([...assembler.getBinaryOutput()], [0xa9, 14, 0xbd, 6, 0x80, 0x8d, 1, 0, 0xa5, 1]);
  const typedInputs = evaluate
    .getCalls()
    .map((call) => call.args[0])
    .filter((input): input is ExpressionNode => typeof input !== "string");
  t.true(typedInputs.some((node) => node.type === "binary" && node.operator === "*"));
  t.true(typedInputs.some((node) => node.type === "binary" && node.operator === "+"));
});

test("native statement families bypass preprocessing and retain occurrence metadata", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.activateStage("emitProgram");
  assembler.setWritePosition(0x808000);
  const program = assembler.buildProgramModel(
    "Entry:\nValue = 2*(3+4)\ndb Value\ndw $1234",
    "statements.asm",
  );
  const lowered = assembler.commandLoweringService.lowerProgram(program);
  t.deepEqual(
    lowered.nodes.map((node) => node.kind),
    ["label", "assignment", "numericData", "numericData"],
  );
  const before = JSON.stringify(program);
  const preprocess = sinon.spy(assembler, "processNormalizedCommand");
  assembler.executeLoweredNodeStream(lowered.nodes);
  t.false(preprocess.called);
  t.deepEqual([...assembler.getBinaryOutput()], [14, 0x34, 0x12]);
  t.is(JSON.stringify(program), before);
  t.true(
    assembler.symbolDefinitions.some((symbol) => symbol.name === "Value" && symbol.value === 14),
  );
});

test("typed declarations/data retain scopes, inline writes, mutable defines and macro capture", (t) => {
  const source = `lorom
org $808000
namespace Test
FillByte = $ee
Root:
.first
db FillByte
.second
dw Root
global #Shared
db 2*(3+4), (2.7)*3
namespace off
!data = 1,2
db !data
!data = 3,4
db !data
macro emit(value)
  ?local:
  db <value>
endmacro
%emit(5)
%emit(6)
struct Record $1000
  .value: db
endstruct
Label: db 7
dl $123456
dd $12345678`;
  const { metrics, ...native } = assembleSnes(source, false);
  const { metrics: _legacyMetrics, ...legacy } = assembleSnes(source, true);
  t.deepEqual(native, legacy);
  t.is(metrics.expressionBoundaries.passthrough.staticAssignment, undefined);
  t.is(metrics.expressionBoundaries.passthrough.labelDefinition, undefined);
});

test("a data handler replaced after lowering regains execution ownership", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const lowered = assembler.commandLoweringService.lowerProgram(
    assembler.buildProgramModel("db 1", "override.asm"),
  );
  t.is(lowered.nodes[0].kind, "numericData");
  const calls: string[] = [];
  assembler.directiveRegistry.registerTyped(
    "db",
    ({ text }) => text,
    (value): value is string => typeof value === "string",
    (text) => {
      calls.push(text);
    },
  );
  assembler.executeLoweredNodeStream(lowered.nodes);
  t.deepEqual(calls, ["db 1"]);
});

test("native failures retain compatibility diagnostics without retrying evaluation", (t) => {
  for (const statement of [
    "lda #Missing+1",
    "db Missing+1",
    "Value = Missing+1",
    "lda #1.5",
    "lda #(-1)",
    "lda #2.7*3",
    "lda #(2.7)",
    "db (2.7)",
    "db (Missing.field)",
  ]) {
    const source = `lorom\norg $808000\n${statement}`;
    const native = t.throws(() => assembleSnes(source, false));
    const legacy = t.throws(() => assembleSnes(source, true));
    t.is(native.message, legacy.message);
  }
});

test("typed data preserves before-directive hooks, including handled writes", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.activateStage("emitProgram");
  assembler.setWritePosition(0x808000);
  const hook = sinon.stub(assembler, "runBeforeDirective").callsFake((keyword) => {
    t.is(keyword, "db");
    assembler.write1(0x42);
    return "handled";
  });
  assembler.executeLoweredNodeStream(
    assembler.commandLoweringService.lowerProgram(assembler.buildProgramModel("db 1", "hook.asm"))
      .nodes,
  );
  t.true(hook.calledOnce);
  t.deepEqual([...assembler.getBinaryOutput()], [0x42]);
});

test("variadic numeric data rebinds its argument index on every macro-loop iteration", (t) => {
  const source = `lorom
org $808000
macro emit(...)
  !i = 0
  while !i < sizeof(...)
    db <...[!i]>
    !i #= !i+1
  endwhile
endmacro
%emit(1,2,3,4)`;
  const native = assembleSnes(source, false);
  t.deepEqual(native.bytes, [1, 2, 3, 4]);
  const { metrics, ...output } = native;
  const { metrics: _legacyMetrics, ...legacy } = assembleSnes(source, true);
  t.deepEqual(output, legacy);
  t.true(metrics.counters.actualReparses > 0);
});

test("analysis and execution share a cached target operand tree without caching values", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const command = assembler.createNormalizedCommandFromRaw("lda $0001,x", "cache.asm", 0)!;
  const definition = assembler.resolveActiveArchitecture().definition!;
  const grammar = definition.operandGrammar!;
  const parse = sinon.spy(grammar.parse);
  definition.operandGrammar = { ...grammar, parse };
  const first = assembler.commandLoweringService.parseInstruction(command);
  for (let i = 0; i < 100; i++) {
    t.is(assembler.commandLoweringService.parseInstruction(command), first);
  }
  t.is(parse.callCount, 1);
});

test("integer node evaluation keeps literal spelling and fractional grouping semantics", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  for (const rounding of [false, true]) {
    assembler.mathCore.math_round = rounding;
    for (const text of ["$0001", "%101", "42", "(42)", "2.7"]) {
      t.is(
        assembler.operandResolver.getnum(parseExpressionNode(text)),
        assembler.operandResolver.getnum(text),
        `${text}, rounding=${rounding}`,
      );
    }
    t.is(assembler.operandResolver.getnum(parseExpressionNode("(2.7)")), rounding ? 2 : 2.7);
  }
});

test("typed operands prepare once per lowering and refresh changed define bindings", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.defines.set("value", "1");
  const node = assembler.buildProgramModel("lda #!value", "classify.asm").nodes[0];
  if (!("source" in node)) {
    t.fail();
    return;
  }
  const prepare = sinon.spy(assembler.arch65816, "prepare");
  const snapshot = JSON.stringify(node);
  const first = assembler.commandLoweringService.lowerCommand(node);
  t.true(prepare.calledOnce);
  assembler.defines.set("value", "$1234");
  const next = assembler.commandLoweringService.lowerCommand(node);
  t.is(prepare.callCount, 2);
  if (first.kind !== "typedInstruction" || next.kind !== "typedInstruction") {
    t.fail();
    return;
  }
  const a = first.instruction.operands.operands[0];
  const b = next.instruction.operands.operands[0];
  if (
    a.kind !== "immediate" ||
    b.kind !== "immediate" ||
    a.value.expression.type !== "literal" ||
    b.value.expression.type !== "literal"
  ) {
    t.fail("bound immediate expressions must be literal nodes");
    return;
  }
  t.is(a.value.expression.value, "1");
  t.is(b.value.expression.value, "$1234");
  t.not(first.prepared, next.prepared);
  t.is(JSON.stringify(node), snapshot);
});
