import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

import { createSpcRuntime } from "../../src/directives/spc.js";

test("SPC block runtime switches architecture and restores it on close", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  const runtime = createSpcRuntime(assembler, state);

  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.true(state.inSpcBlock);
  t.is(assembler.arch, "spc700");

  assembler.asblock_pick(["mov", "$12", "#$34"]);
  runtime.handleEndSpcblock(["endspcblock"]);

  t.false(state.inSpcBlock);
  t.is(assembler.arch, "65816");
});

test("SPC block directives validate nesting and lifecycle closure", (t) => {
  const assembler = new Assembler();
  const runtime = createSpcRuntime(assembler, assembler.targetState);

  t.throws(() => runtime.handleEndSpcblock(["endspcblock"]), {
    message: /without an active spcblock/,
  });
  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.throws(() => runtime.handleSpcblock(["spcblock", "$0300"]), {
    message: /nested spcblock/i,
  });
});
