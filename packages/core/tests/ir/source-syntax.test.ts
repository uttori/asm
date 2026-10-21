import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import {
  withAstMigrationGuard,
  runWithInternalInstrumentation,
} from "../../src/internal-instrumentation.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";
import { copySyntaxValue, type SyntaxValue } from "../../src/ir/source-syntax.js";
import { syntaxRecord, syntaxNumber } from "../../src/ir/syntax-codec.js";
import type { ProgramModel } from "../../src/services/program-model-builder.js";

const forbidden = [
  "legacy-command",
  "legacy-evaluation",
  "command-passthrough",
  "reference-to-text",
  "define-to-text",
  "function-to-text",
] as const;

test("immutable built-ins share checked syntax while mutable transports are rechecked on each execution", (t) => {
  const shape = syntaxRecord({ nested: syntaxRecord({ value: syntaxNumber }) });
  const original = { nested: { value: 7 } };
  const received: unknown[] = [];
  const registry = new DirectiveRegistry();
  const register = () =>
    registry.registerImmutableTyped(
      "borrowed",
      () => original,
      shape,
      (payload) => received.push(payload),
    );
  register();
  const command = createNormalizedCommand(
    "borrowed",
    "borrowed",
    ["borrowed"],
    "fixture.asm",
    0,
    false,
  );
  const syntax = registry.parseSyntax(command)!;
  if (syntax.error !== undefined) {
    throw new Error(syntax.error);
  }
  t.true(Object.isFrozen(syntax.payload));
  t.true(shape(syntax.payload) && Object.isFrozen(syntax.payload.nested));
  original.nested.value = 99;
  t.false(Object.isFrozen(original));
  registry.executeSyntax(syntax, command);
  // Replacing the codec must still validate and borrow the same immutable occurrence.
  register();
  registry.executeSyntax(syntax, command);
  t.is(received[0], syntax.payload);
  t.is(received[1], syntax.payload);
  t.deepEqual(received[0], { nested: { value: 7 } });
  const transport = { ...syntax, payload: { nested: { value: 8 } } };
  registry.executeSyntax(transport, command);
  transport.payload.nested.value = 9;
  registry.executeSyntax(transport, command);
  t.deepEqual(received.slice(2), [{ nested: { value: 8 } }, { nested: { value: 9 } }]);
  t.true(Object.isFrozen(received[2]));
  let reads = 0;
  const forged = Object.freeze({
    nested: {
      get value() {
        reads++;
        return 7;
      },
    },
  });
  t.throws(() => registry.executeSyntax({ ...syntax, payload: forged }, command), {
    message: /accessors/,
  });
  t.is(reads, 0);
  registry.registerImmutableTyped(
    "borrowed",
    () => original,
    (value): value is typeof original => shape(value) && value.nested.value === 99,
    () => {},
  );
  t.throws(() => registry.executeSyntax(syntax, command), { message: /Invalid syntax payload/ });
});

test("mutable plugin parser, validator and executor snapshots retain separate ownership", (t) => {
  const shape = syntaxRecord({ nested: syntaxRecord({ value: syntaxNumber }) });
  const original = { nested: { value: 7 } };
  const registry = new DirectiveRegistry();
  const values: number[] = [];
  registry.registerSyntax(
    ["mutable"],
    "fixture.mutable",
    {
      version: "1",
      parse: () => original,
      validate(value) {
        if (!shape(value)) {
          return false;
        }
        value.nested.value++;
        return true;
      },
    },
    (value) => {
      if (!shape(value)) {
        throw new Error("Invalid fixture payload.");
      }
      values.push(value.nested.value);
      value.nested.value++;
    },
  );
  const command = createNormalizedCommand(
    "mutable",
    "mutable",
    ["mutable"],
    "fixture.asm",
    0,
    false,
  );
  const syntax = registry.parseSyntax(command)!;
  registry.executeSyntax(syntax, command);
  registry.executeSyntax(syntax, command);
  t.deepEqual(values, [7, 7]);
  t.deepEqual(original, { nested: { value: 7 } });
});

test("source AST slice executes labels, grouped arithmetic and a real plugin without legacy dispatch", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const source = "org $808000\nMain: db 2 * (3 + 4)\ncheck bankcross off\ndb (5 + 1)";
  const program = assembler.buildProgramModel(source, "slice.asm");
  t.is(program.sourceText, source);
  const line = program.nodes[1];
  t.true("source" in line && line.syntax?.kind === "sequence");
  const command = program.nodes[2];
  t.true("source" in command && command.syntax?.kind === "plugin");
  const before = JSON.stringify(program);
  const portable: ProgramModel = JSON.parse(before);
  withAstMigrationGuard(forbidden, () => assembler.assembleProgram(portable));
  t.deepEqual([...assembler.getBinaryOutput()], [14, 6]);
  t.is(assembler.targetState.bankCrossMode, "off");
  t.is(assembler.labelTable.get("Main")?.value, 0x808000);
  t.is(JSON.stringify(program), before);
});

