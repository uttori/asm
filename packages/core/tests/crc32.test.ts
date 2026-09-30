import { crc32 } from "node:zlib";

import { test } from "../../../tests/ava-helper.js";
import { CRC32 } from "../src/crc32.js";

test("CRC32 facade preserves unsigned values, byte views and numeric-array inputs", (t) => {
  t.is(CRC32.compute(new Uint8Array()), 0);
  t.is(CRC32.compute(Buffer.from("123456789")), 0xcbf43926);
  for (const length of [1, 7, 8, 9, 15, 16, 17, 255, 256, 1023, 65536]) {
    const backing = Uint8Array.from({ length: length + 13 }, (_, i) => (i * 71 + i * i) & 255);
    const before = backing.slice();
    const bytes = backing.subarray(7, length + 7);
    t.is(CRC32.compute(bytes), crc32(bytes));
    t.is(CRC32.compute([...bytes]), crc32(bytes));
    t.deepEqual(backing, before);
  }
  const table = CRC32.makeCRCTable();
  t.is(table.length, 256);
  t.is(table[1], 0x77073096);
  t.deepEqual(table, CRC32.table);
  t.not(table, CRC32.table);
});
