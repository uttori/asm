import { test } from "../../../tests/ava-helper.js";
import { Uint8ArrayDecoderSource } from "../src/decoder-types.js";

test("Uint8ArrayDecoderSource is immutable and bounds-safe", (t) => {
  const input = Uint8Array.of(0x10, 0x20, 0x30);
  const source = new Uint8ArrayDecoderSource(input);
  input[0] = 0xff;

  t.is(source.length, 3);
  t.is(source.readByte(0), 0x10);
  t.is(source.readByte(-1), undefined);
  t.is(source.readByte(3), undefined);
  t.is(source.readByte(0.5), undefined);
  t.deepEqual(source.readBytes(1, 2), Uint8Array.of(0x20, 0x30));
  t.deepEqual(source.readBytes(3, 0), new Uint8Array());
  t.is(source.readBytes(2, 2), undefined);
  t.is(source.readBytes(0, -1), undefined);

  const copy = source.readBytes(0, 1);
  if (copy) copy[0] = 0xee;
  t.is(source.readByte(0), 0x10);
});
