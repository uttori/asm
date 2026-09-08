import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";
import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  DebugAdapterSession,
  DebugSidecarClient,
  NodeStdioSidecarTransport,
  SidecarDebugBackend,
  runDebugBackendConformance,
  type DapEvent,
  type DapProtocolMessage,
  type DapRequest,
  type DapResponse,
  type DebugBackendConformanceFixture,
} from "@uttori/asm-debug-adapter";

import { AresProcessHost, parseAresRuntimeManifest } from "../src/ares-process-host.js";
import {
  ARES_RSP_BACKEND_ID,
  ARES_RSP_CAPABILITIES,
  AresRspDebugBackend,
} from "../src/ares-rsp-backend.js";
import { aresLiveManifest } from "./fixtures/ares-live-manifest.js";

const enabled = process.env.UTTORI_ARES_LIVE === "1";
const liveTest = enabled ? test.serial : test.serial.skip;
const superFxEnabled = process.env.UTTORI_ARES_SUPERFX_LIVE === "1";
const superFxLiveTest = superFxEnabled ? test.serial : test.serial.skip;
const workspace = process.env.UTTORI_ARES_WORKSPACE ?? process.cwd();
const liveRuntimeDirectory =
  process.env.UTTORI_ARES_LIVE_RUNTIME ??
  path.join(workspace, "Local Only/ares-phase10-live-runtime");
const liveExecutable =
  process.env.UTTORI_ARES_LIVE_EXECUTABLE ?? path.join(liveRuntimeDirectory, "bin/ares-headless");
const liveRom =
  process.env.UTTORI_ARES_LIVE_ROM ?? path.join(workspace, "Local Only/Secret of Mana (USA).sfc");
const liveManifestFile =
  process.env.UTTORI_ARES_LIVE_MANIFEST ??
  path.join(liveRuntimeDirectory, "ares-runtime-manifest.json");
const liveManifest = process.env.UTTORI_ARES_LIVE_MANIFEST
  ? parseAresRuntimeManifest(JSON.parse(readFileSync(liveManifestFile, "utf8")))
  : aresLiveManifest;
const superFxRuntimeDirectory =
  process.env.UTTORI_ARES_SUPERFX_RUNTIME ??
  path.join(workspace, "Local Only/ares-current-live-runtime");
const superFxExecutable =
  process.env.UTTORI_ARES_SUPERFX_EXECUTABLE ??
  path.join(superFxRuntimeDirectory, "bin/ares-headless");
const superFxRom =
  process.env.UTTORI_ARES_SUPERFX_ROM ?? path.join(workspace, "Local Only/fixtures/roms/yi.sfc");
const superFxManifestFile =
  process.env.UTTORI_ARES_SUPERFX_MANIFEST ??
  path.join(superFxRuntimeDirectory, "ares-superfx-runtime-manifest.json");

const conformanceFixture: DebugBackendConformanceFixture = {
  architectures: [
    {
      architecture: "snes.65816",
      addressSpaces: ["snes.cpu", "snes.wram", "snes.cartridge-rom"],
      memorySpaces: [
        { addressSpace: "snes.wram", sideEffectFree: true },
        { addressSpace: "snes.cartridge-rom", sideEffectFree: true },
      ],
      trace: {
        addressSpaces: ["snes.cpu"],
        maxBufferedEvents: 65_536,
        maxBatchEvents: 240,
      },
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: true,
        disassemble: true,
      },
    },
    {
      architecture: "snes.spc700",
      addressSpaces: ["spc.aram"],
      memorySpaces: [],
      trace: null,
      capabilities: { pause: false, step: false, registers: false, memory: false },
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.ram", "superfx.rom"],
      memorySpaces: [],
      trace: null,
      capabilities: { pause: false, step: false, registers: false, memory: false },
    },
  ],
  primaryArchitecture: "snes.65816",
  primaryAddressSpace: "snes.cpu",
  initialAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x00_8004,
  },
  steppedAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x00_8005,
  },
  breakpointAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x00_8005,
  },
  memoryAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cartridge-rom",
    address: 0x00_8004,
  },
  memoryBytes: [0x18, 0xfb, 0xe2, 0x30, 0x5c, 0x10, 0x00, 0xc1],
  requiredRegisters: ["A", "X", "Y", "S", "D", "DB", "PB", "PC", "P", "E"],
  disassemblyAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x00_8004,
  },
  disassemblyText: "CLC",
};

