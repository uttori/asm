#!/usr/bin/env node
/**
 * Read-only ACT2 storage experiment. Samples evenly spaced complete chunks, checks
 * their existing decoder, and verifies every codec/transform round trip byte for byte.
 * No compressed archive is published: modeled sizes omit future format negotiation.
 * Requires Node with Zstandard support and the built debug-adapter package.
 * Usage: node scripts/research/benchmark-capture-compression.mjs [--chunks=128]
 *   [--repeats=3] [--output=report.json] capture.act2 [...]
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openSync, closeSync, readSync, fstatSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { relative } from "node:path";
import { performance } from "node:perf_hooks";
import * as zlib from "node:zlib";

import { readCaptureFileHeader } from "../../packages/debug-adapter/dist/capture-file.js";
import { captureCrc32c, decodeCaptureChunk } from "../../packages/debug-adapter/dist/capture-v2.js";

/** @type {{chunks: number, repeats: number, output: string | undefined}} */
const options = { chunks: 128, repeats: 3, output: undefined };
const files = [];
for (const argument of process.argv.slice(2)) {
  if (argument.startsWith("--output=")) {
    options.output = argument.slice(9);
  } else if (argument.startsWith("--chunks=")) {
    options.chunks = Number(argument.slice(9));
  } else if (argument.startsWith("--repeats=")) {
    options.repeats = Number(argument.slice(10));
  } else if (argument.startsWith("--")) {
    throw new Error(`Unknown option: ${argument}`);
  } else {
    files.push(argument);
  }
}
for (const key of ["chunks", "repeats"]) {
  assert(Number.isSafeInteger(options[key]) && options[key] > 0, `${key} must be positive`);
}
assert(files.length > 0, "Provide at least one existing ACT2 archive.");
assert.equal(typeof zlib.zstdCompressSync, "function", "Node Zstandard support is required.");

/**
 * Read an exact component at an absolute offset; never accept a zero-filled short read.
 * @param {number} fd Caller-owned read-only file descriptor.
 * @param {number} length Required byte count.
 * @param {number} offset Absolute byte position.
 * @returns {Buffer} Owned, fully initialized component.
 */
function readAt(fd, length, offset) {
  const bytes = Buffer.allocUnsafe(length);
  let received = 0;
  while (received < length) {
    const count = readSync(fd, bytes, received, length - received, offset + received);
    assert(count > 0, `Truncated archive at ${offset + received}`);
    received += count;
  }
  return bytes;
}

/**
 * Check all framing/checkpoints and index payload offsets without reading every payload.
 * CRC and semantic record validation are performed separately for selected chunks only.
 * @param {number} fd Caller-owned descriptor.
 * @param {number} size Initial archive size in bytes.
 * @param {import('../../packages/debug-adapter/dist/capture-file.js').CaptureFileHeader} header Validated session identity.
 * @returns {{chunks: {offset: number, length: number, count: number}[], payloadBytes: number, events: string}} Positions and declared totals of checkpointed chunks.
 */
