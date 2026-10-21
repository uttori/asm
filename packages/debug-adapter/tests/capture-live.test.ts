import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { captureFixtureHeader } from "../../../tests/helpers/capture-archive.js";
import {
  busChunk,
  busJsonFrame,
  busPosition,
  busScope,
  busSession,
} from "../../../tests/helpers/capture-bus.js";
import { NativeCaptureFileCursor, recoverCaptureFile, type NativeCaptureFilePosition,captureCrc32c } from "@uttori/asm-capture";


const header = busJsonFrame("ACS2", { ...captureFixtureHeader, scope: busScope });
const pair = (n: number) =>
  Buffer.concat([
    busChunk([{}], BigInt(n), BigInt(n)),
    busJsonFrame("ACK2", { session: busSession, chunkThrough: String(n), eventThrough: String(n) }),
  ]);
const position = (bytes: number, n: number, complete = false): NativeCaptureFilePosition => ({
  ...busPosition(String(n), String(n), complete ? "complete" : "recording"),
  fileState: complete ? "complete" : "writing",
  fileBytes: String(bytes),
  fileBatches: String(n),
});
const fixture = (t: { teardown: (fn: () => void) => void }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "capture-live-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "capture.act2");
};

test("sliced CRC agrees with an independent bitwise reader, including checksum words and tails", (t) => {
  for (const length of [...Array.from({ length: 80 }, (_, i) => i), 255, 1024, 262144]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 137 + (i >>> 3)) & 255);
    const original = bytes.slice();
    for (const zero of [false, true]) {
      let crc = 0xffffffff;
      for (let i = 0; i < length; i++) {
        crc ^= zero && i >= 56 && i < 60 ? 0 : bytes[i];
        for (let bit = 0; bit < 8; bit++) {
          crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
        }
      }
      t.is(captureCrc32c(bytes, zero), ~crc >>> 0);
      t.deepEqual(bytes, original);
    }
  }
});

test("live cursor ignores visible unsynced checkpoints and reads each durable chunk once", async (t) => {
  const file = fixture(t);
  const prefix = Buffer.concat([header, pair(1)]);
  fs.writeFileSync(file + ".partial", Buffer.concat([prefix, pair(2)]));
  const cursor = await NativeCaptureFileCursor.open(file + ".partial");
  const seen: string[] = [];
  try {
    const accept = (chunk: { through: string }) => {
      seen.push(chunk.through);
    };
    await cursor.readThrough(position(prefix.length, 1), accept);
    await cursor.readThrough(position(prefix.length, 1), accept);
    t.deepEqual(seen, ["1"]);
    t.false(cursor.complete);
    const all = Buffer.concat([
      prefix,
      pair(2),
      busJsonFrame("END2", busPosition("2", "2", "complete")),
    ]);
    fs.appendFileSync(file + ".partial", all.subarray(prefix.length + pair(2).length));
    fs.linkSync(file + ".partial", file);
    fs.unlinkSync(file + ".partial");
    await cursor.readThrough(position(all.length, 2, true), accept, 1, file);
    t.deepEqual(seen, ["1", "2"]);
    t.false(cursor.complete);
    await cursor.readThrough(position(all.length, 2, true), accept, 1, file);
    t.true(cursor.complete);
  } finally {
    await cursor.close();
  }
});

test("live cursor rejects split/regressing watermarks, corrupt tails and replaced publication", async (t) => {
  for (const failure of [
    "split",
    "regress",
    "corrupt",
    "replace",
    "missing-end",
    "session",
  ] as const) {
    const file = fixture(t);
    const prefix = Buffer.concat([header, pair(1)]);
    const tail = busJsonFrame("END2", busPosition("1", "1", "complete"));
    if (failure === "corrupt") {
      tail[12] ^= 1;
    }
    const all = Buffer.concat([prefix, failure === "missing-end" ? Buffer.alloc(0) : tail]);
    fs.writeFileSync(file, all);
    const cursor = await NativeCaptureFileCursor.open(file);
    try {
      await cursor.readThrough(position(prefix.length, 1), () => undefined);
      if (failure === "replace") {
        fs.renameSync(file, file + ".old");
        fs.writeFileSync(file, all);
      }
      let p = position(all.length, 1, true);
      if (failure === "split") {
        p = position(prefix.length + 1, 1);
      }
      if (failure === "regress") {
        p = position(header.length, 0);
      }
      if (failure === "session") {
        p = { ...p, session: "f".repeat(32) };
      }
      await t.throwsAsync(cursor.readThrough(p, () => undefined, 16, file));
      await t.throwsAsync(
        cursor.readThrough(position(all.length, 1, true), () => undefined),
        { message: /failed previously/ },
      );
    } finally {
      await cursor.close();
    }
  }
});

test("live read-ahead never hides a future frame changed between slices", async (t) => {
  const file = fixture(t);
  const prefix = Buffer.concat([header, pair(1)]);
  const all = Buffer.concat([
    prefix,
    pair(2),
    busJsonFrame("END2", busPosition("2", "2", "complete")),
  ]);
  fs.writeFileSync(file, all);
  const cursor = await NativeCaptureFileCursor.open(file);
  try {
    const seen: string[] = [];
    const accept = (chunk: { through: string }) => seen.push(chunk.through);
    const complete = position(all.length, 2, true);
    await cursor.readThrough(complete, accept, 1, file);
    all[prefix.length + 64] ^= 1;
    fs.writeFileSync(file, all);
    await t.throwsAsync(cursor.readThrough(complete, accept, 1, file), { message: /checksum/ });
    t.deepEqual(seen, ["1"]);
  } finally {
    await cursor.close();
  }
});

test("live buffered checkpoints service queued cancellation before terminal publication", async (t) => {
  const file = fixture(t);
  const all = Buffer.concat([
    header,
    pair(1),
    busJsonFrame("END2", busPosition("1", "1", "complete")),
  ]);
  fs.writeFileSync(file, all);
  const cancellation = new AbortController();
  const cursor = await NativeCaptureFileCursor.open(file, { signal: cancellation.signal });
  try {
    await t.throwsAsync(
      cursor.readThrough(
        position(all.length, 1, true),
        () => {
          // Simulate a control message queued by the first progress callback. A chain
          // of fulfilled buffered reads must not run through END2 before servicing it.
          setImmediate(() => cancellation.abort());
        },
        16,
        file,
      ),
      { name: "AbortError" },
    );
    t.false(cursor.complete);
    await t.throwsAsync(
      cursor.readThrough(position(all.length, 1, true), () => {}, 16, file),
      { message: /failed previously/ },
    );
  } finally {
    await cursor.close();
  }
});

test("offline buffered checkpoints service queued cancellation before returning completion", async (t) => {
  const file = fixture(t);
  fs.writeFileSync(
    file,
    Buffer.concat([header, pair(1), busJsonFrame("END2", busPosition("1", "1", "complete"))]),
  );
  const cancellation = new AbortController();
  await t.throwsAsync(
    recoverCaptureFile(
      file,
      () => {
        setImmediate(() => cancellation.abort());
      },
      { signal: cancellation.signal },
    ),
    { name: "AbortError" },
  );
});
