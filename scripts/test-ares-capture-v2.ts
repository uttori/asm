import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { readRuntimeTraceFileMetadata, readRuntimeTraceFileChunks } from "@uttori/asm-disassembler";

import {
  LosslessCaptureFileRecorder,
  recoverCaptureFile,
} from "../packages/debug-adapter/src/capture-file.js";
import { validateCapturePosition } from "../packages/debug-adapter/src/capture-v2.js";
import { AresRspDebugBackend } from "../packages/debug-sidecar-ares/src/ares-rsp-backend.js";
import { GdbRspClient } from "../packages/debug-sidecar-ares/src/gdb-rsp-client.js";
import { NodeTcpGdbRspTransport } from "../packages/debug-sidecar-ares/src/node-tcp-gdb-rsp-transport.js";

const executable = path.resolve(
  process.argv[2] ?? "fixtures/external/ares/runtime/ares.app/Contents/MacOS/ares",
);
const evidence = process.argv[3];
const normal = process.argv.includes("--normal");
const temporary = await mkdtemp(path.join(os.tmpdir(), "ares-capture-desktop-"));
// Original LoROM fixture: SEI. INX. STX $0000. BRA $8001.
const rom = Buffer.alloc(32768, 0xea);
rom.set([0x78, 0xe8, 0x86, 0, 0x80, 0xfb]);
rom.fill(0, 0x7fc0);
rom.write("CAPTURE V2 FIXTURE    ", 0x7fc0, "ascii");
rom[0x7fd5] = 0x20;
rom[0x7fd7] = 5;
rom[0x7fd9] = 1;
rom.writeUInt16LE(0x8000, 0x7ffc);
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
await writeFile(path.join(temporary, "fixture.sfc"), rom);
await writeFile(path.join(temporary, "settings.bml"), "");
await mkdir(path.join(temporary, "systems"));
const probe = net.createServer();
await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const address = probe.address();
assert(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((resolve) => probe.close(() => resolve()));
const overrides = [
  "Developer/DebugServerEnabled=true",
  "Developer/DebugServerUseIPv4=true",
  `Developer/DebugServerPort=${port}`,
  "Boot/AwaitGDBClient=true",
  "Input/Defocus=Allow",
  "Video/Driver=None",
  "Audio/Mute=true",
  "Audio/Blocking=false",
  "Video/Blocking=false",
  `Paths/Home=${temporary}/systems/`,
  `Paths/Saves=${temporary}/`,
];
const child = spawn(
  executable,
  [
    "--no-file-prompt",
    "--settings-file",
    path.join(temporary, "settings.bml"),
    ...overrides.flatMap((v) => ["--setting", v]),
    path.join(temporary, "fixture.sfc"),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
child.stdout.on("data", (bytes) => {
  log = (log + bytes).slice(-16000);
});
child.stderr.on("data", (bytes) => {
  log = (log + bytes).slice(-16000);
});
const backend = new AresRspDebugBackend({
  createClient: async () => {
    const deadline = Date.now() + 15000;
    for (;;) {
      if (child.exitCode !== null || child.signalCode) throw new Error(`Desktop exited: ${log}`);
      try {
        return new GdbRspClient({
          transport: await NodeTcpGdbRspTransport.connect({ port, connectTimeoutMs: 500 }),
          requestTimeoutMs: 5000,
        });
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await delay(50);
      }
    }
  },
});
// Match the sidecar server's serialized command dispatch when exercising the
// RSP backend directly: capture and debugger control share one RSP connection.
let controlTail = Promise.resolve();
const dispatch = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = controlTail.then(operation);
  controlTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};
const pauseAtBoundary = async (): Promise<void> => {
  let dispose = (): void => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Desktop pause did not reach a safe boundary.")),
      5000,
    );
    const subscription = backend.onEvent((event) => {
      if (event.type === "stopped") resolve();
    });
    dispose = () => subscription.dispose();
  });
  try {
    await Promise.all([stopped, dispatch(() => backend.pause())]);
  } finally {
    clearTimeout(timeout);
    dispose();
  }
};
try {
  await backend.connect();
  const metadata = {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: digest(rom),
    producer: { id: "ares", revision: digest(await readFile(executable)) },
  };
  const empty = await LosslessCaptureFileRecorder.create({
    context: false,
    ...metadata,
    file: path.join(temporary, "empty.json"),
    transport: (request) => dispatch(() => backend.capture(request)),
    bufferBytes: 4718656,
  });
  assert.equal((await empty.stop()).observedEvents, 0);
  const started = validateCapturePosition(
    await backend.capture({ operation: "start", bufferBytes: 4718656 }),
  );
  await dispatch(() => backend.continue());
  await delay(250);
  const throttled = validateCapturePosition(
    await backend.capture({ operation: "status", session: started.session }),
  );
  assert.equal(throttled.state, "throttled");
  const first = await backend.capture({ operation: "read", session: started.session, chunk: "1" });
  assert.deepEqual(
    await backend.capture({ operation: "read", session: started.session, chunk: "1" }),
    first,
  );
  await pauseAtBoundary();
  const registers = await dispatch(() => backend.registers(1));
  await backend.capture({ operation: "abort", session: started.session });
  await backend.capture({ operation: "release", session: started.session });
  assert.deepEqual(await dispatch(() => backend.registers(1)), registers);

  const file = path.join(temporary, "capture.json");
  const recorder = await LosslessCaptureFileRecorder.create({
    context: false,
    ...metadata,
    file,
    bufferBytes: normal ? 8 * 1024 * 1024 : 4718656,
    transport: async (request) => {
      if (!normal && request.operation === "read") await delay(15); // deliberately slow consumer
      return dispatch(() => backend.capture(request));
    },
  });
  const start = performance.now();
  await dispatch(() => backend.continue());
  await delay(2000);
  await pauseAtBoundary();
  const paused = await dispatch(() => backend.registers(1)),
    drainStart = performance.now();
  const summary = await recorder.stop();
  const drainMs = performance.now() - drainStart;
  assert.equal(summary.droppedEvents, 0);
  assert(summary.complete && summary.observedEvents > 1000);
  assert(BigInt(summary.position.throttleCount) > 0n);
  assert.deepEqual(await dispatch(() => backend.registers(1)), paused);
  let count = 0,
    firstCycle: bigint | undefined,
    lastCycle = 0n;
  const recovery = await recoverCaptureFile(summary.archive, (c) => {
    assert(c.scope === "snes.65816.instructions", "Unexpected bus capture.");
    firstCycle ??= BigInt(c.instructions[0].cycle);
    lastCycle = BigInt(c.instructions.at(-1)!.cycle);
  });
  assert(recovery.complete);
  for await (const c of readRuntimeTraceFileChunks(file, await readRuntimeTraceFileMetadata(file)))
    count += c.addresses.length;
  assert.equal(count, summary.observedEvents);
  const result = {
    fixtureSha256: metadata.romContentSha256,
    executableSha256: metadata.producer.revision,
    scope: "snes.65816.instructions",
    consumer: normal ? "unrestricted" : "15ms-delay-per-read",
    checks: [
      "empty capture",
      "slow-consumer throttle",
      "byte-identical retry",
      "debugger pause while throttled",
      "abort and explicit release",
      "sync-before-ack writer",
      "stop and final drain",
      "legacy streaming importer",
      "independent user pause retained",
    ],
    observedEvents: summary.observedEvents,
    droppedEvents: summary.droppedEvents,
    allocatedBytes: summary.position.allocatedBytes,
    throttleCount: summary.position.throttleCount,
    elapsedMs: performance.now() - start,
    drainMs,
    emulatedMasterClocks: String(lastCycle - (firstCycle ?? 0n)),
  };
  if (evidence) await writeFile(evidence, JSON.stringify(result, undefined, 2) + "\n");
  console.log(JSON.stringify(result, undefined, 2));
} finally {
  await backend.disconnect().catch(() => undefined);
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    delay(2000),
  ]);
  if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
  await rm(temporary, { recursive: true, force: true });
}