function indexArchive(fd, size, header) {
  const chunks = [];
  let offset = 0;
  let pending;
  let event = 0n;
  let ended = false;
  let payloadBytes = 0;
  while (offset < size) {
    const prefix = readAt(fd, 12, offset);
    const magic = prefix.toString("ascii", 0, 4);
    if (magic === "ACT2") {
      assert(!pending && !ended, "Unexpected chunk before ACK or after END");
      const envelope = readAt(fd, 64, offset);
      const length = envelope.readUInt32LE(48);
      assert(length > 0 && length <= 262144 - 64);
      assert.equal(envelope.readUInt32LE(52), length);
      assert.equal(envelope.readUInt16LE(4), 2);
      assert.equal(envelope.readUInt16LE(6), 0);
      assert.equal(envelope.readUInt32LE(44), 64);
      assert.equal(envelope.readUInt32LE(60), 0);
      assert.equal(envelope.toString("hex", 8, 24), header.session);
      assert.equal(envelope.readBigUInt64LE(24), BigInt(chunks.length + 1));
      assert.equal(envelope.readBigUInt64LE(32), event + 1n);
      assert(envelope.readUInt32LE(40) > 0);
      event += BigInt(envelope.readUInt32LE(40));
      pending = { offset, length, count: envelope.readUInt32LE(40) };
      chunks.push(pending);
      payloadBytes += length;
      offset += 64 + length;
      continue;
    }
    assert(["ACS2", "ACK2", "END2"].includes(magic), `Unexpected frame ${magic}`);
    const length = prefix.readUInt32LE(4);
    assert(length <= 65536 && offset + 12 + length <= size);
    const body = readAt(fd, length, offset + 12);
    assert.equal(captureCrc32c(body), prefix.readUInt32LE(8));
    /** @type {unknown} */
    const value = JSON.parse(body.toString("utf8"));
    assert(value !== null && typeof value === "object" && "session" in value);
    assert.equal(value.session, header.session);
    if (magic === "ACS2") {
      assert.equal(offset, 0);
    }
    if (magic === "ACK2") {
      assert(pending, "ACK without a pending chunk");
      assert("chunkThrough" in value && "eventThrough" in value);
      assert.equal(value.chunkThrough, String(chunks.length));
      assert.equal(value.eventThrough, String(event));
      pending = undefined;
    }
    if (magic === "END2") {
      assert(!pending && !ended);
      assert("state" in value && "producedChunks" in value && "producedThrough" in value);
      assert.equal(value.state, "complete");
      assert.equal(value.producedChunks, String(chunks.length));
      assert.equal(value.producedThrough, String(event));
      assert.equal(offset + 12 + length, size);
      ended = true;
    }
    offset += 12 + length;
  }
  assert(ended && chunks.length > 0, "Archive has no complete terminal/chunks");
  return { chunks, payloadBytes, events: String(event) };
}

/**
 * Group equal byte positions from fixed 128-byte NES records into contiguous columns.
 * This permutation preserves every field, event order and reserved byte, including
 * mixed kind-4/kind-5 payloads. It needs no state from another chunk.
 * @param {Buffer} bytes Whole records or their transposed columns.
 * @param {boolean} inverse Restore row order when true; transpose by default.
 * @returns {Buffer} Independently owned permutation of the input bytes.
 */
function shuffle(bytes, inverse = false) {
  assert.equal(bytes.length % 128, 0);
  const count = bytes.length / 128;
  const out = Buffer.allocUnsafe(bytes.length);
  for (let column = 0; column < 128; column++) {
    for (let row = 0; row < count; row++) {
      if (inverse) {
        out[row * 128 + column] = bytes[column * count + row];
      } else {
        out[column * count + row] = bytes[row * 128 + column];
      }
    }
  }
  return out;
}

/**
 * Count byte cost by record kind and graphics relevance without inferring hardware events.
 * @param {Buffer[]} chunks Semantically validated ACT2 chunks, including envelopes.
 * @returns {{counts: Record<string, number>, bytesByKind: Record<string, number>, zeroBytes: number, cycleSpan: string, nesBus: number, relevantNesBus: number}} Sample counts and summed within-chunk observer clock spans.
 */
function describeChunks(chunks) {
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, number>} */
  const bytesByKind = {};
  let cycleSpan = 0n;
  let zeroBytes = 0;
  let relevantNesBus = 0;
  let nesBus = 0;
  for (const chunk of chunks) {
    const payload = chunk.subarray(64);
    for (const byte of payload) {
      if (byte === 0) {
        zeroBytes++;
      }
    }
    let first;
    let last;
    for (let offset = 0; offset < payload.length;) {
      const kind = payload.readUInt16LE(offset);
      const length = payload.readUInt32LE(offset + 4);
      assert(length >= 32 && offset + length <= payload.length);
      let label = `kind-${kind}/${length}`;
      if (kind === 5) {
        label += `/timeline-${payload[offset + 56]}`;
      }
      counts[label] = (counts[label] ?? 0) + 1;
      bytesByKind[label] = (bytesByKind[label] ?? 0) + length;
      if (kind === 4) {
        nesBus++;
        const address = payload.readUInt16LE(offset + 42);
        const write = payload[offset + 45] === 1;
        // This is only a scope-sizing experiment. Removing other reads would
        // lose provenance and cannot be advertised as the existing lossless scope.
        if (
          (address >= 0x2000 && address < 0x4000) ||
          (write && (address === 0x4014 || address >= 0x8000)) ||
          payload[offset + 102]
        ) {
          relevantNesBus++;
        }
      }
      const cycle = payload.readBigUInt64LE(offset + 24);
      first ??= cycle;
      last = cycle;
      offset += length;
    }
    cycleSpan += last - first;
  }
  return { counts, bytesByKind, zeroBytes, cycleSpan: String(cycleSpan), nesBus, relevantNesBus };
}

