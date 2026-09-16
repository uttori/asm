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
  NativeCaptureFileRecorder,
  createDebugSidecarSessionToken,
  recoverCaptureFile,
  type CaptureResultV2,
  type CaptureTransportV2,
  type CaptureScopeV2,
} from "../packages/debug-adapter/src/index.js";
import { parseAresRuntimeManifest } from "../packages/debug-sidecar-ares/src/ares-process-host.js";
import { ARES_RSP_CAPABILITIES } from "../packages/debug-sidecar-ares/src/ares-rsp-backend.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
} from "../packages/disassembler/src/index.js";
import { createRuntimeBusTraceImporter } from "../packages/disassembler/src/runtime-bus-trace.js";
import { LiveBusAnalysis } from "../packages/vscode-extension/src/live-bus-analysis.js";
import { createEditorRuntimeBusSource } from "../packages/vscode-extension/src/runtime-bus-source.js";

// Exercise the editor's DAP request and its actual bundled stdio sidecar, with
// an isolated runtime copy so the user's settings and saves are never touched.
const source = path.resolve(process.argv[2] ?? "Local Only/ares-capture-v2-desktop-runtime");
const evidence = process.argv[3];
const ppu = process.argv.includes("--ppu");
const transfers = ppu || process.argv.includes("--transfers");
const bus = transfers || process.argv.includes("--bus");
let scope: CaptureScopeV2 = "snes.65816.instructions";
if (bus) scope = "snes.cpu-bus";
if (transfers) scope = "snes.cpu-bus-transfers";
if (ppu) scope = "snes.cpu-bus-ppu";
const slow = process.argv.includes("--slow");
const profile = process.argv.includes("--profile");
const nativeFile = process.argv.includes("--native-file");
const liveAnalysis = process.argv.includes("--live");
const framePaced = process.argv.includes("--frame-paced");
// Driver selection belongs only to the disposable benchmark runtime. Verify
// the saved setting after load so a failed Metal initialization cannot look like
// a successful display benchmark that silently fell back to None.
const hostVideo = process.argv.includes("--host-video") ? "Metal" : "None";
if (liveAnalysis && (!nativeFile || !bus))
  throw new Error("--live requires --native-file and a bus scope.");
const durationIndex = process.argv.indexOf("--duration-ms");
const defaultDurationMs = bus ? 4000 : 1000;
const durationMs = durationIndex < 0 ? defaultDurationMs : Number(process.argv[durationIndex + 1]);
if (!Number.isSafeInteger(durationMs) || durationMs < 100 || durationMs > 60000)
  throw new Error("Capture duration must be 100–60000 ms.");
const lagIndex = process.argv.indexOf("--live-max-lag-mib");
const liveMaxLagMiB = lagIndex < 0 ? 256 : Number(process.argv[lagIndex + 1]);
if (!Number.isSafeInteger(liveMaxLagMiB) || liveMaxLagMiB < 16 || liveMaxLagMiB > 4096)
  throw new Error("Live lag budget must be 16–4096 MiB.");
const keepIndex = process.argv.indexOf("--keep-archive");
const keepArchive = keepIndex < 0 ? undefined : process.argv[keepIndex + 1];
if (keepIndex >= 0 && (!keepArchive || keepArchive.startsWith("--")))
  throw new Error("--keep-archive requires a new destination path.");
