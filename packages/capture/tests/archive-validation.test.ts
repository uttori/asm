import { mkdtemp, writeFile, readFile, rm, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  captureCrc32c,
  readCaptureFileHeader,
  recoverCaptureFile,
  NativeCaptureFileCursor,
  exportCaptureJson,
  validateCaptureMetadata,
  nativePosition,
  type CapturePositionV2,
  type NativeCaptureFilePosition,
} from "../src/index.js";

const session = "0123456789abcdef0123456789abcdef";
const scope = "snes.65816.instructions";
const metadata = {
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "test", revision: "1" },
};
const header = {
  ...metadata,
  session,
  scope,
  clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
  format: "uttori-ares-capture",
  version: 2,
  ownership: "durable-prefix",
  compression: "none",
  checksum: "crc32c",
  maxChunkBytes: 262144,
  allocatedBytes: 4718656,
};
const position = (
  events = "1",
  chunks = "1",
  state: CapturePositionV2["state"] = "complete",
): CapturePositionV2 => ({
  session,
  scope,
  state,
  producedThrough: events,
  deliveredThrough: events,
  acceptedThrough: events,
  durableThrough: events,
  releasedThrough: events,
  chunkThrough: chunks,
  producedChunks: chunks,
  bufferedBytes: 0,
  allocatedBytes: 4718656,
  clockNumerator: "236250000",
  clockDenominator: "11",
  throttleCount: "0",
  droppedInScope: "0",
  error: "",
});
const native = (bytes: number, complete = true): NativeCaptureFilePosition => ({
  ...position("1", "1", complete ? "complete" : "recording"),
  fileState: complete ? "complete" : "writing",
  fileBytes: String(bytes),
  fileBatches: "1",
});

/** Build checksummed wire frames so validation failures exercise contracts after CRC admission. */
function frame(magic: string, value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const prefix = Buffer.alloc(12);
  prefix.write(magic);
  prefix.writeUInt32LE(body.length, 4);
  prefix.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([prefix, body]);
}
/** One real 65816 NOP observation with absolute sequence, cycle and processor-state fields. */
function chunk(sequence = 1n, event = 1n): Buffer {
  const bytes = Buffer.alloc(132);
  bytes.write("ACT2");
  bytes.writeUInt16LE(2, 4);
  Buffer.from(session, "hex").copy(bytes, 8);
  bytes.writeBigUInt64LE(sequence, 24);
  bytes.writeBigUInt64LE(event, 32);
  bytes.writeUInt32LE(1, 40);
  bytes.writeUInt32LE(64, 44);
  bytes.writeUInt32LE(68, 48);
  bytes.writeUInt32LE(68, 52);
  bytes.writeUInt16LE(1, 64);
  bytes.writeUInt16LE(1, 66);
  bytes.writeUInt32LE(68, 68);
  bytes.writeBigUInt64LE(event, 72);
  bytes.writeBigUInt64LE(event * 6n, 88);
  bytes.writeBigUInt64LE(event, 96);
  bytes.writeBigUInt64LE(0x7e0100n, 104);
  bytes[112] = 1;
  bytes.writeUInt16LE(16, 113);
  bytes[115] = 0xea;
  bytes[127] = 0x7e;
  bytes.writeUInt16LE(0x0100, 128);
  bytes[130] = 0x30;
  bytes[131] = 1;
  bytes.writeUInt32LE(captureCrc32c(bytes, true), 56);
  return bytes;
}
const ack = () => frame("ACK2", { session, chunkThrough: "1", eventThrough: "1" });
const archive = (...tail: Uint8Array[]) => Buffer.concat([frame("ACS2", header), ...tail]);

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-archive-contracts-"));
  return { directory, file: path.join(directory, "capture.act2") };
}

