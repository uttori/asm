import { test } from "../ava-helper.js";
import { handleEndSpcblock, handleSpcblock } from "../../src/directives/spc.js";
import type { SpcDirectiveContext } from "../../src/directives/types.js";
import type { LegacySpcRuntimeService } from "../../src/services/legacy-spc-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

test("SPC directives call the injected runtime instead of the assembler", t => {
  const calls: string[][] = [];
  const runtime = {
    handleSpcblock: (words: string[]) => calls.push(words),
    handleEndSpcblock: (words: string[]) => calls.push(words),
  } as LegacySpcRuntimeService;
  const ctx = {
    session: {},
    operandResolver: createOperandResolver(),
    runtime,
  } as SpcDirectiveContext;

  handleSpcblock(ctx, ["spcblock", "$0200"]);
  handleEndSpcblock(ctx, ["endspcblock"]);
  t.deepEqual(calls, [["spcblock", "$0200"], ["endspcblock"]]);
});
