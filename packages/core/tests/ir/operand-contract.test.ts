import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  parseInstructionOperands,
  bindInstructionOperands,
  type OperandScalar,
} from "../../src/ir/parsed-operand.js";
import { InstructionResolutionFrame } from "../../src/ir/resolved-instruction.js";
import { sourceFragment, fragmentText } from "../../src/ir/source-fragment.js";
import { syntaxExpression } from "../../src/ir/syntax-codec.js";

const grammar = {
  registers: ["a", "x", "y", "s"],
  indexRegisters: ["x", "y", "s"],
  commaIndex: true,
  ca65Widths: true,
};
const parse = (text: string) => parseInstructionOperands("lda", text, grammar);

test("operand grammar separates addressing punctuation, grouping, stack indexes and width", (t) => {
  t.deepEqual(parse("").operands, []);
  t.is(parse("a").operands[0].kind, "register");
  const immediate = parse("#(1 + 2)").operands[0];
  t.is(immediate.kind, "immediate");
  if (immediate.kind === "immediate") {
    t.true(immediate.value.width.grouped);
  }
  for (const [source, delimiter, position] of [
    ["($12,x)", "parentheses", "inside"],
    ["($12),y", "parentheses", "outside"],
    ["[$12],y", "brackets", "outside"],
  ]) {
    const node = parse(source).operands[0];
    t.is(node.kind, "memory");
    if (node.kind === "memory") {
      t.is(node.delimiter, delimiter);
      t.is(node.index?.position, position);
    }
  }
  const stack = parse("($12,s),y").operands[0];
  if (stack.kind !== "memory") {
    {
      t.fail();
      return;
    }
  }
  t.is(stack.innerIndex, "s");
  t.is(stack.index?.register, "y");
  const grouped = parse("(one)+(two)").operands[0];
  if (grouped.kind !== "memory" || "kind" in grouped.address) {
    {
      t.fail();
      return;
    }
  }
  t.is(grouped.delimiter, "none");
  t.is(grouped.address.expression.type, "binary");
  const width = parse("a:$0012").operands[0];
  if (width.kind !== "memory" || "kind" in width.address) {
    {
      t.fail();
      return;
    }
  }
  t.is(width.address.width.literalBytes, 2);
  t.is(width.address.width.forcedBytes, 2);
  t.is(parseInstructionOperands("lda.l", "$12", grammar).width, 3);
  t.is(parse("$12, ($34)").operands.length, 2);
  t.is(parse("[1)").operands[0].kind, "invalid");
});

test("registered SPC and SuperFX grammars preserve register identity and compound forms", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const spc = assembler.architectureRegistry.getDefinition("spc700")!.operandGrammar!;
  const superfx = assembler.architectureRegistry.getDefinition("superfx")!.operandGrammar!;
  for (const source of ["a,($12+x)", "($12)+y,a", "(x)+,a", "c,/$1234.3", "$12,++"]) {
    const result = spc.parse("mov", source);
    t.is(result.operands.length, 2, source);
    t.false(
      result.operands.some((node) => node.kind === "invalid"),
      source,
    );
  }
  for (const spelling of ["(x)+", "(x+)"]) {
    const increment = spc.parse("mov", spelling).operands[0];
    if (increment.kind !== "memory") {
      t.fail();
      return;
    }
    t.true(increment.postIncrement);
    t.true("kind" in increment.address && increment.address.kind === "register");
  }
  const bit = spc.parse("or1", "c,/$1234.3").operands[1];
  if (bit.kind !== "memory") {
    {
      t.fail();
      return;
    }
  }
  t.true(bit.bit?.inverted);
  t.is(spc.parse("bbs3", "$12,+").mnemonicBit, 3);
  t.is(superfx.parse("to", "r0").operands[0].kind, "register");
  const zeroPadded = superfx.parse("ibt", "r00").operands[0];
  t.is(zeroPadded.kind, "memory");
  t.is(superfx.parse("iwt", "r1,#$0012").operands.length, 2);
  t.is(superfx.parse("lm", "r1,($1234)").operands.length, 2);
});

test("resolution receipts preserve explicit evaluation order, cursor, widths and frame lifetime", (t) => {
  let address = 100;
  let calls = 0;
  let identity = {};
  const scalar: OperandScalar = {
    expression: { type: "literal", value: "-1.5", numericValue: -1.5 },
    width: { spelling: "decimal", grouped: false },
    span: { start: 0, end: 4 },
  };
  const frame = new InstructionResolutionFrame(
    { mnemonic: "test", operands: parse("#1") },
    {
      evaluate: () => {
        calls++;
        return -1.5;
      },
      reference: () => ({ kind: "missing", name: "label", deferred: true }),
      currentAddress: () => address,
      stage: () => "emitProgram",
      stageIdentity: () => identity,
    },
  );
  frame.choose("immediate", 2, { wide: false });
  const before = frame.evaluate(scalar, "classification", true);
  address++;
  const after = frame.evaluate(scalar, "afterOpcode", true);
  t.is(calls, 2);
  t.is(before.address, 100);
  t.is(after.address, 101);
  t.is(after.value, -1.5);
  t.is(after.generatedNumberIssue, "negative");
  t.deepEqual(frame.snapshot().values, [before, after]);
  identity = {};
  t.throws(() => frame.evaluate(scalar, "operand"), { message: /no longer active/ });
  frame.close();
  t.throws(() => frame.snapshot(), { message: /no longer active/ });
});

