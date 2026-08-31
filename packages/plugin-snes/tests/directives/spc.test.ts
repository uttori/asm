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

test("SPC block open rejects bad destinations and unimplemented types", (t) => {
  const assembler = new Assembler();
  const runtime = createSpcRuntime(assembler, assembler.targetState);

  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock"])).message,
    "spcblock requires at least a destination address.",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$0200", "nspc", "macro", "extra"])).message,
    "spcblock has too many arguments.",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$10000"])).message,
    "spcblock destination must be 16-bit, got: $10000",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$0200", "custom"])).message,
    "Custom spcblock mode requires a macro and is not implemented.",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$0200", "raw"])).message,
    "Unknown spcblock type: raw",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$0200", "nspc", "macro"])).message,
    "Unexpected spcblock argument for type: nspc",
  );
  t.is(
    t.throws(() => runtime.handleSpcblock(["spcblock", "$0200", "custom", "macro"])).message,
    "Custom spcblock mode is not implemented.",
  );

  runtime.handleSpcblock(["spcblock", "$0300", "nspc"]);
  t.true(assembler.targetState.inSpcBlock);
  t.is(assembler.targetState.spcBlock?.destination, 0x300);
});

test("SPC block close validates trailer syntax and startpos execute", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  const runtime = createSpcRuntime(assembler, state);

  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.is(
    t.throws(() => runtime.handleEndSpcblock(["endspcblock", "nspc", "$0200"])).message,
    "Invalid endspcblock argument: nspc",
  );

  t.is(
    t.throws(() => runtime.handleEndSpcblock(["endspcblock", "execute"])).message,
    "Unknown endspcblock format.",
  );

  if (!state.spcBlock) {
    t.fail("expected an open spcblock");
    return;
  }
  state.spcBlock.type = "custom";
  t.is(
    t.throws(() => runtime.handleEndSpcblock(["endspcblock"])).message,
    "Custom spcblock mode is not implemented.",
  );
  state.spcBlock.type = "nspc";
  state.spcBlock.executeAddress = 0x1234;
  runtime.handleEndSpcblock(["endspcblock"]);
  t.false(state.inSpcBlock);
  t.is(state.spcBlock, null);
});

test("SPC block close rejects an unmapped size address on finalize", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0;
  assembler.currentTargetBaseAddress = 0;
  const runtime = createSpcRuntime(assembler, assembler.targetState);

  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.is(
    t.throws(() => runtime.handleEndSpcblock(["endspcblock"])).message,
    "spcblock size address does not map to output.",
  );
});

test("SPC finishPass errors when an explicit block is still open", (t) => {
  const assembler = new Assembler();
  const runtime = createSpcRuntime(assembler, assembler.targetState);

  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.is(
    t.throws(() => runtime.finishPass()).message,
    "Missing endspcblock before end of pass.",
  );
});

test("SPC finishPass auto-closes an inline-compatibility block", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  state.spcInlineCompatibility = true;
  const runtime = createSpcRuntime(assembler, state);

  runtime.handleSpcblock(["spcblock", "$0200"]);
  t.true(state.inSpcBlock);
  runtime.finishPass();
  t.false(state.inSpcBlock);
});
