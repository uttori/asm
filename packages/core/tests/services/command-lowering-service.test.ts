import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

/** Returns the indexed element, or undefined when the index is past the end. */
const elementAt = <T>(items: readonly T[], index: number): T | undefined =>
  index >= 0 && index < items.length ? items[index] : undefined;

test("command lowering preserves loop structure and typed children", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel(
    ["for i = 0..2", "fillbyte $00", "endfor", "while 0", "db $01", "endwhile"].join("\n"),
    "loops.asm",
  );

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const forLoop = elementAt(lowered.nodes, 0);
  const whileLoop = elementAt(lowered.nodes, 1);

  t.is(forLoop?.kind, "loop");
  if (forLoop?.kind === "loop") {
    t.is(forLoop.loopType, "for");
    t.is(forLoop.variable, "i");
    t.truthy(forLoop.rangeNode);
    t.is(forLoop.header?.source.file, "loops.asm");
    t.is(forLoop.commands[0]?.kind, "pluginSyntax");
  }

  t.is(whileLoop?.kind, "loop");
  if (whileLoop?.kind === "loop") {
    t.is(whileLoop.loopType, "while");
    t.truthy(whileLoop.conditionNode);
    t.is(whileLoop.commands[0]?.kind, "numericData");
  }
});

test("command lowering preserves if elseif and else branches", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel(
    ["if 0", "fillbyte $01", "elseif 1", "fillbyte $02", "else", "fillbyte $03", "endif"].join(
      "\n",
    ),
    "conditional.asm",
  );

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const conditional = elementAt(lowered.nodes, 0);

  t.is(conditional?.kind, "conditional");
  if (conditional?.kind !== "conditional") {
    return;
  }
  t.deepEqual(
    conditional.branches.map((branch) => branch.kind),
    ["if", "elseif", "else"],
  );
  t.truthy(conditional.branches[0]?.conditionNode);
  t.truthy(conditional.branches[1]?.conditionNode);
  t.falsy(conditional.branches[2]?.conditionNode);
  for (const branch of conditional.branches) {
    t.is(branch.commands[0]?.kind, "pluginSyntax");
  }
});

test("include and incbin metadata survives the direct lowering boundary", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel(
    ['include "shared file.asm"', 'incbin "data.bin":(1 * 2)..(4 * 2)'].join("\n"),
    "include.asm",
  );

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const include = elementAt(lowered.nodes, 0);
  const incbin = elementAt(lowered.nodes, 1);

  t.is(include?.kind, "pluginSyntax");
  if (include?.kind === "pluginSyntax") {
    t.is(include.command.keyword, "include");
    t.deepEqual(include.command.words, ["include", '"shared file.asm"']);
    t.is(include.command.parsed.includeTarget?.target, '"shared file.asm"');
  }

  t.is(incbin?.kind, "pluginSyntax");
  if (incbin?.kind === "pluginSyntax") {
    t.is(incbin.command.keyword, "incbin");
    t.truthy(incbin.command.parsed.incbinRange);
    t.deepEqual(incbin.command.parsed.directiveArgs?.args, ['"data.bin":(1 * 2)..(4 * 2)']);
  }
});

test("lowering distinguishes define operations from deferred source templates", (t) => {
  const assembler = new Assembler();
  const cases = [
    { source: "!value = 1", reason: "operation" },
    { source: "db <value>", reason: "sourceTemplate" },
  ] as const;

  for (const { source, reason } of cases) {
    const program = assembler.buildProgramModel(source, `${reason}.asm`);
    const lowered = elementAt(assembler.commandLoweringService.lowerProgram(program).nodes, 0);
    t.is(lowered?.kind, reason, source);
  }
});

test("lowered labels share immutable input across execution", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("Entry:", "immutable.asm");
  const sourceCommand = elementAt(program.nodes, 0);
  const lowered = elementAt(assembler.commandLoweringService.lowerProgram(program).nodes, 0);

  t.is(lowered?.kind, "label");
  if (lowered?.kind !== "label" || !sourceCommand || !("source" in sourceCommand)) {
    return;
  }

  t.is(lowered.command, sourceCommand);
  assembler.executeLoweredNode(lowered);
  t.deepEqual(sourceCommand.words, ["Entry:"]);
  t.is(sourceCommand.command, "Entry:");
});

test("Asar @-prefixed directives map to the unprefixed handlers", (t) => {
  const assembler = new Assembler();
  t.true(assembler.directiveRegistry.has("@asar"));
  t.true(assembler.directiveRegistry.has("@includeonce"));

  const program = assembler.buildProgramModel("@asar 1.71\n@includeonce\ndb $01", "pragma.asm");
  const lowered = assembler.commandLoweringService.lowerProgram(program);

  t.is(lowered.nodes[0]?.kind, "pluginSyntax");
  if (lowered.nodes[0]?.kind === "pluginSyntax") {
    t.is(lowered.nodes[0].statement.contributionId, "snes.directive.asar-noops");
  }
  t.is(lowered.nodes[1]?.kind, "pluginSyntax");
  if (lowered.nodes[1]?.kind === "pluginSyntax") {
    t.is(lowered.nodes[1].statement.contributionId, "core.directive.includeonce");
  }

  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    assembler.setWritePosition(0x808000);
    assembler.processCommand("@asar 1.71");
    assembler.processCommand("@includeonce");
    assembler.processCommand("reset bytes");
    assembler.processCommand("db $01");
    assembler.finishPass();
  }

  t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x01]);
});

test("registered lowered dot directives take precedence over sublabel syntax", (t) => {
  const assembler = new Assembler();
  const calls: string[] = [];
  assembler.directiveRegistry.registerTyped(
    ".width",
    ({ text }) => text,
    (value): value is string => typeof value === "string",
    (text) => {
      calls.push(text);
    },
  );
  const program = assembler.buildProgramModel(".width 16", "dot-directive.asm");
  const lowered = elementAt(assembler.commandLoweringService.lowerProgram(program).nodes, 0);
  t.is(lowered?.kind, "pluginSyntax");
  if (lowered?.kind === "pluginSyntax") {
    assembler.dispatchLoweredNode(lowered);
  }
  t.deepEqual(calls, [".width 16"]);
});

test("macro bodies remain immutable source templates until invocation", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel(
    ["macro emit()", "lda #$01", "endmacro"].join("\n"),
    "macro.asm",
  );
  const lowered = assembler.commandLoweringService.lowerProgram(program);

  t.deepEqual(
    lowered.nodes.map((node) => node.kind),
    ["capture"],
  );
  const capture = lowered.nodes[0];
  if (capture.kind !== "capture") {
    t.fail("Expected macro capture");
    return;
  }
  t.is(capture.captureKind, "macro");
  t.is(capture.header.keyword, "macro");
  t.is(capture.footer?.keyword, "endmacro");
  t.like(capture.commands[0], { kind: "macroDefinitionOrInvoke", command: "lda #$01" });
});
