import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";

import { cloneSnesSessionState } from "../src/session-state.js";

test("cloneSnesSessionState copies nested banks, cpu stack, and an open SPC block", (t) => {
  const assembler = new Assembler();
  const original = assembler.targetState;
  original.cpuStack.push("snes.65816");
  original.spcBlock = {
    destination: 0x200,
    type: "nspc",
    sizeAddress: 0x8000,
    executeAddress: 0xabcd,
    namespaceBackup: "outer",
  };

  const cloned = cloneSnesSessionState(original);
  t.false(cloned.sa1Banks === original.sa1Banks);
  t.false(cloned.cpuStack === original.cpuStack);
  t.false(cloned.spcBlock === original.spcBlock);
  t.deepEqual(cloned.spcBlock, original.spcBlock);

  cloned.sa1Banks[0] = 99;
  cloned.cpuStack.push("snes.spc700");
  cloned.spcBlock!.destination = 0x300;
  t.is(original.sa1Banks[0], 0);
  t.deepEqual(original.cpuStack, ["snes.65816"]);
  t.is(original.spcBlock?.destination, 0x200);
});

test("cloneSnesSessionState keeps a null SPC block null", (t) => {
  const assembler = new Assembler();
  t.is(assembler.targetState.spcBlock, null);
  const cloned = cloneSnesSessionState(assembler.targetState);
  t.is(cloned.spcBlock, null);
  t.false(cloned.sa1Banks === assembler.targetState.sa1Banks);
});