/**
 * Median of repeated wall-clock measurements; allocation and transform time stay included.
 * @param {number[]} values Nonempty measurements in milliseconds.
 * @returns {number} Middle measurement, choosing the upper middle for an even count.
 */
function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Benchmark independent chunk payloads with raw fallback for incompressible blocks.
 * Timings exclude source I/O, CRC, existing event decoding and equality checks.
 * This is a synchronous JS microbenchmark, not emulator throughput or a file writer.
 * @param {Buffer[]} payloads Uncompressed record bodies without ACT2 envelopes.
 * @param {Codec} codec Independent compression and decompression operations.
 * @param {boolean} transformed Transpose fixed 128-byte records before compression.
 * @param {number} repeats Positive measurement count after warmup.
 * @returns {object} Stored byte totals, median timings and exact round-trip evidence.
 */
function benchmark(payloads, codec, transformed, repeats) {
  /** @type {(bytes: Buffer) => Buffer} */
  const encode = (bytes) => codec.compress(transformed ? shuffle(bytes) : bytes);
  /** @type {(bytes: Buffer) => Buffer} */
  const decode = (bytes) => {
    const plain = codec.decompress(bytes);
    return transformed ? shuffle(plain, true) : plain;
  };
  // Warm up the codec and transform without letting the warmup affect reported times.
  assert(payloads[0].equals(decode(encode(payloads[0]))));
  const encodeTimes = [];
  const decodeTimes = [];
  const total = payloads.reduce((sum, bytes) => sum + bytes.length, 0);
  let storedBytes = 0;
  let rawFallbackChunks = 0;
  for (let repeat = 0; repeat < repeats; repeat++) {
    let encodeMs = 0;
    let decodeMs = 0;
    storedBytes = 0;
    rawFallbackChunks = 0;
    for (const bytes of payloads) {
      let start = performance.now();
      const compressed = encode(bytes);
      encodeMs += performance.now() - start;
      start = performance.now();
      const restored = decode(compressed);
      decodeMs += performance.now() - start;
      assert(bytes.equals(restored), `${codec.name} round trip mismatch`);
      // Preserve raw bytes when compression expands. The future envelope must
      // distinguish raw/compressed and shuffled/unshuffled payloads explicitly.
      storedBytes += Math.min(bytes.length, compressed.length);
      if (compressed.length >= bytes.length) {
        rawFallbackChunks++;
      }
    }
    encodeTimes.push(encodeMs);
    decodeTimes.push(decodeMs);
  }
  const encodeMs = median(encodeTimes);
  const decodeMs = median(decodeTimes);
  return {
    codec: codec.name,
    transform: transformed ? "byte-shuffle-128" : "none",
    storedBytes,
    rawFallbackChunks,
    rawToStoredRatio: total / storedBytes,
    reductionPercent: 100 * (1 - storedBytes / total),
    encodeMs,
    decodeMs,
    encodeMiBPerSecond: total / 1048576 / (encodeMs / 1000),
    decodeMiBPerSecond: total / 1048576 / (decodeMs / 1000),
    roundTripVerified: true,
  };
}

/**
 * Each codec starts fresh for every chunk so recovery never depends on earlier data.
 * @typedef {{name: string, compress: (bytes: Buffer) => Buffer, decompress: (bytes: Buffer) => Buffer}} Codec
 */