const createLiveBackend = () => {
  const host = new AresProcessHost({
    executable: liveExecutable,
    rom: liveRom,
    runtimeDirectory: liveRuntimeDirectory,
    manifest: liveManifest,
    startupTimeoutMs: 10_000,
    requestTimeoutMs: 3_000,
    shutdownTimeoutMs: 2_000,
  });
  return {
    backend: new AresRspDebugBackend({
      createClient: (options) => host.createClient(options),
      terminate: () => host.terminate(),
    }),
    host,
  };
};

const createSuperFxLiveBackend = () => {
  const host = new AresProcessHost({
    executable: superFxExecutable,
    rom: superFxRom,
    runtimeDirectory: superFxRuntimeDirectory,
    manifest: parseAresRuntimeManifest(JSON.parse(readFileSync(superFxManifestFile, "utf8"))),
    startupTimeoutMs: 10_000,
    requestTimeoutMs: 3_000,
    shutdownTimeoutMs: 2_000,
  });
  return {
    backend: new AresRspDebugBackend({
      createClient: (options) => host.createClient(options),
      terminate: () => host.terminate(),
    }),
    host,
  };
};

const createLiveSidecarBackend = async (
  entry = path.join(workspace, "packages/debug-sidecar-ares/src/sidecar.ts"),
): Promise<SidecarDebugBackend> => {
  await mkdir(liveRuntimeDirectory, { recursive: true });
  const manifest = path.join(liveRuntimeDirectory, "ares-runtime-manifest.json");
  await writeFile(manifest, `${JSON.stringify(liveManifest, undefined, 2)}\n`, "utf8");
  return new SidecarDebugBackend({
    backend: ARES_RSP_BACKEND_ID,
    capabilities: ARES_RSP_CAPABILITIES,
    createClient: () => {
      const session = randomBytes(32).toString("hex");
      const transport = new NodeStdioSidecarTransport({
        command: process.execPath,
        args: [
          ...(entry.endsWith(".ts") ? ["--import=tsx"] : []),
          entry,
          "--manifest",
          manifest,
          "--ares",
          liveExecutable,
          "--rom",
          liveRom,
          "--runtime-dir",
          liveRuntimeDirectory,
        ],
        session,
        shutdownTimeoutMs: 3_000,
      });
      return new DebugSidecarClient({ transport, session, requestTimeoutMs: 15_000 });
    },
  });
};

const dapRequest = (
  seq: number,
  command: string,
  args: Record<string, unknown> = {},
): DapRequest => ({ seq, type: "request", command, arguments: args });

const dapResponse = (messages: readonly DapProtocolMessage[]): DapResponse =>
  messages[0] as DapResponse;

liveTest("pinned ares proof launches through the production host and translator", async (t) => {
  const { backend, host } = createLiveBackend();
  const events: string[] = [];
  let resolveStop: (() => void) | undefined;
  backend.onEvent((event) => {
    events.push(event.type);
    if (event.type === "stopped") {
      resolveStop?.();
      resolveStop = undefined;
    }
  });
  try {
    await backend.connect({ reset: true });
    const [thread] = await backend.threads();
    t.truthy(thread);
    const [frame] = await backend.stackFrames(thread!.id);
    t.truthy(frame);
    const registers = await backend.registers(frame!.id);
    const memory = await backend.readMemory(conformanceFixture.memoryAddress, 8);
    const instructions = await backend.disassemble(frame!.pc, 3);
    t.is(memory.unreadableBytes, 0);
    t.is(registers.length, 10);
    t.is(instructions.length, 3);
    t.log(
      JSON.stringify({
        pid: host.pid,
        initialPc: frame!.pc.address,
        memory: [...memory.bytes],
        instructions,
        registers,
      }),
    );

    const stopped = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for live step stop.")),
        3_000,
      );
      resolveStop = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    await backend.step(thread!.id, "instruction");
    await stopped;
    const [stepped] = await backend.stackFrames(thread!.id);
    t.not(stepped?.pc.address, frame!.pc.address);
    t.deepEqual(events.slice(-2), ["continued", "stopped"]);

    await backend.disconnect({ terminate: false });
    await backend.connect({ reset: false });
    const [reconnected] = await backend.stackFrames(thread!.id);
    t.is(reconnected?.pc.address, stepped?.pc.address);
  } finally {
    await backend.disconnect({ terminate: true }).catch(() => host.terminate());
  }
});

