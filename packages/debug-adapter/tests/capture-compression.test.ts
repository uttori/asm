import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import {
  captureFixtureHeader,
  writeCaptureFixture,
} from "../../../tests/helpers/capture-archive.js";
import {
  busChunk,
  busJsonFrame,
  busPosition,
  busSession,
} from "../../../tests/helpers/capture-bus.js";
import { writeNesCaptureFixture } from "../../../tests/helpers/nes-capture.js";
import { compressCaptureChunk, decodeCaptureChunkBytes } from "../src/capture-compression.js";
import { NativeCaptureFileCursor, recoverCaptureFile } from "../src/capture-file.js";
import { captureCrc32c, decodeCaptureChunk, type CaptureChunkV2 } from "../src/capture-v2.js";

/** Recalculate the physical checksum to isolate framing errors from corruption errors. */
function checksum(bytes: Buffer): Buffer {
  bytes.writeUInt32LE(captureCrc32c(bytes, true), 56);
  return bytes;
}

/** Encode a complete legacy fixture using new storage while leaving event/checkpoint identity intact. */
function compressedArchive(raw: Buffer): Buffer {
  const frames: Buffer[] = [];
  for (let offset = 0; offset < raw.length;) {
    const magic = raw.toString("ascii", offset, offset + 4);
    const length =
      magic === "ACT2" ? 64 + raw.readUInt32LE(offset + 48) : 12 + raw.readUInt32LE(offset + 4);
    const frame = raw.subarray(offset, offset + length);
    if (magic === "ACS2") {
      const header: unknown = JSON.parse(frame.subarray(12).toString());
      if (!header || typeof header !== "object") {
        throw new Error("Invalid fixture header");
      }
      frames.push(busJsonFrame(magic, { ...header, compression: "zstd" }));
    } else if (magic === "ACT2") {
      frames.push(compressCaptureChunk(frame));
    } else {
      frames.push(frame);
    }
    offset += length;
  }
  return Buffer.concat(frames);
}

test("compressed chunks restore every byte at the maximum bound and preserve exact u64 identities", (t) => {
  const first = 9007199254740993n;
  const raw = busChunk(
    Array.from({ length: 4095 }, () => ({})),
    1n,
    first,
  );
  const before = Buffer.from(raw);
  const stored = compressCaptureChunk(raw);
  t.is(stored.readUInt16LE(6), 1);
  t.true(stored.length < raw.length / 4);
  t.deepEqual(raw, before);
  t.deepEqual(decodeCaptureChunkBytes(stored), raw);
  t.deepEqual(
    decodeCaptureChunk(stored, busSession, "snes.cpu-bus"),
    decodeCaptureChunk(raw, busSession, "snes.cpu-bus"),
  );
  // A subarray's byte offset must not change CRC or decompressor boundaries.
  const surrounded = Buffer.concat([Buffer.alloc(17), stored, Buffer.alloc(23)]);
  t.deepEqual(decodeCaptureChunkBytes(surrounded.subarray(17, 17 + stored.length)), raw);
});

test("incompressible chunks fall back to raw without exceeding the original chunk allocation", (t) => {
  const raw = busChunk(Array.from({ length: 4095 }, () => ({})));
  randomBytes(raw.length - 64).copy(raw, 64);
  checksum(raw);
  const stored = compressCaptureChunk(raw);
  t.is(stored.readUInt16LE(6), 0);
  t.deepEqual(stored, raw);
  t.deepEqual(decodeCaptureChunkBytes(stored), raw);
});

test("compressed framing rejects unsupported codecs, bombs, dictionaries, trailing data and corruption", (t) => {
  const stored = compressCaptureChunk(busChunk(Array.from({ length: 1024 }, () => ({}))));
  const mutations: ((bytes: Buffer) => void)[] = [
    (bytes) => bytes.writeUInt16LE(2, 6),
    (bytes) => bytes.writeUInt32LE(262081, 52),
    (bytes) => bytes.writeUInt32LE(0, 52),
    (bytes) => bytes.writeUInt32LE(64, 52),
    (bytes) => {
      bytes[68] |= 1;
    }, // dictionary flag
    (bytes) => {
      bytes[68] &= ~0x20;
    }, // unbounded external window descriptor
    (bytes) => {
      bytes[68] |= 8;
    }, // reserved descriptor bit
    (bytes) => {
      bytes[64] ^= 1;
    },
  ];
  for (const mutate of mutations) {
    const bytes = Buffer.from(stored);
    mutate(bytes);
    t.throws(() => decodeCaptureChunkBytes(checksum(bytes)));
  }
  const corrupt = Buffer.from(stored);
  corrupt[corrupt.length - 1] ^= 1;
  t.throws(() => decodeCaptureChunkBytes(corrupt), { message: /checksum/ });
  for (const suffix of [Buffer.from([0]), stored.subarray(64)]) {
    const extra = Buffer.concat([stored, suffix]);
    extra.writeUInt32LE(extra.length - 64, 48);
    t.throws(() => decodeCaptureChunkBytes(checksum(extra)), { message: /trailing/ });
  }
  const truncated = Buffer.from(stored.subarray(0, stored.length - 1));
  truncated.writeUInt32LE(truncated.length - 64, 48);
  t.throws(() => decodeCaptureChunkBytes(checksum(truncated)), { message: /Truncated|missing/ });
  t.throws(() => decodeCaptureChunk(stored, "f".repeat(32), "snes.cpu-bus"), {
    message: /session/,
  });
});

