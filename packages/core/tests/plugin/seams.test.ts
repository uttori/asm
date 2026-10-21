import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

test("registered architecture grammar and typed execution share the source occurrence", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const parsed: string[] = [],
    encoded: string[] = [];
  assembler.architectureRegistry.register(
    {
      name: "contract-test",
      operandGrammar: {
        version: "1",
        parse: (_mnemonic, text) => {
          parsed.push(text);
          return { operands: [] };
        },
      },
      unknownInstructionBehavior: "throw",
      encoder: {
        typed: {
          estimate: (frame) => {
            frame.choose("test", 1);
            return 1;
          },
          encode: (frame) => {
            frame.choose("test", 1);
            encoded.push(frame.instruction.mnemonic);
            return true;
          },
        },
      },
    },
    ["contract-alias"],
  );
  assembler.arch = "contract-alias";
  const lowered = assembler.commandLoweringService.lowerCommand(
    assembler.createNormalizedCommandFromRaw("emit left,right")!,
  );
  t.is(lowered.kind, "typedInstruction");
  assembler.activateStage("emitProgram");
  assembler.dispatchLoweredNode(lowered);
  t.deepEqual(parsed, ["left,right"]);
  t.deepEqual(encoded, ["emit"]);
});

test("registered directives execute their parsed payload with source ownership", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const calls: string[] = [];
  assembler.directiveRegistry.registerTyped(
    "contract-directive",
    ({ words }) => words[1],
    (value): value is string => typeof value === "string",
    (value, command) => calls.push(`seen:${value}:${command.source.raw}`),
  );
  const program = assembler.buildProgramModel("contract-directive value", "plugin-seam.asm");
  const lowered = assembler.commandLoweringService.lowerProgram(program).nodes[0];
  t.is(lowered.kind, "pluginSyntax");
  assembler.executeLoweredNode(lowered);
  t.deepEqual(calls, ["seen:value:contract-directive value"]);
});
