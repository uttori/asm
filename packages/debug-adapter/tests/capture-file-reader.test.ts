import { test } from "../../../tests/ava-helper.js";
import { CaptureFrameReader } from "../src/capture-file-reader.js";

test("read-ahead handles short reads and frame boundaries without rereading or mutating owned prefixes", async (t) => {
  const source = Buffer.from(Array.from({ length: 300 }, (_, i) => i & 255));
  const requested: number[] = [];
  const reader = new CaptureFrameReader(async (buffer, offset, length, position) => {
    t.true(position + length <= 270);
    requested.push(position);
    const count = Math.min(length, 7);
    source.copy(buffer, offset, position, position + count);
    return { bytesRead: count };
  }, 128);
  const prefix = await reader.read(12, 0, 270);
  t.deepEqual(prefix, source.subarray(0, 12));
  const another = await reader.read(12, 0, 270);
  another.fill(255);
  t.deepEqual(await reader.read(12, 0, 270), source.subarray(0, 12));
  t.deepEqual(await reader.read(110, 12, 270), source.subarray(12, 122));
  t.deepEqual(await reader.read(110, 122, 270), source.subarray(122, 232));
  t.deepEqual(await reader.read(38, 232, 270), source.subarray(232, 270));
  t.deepEqual(prefix, source.subarray(0, 12));
  t.true(requested.every((position, i) => i === 0 || position > requested[i - 1]));
  await t.throwsAsync(reader.read(1, 270, 270), { message: /Torn capture/ });
});

test("read-ahead never turns a premature EOF into zero-filled valid bytes", async (t) => {
  const reader = new CaptureFrameReader(async (buffer, offset) => {
    if (offset) {
      return { bytesRead: 0 };
    }
    buffer.fill(3, 0, 4);
    return { bytesRead: 4 };
  });
  await t.throwsAsync(reader.read(12, 0, 20), { message: /Torn capture/ });
});
