import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

import { handleFreespace, handleFreespaceByte, handleProt } from "../../src/directives/freespace.js";

test("SNES freespace directives own allocation and fill policy", (t) => {
  const assembler = new Assembler(new Uint8Array(0x90000));
  const state = assembler.targetState;
  assembler.activateStage("emitProgram");

  handleFreespaceByte(assembler, state, ["freespacebyte", "$1A5"]);
  t.is(state.outputFillByte, 0xa5);
  t.is(assembler.outputFillByte, 0xa5);

  handleFreespace(assembler, state, ["freedata"]);
  t.is(state.activeFreespaceStartOffset, 0x90000);
  t.is(state.activeFreespaceContentStartOffset, 0x90008);
  t.deepEqual([...assembler.outputBytes.slice(0x90000, 0x90008)], [
    0x53, 0x54, 0x41, 0x52, 0x00, 0x00, 0xff, 0xff,
  ]);
});

test("SNES freespace policy rejects unsupported contexts", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  state.mapper = "norom";
  t.is(
    t.throws(() => handleFreespace(assembler, state, ["freespace"])).message,
    "No freespace available in norom.",
  );

  state.mapper = "lorom";
  state.inSpcBlock = true;
  t.is(
    t.throws(() => handleFreespace(assembler, state, ["freecode"])).message,
    "freecode is unavailable inside spcblock.",
  );
});

test("SNES PROT emits resolved and deferred address records", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x808000;
  assembler.currentTargetBaseAddress = 0x808000;
  assembler.labelTable.set("known", { value: 0x1234567, isStatic: false });

  t.throws(() => handleProt(assembler, ["prot"]));
  handleProt(assembler, ["prot", "known,", "forward"]);

  t.deepEqual([...assembler.outputBytes.slice(0, 16)], [
    0x50, 0x52, 0x4f, 0x54, 0x06,
    0x67, 0x45, 0x23,
    0x00, 0x00, 0x00,
    0x53, 0x54, 0x4f, 0x50, 0x00,
  ]);
});

test("SNES freespacebyte requires exactly one parameter", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  t.is(
    t.throws(() => handleFreespaceByte(assembler, state, ["freespacebyte"])).message,
    "FREESPACEBYTE requires exactly one parameter.",
  );
  t.is(
    t.throws(() => handleFreespaceByte(assembler, state, ["freespacebyte", "$00", "$01"])).message,
    "FREESPACEBYTE requires exactly one parameter.",
  );
});

test("SNES freespace refuses an unmapped start offset", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  assembler.activateStage("emitProgram");
  state.mapper = "sa1rom";
  state.sa1Banks = [];

  t.is(
    t.throws(() => handleFreespace(assembler, state, ["freespace"])).message,
    "Unable to map freespace start to a logical address.",
  );
});

test("SNES freespace falls back to output length without a base image", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  assembler.activateStage("emitProgram");

  handleFreespace(assembler, state, ["freespace"]);
  t.is(state.activeFreespaceStartOffset, 0x80000);
  t.is(state.activeFreespaceContentStartOffset, 0x80008);
});

test("SNES plugin registers every memory directive alias", (t) => {
  const assembler = new Assembler();
  for (const keyword of ["freecode", "freespace", "freedata", "freespacebyte", "prot"]) {
    t.true(assembler.directiveRegistry.has(keyword));
  }
});