test("capture metadata rejects malformed identity and disagreed scope before delivering events", async (t) => {
  const { directory, file } = await fixture();
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  for (const bad of [
    null,
    [],
    { ...metadata, romFileSha256: "bad" },
    { ...metadata, producer: null },
    { ...metadata, producer: { id: "", revision: "1" } },
  ]) {
    t.throws(() => validateCaptureMetadata(bad), { message: /identity/ });
  }
  for (const bad of [
    null,
    { ...header, scope: "nes.2a03.instructions" },
    { ...header, clock: null },
    { ...header, clock: { ...header.clock, id: "other" } },
    { ...header, clock: { ...header.clock, numerator: "0" } },
    { ...header, clock: { ...header.clock, denominator: "0" } },
    ...[0, 4718655, 67108865, 1.5, "4718656"].map((allocatedBytes) =>
      Object.assign({}, header, { allocatedBytes }),
    ),
    { ...header, format: "other" },
    { ...header, version: 1 },
    { ...header, ownership: "other" },
    { ...header, compression: "gzip" },
    { ...header, checksum: "crc32" },
    { ...header, maxChunkBytes: 1 },
  ]) {
    await writeFile(file, frame("ACS2", bad));
    await t.throwsAsync(readCaptureFileHeader(file));
    await t.throwsAsync(recoverCaptureFile(file));
    await t.throwsAsync(NativeCaptureFileCursor.open(file));
  }
  for (const bad of [
    Buffer.alloc(4),
    frame("BAD2", header),
    (() => {
      const bytes = frame("ACS2", header);
      bytes.writeUInt32LE(65537, 4);
      return bytes;
    })(),
    (() => {
      const bytes = frame("ACS2", header);
      bytes[12] ^= 1;
      return bytes;
    })(),
  ]) {
    await writeFile(file, bad);
    await t.throwsAsync(readCaptureFileHeader(file));
    await t.throwsAsync(recoverCaptureFile(file));
    await t.throwsAsync(NativeCaptureFileCursor.open(file));
  }
  await writeFile(file, frame("ACS2", header));
  for (const maxBytes of [0, 0.5, Infinity, 12]) {
    await t.throwsAsync(readCaptureFileHeader(file, { maxBytes }));
    await t.throwsAsync(recoverCaptureFile(file, undefined, { maxBytes }));
  }
});

test("recovery and native cursors reject corrupt frames without promoting provisional events", async (t) => {
  const { directory, file } = await fixture();
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const compressed = chunk();
  compressed.writeUInt16LE(1, 6);
  const oversized = chunk();
  oversized.writeUInt32LE(262144, 48);
  const metadataTooLarge = ack();
  metadataTooLarge.writeUInt32LE(65537, 4);
  const badChecksum = ack();
  badChecksum[12] ^= 1;
  const tails: readonly [readonly Uint8Array[], RegExp][] = [
    [[compressed], /Compressed chunk/],
    [[oversized], /chunk exceeds/],
    [[chunk(2n, 2n)], /Noncontiguous/],
    [[frame("BAD2", {})], /Unknown required|expected an ACT2/],
    [[chunk(), metadataTooLarge], /metadata.*bounds/],
    [[chunk(), badChecksum], /checksum/],
    [[chunk(), frame("ACK2", null)], /Checkpoint|checkpoint/],
    [
      [chunk(), frame("ACK2", { session, chunkThrough: "2", eventThrough: "1" })],
      /Checkpoint|checkpoint/,
    ],
    [[chunk(), chunk()], /Uncommitted|no checkpoint/],
    [[frame("END2", position("0", "0", "recording"))], /Terminal|terminal/],
    [[chunk(), ack(), frame("END2", position("2", "1"))], /Terminal|terminal/],
    [
      [chunk(), ack(), frame("END2", position()), Buffer.alloc(1)],
      /after capture terminal|terminal disagrees/,
    ],
  ];
  for (const [tail, reason] of tails) {
    const bytes = archive(...tail);
    await writeFile(file, bytes);
    const recovery = await recoverCaptureFile(file);
    t.false(recovery.complete);
    t.regex(recovery.reason ?? "", reason);
    const cursor = await NativeCaptureFileCursor.open(file);
    try {
      await t.throwsAsync(
        cursor.readThrough(native(bytes.length), () => {}),
        { message: reason },
      );
      await t.throwsAsync(
        cursor.readThrough(native(bytes.length), () => {}),
        { message: /failed previously/ },
      );
      t.false(cursor.complete);
    } finally {
      await cursor.close();
    }
  }
});