/** @type {Codec[]} */
const codecs = [];
for (const level of [1, 3]) {
  codecs.push({
    name: `zstd-${level}`,
    compress: (bytes) =>
      zlib.zstdCompressSync(bytes, {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: level },
      }),
    decompress: (bytes) => zlib.zstdDecompressSync(bytes, { maxOutputLength: 262144 }),
  });
}
for (const level of [1, 6]) {
  codecs.push({
    name: `deflate-${level}`,
    compress: (bytes) => zlib.deflateRawSync(bytes, { level }),
    decompress: (bytes) => zlib.inflateRawSync(bytes, { maxOutputLength: 262144 }),
  });
}

const reports = [];
for (const file of files) {
  console.error(`Sampling ${file}`);
  const header = await readCaptureFileHeader(file);
  const fd = openSync(file, "r");
  try {
    const before = fstatSync(fd);
    const index = indexArchive(fd, before.size, header);
    const count = Math.min(options.chunks, index.chunks.length);
    const selected = [];
    for (let i = 0; i < count; i++) {
      let ordinal = 0;
      if (count > 1) {
        ordinal = Math.round((i * (index.chunks.length - 1)) / (count - 1));
      }
      selected.push(index.chunks[ordinal]);
    }
    const chunks = selected.map(({ offset, length }) => readAt(fd, length + 64, offset));
    for (const chunk of chunks) {
      decodeCaptureChunk(chunk, header.session, header.scope);
    }
    const after = fstatSync(fd);
    assert.equal(before.size, after.size);
    assert.equal(before.mtimeMs, after.mtimeMs, "Input changed while sampling");
    const digest = createHash("sha256");
    for (const chunk of chunks) {
      digest.update(chunk);
    }
    const payloads = chunks.map((chunk) => chunk.subarray(64));
    const payloadBytes = payloads.reduce((sum, bytes) => sum + bytes.length, 0);
    const description = describeChunks(chunks);
    const sampledSeconds =
      (Number(description.cycleSpan) * Number(header.clock.denominator)) /
      Number(header.clock.numerator);
    const results = [];
    for (const codec of codecs) {
      results.push(benchmark(payloads, codec, false, options.repeats));
      if (header.scope === "nes.cpu-bus-ppu") {
        results.push(benchmark(payloads, codec, true, options.repeats));
      }
    }
    reports.push({
      file: relative(process.cwd(), file),
      bytes: before.size,
      mtimeMs: before.mtimeMs,
      header,
      totalChunks: index.chunks.length,
      totalEvents: index.events,
      totalPayloadBytes: index.payloadBytes,
      framingBytes: before.size - index.payloadBytes,
      sampledChunks: count,
      allPayloadsValidated: count === index.chunks.length,
      sampledChunkOffsets: selected.map((chunk) => chunk.offset),
      sampledChunksSha256: digest.digest("hex"),
      sampledPayloadBytes: payloadBytes,
      sampledSeconds,
      rawPayloadMiBPerEmulatedSecond: payloadBytes / 1048576 / sampledSeconds,
      description,
      results,
    });
  } finally {
    closeSync(fd);
  }
}
const output =
  JSON.stringify(
    {
      format: "uttori-capture-compression-research",
      version: 1,
      createdAt: new Date().toISOString(),
      node: process.version,
      zstd: process.versions.zstd,
      zlib: process.versions.zlib,
      cpu: cpus()[0]?.model,
      options,
      methodology:
        "Evenly spaced chunks; independent payload frames; median timings; all round trips checked. Framing and checkpoints scanned throughout; only sampled payloads have CRC/record validation. Rates use summed first-to-last CPU observer spans within sampled chunks. No disk I/O/fsync/CRC/event decode in codec timings. No whole-file compression.",
      reports,
    },
    null,
    2,
  ) + "\n";
if (options.output) {
  writeFileSync(options.output, output, { flag: "wx" });
} else {
  process.stdout.write(output);
}
