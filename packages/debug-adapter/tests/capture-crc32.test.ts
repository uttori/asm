import { test } from "../../../tests/ava-helper.js";
import { captureCrc32c } from "../src/capture-v2.js";

/** Independent bitwise Castagnoli oracle, including view-relative ACT2 masking. */
function reference(bytes: Uint8Array, zeroChecksum: boolean): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    let byte = bytes[index];
    if (zeroChecksum && index >= 56 && index < 60) {
      byte = 0;
    }
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
    }
  }
  return ~crc >>> 0;
}

test("capture CRC32C masks only existing ACT2 checksum bytes without mutating offset views", (t) => {
  for (const length of [0, 1, 7, 8, 55, 56, 57, 59, 60, 63, 64, 65, 262144]) {
    const backing = Buffer.from(Uint8Array.from({ length: length + 13 }, (_, i) => (i * 71) & 255));
    const before = Buffer.from(backing);
    const bytes = backing.subarray(7, 7 + length);
    for (const zero of [false, true]) {
      t.is(captureCrc32c(bytes, zero), reference(bytes, zero));
    }
    t.deepEqual(backing, before);
  }
});
