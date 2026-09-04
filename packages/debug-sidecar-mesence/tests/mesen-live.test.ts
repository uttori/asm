import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  DebugSidecarClient,
  NodeStdioSidecarTransport,
  SidecarDebugBackend,
  runDebugBackendConformance,
  type DebugBackendConformanceFixture,
  type DebugRegister,
} from "@uttori/asm-debug-adapter";

import { MESEN_BACKEND_ID, MESEN_CAPABILITIES, MesenDebugBackend } from "../src/mesen-backend.js";
import { MesenProcessHost, parseMesenRuntimeManifest } from "../src/mesen-process-host.js";
import { test } from "../../../tests/ava-helper.js";

const enabled = process.env.UTTORI_MESEN_LIVE === "1";
const liveTest = enabled ? test.serial : test.serial.skip;
const superFxEnabled = process.env.UTTORI_MESEN_SUPERFX_LIVE === "1";
const superFxLiveTest = superFxEnabled ? test.serial : test.serial.skip;
const workspace = process.env.UTTORI_MESEN_WORKSPACE ?? process.cwd();
const runtimeDirectory =
  process.env.UTTORI_MESEN_RUNTIME_DIRECTORY ??
  "/private/tmp/uttori-mesence-phase10-baseline/bin/osx-arm64/Release/osx-arm64/publish/Mesen.app/Contents/MacOS";
const executable = path.join(runtimeDirectory, "Mesen");
const rom = path.join(workspace, "Local Only/Secret of Mana (USA).sfc");
const manifestFile = path.join(
  workspace,
  "Local Only/mesen-phase10-runtime/mesen-live-manifest.json",
);
const superFxRom =
  process.env.UTTORI_MESEN_SUPERFX_ROM ?? path.join(workspace, "Local Only/fixtures/roms/yi.sfc");
const superFxManifestFile =
  process.env.UTTORI_MESEN_SUPERFX_MANIFEST ??
  path.join(workspace, "Local Only/mesen-phase10-runtime/mesen-superfx-live-manifest.json");

const conformanceFixture: DebugBackendConformanceFixture = {
  architectures: [
    {
      architecture: "snes.65816",
      addressSpaces: ["snes.address-space", "snes.wram", "snes.cartridge-rom"],
      memorySpaces: [
        { addressSpace: "snes.wram", sideEffectFree: true },
        { addressSpace: "snes.cartridge-rom", sideEffectFree: true },
      ],
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
      memorySpaces: [{ addressSpace: "spc.aram", sideEffectFree: true }],
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: false,
        disassemble: true,
      },
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.rom", "superfx.ram"],
      memorySpaces: [
        { addressSpace: "superfx.rom", sideEffectFree: true },
        { addressSpace: "superfx.ram", sideEffectFree: true },
      ],
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: false,
        disassemble: true,
      },
    },
  ],
  primaryArchitecture: "snes.65816",
  primaryAddressSpace: "snes.address-space",
  initialAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.address-space",
    address: 0x00_8004,
  },
  steppedAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.address-space",
    address: 0x00_8005,
  },
  breakpointAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.address-space",
    address: 0x00_8008,
  },
  memoryAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cartridge-rom",
    address: 0x00_8004,
  },
  memoryBytes: [0x18, 0xfb, 0xe2, 0x30, 0x5c, 0x10, 0x00, 0xc1],
  requiredRegisters: ["A", "X", "Y", "S", "D", "DB", "PB", "PC", "P", "E", "Cycle"],
  disassemblyAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.address-space",
    address: 0x00_8004,
  },
  disassemblyText: "CLC",
};

const manifest = () =>
  parseMesenRuntimeManifest(JSON.parse(readFileSync(manifestFile, "utf8")) as unknown);

const createLiveBackend = () => {
  const host = new MesenProcessHost({
    executable,
    rom,
    runtimeDirectory,
    manifest: manifest(),
    startupTimeoutMs: 10_000,
    requestTimeoutMs: 5_000,
    shutdownTimeoutMs: 2_000,
  });
  return {
    backend: new MesenDebugBackend({
      createClient: (options) => host.createClient(options),
      terminate: () => host.terminate(),
    }),
    host,
  };
};

