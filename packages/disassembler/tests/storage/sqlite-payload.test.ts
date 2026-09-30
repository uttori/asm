import { randomBytes } from "node:crypto";
import { runInNewContext } from "node:vm";
import { crc32, deflateSync } from "node:zlib";

import { test } from "../../../../tests/ava-helper.js";
import {
  decodeSqlitePayload,
  encodeSqlitePayload,
  decodeSqliteRuntimeIdentity,
  sqliteRuntimeIdentity,
  MAX_SQLITE_PAYLOAD_BYTES,
  parseSqlitePayload,
} from "../../src/storage/sqlite-payload.js";
import {
  encodePackedRuntimePayload,
  decodePackedRuntimePayload,
  type PackedRuntimePayload,
} from "../../src/storage/sqlite-runtime-payload.js";

test("packed runtime snapshots preserve full registers, field presence and instruction bytes", (t) => {
  const payloads: PackedRuntimePayload[] = [
    { state: {} },
    { state: { a: 0, p: 0xff, e: 1 } },
    {
      bytes: [0, 255, 0, 128],
      state: {
        a: 65535,
        d: 65535,
        db: 255,
        e: 0,
        p: 0x31,
        pb: 255,
        pc: 65535,
        s: 65535,
        x: 65535,
        y: 0,
      },
    },
  ];
  for (const payload of payloads) {
    const encoded = encodePackedRuntimePayload(payload)!;
    t.truthy(encoded);
    t.deepEqual(decodePackedRuntimePayload(encoded), payload);
    t.deepEqual(parseSqlitePayload(encoded), payload);
    t.deepEqual(JSON.parse(decodeSqlitePayload(encoded)), payload);
    const foreign: unknown = runInNewContext("new Uint8Array(bytes)", { bytes: [...encoded] });
    t.deepEqual(parseSqlitePayload(foreign), payload);
  }
  const fallbackStates: PackedRuntimePayload["state"][] = [
    { A: 1 },
    { e: true },
    { a: "unknown" },
    { db: -1 },
    { x: 65536 },
    { e: 2 },
    { p: 1.5 },
    { extra: 7 },
  ];
  for (const state of fallbackStates) {
    t.is(encodePackedRuntimePayload({ bytes: [0xea], state }), undefined);
  }
  for (const bytes of [[], [256], [1, 2, 3, 4, 5], Array<number>(2)]) {
    t.is(encodePackedRuntimePayload({ bytes, state: {} }), undefined);
  }
});

test("packed runtime decoder rejects corruption, truncation and noncanonical layouts", (t) => {
  const original = encodePackedRuntimePayload({ bytes: [0xea], state: { e: 1, a: 32768 } })!;
  for (let offset = 0; offset < original.length; offset++) {
    t.throws(() => decodePackedRuntimePayload(original.subarray(0, offset)));
    const corrupt = Buffer.from(original);
    corrupt[offset] ^= 0x80;
    t.throws(() => decodePackedRuntimePayload(corrupt));
  }
  t.throws(() => decodePackedRuntimePayload(Buffer.concat([original, Buffer.from([0])])));
  const invalid = encodePackedRuntimePayload({ state: { e: 1 } })!;
  invalid[7] = 2;
  invalid.writeUInt32LE(crc32(invalid.subarray(0, invalid.length - 4)), invalid.length - 4);
  t.throws(() => decodePackedRuntimePayload(invalid), { message: /emulation/ });
});

