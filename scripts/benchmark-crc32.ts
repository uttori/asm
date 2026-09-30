import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32 as nativeCrc32, inflateSync } from "node:zlib";

import { CRC32 } from "../packages/core/src/crc32.js";
import { captureCrc32c } from "../packages/debug-adapter/src/capture-v2.js";

/** Checksums accepted from either the installed release or an explicitly supplied build. */
interface CrcModule {
  compute(input: string | Uint8Array): number;
  computeBytes(input: Uint8Array): number;
  crc32cBytes(input: Uint8Array, zeroChecksum?: boolean): number;
}

/** Exact production input, with UTF-8 preparation performed outside byte-only measurements. */
interface Workload {
  readonly name: string;
  readonly provenance: string;
  readonly input: string | Uint8Array;
  readonly bytes: Uint8Array;
}

const output = process.argv[2];
if (!output) {
  throw new Error("Usage: benchmark-crc32.ts OUTPUT [CRC_MODULE]");
}
const moduleSpecifier = process.argv[3];
let moduleUrl = "@uttori/data-tools/data-hash-crc32";
if (moduleSpecifier) {
  moduleUrl = pathToFileURL(resolve(moduleSpecifier)).href;
}
const crc = (await import(moduleUrl)) as CrcModule;
const workloads: Workload[] = [];

/**
 * Keep input identity and correctness evidence alongside each timing.
 * @param {string} name Stable workload identifier.
 * @param {string} provenance Production source of these exact bytes.
 * @param {string | Uint8Array} input Strings are encoded once for the byte-only candidates.
 */
function add(name: string, provenance: string, input: string | Uint8Array): void {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  workloads.push({ name, provenance, input, bytes });
}

const sourcePath = "packages/core/src/crc32.ts";
add("filename-basename", sourcePath, basename(sourcePath));
add("filename-relative", sourcePath, sourcePath);
add("filename-absolute", sourcePath, resolve(sourcePath));
for (const path of [sourcePath, "packages/language-server/src/server.ts"]) {
  add(`source-bytes:${path}`, path, readFileSync(path));
}
add("source-utf8-string", sourcePath, readFileSync(sourcePath, "utf8"));
const pngPath = "packages/assets/tests/fixtures/indexed-4bpp.png";
const png = readFileSync(pngPath);
for (let offset = 8; offset < png.length;) {
  const length = png.readUInt32BE(offset);
  const type = png.toString("ascii", offset + 4, offset + 8);
  if (type === "IHDR" || type === "IDAT") {
    add(`png-${type}`, `${pngPath}:${offset + 4}`, png.subarray(offset + 4, offset + 8 + length));
  }
  offset += length + 12;
}

// Read immutable evidence without changing SQLite or materializing a capture archive.
const databasePath = "secret-of-mana/disassembly/analysis/analysis.sqlite";
const database = new DatabaseSync(databasePath, { readOnly: true });
const packed = new Map<number, Uint8Array>();
let history: Uint8Array | undefined;
try {
  for (const row of database
    .prepare("SELECT id, payload FROM runtime_history LIMIT 32")
    .iterate()) {
    const encoded = Buffer.from(row.payload as Uint8Array);
    const body = inflateSync(encoded.subarray(16));
    if (!history || body.length > history.length) {
      history = body;
    }
    for (let index = 0; index < encoded.readUInt32LE(4); index++) {
      const start = body.readUInt32LE(index * 4);
      const end = body.readUInt32LE((index + 1) * 4);
      if (body.toString("ascii", start + 1, start + 4) === "UAR") {
        // The persisted checksum is excluded exactly as in the production codec.
        const bytes = body.subarray(start + 1, end - 4);
        if (!packed.has(bytes.length)) {
          packed.set(bytes.length, bytes);
        }
      }
    }
  }
} finally {
  database.close();
}
assert(packed.size && history, "The research database must contain packed registers and history.");
for (const [length, bytes] of packed) {
  add(`sqlite-packed-registers-${length}`, databasePath, bytes);
}
add("sqlite-inflated-history", databasePath, history);

const capturePath = "secret-of-mana/disassembly/captures/enter-witch-castle.act2";
const file = openSync(capturePath, "r");
let chunk: Buffer;
let header: Buffer;
try {
  const prefix = Buffer.alloc(12);
  assert.equal(readSync(file, prefix, 0, 12, 0), 12);
  assert.equal(prefix.toString("ascii", 0, 4), "ACS2");
  header = Buffer.alloc(prefix.readUInt32LE(4));
  assert.equal(readSync(file, header, 0, header.length, 12), header.length);
  const offset = 12 + header.length;
  const envelope = Buffer.alloc(64);
  assert.equal(readSync(file, envelope, 0, 64, offset), 64);
  assert.equal(envelope.toString("ascii", 0, 4), "ACT2");
  chunk = Buffer.alloc(64 + envelope.readUInt32LE(48));
  assert.equal(readSync(file, chunk, 0, chunk.length, offset), chunk.length);
} finally {
  closeSync(file);
}