test("native cursors enforce watermarks, poisoned consumers and immutable completion", async (t) => {
  const { directory, file } = await fixture();
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const bytes = archive(chunk(), ack(), frame("END2", position()));
  await writeFile(file, bytes);
  for (const [value, budget, message] of [
    [native(bytes.length), 0, /watermark or chunk budget/],
    [native(bytes.length), 257, /watermark or chunk budget/],
    [native(0), 16, /watermark or chunk budget/],
    [native(bytes.length + 1), 16, /shorter/],
    [native(frame("ACS2", header).length + 1), 16, /splits a frame/],
    [{ ...native(bytes.length, false), fileState: "incomplete" }, 16, /interrupted/],
    [{ ...native(bytes.length), fileBytes: "9007199254740993" }, 16, /watermark/],
  ] as const) {
    const cursor = await NativeCaptureFileCursor.open(file);
    try {
      await t.throwsAsync(
        cursor.readThrough(value, () => {}, budget),
        { message },
      );
    } finally {
      await cursor.close();
    }
  }
  const failure = new Error("Consumer refused staged facts");
  const poisoned = await NativeCaptureFileCursor.open(file);
  try {
    await t.throwsAsync(
      poisoned.readThrough(native(bytes.length), () => {
        throw failure;
      }),
      { is: failure },
    );
  } finally {
    await poisoned.close();
  }
  const cursor = await NativeCaptureFileCursor.open(file);
  try {
    await cursor.readThrough(native(bytes.length), () => {}, 1);
    t.is(cursor.observedEvents, "1");
    t.false(cursor.complete);
    await cursor.readThrough(native(bytes.length), () => {}, 1, file);
    t.true(cursor.complete);
    t.is(cursor.readBytes, bytes.length);
    await t.notThrowsAsync(cursor.readThrough(native(bytes.length), () => {}));
    await t.throwsAsync(
      cursor.readThrough(native(bytes.length, false), () => {}),
      { message: /Completed native capture changed/ },
    );
  } finally {
    await cursor.close();
  }
  const replaced = await NativeCaptureFileCursor.open(file);
  const other = path.join(directory, "replacement.act2");
  await writeFile(other, bytes);
  try {
    await t.throwsAsync(
      replaced.readThrough(native(bytes.length), () => {}, 16, other),
      { message: /replaced the opened file/ },
    );
  } finally {
    await replaced.close();
  }
  const incomplete = archive(chunk(), ack());
  await writeFile(file, incomplete);
  const missingTerminal = await NativeCaptureFileCursor.open(file);
  try {
    await t.throwsAsync(
      missingTerminal.readThrough(native(incomplete.length), () => {}),
      { message: /no terminal/ },
    );
  } finally {
    await missingTerminal.close();
  }
});

test("archive scans preserve consumer failures, report timings and detect changed input", async (t) => {
  const { directory, file } = await fixture();
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const bytes = archive(chunk(), ack(), frame("END2", position()));
  await writeFile(file, bytes);
  const failure = new Error("Budget exhausted");
  await t.throwsAsync(
    recoverCaptureFile(file, () => {
      throw failure;
    }),
    { is: failure },
  );
  const timings = new Set<string>();
  const progress: number[] = [];
  const result = await recoverCaptureFile(file, () => {}, {
    onTiming: (stage) => timings.add(stage),
    onProgress: (read) => progress.push(read),
  });
  t.true(result.complete);
  t.deepEqual([...timings].toSorted(), ["consume", "decode", "read"]);
  t.is(progress.at(-1), bytes.length);
  const changed = await recoverCaptureFile(file, async () => {
    const status = await stat(file);
    await utimes(file, status.atime, new Date(status.mtimeMs + 2000));
  });
  t.false(changed.complete);
  t.regex(changed.reason ?? "", /changed while being read/);
  const destination = path.join(directory, "trace.json");
  await writeFile(destination, "keep me");
  await t.throwsAsync(exportCaptureJson(file, destination, true), {
    message: /Reserved trace destination changed/,
  });
  t.is(await readFile(destination, "utf8"), "keep me");
  await writeFile(destination, "");
  await exportCaptureJson(file, destination, true);
  t.true((await readFile(destination, "utf8")).includes('"addresses":[8257792]'));
});

test("native status profiles and publication state are validated independently of transport", (t) => {
  const valid = native(100);
  for (const bad of [
    { ...valid, fileState: "unknown" },
    { ...valid, fileProfile: [] },
    { ...valid, state: "recording" },
  ]) {
    t.throws(() => nativePosition(bad), { message: /native file|publication/ });
  }
  t.deepEqual(
    nativePosition({
      ...valid,
      fileProfile: { sealNs: "1", copyNs: "2", writeNs: "3", syncNs: "4" },
    }).fileProfile,
    { sealNs: "1", copyNs: "2", writeNs: "3", syncNs: "4" },
  );
});