const recorderType = nativeFile ? NativeCaptureFileRecorder : LosslessCaptureFileRecorder;
const temporary = await mkdtemp(path.join(os.tmpdir(), "ares-capture-sidecar-"));
let live: LiveBusAnalysis | undefined;
let livePoll: ReturnType<typeof setInterval> | undefined;
let livePreviews = 0;
let liveFinishedAt = 0;
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
let dmaInstruction = 0;
if (bus) {
  // Original synthetic program: fixed-source DMA channel 0 plus direct and
  // indirect HDMA on channels 1/2. Tables and payload live in this generated ROM.
  const code = [0x78]; // SEI; stay in reset's 8-bit emulation mode.
  const store = (address: number, value: number): void => {
    code.push(0xa9, value, 0x8d, address & 255, address >>> 8);
  };
  for (const [address, value] of [
    [0x2100, 0x80],
    [0x4300, 8],
    [0x4301, 0x22],
    [0x4302, 0],
    [0x4303, 0x90],
    [0x4304, 0],
    [0x4310, 0],
    [0x4311, 0],
    [0x4312, 0],
    [0x4313, 0x91],
    [0x4314, 0],
    [0x4320, 0x40],
    [0x4321, 0],
    [0x4322, 0],
    [0x4323, 0x92],
    [0x4324, 0],
    [0x4327, 0],
    [0x420c, 6],
  ])
    store(address, value);
  // A second workload transfers 256 bytes per NMI instead of saturating the bus.
  // It exercises sustained live catch-up without changing the dense stress case.
  if (framePaced) store(0x4200, 0x80);
  const loop = code.length;
  if (framePaced) code.push(0xcb); // WAI until the next frame's NMI.
  store(0x4305, 0);
  store(0x4306, framePaced ? 1 : 0x80);
  code.push(0xa9, 1);
  // The enable write schedules DMA; dmaEdge runs before the following opcode
  // fetch. Break on that BRA so its single step actually includes the transfer.
  dmaInstruction = 0x8000 + code.length + 3;
  code.push(0x8d, 0x0b, 0x42, 0x80, (loop - (code.length + 5)) & 255);
  rom.set(code);
  rom[0x1000] = 0x80;
  rom.set([0x81, 0x80, 0x81, 0x80, 0], 0x1100);
  rom.set([0x82, 0, 0x90, 0], 0x1200);
  if (framePaced) {
    rom[0x1300] = 0x40;
    rom.writeUInt16LE(0x9300, 0x7ffa);
  }
}
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
  `Video\n  Driver: ${hostVideo}\n  Blocking: false\nAudio\n  Mute: true\n  Blocking: false\nPaths\n  Home: ${temporary}/systems/\n`,
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
let recorder: LosslessCaptureFileRecorder | NativeCaptureFileRecorder | undefined;
// This is the adapter's real DAP/stdio/RSP path; delay only the consumer to
// exercise backpressure without changing the synthetic program or native timing.
const captureTransport: CaptureTransportV2 = async (r) => {
  if (slow && r.operation === "read") await delay(15);
  return (await request("uttori/capture", { ...r })) as CaptureResultV2;
};
/**
 * Wait for the asynchronous stop while allowing the recorder's DAP drain requests to run.
 * @param {() => Promise<unknown>} action Debugger operation that will eventually report a stop.
 * @returns {Promise<void>} Settlement at the instruction boundary, or a bounded timeout failure.
 */
