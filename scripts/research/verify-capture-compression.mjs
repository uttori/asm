/** Verify native raw/Zstandard benchmark pairs with bounded, byte-exact payload hashing. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decodeCaptureChunkBytes, recoverCaptureFile, captureCrc32c } from "@uttori/asm-capture";

/**
 * Read exactly one bounded field at the descriptor's current position.
 * @param {number} fd Open file descriptor owned by the caller.
 * @param {number} length Required bytes, at most one ACT2 chunk.
 * @returns {Buffer} Complete field; a truncated read throws.
 */
function read(fd, length) {
  assert(length >= 0 && length <= 262144);
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const count = fs.readSync(fd, bytes, offset, length - offset, null);
    assert(count > 0, "Unexpected EOF");
    offset += count;
  }
  return bytes;
}

/**
 * Hash only restored event bytes so differing session IDs and chunk boundaries do not mask loss.
 * @param {string} file Native benchmark archive; never modified.
 * @returns {{bytes: number, chunks: number, compressed: number, payloadBytes: number, payloadSha256: string, fileSha256: string}} Physical/decoded sizes and exact-byte identities.
 */
function inspect(file) {
  const fd = fs.openSync(file, "r");
  const bytes = fs.fstatSync(fd).size;
  let offset = 0,
    chunks = 0,
    compressed = 0,
    payloadBytes = 0;
  const payload = createHash("sha256");
  const physical = createHash("sha256");
  try {
    while (offset < bytes) {
      const prefix = read(fd, 12);
      let frame;
      if (prefix.toString("ascii", 0, 4) === "ACT2") {
        const envelope = Buffer.concat([prefix, read(fd, 52)]);
        assert(envelope.readUInt32LE(48) <= 262080);
        frame = Buffer.concat([envelope, read(fd, envelope.readUInt32LE(48))]);
        const raw = decodeCaptureChunkBytes(frame);
        payload.update(raw.subarray(64));
        payloadBytes += raw.length - 64;
        chunks++;
        if (frame.readUInt16LE(6)) {
          compressed++;
        }
      } else {
        const body = read(fd, prefix.readUInt32LE(4));
        assert.equal(captureCrc32c(body), prefix.readUInt32LE(8));
        frame = Buffer.concat([prefix, body]);
      }
      physical.update(frame);
      offset += frame.length;
    }
    assert.equal(offset, bytes);
  } finally {
    fs.closeSync(fd);
  }
  return {
    bytes,
    chunks,
    compressed,
    payloadBytes,
    payloadSha256: payload.digest("hex"),
    fileSha256: physical.digest("hex"),
  };
}

const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
const directories = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
assert(
  output && directories.length,
  "Usage: node --conditions=uttori-source --import=tsx scripts/research/verify-capture-compression.mjs --output=report.json /tmp/benchmark-directory [...]",
);
const results = [];
/** Native benchmark output; counters remain decimal strings to preserve exact u64 values.
 * @typedef {{mode: string, stateEqual: boolean, position: null | {producedThrough: string, durableThrough: string, droppedInScope: string, state: string}}} Run
 */
/**
 * Validate the fields consumed from local benchmark logs; retain extra profiling fields.
 * @param {string} json One RESULT payload from the native harness.
 * @returns {Run} Validated run with exact counters.
 */
function parseRun(json) {
  /** @type {unknown} */
  const value = JSON.parse(json);
  assert(value && typeof value === "object" && "mode" in value && typeof value.mode === "string");
  assert("stateEqual" in value && typeof value.stateEqual === "boolean" && "position" in value);
  const position = value.position;
  if (position !== null) {
    assert(position && typeof position === "object");
    assert("producedThrough" in position && typeof position.producedThrough === "string");
    assert("durableThrough" in position && typeof position.durableThrough === "string");
    assert("droppedInScope" in position && typeof position.droppedInScope === "string");
    assert("state" in position && typeof position.state === "string");
    // Materialize validated fields explicitly: spreading the unknown object loses their narrowed types.
    return {
      ...value,
      mode: value.mode,
      stateEqual: value.stateEqual,
      position: {
        ...position,
        producedThrough: position.producedThrough,
        durableThrough: position.durableThrough,
        droppedInScope: position.droppedInScope,
        state: position.state,
      },
    };
  }
  return { ...value, mode: value.mode, stateEqual: value.stateEqual, position };
}
for (const directory of directories) {
  const runs = fs
    .readFileSync(`${directory}.log`, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("RESULT "))
    .map((line) => parseRun(line.slice(7)));
  assert.equal(runs.length, 3);
  /** @type {Record<string, ReturnType<typeof inspect> & {recovery?: Awaited<ReturnType<typeof recoverCaptureFile>>}>} */
  const pair = {};
  for (const mode of ["none", "zstd"]) {
    const file = path.join(directory, `${mode}.act2`);
    const evidence = inspect(file);
    // The first sample additionally uses the production semantic/checkpoint reader.
    // Every sample still validates every physical CRC/frame and all restored payload bytes.
    let recovery;
    if (directory.endsWith("-1")) {
      recovery = await recoverCaptureFile(file);
      assert(recovery.complete, recovery.reason ?? "Capture recovery is incomplete");
      const run = runs.find((entry) => entry.mode === mode);
      assert(run?.position, `Missing capture position for ${mode}`);
      assert.equal(recovery.eventThrough, run.position.producedThrough);
    }
    pair[mode] = { ...evidence, recovery };
  }
  assert.equal(pair.none.payloadBytes, pair.zstd.payloadBytes);
  assert.equal(
    pair.none.payloadSha256,
    pair.zstd.payloadSha256,
    "Capture mode changed event evidence",
  );
  assert(pair.zstd.compressed > 0 && pair.none.compressed === 0);
  for (const run of runs.filter((entry) => entry.position)) {
    assert(run.position);
    assert.equal(run.position.droppedInScope, "0");
    assert.equal(run.position.state, "complete");
    assert.equal(run.position.producedThrough, run.position.durableThrough);
    assert(run.stateEqual);
  }
  results.push({ directory, runs, evidence: pair });
  process.stdout.write(`Verified ${directory}: ${pair.zstd.payloadSha256}\n`);
}
fs.writeFileSync(
  output,
  `${JSON.stringify({ date: new Date().toISOString(), platform: os.platform(), architecture: os.arch(), cpu: os.cpus()[0].model, node: process.version, results }, null, 2)}\n`,
);