const forbidden = (): never => {
  throw new Error("Legacy instruction adapter called.");
};

test("scalar instruction state owns its tuple and preserves validation and frame expiry", (t) => {
  const identity = {};
  const frame = new InstructionResolutionFrame(
    { mnemonic: "test", operands: parse("#1") },
    {
      evaluate: () => 0,
      reference: () => ({ kind: "missing", name: "label", deferred: true }),
      currentAddress: () => 100,
      stage: () => "emitProgram",
      stageIdentity: () => identity,
    },
  );
  const values: (number | boolean | string | null)[] = [2, false, "immediate", null];
  frame.chooseScalars("tuple", 2, ...values);
  values[0] = 99;
  t.deepEqual(frame.snapshot().state, [2, false, "immediate", null]);
  for (const value of [NaN, Infinity, -Infinity, undefined, {}, []]) {
    t.throws(() => Reflect.apply(frame.chooseScalars.bind(frame), frame, ["tuple", 2, value]), {
      message: /finite JSON scalars/,
    });
  }
  t.throws(() => frame.chooseScalars("", 2, 1), { message: /Invalid resolved instruction/ });
  t.throws(() => frame.chooseScalars("tuple", -1, 1), { message: /Invalid resolved instruction/ });
  // Generic plugin state retains its defensive tree-copy boundary.
  const original = { child: { value: 3 } };
  frame.choose("object", 1, original);
  original.child.value = 4;
  t.deepEqual(frame.snapshot().state, { child: { value: 3 } });
  frame.close();
  t.throws(() => frame.chooseScalars("tuple", 1, 1), { message: /no longer active/ });
});

const choose = (frame: InstructionResolutionFrame) => {
  frame.choose("immediate", 2);
  return 2;
};

test("typed dispatch never invokes legacy classifiers, expansion, sizing or encoding", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const definition = assembler.architectureRegistry.getDefinition("65816")!;
  const observations: { stage: string; address: number; point: string }[] = [];
  const retained: InstructionResolutionFrame[] = [];
  definition.classifyOperand = forbidden;
  definition.encoder = {
    estimateSize: forbidden,
    encode: forbidden,
    typed: {
      estimate: choose,
      encode(frame, context) {
        choose(frame);
        retained.push(frame);
        const operand = frame.instruction.operands.operands[0];
        if (operand.kind !== "immediate") {
          throw new Error("Expected immediate.");
        }
        context.emission.write1(0xa9);
        const value = frame.evaluate(operand.value, "afterOpcode");
        observations.push({
          stage: frame.snapshot().stage,
          address: value.address,
          point: value.point,
        });
        context.emission.write1(value.value);
        t.false("operands" in context);
        return true;
      },
    },
  };
  assembler.assembleProgram(assembler.buildProgramModel("org $808000\ntyped #$12", "typed.asm"));
  t.deepEqual([...assembler.getBinaryOutput()], [0xa9, 0x12]);
  t.true(observations.length > 0);
  t.true(
    observations.every((entry) => entry.address === 0x808001 && entry.point === "afterOpcode"),
  );
  t.true(retained.every((frame) => t.throws(() => frame.currentAddress()) !== undefined));
});

test("portable expression guard rejects hidden raw readers and malformed typed children", (t) => {
  t.false(syntaxExpression({ type: "raw", value: "1" }));
  t.false(
    syntaxExpression({
      type: "binary",
      operator: "+",
      left: { type: "raw", value: "1" },
      right: { type: "literal", value: "2" },
    }),
  );
  t.false(
    syntaxExpression({ type: "call", callee: { type: "literal", value: "2" }, arguments: [] }),
  );
  t.false(
    syntaxExpression({ type: "error", value: "", message: "", outcome: { kind: "invented" } }),
  );
});

/** Legacy processor schedules are acceptance evidence for the subsequent encoder migrations. */
test("processor expression timing retains stage-entry and instruction-cursor reads", (t) => {
  const schedules = [
    {
      source: "lda #pc()&255",
      bytes: [0xa9, 0],
      offsets: [-0x808000, -0x808000, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0],
      stages: [5, 4, 4],
    },
    {
      source: "arch spc700\nmov a,#pc()&255",
      bytes: [0xe8, 0],
      offsets: [-0x808000, 0, 2, 0, 2, 0],
      stages: [2, 2, 2],
    },
    {
      source: "arch superfx\nibt r1,#pc()&255",
      bytes: [0xa1, 0],
      offsets: [-0x808000, 0, 2, 0, 2, 0],
      stages: [2, 2, 2],
    },
  ];
  for (const expected of schedules) {
    const assembler = new Assembler();
    t.teardown(() => assembler.dispose());
    const calls: { stage: string; address: number }[] = [];
    const builtin = assembler.mathCore.callBuiltInFunction;
    assembler.mathCore.callBuiltInFunction = (name, args) => {
      if (name === "pc") {
        calls.push({
          stage: assembler.traceStage,
          address: assembler.currentTargetAddress - 0x808000,
        });
      }
      return builtin(name, args);
    };
    assembler.assembleSource(`lorom\norg $808000\n${expected.source}`, "timing.asm");
    t.deepEqual([...assembler.getBinaryOutput()], expected.bytes);
    t.deepEqual(
      calls.map((call) => call.address),
      expected.offsets,
    );
    t.deepEqual(
      ["collectDefinitions", "resolveLayout", "emitProgram"].map(
        (stage) => calls.filter((call) => call.stage === stage).length,
      ),
      expected.stages,
    );
  }
});