superFxLiveTest(
  "current ares launches a GSU cartridge with explicit reduced capability",
  async (t) => {
    const { backend, host } = createSuperFxLiveBackend();
    try {
      await backend.connect({ reset: true });
      const superFx = backend.capabilities.architectures.find(
        ({ architecture }) => architecture === "snes.superfx",
      );
      t.deepEqual(superFx, {
        architecture: "snes.superfx",
        addressSpaces: ["superfx.ram", "superfx.rom"],
        memorySpaces: [],
        trace: null,
        pause: false,
        step: false,
        registers: false,
        memory: false,
        stackFrames: false,
        breakpoints: false,
        disassemble: false,
      });
      const threads = await backend.threads();
      t.deepEqual(
        threads.map(({ architecture }) => architecture),
        ["snes.65816"],
      );
      const frame = (await backend.stackFrames(threads[0]?.id ?? -1))[0];
      t.is(frame?.pc.architecture, "snes.65816");
      t.true((await backend.disassemble(frame!.pc, 1)).length === 1);
      await t.throwsAsync(
        backend.readMemory(
          { architecture: "snes.superfx", addressSpace: "superfx.rom", address: 0 },
          1,
        ),
        { message: /unsupported architecture 'snes\.superfx'/ },
      );
    } finally {
      await backend.disconnect({ terminate: true }).catch(() => host.terminate());
    }
  },
);

liveTest("pinned ares proof passes the frozen live backend conformance suite", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "ares-rsp-live-macos-arm64",
    createBackend: () => createLiveBackend().backend,
    fixture: conformanceFixture,
    timeoutMs: 5_000,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

liveTest("pinned ares crash is contained and a fresh verified process reconnects", async (t) => {
  const { backend, host } = createLiveBackend();
  let resolveTermination: (() => void) | undefined;
  let restartable = false;
  backend.onEvent((event) => {
    if (event.type !== "terminated") return;
    restartable = event.restart;
    resolveTermination?.();
    resolveTermination = undefined;
  });
  try {
    await backend.connect({ reset: true });
    const pid = host.pid;
    if (pid === undefined) throw new Error("Live ares process did not expose a PID.");
    const terminated = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for crashed ares termination.")),
        5_000,
      );
      resolveTermination = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    process.kill(pid, "SIGKILL");
    await terminated;
    t.true(restartable);
    t.throws(() => backend.threads(), { message: "ares RSP backend is not connected." });

    await backend.connect({ reset: true });
    const [frame] = await backend.stackFrames(1);
    t.is(frame?.pc.address, conformanceFixture.initialAddress.address);
    t.not(host.pid, pid);
  } finally {
    await backend.disconnect({ terminate: true }).catch(() => host.terminate());
  }
});

liveTest(
  "pinned ares proof passes conformance through the authenticated stdio sidecar",
  async (t) => {
    const report = await runDebugBackendConformance({
      backend: "ares-sidecar-live-macos-arm64",
      createBackend: createLiveSidecarBackend,
      fixture: conformanceFixture,
      timeoutMs: 15_000,
    });
    t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
    t.deepEqual(
      report.scenarios.map(({ id, status }) => ({ id, status })),
      DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
    );
  },
);