test("legacy and compressed NES instructions, NES graphics and SNES instructions recover identical evidence", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "capture-codecs-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const snes = path.join(directory, "snes.act2");
  const nes = path.join(directory, "nes.act2");
  await writeCaptureFixture(snes, 8000);
  writeNesCaptureFixture(nes, { sha256: "a".repeat(64), contentSha256: "b".repeat(64) });
  for (const file of [snes, nes, `${nes}.context/graphics.act2`]) {
    const raw = await readFile(file);
    const encoded = compressedArchive(raw);
    const destination = `${file}.compressed`;
    await writeFile(destination, encoded);
    const expected: CaptureChunkV2[] = [];
    const actual: CaptureChunkV2[] = [];
    const old = await recoverCaptureFile(file, (chunk) => {
      expected.push(chunk);
    });
    const newer = await recoverCaptureFile(destination, (chunk) => {
      actual.push(chunk);
    });
    t.true(old.complete);
    t.true(newer.complete);
    t.is(newer.header.compression, "zstd");
    t.deepEqual(actual, expected);
    t.true(encoded.length < raw.length);
  }
});

test("mixed raw/compressed sessions retain only acknowledged prefixes across every torn frame boundary", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "capture-prefix-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "mixed.act2");
  const header = busJsonFrame("ACS2", {
    ...captureFixtureHeader,
    scope: "snes.cpu-bus",
    compression: "zstd",
  });
  const raw = busChunk([{}]);
  const first = Buffer.concat([
    header,
    raw,
    busJsonFrame("ACK2", { session: busSession, chunkThrough: "1", eventThrough: "1" }),
  ]);
  const compressed = compressCaptureChunk(
    busChunk(
      Array.from({ length: 32 }, () => ({})),
      2n,
      2n,
    ),
  );
  const second = Buffer.concat([
    compressed,
    busJsonFrame("ACK2", { session: busSession, chunkThrough: "2", eventThrough: "33" }),
  ]);
  const end = busJsonFrame("END2", busPosition("33", "2", "complete"));
  const full = Buffer.concat([first, second, end]);
  // Exercise every byte of the encoded chunk and its checkpoint, not only a clean EOF.
  for (let n = first.length; n < first.length + second.length; n++) {
    await writeFile(file, full.subarray(0, n));
    const recovered = await recoverCaptureFile(file);
    t.false(recovered.complete);
    t.is(recovered.eventThrough, "1");
  }
  await writeFile(file, Buffer.concat([first, second]));
  t.is((await recoverCaptureFile(file)).eventThrough, "33");
  await writeFile(file, full);
  t.true((await recoverCaptureFile(file)).complete);
  const cursor = await NativeCaptureFileCursor.open(file);
  try {
    const seen: string[] = [];
    await cursor.readThrough(
      {
        ...busPosition("1", "1", "recording"),
        fileState: "writing",
        fileBytes: String(first.length),
        fileBatches: "1",
      },
      (chunk) => {
        seen.push(chunk.through);
      },
    );
    t.deepEqual(seen, ["1"]);
    await cursor.readThrough(
      {
        ...busPosition("33", "2", "complete"),
        fileState: "complete",
        fileBytes: String(full.length),
        fileBatches: "2",
      },
      (chunk) => {
        seen.push(chunk.through);
      },
      16,
      file,
    );
    t.true(cursor.complete);
    t.deepEqual(seen, ["1", "33"]);
  } finally {
    await cursor.close();
  }
  // Raw declarations cannot silently expand the session's negotiated representation.
  const legacyHeader = busJsonFrame("ACS2", { ...captureFixtureHeader, scope: "snes.cpu-bus" });
  await writeFile(file, Buffer.concat([legacyHeader, full.subarray(header.length)]));
  const rejected = await recoverCaptureFile(file);
  t.false(rejected.complete);
  t.is(rejected.eventThrough, "1");
  t.regex(rejected.reason!, /uncompressed capture session/);
});