test("pure parsing defers failures, performs no reads or evaluation, and recovers at the next statement", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const program = assembler.buildProgramModel(
    'org $808000\nif 0\ncheck bankcross invalid\ndb missing(1)\nincsrc "missing.asm"\nendif\ndb 7',
    "inactive.asm",
  );
  t.is(assembler.outputBytes.length, 0);
  t.false(assembler.targetState.readFunctionsEnabled);
  t.notThrows(() => assembler.assembleProgram(program));
  t.deepEqual([...assembler.getBinaryOutput()], [7]);
  const result = assembler.analyzeSource("check\nMain: db (2 + 1)", "incomplete.asm", 0, [
    "collectDefinitions",
    "resolveLayout",
    "emitProgram",
  ]);
  t.true(result.diagnostics.some((diagnostic) => diagnostic.message.includes("Invalid CHECK")));
  t.truthy(result.program.nodes[1]);
});

test("cache identity and parser family keep physical and generated fragments distinct", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const { metrics } = runWithInternalInstrumentation(() => {
    const first = assembler.frontEndService.parseSource("check title", "one.asm");
    const again = assembler.frontEndService.parseSource("check title", "one.asm");
    t.is(first.nodes, again.nodes);
    const fragment = assembler.frontEndService.parseGeneratedFragment("check title", "one.asm");
    t.not(fragment.nodes, first.nodes);
    t.is(assembler.frontEndService.parseExpression("2 * (3 + 4)").outcome.kind, "native");
  });
  t.is(metrics.syntaxBoundaries["physical-source-parse"], 1);
  t.is(metrics.syntaxBoundaries["generated-fragment-parse"], 1);
  t.is(metrics.syntaxBoundaries["source-cache-miss"], 2);
  t.false(assembler.targetState.readFunctionsEnabled);
});

test("plugin payload round trips reject stale identities, invalid schemas and host objects", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  for (const corrupt of ["version", "identity", "payload"]) {
    const program: ProgramModel = JSON.parse(
      JSON.stringify(assembler.buildProgramModel("check title", "stale.asm")),
    );
    const node = program.nodes[0];
    if (!("source" in node) || node.syntax?.kind !== "plugin") {
      t.fail("Missing plugin syntax");
      return;
    }
    if (corrupt === "version") {
      node.syntax = { ...node.syntax, grammarVersion: "other" };
    } else if (corrupt === "identity") {
      node.syntax = { ...node.syntax, contributionId: "other" };
    } else {
      node.syntax = { ...node.syntax, payload: { operation: "unknown" }, error: undefined };
    }
    t.throws(() => assembler.assembleProgram(program), {
      message: /grammar changed|Invalid syntax payload/,
    });
  }
  for (const invalid of [
    undefined,
    () => 1,
    new Date(),
    NaN,
    Infinity,
    [undefined],
    new Uint8Array([1]),
  ]) {
    t.throws(() => copySyntaxValue(invalid));
  }
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  t.throws(() => copySyntaxValue(cyclic));
  let reads = 0;
  t.throws(() =>
    copySyntaxValue({
      get value() {
        reads++;
        return 1;
      },
    }),
  );
  t.is(reads, 0);
  const source = { nested: [1, "two", null] };
  const copy = copySyntaxValue(source);
  t.deepEqual(copy, source);
  t.not(copy, source);
});

test("plugin payload copies retain independent node and nesting limits", (t) => {
  // Shared children count at every occurrence because the detached tree duplicates them.
  const row = Array<number>(999).fill(0);
  const payload = Array<number[]>(999).fill(row);
  payload.push(row.slice(1));
  t.notThrows(() => copySyntaxValue(payload));
  payload[999] = row;
  t.throws(() => copySyntaxValue(payload), { message: /1,000,000 values/ });

  let nested: SyntaxValue = null;
  for (let depth = 0; depth < 128; depth++) {
    nested = [nested];
  }
  t.notThrows(() => copySyntaxValue(nested));
  t.throws(() => copySyntaxValue([nested]), { message: /128 nesting levels/ });
});

test("syntax copying retains own nonenumerable data and never invokes accessors or prototype setters", (t) => {
  const input: Record<string, unknown> = {};
  Object.setPrototypeOf(input, null);
  Object.defineProperty(input, "hidden", { value: [1, 2] });
  Object.defineProperty(input, "__proto__", { value: { safe: true } });
  const output = copySyntaxValue(input);
  t.deepEqual(output, { hidden: [1, 2], ["__proto__"]: { safe: true } });
  t.is(Object.getPrototypeOf(output), Object.prototype);
  let reads = 0;
  const accessor = {
    get value() {
      reads++;
      return 1;
    },
  };
  t.throws(() => copySyntaxValue(accessor), { message: /accessors/ });
  t.is(reads, 0);
  const array = [1];
  Object.defineProperty(array, "0", {
    get() {
      reads++;
      return 1;
    },
  });
  t.throws(() => copySyntaxValue(array), { message: /accessors/ });
  t.is(reads, 0);
  const key = "__uttoriCopySentinel";
  // oxlint-disable-next-line eslint/no-extend-native -- Exercise inherited-setter isolation; finally restores the unique property.
  Object.defineProperty(Object.prototype, key, {
    configurable: true,
    set() {
      reads++;
    },
  });
  try {
    const owned = {};
    Object.defineProperty(owned, key, { value: 42 });
    const copied = copySyntaxValue(owned);
    t.is(reads, 0);
    t.true(Object.hasOwn(copied, key));
  } finally {
    Reflect.deleteProperty(Object.prototype, key);
  }
});

