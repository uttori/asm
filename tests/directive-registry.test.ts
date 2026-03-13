import sinon from "sinon";
import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";

test("directive registry dispatches fill aliases", t => {
  const assembler = new Assembler();
  const handled = (assembler as any).directiveRegistry.dispatch("fillword", ["fillword", "$1234"], "fillword $1234");

  t.true(handled);
  t.deepEqual(assembler.fillbyte.slice(0, 6), [0x34, 0x12, 0x34, 0x12, 0x34, 0x12]);
});

test("directive registry reuses shared data handler for aliases", t => {
  const assembler = new Assembler();
  const spy = sinon.spy(assembler, "handleDataDirective");
  sinon.stub(assembler, "addAddressToLine");

  const handled = (assembler as any).directiveRegistry.dispatch("dc.w", ["dc.w", "$1234"], "dc.w $1234");

  t.true(handled);
  t.true(spy.calledOnceWithExactly("dc.w", ["$1234"]));
});

test("directive registry returns false for unknown directives", t => {
  const assembler = new Assembler();
  const handled = (assembler as any).directiveRegistry.dispatch("not-a-directive", ["not-a-directive"], "not-a-directive");

  t.false(handled);
});

test("directive registry dispatches struct and incbin directives", t => {
  const assembler = new Assembler();
  const structSpy = sinon.stub(assembler, "handleStruct");
  const incbinSpy = sinon.stub(assembler, "handleIncbin");

  const handledStruct = (assembler as any).directiveRegistry.dispatch("struct", ["struct", "Sprite"], "struct Sprite");
  const handledIncbin = (assembler as any).directiveRegistry.dispatch("incbin", ["incbin", "test.bin"], 'incbin "test.bin"');

  t.true(handledStruct);
  t.true(handledIncbin);
  t.true(structSpy.calledOnceWithExactly(["struct", "Sprite"]));
  t.true(incbinSpy.calledOnceWithExactly(["incbin", "test.bin"]));
});

test("processCommand routes extracted directives through the registry", t => {
  const assembler = new Assembler();
  assembler.setCurrentFile("test.asm");
  assembler.includedFiles.set("test.asm", { included: true, guarded: false });
  const opcodeSpy = sinon.spy(assembler, "asblock_pick");
  sinon.stub(assembler, "addAddressToLine");

  assembler.processCommand("includeonce");

  t.true(assembler.includedFiles.get("test.asm")?.guarded ?? false);
  t.false(opcodeSpy.called);
});

test("processCommand preserves check bankcross behavior", t => {
  const assembler = new Assembler();
  sinon.stub(assembler, "addAddressToLine");

  assembler.processCommand("check bankcross half");
  t.is(assembler.bankCrossCheckMode, "half");

  assembler.processCommand("check bankcross on");
  t.is(assembler.bankCrossCheckMode, "full");
});