test("registered typed factories receive state/options and no legacy resolution facade", async (t) => {
  const { createFixturePlugin, registerFixtureContributions } =
    await import("../../../../tests/plugin/fixture-plugin.js");
  const { Assembler: CoreAssembler, PluginManager } = await import("../../src/index.js");
  const manager = new PluginManager();
  t.teardown(() => manager.dispose());
  const plugin = createFixturePlugin({
    activate(context) {
      registerFixtureContributions({
        ...context,
        registerArchitecture(contribution) {
          context.registerArchitecture({
            ...contribution,
            operandGrammar: { version: "1", parse: (_mnemonic, text) => parse(text) },
            createTypedEncoder(factory) {
              t.deepEqual(Object.keys(factory).toSorted(), ["options", "state", "targetId"]);
              return {
                estimate: choose,
                encode(frame, capabilities) {
                  choose(frame);
                  const operand = frame.instruction.operands.operands[0];
                  if (operand.kind !== "immediate") {
                    throw new Error("Expected immediate.");
                  }
                  capabilities.emission.write1(0x42);
                  capabilities.emission.write1(frame.evaluate(operand.value, "afterOpcode").value);
                  return true;
                },
              };
            },
          });
        },
      });
    },
  });
  await manager.activatePlugins([{ plugin }]);
  const assembler = new CoreAssembler({
    environment: manager.freeze(),
    target: "fixture.raw-target",
  });
  t.teardown(() => assembler.dispose());
  assembler.assembleProgram(
    JSON.parse(JSON.stringify(assembler.buildProgramModel("org 0\nFIX #7", "plugin.asm"))),
  );
  t.deepEqual([...assembler.getBinaryOutput()], [0x42, 7]);
});

const bindTestOperands = (text: string) =>
  bindInstructionOperands(
    parse(text),
    (fragment) => {
      const value = fragmentText(fragment);
      if (value === "#!one") {
        return sourceFragment("#!two");
      }
      if (value === "#!two") {
        return sourceFragment("#$0012");
      }
      return sourceFragment(value === "!cycle1" ? "!cycle2" : "!cycle1");
    },
    parse,
  );

test("operand templates bind chained definitions before classification and reject cycles", (t) => {
  const immediate = bindTestOperands("#!one").operands[0];
  if (immediate.kind !== "immediate") {
    t.fail();
    return;
  }
  t.is(immediate.value.width.literalBytes, 2);
  t.throws(() => bindTestOperands("!cycle1"), { message: /Recursive operand template/ });
});

test("prepared values preserve numeric/math effects and reject a different stage or cursor", (t) => {
  let address = 100;
  let stage: "collectDefinitions" | "emitProgram" = "collectDefinitions";
  let numericCalls = 0;
  let mathCalls = 0;
  const identity = {};
  const instruction = { mnemonic: "test", operands: parse("#1") };
  const context = {
    evaluate: () => {
      numericCalls++;
      return 2;
    },
    evaluateMath: () => {
      mathCalls++;
      return 3;
    },
    reference: () => ({ kind: "resolved" as const, value: 4 }),
    currentAddress: () => address,
    stage: () => stage,
    stageIdentity: () => identity,
  };
  const scalar: OperandScalar = {
    expression: { type: "literal", value: "1" },
    width: { spelling: "decimal", grouped: false },
    span: { start: 1, end: 2 },
  };
  const preparation = new InstructionResolutionFrame(instruction, context);
  preparation.evaluate(scalar, "classification");
  const value = preparation.evaluate(scalar, "classification", true, "math");
  preparation.choose("immediate", 2);
  const receipt = preparation.snapshot();
  preparation.close();
  const frame = new InstructionResolutionFrame(instruction, context, receipt);
  frame.observe(scalar, value.value, "beforeOpcode", "$3");
  frame.choose("immediate", 2);
  t.is(numericCalls, 1);
  t.is(mathCalls, 1);
  t.is(frame.snapshot().values[0].displayText, "$3");
  frame.close();
  t.throws(() => frame.observe(scalar, 5, "operand"), { message: /no longer active/ });
  address++;
  t.throws(() => new InstructionResolutionFrame(instruction, context, receipt), {
    message: /different stage or cursor/,
  });
  address--;
  stage = "emitProgram";
  t.throws(() => new InstructionResolutionFrame(instruction, context, receipt), {
    message: /different stage or cursor/,
  });
});