liveTest("built ares sidecar artifact passes the frozen live conformance suite", async (t) => {
  const entry = path.join(workspace, "packages/debug-sidecar-ares/out/sidecar.mjs");
  const report = await runDebugBackendConformance({
    backend: "ares-sidecar-bundle-live-macos-arm64",
    createBackend: () => createLiveSidecarBackend(entry),
    fixture: conformanceFixture,
    timeoutMs: 15_000,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

liveTest(
  "built ares sidecar stops a live DAP session on the exact mapped native source line",
  async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-ares-dap-live-"));
    const source = path.join(directory, "reset.asm");
    await writeFile(source, "CLC\nXCE\nJSL $C300C6\n", "utf8");
    const output = readFileSync(liveRom);
    const mapping = new AddressToLineMapping();
    mapping.includeByte(source, 1, "snes.65816", "snes.cpu", 0x00_8004, 4);
    mapping.includeByte(source, 2, "snes.65816", "snes.cpu", 0x00_8005, 5);
    mapping.includeByte(source, 3, "snes.65816", "snes.cpu", 0xc3_00c6, 0x03_00c6);
    const debugMap = createDebugMap({
      target: path.basename(liveRom),
      output,
      mapping,
      sourceRoot: directory,
    });
    const backend = await createLiveSidecarBackend(
      path.join(workspace, "packages/debug-sidecar-ares/out/sidecar.mjs"),
    );
    const asynchronous: DapProtocolMessage[] = [];
    let resolveStop: ((event: DapEvent) => void) | undefined;
    const session = new DebugAdapterSession({
      backend,
      debugMap,
      output,
      sourceRoot: directory,
      onMessage: (message) => {
        asynchronous.push(message);
        if (message.type === "event" && message.event === "stopped") {
          resolveStop?.(message);
          resolveStop = undefined;
        }
      },
    });
    try {
      const launch = await session.dispatch(dapRequest(1, "launch"));
      t.true(
        dapResponse(launch).success,
        `DAP launch failed: ${dapResponse(launch).message ?? "unknown error"}`,
      );

      const set = dapResponse(
        await session.dispatch(
          dapRequest(2, "setBreakpoints", {
            source: { path: source },
            breakpoints: [{ line: 2 }],
          }),
        ),
      );
      const breakpoint = (
        set.body as {
          breakpoints: Array<{
            verified: boolean;
            line: number;
            instructionReference: string;
          }>;
        }
      ).breakpoints[0];
      t.deepEqual(
        { verified: breakpoint?.verified, line: breakpoint?.line },
        { verified: true, line: 2 },
      );
      t.regex(breakpoint?.instructionReference ?? "", /\|0x8005(?:\||$)/);

      const stopped = new Promise<DapEvent>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timed out waiting for live DAP source breakpoint.")),
          5_000,
        );
        resolveStop = (event) => {
          clearTimeout(timer);
          resolve(event);
        };
      });
      const continued = await session.dispatch(dapRequest(3, "continue", { threadId: 1 }));
      t.true(
        dapResponse(continued).success,
        `DAP continue failed: ${dapResponse(continued).message ?? "unknown error"}`,
      );
      const stop = await stopped;
      t.is((stop.body as { reason?: string }).reason, "breakpoint");

      const stack = dapResponse(
        await session.dispatch(dapRequest(4, "stackTrace", { threadId: 1 })),
      ).body as {
        stackFrames: Array<{
          id: number;
          line: number;
          source: { path: string };
          instructionPointerReference: string;
        }>;
      };
      const frame = stack.stackFrames[0];
      t.is(frame?.line, 2);
      t.is(frame?.source.path, source);
      t.regex(frame?.instructionPointerReference ?? "", /\|0x8005(?:\||$)/);
      const evaluated = dapResponse(
        await session.dispatch(
          dapRequest(5, "evaluate", {
            expression: "(PB << 16) | PC",
            frameId: frame?.id,
          }),
        ),
      );
      t.true(evaluated.success, evaluated.message);
      t.deepEqual(evaluated.body, {
        result: "0x8005",
        type: "integer",
        variablesReference: 0,
      });
      const traceStart = dapResponse(
        await session.dispatch(
          dapRequest(6, "uttori/startTrace", {
            architecture: "snes.65816",
            addressSpace: "snes.cpu",
          }),
        ),
      );
      t.true(traceStart.success, traceStart.message);
      await session.dispatch(
        dapRequest(7, "setBreakpoints", { source: { path: source }, breakpoints: [] }),
      );
      const stepped = new Promise<DapEvent>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timed out waiting for traced live DAP step.")),
          5_000,
        );
        resolveStop = (event) => {
          clearTimeout(timer);
          resolve(event);
        };
      });
      await session.dispatch(dapRequest(8, "stepIn", { threadId: 1 }));
      const stepStop = await stepped;
      t.is((stepStop.body as { reason?: string }).reason, "step");
      t.true(dapResponse(await session.dispatch(dapRequest(9, "uttori/stopTrace"))).success);
      const traced: number[] = [];
      for (let index = 0; index < 8; index++) {
        const pulled = dapResponse(
          await session.dispatch(dapRequest(10 + index, "uttori/readTrace", { maxEvents: 240 })),
        ).body as { addresses: number[]; active: boolean };
        traced.push(...pulled.addresses);
        if (!pulled.active && pulled.addresses.length === 0) break;
      }
      t.true(traced.length > 0);
      t.true(
        asynchronous.some((message) => message.type === "event" && message.event === "continued"),
      );

      const dynamicStop = new Promise<DapEvent>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timed out waiting for a running source breakpoint.")),
          15_000,
        );
        resolveStop = (event) => {
          clearTimeout(timer);
          resolve(event);
        };
      });
      await session.dispatch(dapRequest(18, "continue", { threadId: 1 }));
      const dynamicStart = asynchronous.length;
      // Line 3 executes later in the boot loop, giving the adapter time to perform its
      // required pause/install/resume cycle while the real emulator is already running.
      const dynamicSet = dapResponse(
        await session.dispatch(
          dapRequest(19, "setBreakpoints", {
            source: { path: source },
            breakpoints: [{ line: 3 }],
          }),
        ),
      );
      t.true(dynamicSet.success, dynamicSet.message);
      t.false(
        asynchronous
          .slice(dynamicStart)
          .some(
            (message) =>
              message.type === "event" &&
              message.event === "stopped" &&
              (message.body as { reason?: string } | undefined)?.reason === "pause",
          ),
        "The adapter must hide its breakpoint-maintenance pause.",
      );
      const runningBreakpoint = await dynamicStop;
      t.is((runningBreakpoint.body as { reason?: string }).reason, "breakpoint");
      const runningStack = dapResponse(
        await session.dispatch(dapRequest(20, "stackTrace", { threadId: 1 })),
      ).body as {
        stackFrames: Array<{ line: number; source: { path: string } }>;
      };
      t.deepEqual(
        {
          line: runningStack.stackFrames[0]?.line,
          source: runningStack.stackFrames[0]?.source.path,
        },
        { line: 3, source },
      );
    } finally {
      session.dispose();
      await backend.disconnect({ terminate: true }).catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
    }
  },
);

