import { spy } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

for (const endianness of ["little", "big"] as const) {
  for (const width of [1, 2, 3, 4]) {
    test(`numeric output emits ${width} low bytes in ${endianness} order`, (t) => {
      const assembler = new Assembler();
      t.teardown(() => assembler.dispose());
      assembler.activateStage("emitProgram");
      const start = assembler.outputWriter.fromOutputOffset(0);
      assembler.cursorAddress.setWritePosition(start);
      const values = [0x0102030405, -2, 0xffffffff];
      const expected = [
        [5, 4, 3, 2],
        [254, 255, 255, 255],
        [255, 255, 255, 255],
      ].flatMap((bytes) => {
        const selected = bytes.slice(0, width);
        return endianness === "little" ? selected : selected.toReversed();
      });
      for (const value of values) {
        assembler.outputWriter.writeValue(value, width, endianness);
      }
      t.deepEqual([...assembler.getBinaryOutput()], expected);
      t.is(assembler.currentTargetAddress, start + values.length * width);
    });
  }
}

test("invalid numeric output leaves bytes, cursor and lifecycle hooks untouched", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.activateStage("emitProgram");
  const start = assembler.outputWriter.fromOutputOffset(0);
  assembler.cursorAddress.setWritePosition(start);
  assembler.outputWriter.writeValue(0x1234, 2);
  const before = [...assembler.getBinaryOutput()];
  const cursor = assembler.currentTargetAddress;
  const validate = spy(assembler.outputWriter, "validateWrite");
  for (const width of [0, -1, 1.5, 5, 32, NaN, Infinity]) {
    t.throws(() => assembler.outputWriter.writeValue(0x0102030405, width), {
      message: /Invalid write width/,
    });
  }
  for (const value of [NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    t.throws(() => assembler.outputWriter.writeValue(value, 2), {
      message: /safe integer/,
    });
  }
  t.throws(
    () =>
      Reflect.apply(assembler.outputWriter.writeValue, assembler.outputWriter, [1, 1, "middle"]),
    {
      message: /Invalid write endianness/,
    },
  );
  t.false(validate.called);
  t.deepEqual([...assembler.getBinaryOutput()], before);
  t.is(assembler.currentTargetAddress, cursor);
  t.is(assembler.currentTargetBaseAddress, cursor);
});