const registerNumber = (registers: readonly DebugRegister[], name: string): number =>
  Number.parseInt(registers.find((register) => register.name === name)?.value ?? "", 16);

const isSequentialSuperFxOpcode = (opcode: number, destinationRegister: number): boolean =>
  (opcode >= 0x01 && opcode <= 0x04) ||
  (opcode >= 0x10 && opcode <= 0x3b) ||
  (destinationRegister !== 15 &&
    ((opcode >= 0x40 && opcode <= 0x97) ||
      (opcode >= 0x9e && opcode <= 0x9f) ||
      (opcode >= 0xb0 && opcode <= 0xef)));

const createLiveSidecarBackend = async (
  entry = path.join(workspace, "packages/debug-sidecar-mesence/out/sidecar.mjs"),
  selectedManifestFile = manifestFile,
  selectedRom = rom,
): Promise<SidecarDebugBackend> =>
  new SidecarDebugBackend({
    backend: MESEN_BACKEND_ID,
    capabilities: MESEN_CAPABILITIES,
    createClient: () => {
      const session = randomBytes(32).toString("hex");
      const transport = new NodeStdioSidecarTransport({
        command: process.execPath,
        args: [
          ...(entry.endsWith(".ts") ? ["--import=tsx"] : []),
          entry,
          "--manifest",
          selectedManifestFile,
          "--mesen",
          executable,
          "--rom",
          selectedRom,
          "--runtime-dir",
          runtimeDirectory,
        ],
        session,
        shutdownTimeoutMs: 3_000,
      });
      return new DebugSidecarClient({ transport, session, requestTimeoutMs: 15_000 });
    },
  });