const stoppedAfter = async (action: () => Promise<unknown>): Promise<void> => {
  let subscription: ReturnType<typeof backend.onEvent> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<void>((resolve, reject) => {
    subscription = backend.onEvent((event) => {
      if (event.type === "stopped") resolve();
    });
    timeout = setTimeout(() => reject(new Error("Bus capture debugger stop timed out.")), 15000);
  });
  try {
    await Promise.all([action(), stopped]);
  } finally {
    subscription?.dispose();
    clearTimeout(timeout);
  }
};
try {
  await request("initialize");
  await request("launch");
  const savedSettings = await readFile(path.join(runtime, "settings.bml"), "utf8");
  let inVideo = false;
  let savedVideo: string | undefined;
  for (const line of savedSettings.split(/\r?\n/)) {
    if (line && !line.startsWith(" ")) inVideo = line === "Video";
    if (inVideo && line.startsWith("  Driver: ")) savedVideo = line.slice(10);
  }
  assert.equal(
    savedVideo,
    hostVideo,
    "The requested benchmark video driver did not remain active.",
  );
  let stepEvents = 0;
  if (bus) {
    await backend.setBreakpoints([
      { architecture: "snes.65816", addressSpace: "snes.cpu", address: dmaInstruction },
    ]);
    await stoppedAfter(() => request("continue", { threadId: 1 }));
    await backend.setBreakpoints([]);
    recorder = await recorderType.create({
      file: path.join(temporary, "step.act2"),
      format: "act2",
      scope,
      bufferBytes: 4718656,
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      romContentSha256: digest(rom),
      producer: { id: "ares", revision: manifest.executableSha256 },
      transport: captureTransport,
    });
    void recorder.completion.catch(() => undefined);
    await stoppedAfter(() => request("stepIn", { threadId: 1, granularity: "instruction" }));
    const paused = await backend.registers(1);
    const stepped = await recorder.stop();
    stepEvents = stepped.observedEvents;
    assert(
      stepped.complete && stepEvents >= (framePaced ? 512 : 65536),
      `DMA step retained ${stepEvents} events`,
    );
    assert.deepEqual(await backend.registers(1), paused);
    assert((await recoverCaptureFile(stepped.archive)).complete);
  }
  recorder = await recorderType.create({
    file: path.join(temporary, bus || nativeFile ? "capture.act2" : "capture.json"),
    measureStages: profile,
    format: bus ? "act2" : "json",
    scope,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: digest(rom),
    producer: { id: "ares", revision: manifest.executableSha256 },
    transport: captureTransport,
  });
  // Attach a handler immediately so a failed background pump is reported here.
  void recorder.completion.catch(() => undefined);
  if (liveAnalysis && recorder instanceof NativeCaptureFileRecorder) {
    const directory = path.join(temporary, "analysis");
    writeAnalysisProject(directory, {
      manifest: {
        format: "uttori-asm-analysis",
        schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
        target: "benchmark",
        rom: new RomImage(rom).identity,
        mapping: { mapper: "fixture", source: "override", candidates: [] },
        addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
      },
      shards: {
        analysis: [],
        annotations: [],
        labels: [],
        comments: [],
        regions: [],
        runtime: [],
        evidence: [],
        imports: [],
      },
    });
    const nativeRecorder = recorder;
    live = new LiveBusAnalysis(
      path.resolve("packages/vscode-extension/out/live-bus-analysis-process.cjs"),
      {
        file: path.join(temporary, "capture.act2"),
        projectDirectory: directory,
        position: nativeRecorder.position,
        maxLagBytes: liveMaxLagMiB * 1048576,
        maxBytes: Number.MAX_SAFE_INTEGER,
        maxIndexRecords: 2_000_000,
      },
      () => {
        livePreviews++;
      },
      512,
    );
    livePoll = setInterval(() => live!.update(nativeRecorder.position), 100);
    void live.completion.then(
      () => {
        liveFinishedAt = performance.now();
      },
      () => undefined,
    );
    void nativeRecorder.completion.then(
      (summary) => {
        clearInterval(livePoll);
        live!.update(
          summary.position as import("../packages/debug-adapter/src/capture-file.js").NativeCaptureFilePosition,
        );
      },
      () => {
        clearInterval(livePoll);
        live!.cancel();
      },
    );
  }
  const started = performance.now();
  await request("continue", { threadId: 1 });
  await delay(durationMs);
  const pauseStarted = performance.now();
  await stoppedAfter(() => request("pause", { threadId: 1 }));
  const pauseMs = performance.now() - pauseStarted;
  const stopStarted = performance.now();
  const summary = await recorder.stop();
  const finalized = performance.now();
  assert(summary.complete && summary.observedEvents > 3854);
  assert.equal(summary.droppedEvents, 0);
  const actors = { cpu: 0, dma: 0, hdma: 0 };
  const phases = new Set<string>();
  let firstCycle: bigint | undefined;
  let lastCycle = 0n;
  assert(
    (
      await recoverCaptureFile(summary.archive, (chunk) => {
        if (chunk.scope === "snes.65816.instructions") {
          firstCycle ??= BigInt(chunk.instructions[0].cycle);
          lastCycle = BigInt(chunk.instructions.at(-1)!.cycle);
          return;
        }
        const events = chunk.scope === "snes.cpu-bus" ? chunk.accesses : chunk.events;
        for (const access of events) {
          if ("kind" in access) continue;
          actors[access.actor]++;
          phases.add(access.phase);
          firstCycle ??= BigInt(access.cycle);
          lastCycle = BigInt(access.cycle);
        }
      })
    ).complete,
  );
  if (bus) {
    assert(actors.cpu > 0 && actors.dma > 0 && actors.hdma > 0);
    assert(phases.has("hdma-table") && phases.has("hdma-indirect") && phases.has("hdma-transfer"));
  }
  let transferSummary;
  let ppuSummary;
  let importedIdentity;
  if (transfers) {
    // This dense benchmark can exceed the editor's default 2 GiB import budget.
    const source = await createEditorRuntimeBusSource(summary.archive, { maxBytes: 8 * 1024 ** 3 });
    const importer = createRuntimeBusTraceImporter(source.metadata, {
      projectRomContentSha256: digest(rom),
      sourceName: "desktop-transfer-capture.act2",
    });
    await source.read(importer.push);
    const imported = importer.finish();
    importedIdentity = imported.sourceSha256;
    transferSummary = imported.summary.transfers;
    ppuSummary = imported.summary.ppu;
    if (ppu) {
      assert(
        ppuSummary &&
          ppuSummary.portWrites > 0 &&
          ppuSummary.byteWrites > 0 &&
          ppuSummary.latched > 0,
      );
      assert(imported.report.imported["ppu.portWrites"] === ppuSummary.portWrites);
    }
    assert(transferSummary?.activity.some((group) => group.actor === "dma" && group.complete > 0));
    assert(transferSummary?.activity.some((group) => group.actor === "hdma" && group.complete > 0));
  }
  const liveResult = await live?.completion;
  if (liveResult) {
    assert.equal(liveResult.sourceSha256, importedIdentity);
    assert(livePreviews > 0);
  }
  const result = {
    hostVideo,
    audioVideoBlocking: false,
    fixtureKind: framePaced ? "frame-paced-256-byte-dma" : "dense-dma",
    ...(liveResult
      ? {
          live: {
            ...liveResult.live,
            finalCatchUpMs: Math.max(0, liveFinishedAt - finalized),
            workerSha256: digest(
              await readFile("packages/vscode-extension/out/live-bus-analysis-process.cjs"),
            ),
            previews: livePreviews,
            sourceSha256: liveResult.sourceSha256,
          },
        }
      : {}),
    pauseMs,
    ...(summary.timings ? { timings: summary.timings } : {}),
    sink: nativeFile ? "native-file" : "stream",
    nativePosition: nativeFile ? summary.position : undefined,
    ...(ppuSummary ? { ppu: { ...ppuSummary, writes: undefined } } : {}),
    ...(transferSummary
      ? { transfers: transferSummary.activity, omittedWindows: transferSummary.omittedWindows }
      : {}),
    fixtureSha256: digest(rom),
    executableSha256: manifest.executableSha256,
    bundledSidecarSha256: digest(await readFile(sidecar)),
    scope: summary.scope,
    consumer: slow ? "15ms-delay-per-read" : "unrestricted",
    checks: [
      "verified runtime launch",
      "DAP capture forwarding",
      "bundled stdio sidecar",
      "bounded ACT2 chunks up to 256 KiB",
      "durable writer and final drain",
      ...(bus
        ? [
            "DMA step drains while awaiting asynchronous stop",
            "independent debugger pause retained",
            "direct and indirect HDMA attribution",
          ]
        : []),
    ],
    observedEvents: summary.observedEvents,
    droppedEvents: summary.droppedEvents,
    throttleCount: summary.position.throttleCount,
    // Include final drain in capture wall time; subsequent recovery/import is
    // reported separately for both instruction and bus scopes.
    recordingMs: stopStarted - started,
    finalDrainMs: finalized - stopStarted,
    captureWallMs: finalized - started,
    validationMs: performance.now() - finalized,
    emulatedSeconds:
      (Number(lastCycle - (firstCycle ?? 0n)) * Number(summary.position.clockDenominator)) /
      Number(summary.position.clockNumerator),
    emulatedMasterClocks: String(lastCycle - (firstCycle ?? 0n)),
    ...(bus
      ? {
          stepEvents,
          actors,
          phases: [...phases].sort(),
          elapsedMs: performance.now() - started,
          // Separate capture/final drain from offline recovery and indexing. A large
          // importer workload must not be mistaken for the emulator's recording speed.
        }
      : {}),
  };
  // Copy after timing capture and validation, so retaining evidence cannot inflate either span.
  if (keepArchive) await cp(summary.archive, keepArchive, { force: false, errorOnExist: true });
  if (evidence) await writeFile(evidence, JSON.stringify(result, undefined, 2) + "\n");
  console.log(JSON.stringify(result, undefined, 2));
} finally {
  clearInterval(livePoll);
  live?.cancel();
  await live?.completion.catch(() => undefined);
  await recorder?.finishIncomplete().catch(() => undefined);
  try {
    // Failed launch has no connected backend; cleanup must preserve that error.
    await backend.disconnect().catch(() => undefined);
  } finally {
    await client?.close();
    adapter.dispose();
    await rm(temporary, { recursive: true, force: true });
  }
}