liveTest("built ares sidecar sustains ordered bounded 65816 trace pulls", async (t) => {
  const entry = path.join(workspace, "packages/debug-sidecar-ares/out/sidecar.mjs");
  const backend = await createLiveSidecarBackend(entry);
  let resolveStop: (() => void) | undefined;
  backend.onEvent((event) => {
    if (event.type !== "stopped") return;
    resolveStop?.();
    resolveStop = undefined;
  });
  try {
    await backend.connect({ reset: true });
    const traceCapabilities = backend.capabilities.architectures.find(
      ({ architecture }) => architecture === "snes.65816",
    )?.trace;
    t.deepEqual(traceCapabilities, {
      addressSpaces: ["snes.cpu"],
      maxBufferedEvents: 65_536,
      maxBatchEvents: 240,
    });
    await backend.startTrace({
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
    });
    const started = performance.now();
    await backend.continue(1);
    let expectedSequence = 1;
    let previousDropped = 0;
    let delivered = 0;
    for (let index = 0; index < 32; index++) {
      const batch = await backend.readTrace(240);
      t.is(batch.architecture, "snes.65816");
      t.is(batch.addressSpace, "snes.cpu");
      t.true(batch.active);
      t.true(batch.addresses.length <= 240);
      t.true(batch.addresses.every((address) => address >= 0 && address <= 0xff_ffff));
      t.is(batch.sequenceStart - expectedSequence, batch.droppedEvents - previousDropped);
      expectedSequence = batch.sequenceStart + batch.addresses.length;
      previousDropped = batch.droppedEvents;
      delivered += batch.addresses.length;
    }
    await backend.stopTrace();
    const finalBatch = await backend.readTrace(240);
    t.false(finalBatch.active);
    t.true(finalBatch.addresses.length <= 240);
    t.is(finalBatch.sequenceStart - expectedSequence, finalBatch.droppedEvents - previousDropped);
    expectedSequence = finalBatch.sequenceStart + finalBatch.addresses.length;
    delivered += finalBatch.addresses.length;
    const elapsedMs = performance.now() - started;
    t.true(delivered > 0);
    t.log(
      JSON.stringify({
        elapsedMs,
        deliveredEvents: delivered,
        observedSequenceSpan: expectedSequence - 1,
        droppedEvents: finalBatch.droppedEvents,
        eventsPerSecond: Math.round(((expectedSequence - 1) * 1_000) / elapsedMs),
        producerBufferLimit: traceCapabilities?.maxBufferedEvents,
        pullBatchLimit: traceCapabilities?.maxBatchEvents,
      }),
    );

    const stopped = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for post-trace pause.")),
        5_000,
      );
      resolveStop = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    await backend.pause(1);
    await stopped;
  } finally {
    await backend.disconnect({ terminate: true }).catch(() => undefined);
  }
});
