import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  AST_COMPLETION_FORBIDDEN,
  withAstMigrationGuard,
} from "../../src/internal-instrumentation.js";
import { materializeNumericData, literalDataOperands } from "../../src/ir/statement-node.js";

test("compact literal rows preserve bytes, symbols, maps and every trace event", (t) => {
  const text = Array.from(
    { length: 32 },
    (_, index) => `$${index.toString(16).padStart(2, "0")}`,
  ).join(",");
  const source = `lorom\norg $808000\nBytes: db ${text}\ndw ${text}\ndd ${text}\n`;
  const results = [];
  for (const materialize of [false, true]) {
    const assembler = new Assembler();
    t.teardown(() => assembler.dispose());
    const traces: unknown[] = [];
    assembler.setTraceListener((event) => traces.push(event));
    const program = assembler.buildProgramModel(source, "literal-data.asm");
    let compactRows = 0;
    for (const node of program.nodes) {
      if (!("source" in node)) {
        continue;
      }
      const syntax = node.syntax;
      if (syntax?.kind === "numericData") {
        t.truthy(syntax.statement.literalData);
        compactRows++;
        if (materialize) {
          node.syntax = { ...syntax, statement: materializeNumericData(syntax.statement) };
        }
      } else if (syntax?.kind === "sequence" && syntax.following.kind === "numericDataFragment") {
        t.truthy(syntax.following.statement.literalData);
        compactRows++;
        if (materialize) {
          node.syntax = {
            ...syntax,
            following: {
              ...syntax.following,
              statement: materializeNumericData(syntax.following.statement),
            },
          };
        }
      }
    }
    t.is(compactRows, 3);
    withAstMigrationGuard(AST_COMPLETION_FORBIDDEN, () => assembler.assembleProgram(program));
    results.push({
      bytes: assembler.getBinaryOutput(),
      symbols: assembler.symbolDefinitions,
      references: assembler.symbolReferences,
      mapping: assembler.addressToLineMapping,
      diagnostics: assembler.diagnostics,
      traces,
    });
    t.is(assembler.stageExecutionStates.get("collectDefinitions")?.loweredProgram, null);
    t.is(assembler.stageExecutionStates.get("resolveLayout")?.loweredProgram, null);
    t.truthy(assembler.stageExecutionStates.get("emitProgram")?.loweredProgram);
  }
  t.deepEqual(
    results[0].bytes.slice(0, 32),
    Uint8Array.from({ length: 32 }, (_, index) => index),
  );
  t.deepEqual(results[0], results[1]);
});

test("literal rows retain exact spelling and physical occurrence after materialization", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const program = assembler.buildProgramModel(
    "db $01,$02,$03,$04,$05,$06,$07,$08",
    "literal.asm",
    7,
  );
  const node = program.nodes[0];
  if (!("source" in node) || node.syntax?.kind !== "numericData") {
    t.fail();
    return;
  }
  const statement = node.syntax.statement;
  t.is(statement.operands.length, 0);
  t.is(statement.literalData?.length, 48);
  const ordinary = materializeNumericData(statement);
  t.is(ordinary.literalData, undefined);
  for (let index = 0; index < 8; index++) {
    t.is(ordinary.operands[index].text, `$0${index + 1}`);
    t.deepEqual(ordinary.operands[index].expression.span, {
      start: 3 + index * 4,
      end: 6 + index * 4,
      line: 7,
    });
  }
  t.throws(() => [...literalDataOperands(["1"])], { message: /Invalid literal data/ });
});

test("mixed and effectful data rows keep the ordinary binding and evaluation path", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const source = 'org $808000\n!value=9\ndb 1,2,3,4,5,6,7,!value\ndb 1,2,3,4,5,6,7,"AB"';
  const program = assembler.buildProgramModel(source);
  for (const node of program.nodes) {
    if ("source" in node && node.syntax?.kind === "numericData") {
      t.is(node.syntax.statement.literalData, undefined);
      t.is(node.syntax.statement.operands.length, 8);
    }
  }
  assembler.assembleProgram(program);
  t.deepEqual(
    [...assembler.getBinaryOutput()],
    [1, 2, 3, 4, 5, 6, 7, 9, 1, 2, 3, 4, 5, 6, 7, 65, 66],
  );
});

test("the public directive grammar retains ordinary literal operands in its plugin payload", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const command = assembler.createNormalizedCommandFromRaw(
    "db 1,2,3,4,5,6,7,8",
    "public-data.asm",
    0,
  )!;
  const syntax = assembler.directiveRegistry.parseSyntax(command);
  if (
    !syntax ||
    syntax.error !== undefined ||
    typeof syntax.payload !== "object" ||
    syntax.payload === null ||
    Array.isArray(syntax.payload)
  ) {
    t.fail();
    return;
  }
  t.is(syntax.payload.literalData, undefined);
  t.true(Array.isArray(syntax.payload.operands));
  if (Array.isArray(syntax.payload.operands)) {
    t.is(syntax.payload.operands.length, 8);
  }
});