test("a transported full-bank record initializer assembles without losing bytes", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const bytes = Uint8Array.from({ length: 0x10000 }, (_, index) => index & 0xff);
  const values = Array.from(bytes, (value) => `$${value.toString(16)}`).join(", ");
  const source = `hirom
org $C60000
struct BankData $C60000
  .tokens: db[65536]
endstruct
dataStruct BankData, { tokens = [${values}] }`;
  // Worker transport must validate the same large declaration as fresh local parsing.
  const program: ProgramModel = JSON.parse(
    JSON.stringify(assembler.buildProgramModel(source, "bank.asm")),
  );
  assembler.assembleProgram(program);
  t.deepEqual(assembler.getBinaryOutput().slice(0x60000), bytes);
});

test("inline source syntax preserves physical indentation, spelling, grouping and trailing command text", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const source = "    Main: db   2 * (3 + 4) ; keep this comment";
  const program = assembler.buildProgramModel(source, "spelling.asm", 12);
  const command = program.nodes[0];
  if (!("source" in command) || command.syntax?.kind !== "sequence") {
    t.fail("Expected a sequence");
    return;
  }
  t.is(command.source.physical?.text, source);
  t.is(command.source.tokenSpans[0].start, 4);
  const following = command.syntax.following;
  if (following.kind !== "numericDataFragment") {
    t.fail("Expected typed numeric data");
    return;
  }
  t.is(following.command, "db   2 * (3 + 4)");
  const expression = following.statement.operands[0].expression;
  t.is(source.slice(expression.span?.start, expression.span?.end), "2 * (3 + 4)");
  t.is(expression.span?.line, 12);
  t.true(expression.type === "binary" && expression.right.parenthesized);
});

test("typed plugin overrides own keywords and invalidate cached grammar selection", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const original = assembler.buildProgramModel("db 7", "override.asm");
  const grammar = { version: "override-1", parse: () => ({ literal: 7 }), validate: () => true };
  assembler.directiveRegistry.registerSyntax(["db"], "test.override", grammar, (payload) => {
    t.deepEqual(payload, { literal: 7 });
    if (payload && typeof payload === "object") {
      Object.assign(payload, { literal: 99 });
    }
    assembler.write1(42);
  });
  const overridden = assembler.buildProgramModel("db 7", "override.asm");
  t.not(overridden.nodes, original.nodes);
  t.not(overridden.grammarIdentity, original.grammarIdentity);
  assembler.activateStage("emitProgram");
  assembler.processCommand("org $808000");
  withAstMigrationGuard(forbidden, () => {
    assembler.executeLoweredNodeStream(
      assembler.commandLoweringService.lowerProgram(overridden).nodes,
    );
    assembler.executeLoweredNodeStream(
      assembler.commandLoweringService.lowerProgram(overridden).nodes,
    );
  });
  t.deepEqual([...assembler.getBinaryOutput()], [42, 42]);
  assembler.directiveRegistry.registerTyped(
    "db",
    () => null,
    (value): value is null => value === null,
    () => assembler.write1(9),
  );
  t.throws(
    () =>
      assembler.executeLoweredNodeStream(
        assembler.commandLoweringService.lowerProgram(overridden).nodes,
      ),
    { message: /grammar changed/ },
  );
});

test("worker programs reject changed grammar identity before any stage effects", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const program = assembler.buildProgramModel("org $808000\ndb 1", "identity.asm");
  program.grammarIdentity = "different-profile";
  t.throws(() => assembler.assembleProgram(program), { message: /Source grammar changed/ });
  t.is(assembler.outputBytes.length, 0);
});

test("continued numeric syntax retains physical leaf positions without evaluating the expression", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const source = "  db 2 * \\\n    (3 + 4) ; comment";
  const program = assembler.buildProgramModel(source, "continued.asm", 10);
  const command = program.nodes[0];
  if (!("source" in command) || command.syntax?.kind !== "numericData") {
    t.fail("Missing numeric syntax");
    return;
  }
  t.is(command.source.physical?.text, source);
  const expression = command.syntax.statement.operands[0].expression;
  if (expression.type !== "binary" || expression.right.type !== "binary") {
    t.fail("Missing grouped expression");
    return;
  }
  t.is(expression.right.left.span?.line, 11);
  t.is(expression.right.left.span?.start, 5);
  t.is(expression.right.right.span?.start, 9);
});
