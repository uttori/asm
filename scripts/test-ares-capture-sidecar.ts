import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  DebugAdapterSession,
  DebugSidecarClient,
  NodeStdioSidecarTransport,
  SidecarDebugBackend,
  LosslessCaptureFileRecorder,
  createDebugSidecarSessionToken,
  recoverCaptureFile,
  type CaptureResultV2,
} from "../packages/debug-adapter/src/index.js";
import { ARES_RSP_CAPABILITIES } from "../packages/debug-sidecar-ares/src/ares-rsp-backend.js";
import { parseAresRuntimeManifest } from "../packages/debug-sidecar-ares/src/ares-process-host.js";

// Exercise the editor's DAP request and its actual bundled stdio sidecar, with
// an isolated runtime copy so the user's settings and saves are never touched.
const source = path.resolve(process.argv[2] ?? "Local Only/ares-capture-v2-desktop-runtime");
const evidence = process.argv[3];
const temporary = await mkdtemp(path.join(os.tmpdir(), "ares-capture-sidecar-"));
const runtime = path.join(temporary, "runtime");
await cp(source, runtime, { recursive: true });
const rom = Buffer.alloc(32768, 0xea);
rom.set([0x78, 0xe8, 0x86, 0, 0x80, 0xfb]);
rom.fill(0, 0x7fc0);
rom.write("CAPTURE V2 FIXTURE    ", 0x7fc0, "ascii");
rom[0x7fd5] = 0x20;
rom[0x7fd7] = 5;
rom[0x7fd9] = 1;
rom.writeUInt16LE(0x8000, 0x7ffc);
const digest = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");
const romFile = path.join(temporary, "fixture.sfc");
await writeFile(romFile, rom);
const manifestFile = path.join(runtime, "ares-runtime-manifest.json");
const manifest = {
  ...parseAresRuntimeManifest(JSON.parse(await readFile(manifestFile, "utf8")) as unknown),
  romSha256: digest(rom),
};
await writeFile(manifestFile, JSON.stringify(manifest));
await writeFile(
  path.join(runtime, "settings.bml"),
  `Video\n  Driver: None\n  Blocking: false\nAudio\n  Mute: true\n  Blocking: false\nPaths\n  Home: ${temporary}/systems/\n`,
);
const sidecar = path.resolve("packages/vscode-extension/sidecars/ares.mjs");
let client: DebugSidecarClient | undefined;
const backend = new SidecarDebugBackend({
  backend: "ares-rsp",
  capabilities: ARES_RSP_CAPABILITIES,
  createClient: () => {
    const session = createDebugSidecarSessionToken();
    client = new DebugSidecarClient({
      session,
      requestTimeoutMs: 15000,
      transport: new NodeStdioSidecarTransport({
        command: process.execPath,
        args: [
          sidecar,
          "--manifest",
          manifestFile,
          "--ares",
          path.join(runtime, "ares.app/Contents/MacOS/ares"),
          "--runtime-dir",
          runtime,
          "--rom",
          romFile,
        ],
        session,
        shutdownTimeoutMs: 3000,
      }),
    });
    return client;
  },
});
const adapter = new DebugAdapterSession({ backend });
let sequence = 0;
const request = async (command: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const messages = await adapter.dispatch({
    type: "request",
    seq: ++sequence,
    command,
    arguments: args,
  });
  const response = messages.find((m) => m.type === "response");
  assert(
    response?.type === "response" && response.success,
    response?.type === "response"
      ? (response.message ?? "DAP request failed")
      : "Missing DAP response",
  );
  return response.body;
};
let recorder: LosslessCaptureFileRecorder | undefined;
try {
  await request("initialize");
  await request("launch");
  recorder = await LosslessCaptureFileRecorder.create({
    file: path.join(temporary, "capture.json"),
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: digest(rom),
    producer: { id: "ares", revision: manifest.executableSha256 },
    transport: async (r) => (await request("uttori/capture", { ...r })) as CaptureResultV2,
  });
  // Attach a handler immediately so a failed background pump is reported here.
  void recorder.completion.catch(() => undefined);
  await request("continue", { threadId: 1 });
  await delay(1000);
  const summary = await recorder.stop();
  assert(summary.complete && summary.observedEvents > 3854);
  assert.equal(summary.droppedEvents, 0);
  assert((await recoverCaptureFile(summary.archive)).complete);
  const result = {
    fixtureSha256: digest(rom),
    executableSha256: manifest.executableSha256,
    bundledSidecarSha256: digest(await readFile(sidecar)),
    checks: [
      "verified runtime launch",
      "DAP capture forwarding",
      "bundled stdio sidecar",
      "full 256 KiB chunks",
      "durable writer and final drain",
    ],
    observedEvents: summary.observedEvents,
    droppedEvents: summary.droppedEvents,
    throttleCount: summary.position.throttleCount,
  };
  if (evidence) await writeFile(evidence, JSON.stringify(result, undefined, 2) + "\n");
  console.log(JSON.stringify(result, undefined, 2));
} finally {
  await recorder?.finishIncomplete().catch(() => undefined);
  try {
    await backend.disconnect();
  } finally {
    await client?.close();
    adapter.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
}
