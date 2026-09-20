import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";

import type { DebugSubscription } from "../packages/debug-adapter/src/contracts.js";
import {
  GdbRspClient,
  type GdbRspTransport,
} from "../packages/debug-sidecar-ares/src/gdb-rsp-client.js";

/** In-memory transport isolates receive assembly/validation from TCP, emulator and disk costs. */
class BenchmarkTransport implements GdbRspTransport {
  listener: ((data: Uint8Array) => void) | undefined;
  async write(): Promise<void> {}
  async close(): Promise<void> {}
  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.listener = listener;
    return {
      dispose: () => {
        this.listener = undefined;
      },
    };
  }
  onClose(): DebugSubscription {
    return { dispose: () => undefined };
  }
}

/** Deterministic, checked RSP payload equivalent in size to a full hex-encoded ACT2 chunk.
 * @param {number} bytes ASCII payload bytes, excluding the four framing bytes.
 * @returns {object} Reusable packet and exact expected response. Construction is outside timing.
 */
const fixture = (bytes: number) => {
  const payload = "0123456789abcdef".repeat(Math.ceil(bytes / 16)).slice(0, bytes);
  const body = Buffer.from(payload, "ascii");
  let sum = 0;
  for (const byte of body) sum = (sum + byte) & 255;
  const packet = Buffer.concat([
    Buffer.from("$"),
    body,
    Buffer.from(`#${sum.toString(16).padStart(2, "0")}`),
  ]);
  return { payload, packet };
};

/** Measure completed requests while preserving acknowledgement scheduling between packets.
 * @param {number} payloadBytes RSP payload length, at most the current capture response bound.
 * @param {number} fragmentBytes Simulated transport fragment size.
 * @param {number} iterations Measured requests after warmup.
 * @returns {Promise<number>} Wall milliseconds for receive parsing and request settlement only.
 */
const measure = async (
  payloadBytes: number,
  fragmentBytes: number,
  iterations: number,
): Promise<number> => {
  const { payload, packet } = fixture(payloadBytes);
  const transport = new BenchmarkTransport();
  const client = new GdbRspClient({ transport });
  await client.start();
  const fragments: Buffer[] = [];
  for (let i = 0; i < packet.length; i += fragmentBytes)
    fragments.push(packet.subarray(i, i + fragmentBytes));
  const receive = async (): Promise<void> => {
    const response = client.request("qUttoriCapture:read:benchmark:1");
    for (const fragment of fragments) transport.listener!(fragment);
    assert.equal(await response, payload);
    // Let queued ACK writes settle, without accumulating an artificial write backlog.
    await Promise.resolve();
    await Promise.resolve();
  };
  for (let i = 0; i < 3; i++) await receive();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await receive();
  const elapsed = performance.now() - start;
  await client.close();
  return elapsed;
};

const cases = [
  { name: "control", payloadBytes: 512, fragmentBytes: 512, iterations: 1000 },
  { name: "capture-64k-fragments", payloadBytes: 524288, fragmentBytes: 65536, iterations: 80 },
  { name: "capture-1k-fragments", payloadBytes: 524288, fragmentBytes: 1024, iterations: 30 },
  { name: "fragmented-small-packet", payloadBytes: 4096, fragmentBytes: 1, iterations: 40 },
];
const results = [];
for (const item of cases) {
  const samplesMs = [];
  for (let repeat = 0; repeat < 5; repeat++)
    samplesMs.push(await measure(item.payloadBytes, item.fragmentBytes, item.iterations));
  const medianMs = [...samplesMs].sort((a, b) => a - b)[2];
  results.push({
    ...item,
    samplesMs,
    medianMs,
    payloadMiBPerSecond: (item.payloadBytes * item.iterations) / 1048576 / (medianMs / 1000),
  });
}
const source = await readFile(
  new URL("../packages/debug-sidecar-ares/src/gdb-rsp-client.ts", import.meta.url),
);
const result = {
  measuredAt: new Date().toISOString(),
  platform: process.platform,
  architecture: process.arch,
  cpu: os.cpus()[0]?.model,
  node: process.version,
  clientSha256: createHash("sha256").update(source).digest("hex"),
  description:
    "Five samples after three warmup requests each. Payload generation excluded. In-memory RSP parsing only, not emulator or disk throughput.",
  results,
};
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
