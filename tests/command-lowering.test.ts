import { test } from "./ava-helper.js";

import { Assembler } from "./test-assembler.js";

test("command lowering preserves loop structure and typed children", t => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel([
    "for i = 0..2",
    "fillbyte $00",
    "endfor",
    "while 0",
    "db $01",
    "endwhile",
  ].join("\n"), "loops.asm");

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const forLoop = lowered.nodes[0];
  const whileLoop = lowered.nodes[1];

  t.is(forLoop?.kind, "loop");
  if (forLoop?.kind === "loop") {
    t.is(forLoop.loopType, "for");
    t.is(forLoop.variable, "i");
    t.truthy(forLoop.rangeNode);
    t.is(forLoop.header?.source.file, "loops.asm");
    t.is(forLoop.commands[0]?.kind, "directive");
  }

  t.is(whileLoop?.kind, "loop");
  if (whileLoop?.kind === "loop") {
    t.is(whileLoop.loopType, "while");
    t.truthy(whileLoop.conditionNode);
    t.is(whileLoop.commands[0]?.kind, "command");
    if (whileLoop.commands[0]?.kind === "command") {
      t.is(whileLoop.commands[0].passthroughReason, "dataDirective");
    }
  }
});

test("command lowering preserves if elseif and else branches", t => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel([
    "if 0",
    "fillbyte $01",
    "elseif 1",
    "fillbyte $02",
    "else",
    "fillbyte $03",
    "endif",
  ].join("\n"), "conditional.asm");

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const conditional = lowered.nodes[0];

  t.is(conditional?.kind, "conditional");
  if (conditional?.kind !== "conditional") {
    return;
  }
  t.deepEqual(conditional.branches.map(branch => branch.kind), ["if", "elseif", "else"]);
  t.truthy(conditional.branches[0]?.conditionNode);
  t.truthy(conditional.branches[1]?.conditionNode);
  t.falsy(conditional.branches[2]?.conditionNode);
  for (const branch of conditional.branches) {
    t.is(branch.commands[0]?.kind, "directive");
  }
});

test("include and incbin metadata survives the direct lowering boundary", t => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel([
    'include "shared file.asm"',
    'incbin "data.bin":(1 * 2)..(4 * 2)',
  ].join("\n"), "include.asm");

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  const include = lowered.nodes[0];
  const incbin = lowered.nodes[1];

  t.is(include?.kind, "directive");
  if (include?.kind === "directive") {
    t.is(include.keyword, "include");
    t.deepEqual(include.words, ["include", '"shared file.asm"']);
    t.is(include.command?.parsed.includeTarget?.target, '"shared file.asm"');
  }

  t.is(incbin?.kind, "directive");
  if (incbin?.kind === "directive") {
    t.is(incbin.keyword, "incbin");
    t.truthy(incbin.command?.parsed.incbinRange);
    t.deepEqual(incbin.command?.parsed.directiveArgs?.args, ['"data.bin":(1 * 2)..(4 * 2)']);
  }
});

test("lowered passthrough nodes name their preprocessing requirement", t => {
  const assembler = new Assembler();
  const cases = [
    { source: "!value = 1", reason: "defineCommand" },
    { source: "Label:", reason: "labelDefinition" },
    { source: "function add(a, b) = a + b", reason: "functionDefinition" },
    { source: "db $01", reason: "dataDirective" },
    { source: "db <value>", reason: "macroPlaceholder" },
    { source: "FillByte = $EE", reason: "staticAssignment" },
  ] as const;

  for (const { source, reason } of cases) {
    const program = assembler.buildProgramModel(source, `${reason}.asm`);
    const lowered = assembler.commandLoweringService.lowerProgram(program).nodes[0];
    t.is(lowered?.kind, "command", source);
    if (lowered?.kind === "command") {
      t.is(lowered.passthroughReason, reason, source);
    }
  }
});

test("lowered passthrough shares immutable input and dispatch mutates only its execution copy", t => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("Entry:", "immutable.asm");
  const sourceCommand = program.nodes[0];
  const lowered = assembler.commandLoweringService.lowerProgram(program).nodes[0];

  t.is(lowered?.kind, "command");
  if (lowered?.kind !== "command" || !sourceCommand || !("source" in sourceCommand)) {
    return;
  }

  t.is(lowered.command, sourceCommand);
  assembler.executeLoweredNode(lowered);
  t.deepEqual(sourceCommand.words, ["Entry:"]);
  t.is(sourceCommand.command, "Entry:");
});

test("Asar @-prefixed directives map to the unprefixed handlers", t => {
  const assembler = new Assembler();
  t.true(assembler.directiveRegistry.has("@asar"));
  t.true(assembler.directiveRegistry.has("@includeonce"));

  const program = assembler.buildProgramModel(
    "@asar 1.71\n@includeonce\ndb $01",
    "pragma.asm",
  );
  const lowered = assembler.commandLoweringService.lowerProgram(program);

  t.is(lowered.nodes[0]?.kind, "directive");
  if (lowered.nodes[0]?.kind === "directive") {
    t.is(lowered.nodes[0].keyword, "asar");
  }
  t.is(lowered.nodes[1]?.kind, "directive");
  if (lowered.nodes[1]?.kind === "directive") {
    t.is(lowered.nodes[1].keyword, "includeonce");
  }

  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    assembler.setWritePosition(0x808000);
    assembler.assembleblock("@asar 1.71");
    assembler.assembleblock("@includeonce");
    assembler.assembleblock("reset bytes");
    assembler.assembleblock("db $01");
    assembler.finishPass();
  }

  t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x01]);
});

test("instruction-looking macro body lines remain preprocessing passthrough", t => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel([
    "macro emit()",
    "lda #$01",
    "endmacro",
  ].join("\n"), "macro.asm");
  const lowered = assembler.commandLoweringService.lowerProgram(program);

  t.deepEqual(lowered.nodes.map(node => node.kind), ["command", "command", "command"]);
  for (const node of lowered.nodes) {
    if (node.kind === "command") {
      t.is(node.passthroughReason, "macroDefinitionOrInvoke");
    }
  }
});