liveTest("pinned MesenCE passes the frozen live backend conformance suite", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "mesence-live-macos-arm64",
    createBackend: () => createLiveBackend().backend,
    fixture: conformanceFixture,
    timeoutMs: 8_000,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

liveTest("pinned MesenCE performs one exact stopped SPC700 instruction", async (t) => {
  const { backend, host } = createLiveBackend();
  const events: string[] = [];
  backend.onEvent((event) => events.push(`${event.type}:${"reason" in event ? event.reason : ""}`));
  try {
    await backend.connect({ reset: true });
    const thread = (await backend.threads()).find(
      ({ architecture }) => architecture === "snes.spc700",
    );
    if (!thread) throw new Error("Live MesenCE did not expose SPC700.");
    const frame = (await backend.stackFrames(thread.id))[0];
    if (!frame) throw new Error("Live MesenCE did not expose an SPC700 frame.");
    const before = await backend.registers(frame.id);
    const beforeCycle = Number.parseInt(
      before.find(({ name }) => name === "Cycle")?.value ?? "",
      16,
    );
    const instruction = (await backend.disassemble(frame.pc, 1))[0];
    const memory = await backend.readMemory(frame.pc, instruction?.bytes.length ?? 1);
    t.deepEqual([...memory.bytes], instruction?.bytes);
    const eventStart = events.length;
    await backend.step(thread.id, "instruction");
    const after = await backend.registers(frame.id);
    const afterCycle = Number.parseInt(after.find(({ name }) => name === "Cycle")?.value ?? "", 16);
    t.true(Number.isSafeInteger(beforeCycle));
    t.true(afterCycle > beforeCycle);
    t.deepEqual(events.slice(eventStart), ["continued:", "stopped:step"]);
  } finally {
    await backend.disconnect({ terminate: true }).catch(() => host.terminate());
  }
});

superFxLiveTest(
  "built MesenCE sidecar performs one exact active SuperFX instruction",
  async (t) => {
    const backend = await createLiveSidecarBackend(
      path.join(workspace, "packages/debug-sidecar-mesence/out/sidecar.mjs"),
      superFxManifestFile,
      superFxRom,
    );
    const events: string[] = [];
    backend.onEvent((event) =>
      events.push(`${event.type}:${"reason" in event ? event.reason : ""}`),
    );
    try {
      await backend.connect({ reset: true });
      const threads = await backend.threads();
      const main = threads.find(({ architecture }) => architecture === "snes.65816");
      const superFx = threads.find(({ architecture }) => architecture === "snes.superfx");
      if (!main || !superFx) throw new Error("Live MesenCE did not expose both SNES processors.");

      let exactStepObserved = false;
      for (let sample = 0; sample < 120; sample++) {
        await backend.continue(main.id);
        await new Promise((resolve) => setTimeout(resolve, 250));
        await backend.pause(main.id);

        const sampledFrame = (await backend.stackFrames(superFx.id))[0];
        if (!sampledFrame) throw new Error("Live MesenCE did not expose a SuperFX frame.");
        const sampledRegisters = await backend.registers(sampledFrame.id);
        if (
          registerNumber(sampledRegisters, "RUN") !== 1 ||
          registerNumber(sampledRegisters, "Cycle") <= 0
        )
          continue;

        // The global stop was requested at a main-CPU boundary. Move once to a
        // GSU-owned stop, then prove the next unambiguous instruction boundary.
        await backend.step(superFx.id, "instruction");
        for (let alignedSample = 0; alignedSample < 64; alignedSample++) {
          const beforeFrame = (await backend.stackFrames(superFx.id))[0];
          if (!beforeFrame) throw new Error("Live MesenCE lost its SuperFX frame.");
          const beforeRegisters = await backend.registers(beforeFrame.id);
          const running = registerNumber(beforeRegisters, "RUN");
          const beforeCycle = registerNumber(beforeRegisters, "Cycle");
          const pipeline = registerNumber(beforeRegisters, "Pipeline");
          const destinationRegister = registerNumber(beforeRegisters, "DREG");
          const programBank = registerNumber(beforeRegisters, "PB");
          const nextProgramCounter = registerNumber(beforeRegisters, "R15");
          if (running !== 1) break;
          if (
            !Number.isSafeInteger(beforeCycle) ||
            beforeCycle <= 0 ||
            !Number.isSafeInteger(pipeline) ||
            !isSequentialSuperFxOpcode(pipeline, destinationRegister)
          ) {
            await backend.step(superFx.id, "instruction");
            continue;
          }

          const memory = await backend.readMemory(beforeFrame.pc, 1);
          t.deepEqual([...memory.bytes], [pipeline]);
          const instruction = (await backend.disassemble(beforeFrame.pc, 1))[0];
          t.is(instruction?.bytes[0], pipeline);

          const eventStart = events.length;
          await backend.step(superFx.id, "instruction");
          const afterFrame = (await backend.stackFrames(superFx.id))[0];
          if (!afterFrame) throw new Error("Live MesenCE lost its SuperFX frame after stepping.");
          const afterRegisters = await backend.registers(afterFrame.id);
          const afterCycle = registerNumber(afterRegisters, "Cycle");
          // The GSU stops before its final sequential R15 increment. PB:R15
          // therefore equals the current PC for linear flow, but already holds
          // the target while a branch delay slot is pending.
          const pipelinedPc = (programBank << 16) | nextProgramCounter;
          const expectedPc =
            pipelinedPc === beforeFrame.pc.address
              ? (programBank << 16) | ((nextProgramCounter + 1) & 0xffff)
              : pipelinedPc;
          t.is(
            afterFrame.pc.address,
            expectedPc,
            JSON.stringify({
              beforePc: beforeFrame.pc.address,
              afterPc: afterFrame.pc.address,
              opcode: pipeline,
              destinationRegister,
              programBank,
              nextProgramCounter,
              instruction,
            }),
          );
          t.true(afterCycle > beforeCycle);
          t.deepEqual(events.slice(eventStart), ["continued:", "stopped:step"]);
          exactStepObserved = true;
          break;
        }
        if (exactStepObserved) break;
      }
      t.true(exactStepObserved, "MesenCE did not reach a safe active SuperFX instruction in 30 s.");
    } finally {
      await backend.disconnect({ terminate: true }).catch(() => undefined);
    }
  },
);

liveTest("built MesenCE sidecar passes the frozen live conformance suite", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "mesence-sidecar-live-macos-arm64",
    createBackend: createLiveSidecarBackend,
    fixture: conformanceFixture,
    timeoutMs: 15_000,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});
