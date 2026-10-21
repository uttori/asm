import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { validateCapturePosition } from "@uttori/asm-capture";
import {
  DebugSidecarClient,
  NodeStdioSidecarTransport,
  SidecarDebugBackend,
} from "@uttori/asm-debug-adapter";

import { ARES_RSP_CAPABILITIES } from "../packages/debug-sidecar-ares/src/profile.js";

const [runtimeArgument, romArgument, receiptArgument, secondsArgument = "120"] =
  process.argv.slice(2);
assert.ok(
  runtimeArgument && romArgument && receiptArgument,
  "Usage: benchmark-paused-runtime.ts runtime-dir rom receipt.json [seconds-per-variant]",
);
const runtime = path.resolve(runtimeArgument),
  rom = path.resolve(romArgument);
const seconds = Number(secondsArgument);
assert.ok(Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600);
const executable = path.join(runtime, "desktop-ui/ares.app/Contents/MacOS/ares");
const sidecar = path.resolve("packages/debug-sidecar-ares/out/sidecar.mjs");
const saves = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-soak-saves-"));
const hash = (file: string): string =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
let transport: NodeStdioSidecarTransport;
const backend = new SidecarDebugBackend({
  backend: "ares-rsp",
  capabilities: ARES_RSP_CAPABILITIES,
  createClient: () => {
    const session = randomBytes(32).toString("hex");
    transport = new NodeStdioSidecarTransport({
      command: process.execPath,
      args: [
        sidecar,
        "--manifest",
        path.join(runtime, "ares-runtime-manifest.json"),
        "--ares",
        executable,
        "--rom",
        rom,
        "--runtime-dir",
        runtime,
        "--save-dir",
        saves,
      ],
      session,
      shutdownTimeoutMs: 3000,
    });
    return new DebugSidecarClient({ transport, session, requestTimeoutMs: 15000 });
  },
});
/** macOS RSS samples keep emulator and transport allocations separate; no aggregate obscures ownership. */
function memory() {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss=,comm="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => {
      const [, pid, parent, rss, command] = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line)!;
      return { pid: Number(pid), parent: Number(parent), rssBytes: Number(rss) * 1024, command };
    });
  const sidecarRow = rows.find((row) => row.pid === transport.pid);
  const emulator = rows.find((row) => row.parent === transport.pid && row.command === executable);
  assert.ok(sidecarRow && emulator, "Owned sidecar/emulator must stay alive during pause");
  return {
    sidecar: sidecarRow.rssBytes,
    emulator: emulator.rssBytes,
    client: process.memoryUsage().rss,
  };
}
const variants: {
  name: string;
  samples: { elapsedMs: number; sidecar: number; emulator: number; client: number }[];
}[] = [];
/** A fixed duration with the same sampling cadence for every capture state. */
async function sample(name: string): Promise<void> {
  const started = performance.now();
  const samples = [];
  while (performance.now() - started <= seconds * 1000) {
    samples.push({ elapsedMs: performance.now() - started, ...memory() });
    await delay(1000);
  }
  variants.push({ name, samples });
  console.log(`${name}: ${JSON.stringify({ first: samples[0], last: samples.at(-1) })}`);
}
try {
  await backend.connect();
  await sample("paused-no-capture");
  const capture = validateCapturePosition(
    await backend.capture({
      operation: "start",
      bufferBytes: 4718656,
      scope: "snes.65816.instructions",
    }),
  );
  await sample("paused-active-capture");
  await backend.capture({ operation: "stop", session: capture.session });
  await sample("paused-stopped-capture");
  await backend.capture({ operation: "abort", session: capture.session });
  await backend.disconnect({ terminate: false });
  await backend.connect({ reset: false });
  await sample("paused-reconnected");
  fs.writeFileSync(
    receiptArgument,
    JSON.stringify(
      {
        version: 1,
        node: process.version,
        platform: process.platform,
        secondsPerVariant: seconds,
        executableSha256: hash(executable),
        sidecarSha256: hash(sidecar),
        romSha256: hash(rom),
        editor:
          "Not attached in this native/sidecar isolation run; measured separately in the editor acceptance run.",
        variants,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await backend.disconnect({ terminate: true });
  fs.rmSync(saves, { recursive: true, force: true });
}