/** Median and range in nanoseconds/call; these are warm kernel timings, not end-to-end latency. */
interface Timing {
  readonly medianNs: number;
  readonly minNs: number;
  readonly maxNs: number;
}
let sink = 0;
/**
 * Consume every checksum so a timer cannot measure an unused result.
 * @param {() => number} fn Checksum kernel with prepared input.
 * @param {number} iterations Number of timed calls.
 * @returns {number} Mean nanoseconds per call for this sample.
 */
function run(fn: () => number, iterations: number): number {
  let consumed = 0;
  const start = performance.now();
  for (let index = 0; index < iterations; index++) {
    consumed = (consumed + fn()) >>> 0;
  }
  const elapsed = performance.now() - start;
  sink = (sink + consumed) >>> 0;
  return (elapsed * 1e6) / iterations;
}

/**
 * Rotate candidate order to spread JIT, thermal and scheduling effects across implementations.
 * @param {Record<string, () => number>} candidates Kernels computing the same checksum.
 * @param {number} bytes Input size used to bound the total timed work.
 * @returns {Record<string, Timing>} Median and range over seven warm samples.
 */
function measure(candidates: Record<string, () => number>, bytes: number): Record<string, Timing> {
  const iterations = Math.max(128, Math.min(250000, Math.floor((32 * 1024 * 1024) / bytes)));
  const names = Object.keys(candidates);
  const samples: Record<string, number[]> = Object.fromEntries(names.map((name) => [name, []]));
  for (const name of names) {
    run(candidates[name], Math.min(iterations, 10000));
  }
  for (let repetition = 0; repetition < 7; repetition++) {
    for (let offset = 0; offset < names.length; offset++) {
      const name = names[(offset + repetition) % names.length];
      samples[name].push(run(candidates[name], iterations));
    }
  }
  return Object.fromEntries(
    names.map((name) => {
      const sorted = samples[name].sort((a, b) => a - b);
      return [name, { medianNs: sorted[3], minNs: sorted[0], maxNs: sorted[6] }];
    }),
  );
}

const results = workloads.map((workload) => {
  const checksum = nativeCrc32(workload.bytes);
  assert.equal(nativeCrc32(workload.input), checksum);
  assert.equal(crc.compute(workload.input), checksum);
  assert.equal(crc.computeBytes(workload.bytes), checksum);
  assert.equal(CRC32.compute(workload.bytes), checksum);
  const timings = measure(
    {
      node: () => nativeCrc32(workload.input),
      nodeBytes: () => nativeCrc32(workload.bytes),
      dataTools: () => crc.compute(workload.input),
      dataToolsBytes: () => crc.computeBytes(workload.bytes),
      coreBytes: () => CRC32.compute(workload.bytes),
    },
    workload.bytes.length,
  );
  return {
    name: workload.name,
    provenance: workload.provenance,
    inputType: typeof workload.input === "string" ? "utf8-string" : "bytes",
    bytes: workload.bytes.length,
    sha256: createHash("sha256").update(workload.bytes).digest("hex"),
    checksum,
    timings,
  };
});
const captureResults = [
  { name: "capture-header", bytes: header, zeroChecksum: false },
  { name: "capture-chunk", bytes: chunk, zeroChecksum: true },
].map(({ name, bytes, zeroChecksum }) => {
  const before = Buffer.from(bytes);
  const checksum = captureCrc32c(bytes, zeroChecksum);
  assert.equal(crc.crc32cBytes(bytes, zeroChecksum), checksum);
  const timings = measure(
    {
      adapter: () => captureCrc32c(bytes, zeroChecksum),
      dataTools: () => crc.crc32cBytes(bytes, zeroChecksum),
    },
    bytes.length,
  );
  assert.deepEqual(bytes, before);
  return { name, provenance: capturePath, bytes: bytes.length, zeroChecksum, checksum, timings };
});
const report = {
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  module: moduleUrl,
  moduleSha256: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.resolve(moduleUrl))))
    .digest("hex"),
  methodology:
    "Seven rotated warm samples. Input I/O, decoding and byte preparation excluded. String candidates include UTF-8 conversion; byte candidates use pre-encoded identical bytes. No runtime backend dispatch is inferred from these measurements.",
  implementationSha256: Object.fromEntries(
    [sourcePath, "packages/debug-adapter/src/capture-v2.ts"].map((path) => [
      path,
      createHash("sha256").update(readFileSync(path)).digest("hex"),
    ]),
  ),
  results,
  captureResults,
  sink,
};
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) {
  console.log(
    result.name,
    result.bytes,
    Object.fromEntries(
      Object.entries(result.timings).map(([name, timing]) => [name, Math.round(timing.medianNs)]),
    ),
  );
}
console.log(captureResults);
