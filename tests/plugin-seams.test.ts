import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";
import type { LoweredOperand } from "../src/architecture-types.js";
import { createNormalizedCommand } from "../src/ir/normalized-command.js";

const commandNode = (command: string) => createNormalizedCommand(
  command,
  command,
  command.trim().split(/\s+/),
  "plugin-seam.asm",
  1,
);

test("disposable architecture registration participates in lowering and dispatch", (t) => {
  const assembler = new Assembler();
  const classified: string[] = [];
  const encoded: string[][] = [];

  assembler.architectureRegistry.register({
    name: "contract-test",
    classifyOperand: (_resolver, operand): LoweredOperand => {
      classified.push(operand);
      return {
        raw: operand,
        expanded: operand,
        length: 1,
        immediate: false,
        indirect: false,
      };
    },
    splitOperands: (operandText) => operandText.split(",").map((operand) => operand.trim()),
    unknownInstructionBehavior: "throw",
    encoder: {
      estimateSize: () => 1,
      encode: (words) => {
        encoded.push(words);
        return true;
      },
    },
  }, ["contract-alias"]);
  assembler.arch = "contract-alias";

  const lowered = assembler.commandLoweringService.lowerCommand(commandNode("emit left,right"));
  t.is(lowered.kind, "instruction");
  if (lowered.kind !== "instruction") {
    return;
  }
  t.deepEqual(lowered.operands, ["left", "right"]);
  t.deepEqual(classified, ["left", "right", "left,right"]);

  assembler.activateStage("emitProgram");
  assembler.dispatchLoweredNode(lowered);
  t.deepEqual(encoded, [["emit", "left,right"]]);
});

test("disposable directive registration remains preprocessing passthrough", (t) => {
  const assembler = new Assembler();
  const calls: Array<{ value: string; raw: string }> = [];
  const context = { prefix: "seen:" };
  assembler.directiveRegistry.register("contract-directive", context, (ctx, words, raw) => {
    calls.push({ value: `${ctx.prefix}${words[1]}`, raw });
  });

  const lowered = assembler.commandLoweringService.lowerExecutableNode(
    commandNode("contract-directive value"),
  );
  t.is(lowered.kind, "command");
  if (lowered.kind !== "command") {
    return;
  }
  t.is(lowered.passthroughReason, "registeredPreprocessDirective");

  assembler.executeLoweredNode(lowered);
  t.deepEqual(calls, [{ value: "seen:value", raw: "contract-directive value" }]);
});