test("SQLite payload codec preserves text and compresses large Unicode JSON losslessly", (t) => {
  for (const json of [
    '{"zero":0,"false":false}',
    JSON.stringify({ text: "日本語😀".repeat(1000), absent: undefined }),
    JSON.stringify({ random: randomBytes(512).toString("hex") }),
  ]) {
    t.is(decodeSqlitePayload(encodeSqlitePayload(json)), json);
  }
  t.is(typeof encodeSqlitePayload("{}"), "string");
  const repeated = JSON.stringify({ state: "repeated metadata ".repeat(1000) });
  const encoded = encodeSqlitePayload(repeated);
  t.true(encoded instanceof Buffer);
  t.true(encoded.length < repeated.length / 4);
  // Earlier writers compressed small records too. Changing the write cutoff must not strand them.
  const small = JSON.stringify({ text: "metadata ".repeat(50) });
  t.is(encodeSqlitePayload(small), small);
  const header = Buffer.from([0x55, 0x41, 0x50, 1, 0, 0, 0, 0]);
  header.writeUInt32LE(Buffer.byteLength(small), 4);
  t.is(decodeSqlitePayload(Buffer.concat([header, deflateSync(small)])), small);
});

test("SQLite payload codec rejects corrupt, unsupported and oversized compressed records", (t) => {
  const encoded = encodeSqlitePayload(JSON.stringify({ text: "a".repeat(2000) })) as Buffer;
  const corrupt = Buffer.from(encoded);
  corrupt[corrupt.length - 1] ^= 0xff;
  t.throws(() => decodeSqlitePayload(corrupt), { message: /Corrupt/ });
  const version = Buffer.from(encoded);
  version[3] = 2;
  t.throws(() => decodeSqlitePayload(version), { message: /Unsupported/ });
  t.throws(() => decodeSqlitePayload(encoded.subarray(0, 8)), { message: /truncated/ });
  const oversized = Buffer.from(encoded);
  oversized.writeUInt32LE(MAX_SQLITE_PAYLOAD_BYTES + 1, 4);
  t.throws(() => decodeSqlitePayload(oversized), { message: /size limit/ });
  const understated = Buffer.from(encoded);
  understated.writeUInt32LE(1, 4);
  t.throws(() => decodeSqlitePayload(understated), { message: /Corrupt/ });
  const invalidUtf8 = Buffer.concat([
    Buffer.from([0x55, 0x41, 0x50, 1, 1, 0, 0, 0]),
    deflateSync(Buffer.from([0xff])),
  ]);
  t.throws(() => decodeSqlitePayload(invalidUtf8), { message: /Corrupt/ });
  t.throws(() => decodeSqlitePayload(null), { message: /representation/ });
  t.throws(() => encodeSqlitePayload("x".repeat(MAX_SQLITE_PAYLOAD_BYTES + 1)), {
    message: /payload limit/,
  });
});

test("runtime identity encoding is lossless for hash, arbitrary, uppercase and Unicode IDs", (t) => {
  for (const id of [
    "a".repeat(64),
    `capture:${"a".repeat(64)}`,
    `capture:${"A".repeat(64)}`,
    "prefix:日本語😀",
    "without-colon",
    "a:b:c",
    "a:",
    "",
    "prefix:\u0000suffix",
  ]) {
    const encoded = sqliteRuntimeIdentity(id);
    t.is(decodeSqliteRuntimeIdentity(encoded.prefix, encoded.suffix), id);
  }
  t.is((sqliteRuntimeIdentity(`capture:${"a".repeat(64)}`).suffix as Buffer).length, 32);
  t.is(typeof sqliteRuntimeIdentity(`capture:${"A".repeat(64)}`).suffix, "string");
  t.throws(() => decodeSqliteRuntimeIdentity("prefix:", Buffer.alloc(31)), { message: /suffix/ });
});

test("SQLite binary values remain readable across extension VM realms", (t) => {
  const json = JSON.stringify({ text: "compressed metadata".repeat(1000) });
  const encoded = encodeSqlitePayload(json) as Buffer;
  const foreign: unknown = runInNewContext("new Uint8Array(bytes)", { bytes: [...encoded] });
  t.is(decodeSqlitePayload(foreign), json);
  const hash: unknown = runInNewContext("new Uint8Array(32).fill(0xab)");
  t.is(decodeSqliteRuntimeIdentity("prefix:", hash), `prefix:${"ab".repeat(32)}`);
});
