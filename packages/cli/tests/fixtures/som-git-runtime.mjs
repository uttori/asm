/** Execute original replay and a moved-table scenario in the pinned native ares runtime. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { decompressSomLz } from "@uttori/asm-assets/secret-of-mana/lz";
import { sourceContentHash } from "@uttori/asm-disassembler";

import { recoverCaptureFile } from "../../../debug-adapter/src/capture-file.ts";
import { validateCapturePosition } from "../../../debug-adapter/src/capture-v2.ts";
import { GdbRspClient } from "../../../debug-sidecar-ares/src/gdb-rsp-client.ts";
import { NodeTcpGdbRspTransport } from "../../../debug-sidecar-ares/src/node-tcp-gdb-rsp-transport.ts";

const hex = (text) => Buffer.from(text).toString("hex");

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const mode = process.argv[2] ?? "original";
if (mode === "manual") {
  await import("./som-git-runtime-manual.mjs");
  // This process is a spawned fixture and the status is the result.
  // oxlint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}
if (mode === "original-all" || mode === "expanded-all") {
  for (const capture of fs
    .readdirSync(path.join(root, "disassembly/captures"))
    .filter((file) => file.endsWith(".act2"))
    .toSorted()) {
    const modes = mode === "original-all" ? ["original"] : ["source-baseline", "expanded"];
    for (const scenario of modes) {
      const result = spawnSync(
        process.execPath,
        [
          "--conditions=uttori-source",
          "--import=tsx",
          fileURLToPath(import.meta.url),
          scenario,
          capture,
        ],
        { stdio: "inherit" },
      );
      if (result.status !== 0) {
        // This process is a spawned fixture and the status is the result.
        // oxlint-disable-next-line unicorn/no-process-exit
        process.exit(result.status ?? 1);
      }
    }
  }
  // This process is a spawned fixture and the status is the result.
  // oxlint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}
assert.ok(
  [
    "original",
    "relocated",
    "relocation-only",
    "code-before",
    "code-after",
    "source-baseline",
    "expanded",
    "compressed",
  ].includes(mode),
);
const codeScenario = mode === "code-before" || mode === "code-after";
const expansionScenario = mode === "source-baseline" || mode === "expanded";
const compressedScenario = mode === "compressed";
const defaultCapture = codeScenario ? "witch-small-room-2-chest.act2" : "chest-bomb.act2";
const name = process.argv[3] ?? defaultCapture;
assert.ok(/^[\w-]+\.act2$/.test(name));
const context = path.join(root, "disassembly/captures", `${name}.context`);
const manifest = JSON.parse(fs.readFileSync(path.join(context, "manifest.json"), "utf8"));
const runtime = path.join(application, "fixtures/external/ares/runtime");
const runtimeManifest = JSON.parse(
  fs.readFileSync(path.join(runtime, "ares-runtime-manifest.json"), "utf8"),
);
const executable = path.join(runtime, "ares.app/Contents/MacOS/ares");
assert.equal(sourceContentHash(fs.readFileSync(executable)), runtimeManifest.executableSha256);
assert.equal(
  manifest.producer.revision,
  `${runtimeManifest.forkRevision}:${runtimeManifest.patchSha256}:${runtimeManifest.executableSha256}`,
);
const directory = fs.mkdtempSync(path.join(root, `.verification/runtime-${mode}-`));
let sourceRom = path.join(root, "Secret of Mana (USA).sfc");
let codeReport, expansionReport, compressedReport;
if (compressedScenario) {
  compressedReport = JSON.parse(
    fs.readFileSync(path.join(root, ".verification/compressed-relocation.json"), "utf8"),
  );
  assert.equal(compressedReport.success, true);
  sourceRom = compressedReport.afterRom;
} else if (codeScenario || mode === "source-baseline") {
  codeReport = JSON.parse(
    fs.readFileSync(path.join(root, ".verification/code-relocation.json"), "utf8"),
  );
  assert.equal(codeReport.success, true);
  sourceRom = mode === "code-after" ? codeReport.afterRom : codeReport.beforeRom;
} else if (mode === "expanded") {
  expansionReport = JSON.parse(
    fs.readFileSync(path.join(root, ".verification/expansion.json"), "utf8"),
  );
  assert.equal(expansionReport.success, true);
  sourceRom = expansionReport.afterRom;
} else if (mode !== "original") {
  const sourceReport = mode === "relocated" ? "relocation-grow" : "relocation-runtime-baseline";
  const report = JSON.parse(
    fs.readFileSync(path.join(root, `.verification/${sourceReport}.json`), "utf8"),
  );
  const build = report.operations.find((operation) => operation.action === "build").result;
  const expectedHash = build.verification.outputSha256;
  const retained = path.join(root, ".verification/runtime-oracles", `${expectedHash}.sfc`);
  if (!fs.existsSync(retained)) {
    let bytes;
    if (fs.existsSync(build.outputFile)) {
      bytes = fs.readFileSync(build.outputFile);
    } else {
      // Successful build caches are intentionally bounded. Reconstruct this specific independent
      // oracle from the retained combined-edit image and verify its previously proven full hash.
      bytes = fs.readFileSync(path.join(root, ".verification/code-relocation-before.sfc"));
      if (mode === "relocation-only") {
        for (const [offset, value] of [
          [0x8e13e, 0x3f],
          [0x8ffc0, 0x6b],
          [0x82b8a, 8],
          [0x63559, 0xf0],
        ]) {
          bytes[offset] = value;
        }
      }
    }
    assert.equal(sourceContentHash(bytes), expectedHash);
    fs.mkdirSync(path.dirname(retained), { recursive: true });
    fs.writeFileSync(retained, bytes);
  }
  assert.equal(sourceContentHash(fs.readFileSync(retained)), expectedHash);
  sourceRom = retained;
}
const rom = fs.readFileSync(sourceRom),
  romSha256 = sourceContentHash(rom);
if (codeReport) {
  assert.equal(
    romSha256,
    mode === "code-after" ? codeReport.expectedSha256 : codeReport.beforeSha256,
  );
}
if (expansionReport) {
  assert.equal(romSha256, expansionReport.expectedSha256);
}
if (compressedReport) {
  assert.equal(romSha256, compressedReport.expectedSha256);
}
const romPath = path.join(directory, "program.sfc");
fs.writeFileSync(romPath, rom);
fs.mkdirSync(path.join(directory, "systems"));
fs.writeFileSync(path.join(directory, "settings.bml"), "");
let replayDirectory = context;
if (mode !== "original") {
  replayDirectory = path.join(directory, "derived-start-state");
  fs.mkdirSync(replayDirectory);
  for (const file of [
    "start.bst",
    "machine.json",
    "start-clock.txt",
    "end-clock.txt",
    "inputs.bin",
    "wram-end.bin",
  ]) {
    const bytes = fs.readFileSync(path.join(context, file));
    assert.equal(sourceContentHash(bytes), manifest.files[file].sha256);
    fs.writeFileSync(path.join(replayDirectory, file), bytes);
  }
  // This is an explicitly derived test state for another ROM, never an altered capture bundle or
  // a claim of original replay equivalence. The test proves execution of the moved table directly.
  fs.writeFileSync(
    path.join(replayDirectory, "identity.txt"),
    `${romSha256}\nares\n${manifest.producer.revision}\n`,
  );
  fs.writeFileSync(
    path.join(replayDirectory, "provenance.json"),
    JSON.stringify(
      {
        derivedFrom: sourceContentHash(fs.readFileSync(path.join(context, "manifest.json"))),
        romSha256,
        purpose:
          "Execute modified source from the verified original chest-scenario starting state.",
      },
      null,
      2,
    ),
  );
} else {
  assert.equal(romSha256, manifest.romContentSha256);
}
const probe = net.createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const settings = [
  "Developer/DebugServerEnabled=true",
  "Developer/DebugServerUseIPv4=true",
  `Developer/DebugServerPort=${port}`,
  "Boot/AwaitGDBClient=true",
  "Boot/Fast=true",
  "Input/Defocus=Allow",
  "General/RunAhead=false",
  "General/Rewind=false",
  "Video/Driver=None",
  "Audio/Mute=true",
  "Audio/Blocking=false",
  "Video/Blocking=false",
  `Paths/Home=${directory}/systems/`,
  `Paths/Saves=${directory}/saves/`,
];
const child = spawn(
  executable,
  [
    "--no-file-prompt",
    "--system",
    "Super Famicom",
    "--settings-file",
    path.join(directory, "settings.bml"),
    ...settings.flatMap((setting) => ["--setting", setting]),
    romPath,
  ],
  { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "",
  client;
child.stdout.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
child.stderr.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
const report = {
  mode,
  capture: name,
  romSha256,
  executableSha256: runtimeManifest.executableSha256,
  directory,
  started: new Date().toISOString(),
  checks: [],
};
const started = performance.now();

/** Each continue/step waits for a real native CPU stop, with bounded cleanup on failures. */
async function execute(action, timeoutMs = 45000) {
  let timer, subscription;
  const stopped = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Native CPU stop timed out.")), timeoutMs);
    subscription = client.onStop(resolve);
  });
  try {
    await Promise.all([stopped, action()]);
  } finally {
    clearTimeout(timer);
    subscription.dispose();
  }
}
const registers = async () => Buffer.from(await client.request("g"), "hex");
const pc = (bytes) => bytes[11] * 65536 + bytes.readUInt16LE(12);
/** Capture replies use a JSON-in-hex envelope so RSP escaping cannot alter their payload. */
async function captureRequest(command, session) {
  const response = await client.request(command);
  assert.match(response, /^J[\da-f]+$/);
  return validateCapturePosition(
    JSON.parse(Buffer.from(response.slice(1), "hex").toString("utf8")),
    session,
    "snes.cpu-bus-ppu",
  );
}
/** Read the complete CPU-visible WRAM in bounded RSP packets for independent execution comparisons. */
async function wramHash() {
  const wram = Buffer.alloc(0x20000);
  for (let offset = 0; offset < wram.length; offset += 0x1000) {
    const bytes = Buffer.from(
      await client.request(`m${(0x7e0000 + offset).toString(16)},1000`),
      "hex",
    );
    assert.equal(bytes.length, 0x1000);
    bytes.copy(wram, offset);
  }
  return sourceContentHash(wram);
}
try {
  const deadline = Date.now() + 15000;
  for (;;) {
    assert.equal(child.exitCode, null, log);
    try {
      const transport = await NodeTcpGdbRspTransport.connect({
        host: "127.0.0.1",
        port,
        connectTimeoutMs: 500,
      });
      client = new GdbRspClient({ transport, requestTimeoutMs: 5000 });
      await client.start();
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await delay(50);
    }
  }
  assert.match(await client.request("qSupported"), /uttoriCaptureContext\+/);
  await client.requestStop("?");
  if (mode !== "original" && !expansionScenario && !compressedScenario) {
    assert.equal(await client.request("Z0,c8e24d,1"), "OK");
  }
  assert.equal(
    await client.request(
      [
        "qUttoriContext",
        compressedScenario ? "restore" : "replay",
        hex(replayDirectory),
        hex(romSha256),
        hex("ares"),
        hex(manifest.producer.revision),
      ].join(":"),
    ),
    compressedScenario ? "restored" : "replaying",
  );
  if (compressedScenario) {
    const initial = await registers();
    /** Set a controlled native-mode entry without modifying the ROM or capture bundle. */
    const entry = async (address, a, p) => {
      const value = Buffer.from(initial);
      value.writeUInt16LE(a, 0);
      value.writeUInt16LE(0x1ff, 6);
      value.writeUInt16LE(0, 8);
      value[10] = 0;
      value[11] = address >>> 16;
      value.writeUInt16LE(address & 0xffff, 12);
      value[14] = p;
      value[15] = 0;
      assert.equal(await client.request(`G${value.toString("hex")}`), "OK");
    };
    /** Execute one existing STA to configure hardware through the real CPU bus, not a ROM patch. */
    const store = async (address, value) => {
      let bytes = Buffer.from([0x8f, address & 0xff, address >>> 8, 0]);
      let offset = rom.indexOf(bytes);
      if (offset < 0) {
        bytes = Buffer.from([0x8d, address & 0xff, address >>> 8]);
        offset = rom.indexOf(bytes);
      }
      assert.ok(offset >= 0 && offset < 0x200000);
      await entry(0xc00000 + offset, value, 0x24);
      assert.equal(
        await client.request(`m${(0xc00000 + offset).toString(16)},${bytes.length}`),
        bytes.toString("hex"),
      );
      await execute(() => client.step());
    };
    await store(0x4200, 0); // No asynchronous interrupt handler should become part of this bounded function proof.
    await store(0x420c, 0);
    await store(0x2100, 0x80); // Forced blank makes the actual PPU acceptance decision deterministic.
    await store(0x2115, 0x80);
    await entry(0xc22614, 0, 0x04);
    assert.equal(await client.request("Z0,c22642,1"), "OK");
    await execute(() => client.continue());
    assert.equal(pc(await registers()), 0xc22642);
    assert.equal(await client.request("m95,1"), "e0");
    assert.equal(await client.request("m97,2"), "0000");
    const encoded = rom.subarray(0x200000, 0x200000 + compressedReport.encodedLength);
    assert.equal(sourceContentHash(encoded), compressedReport.encodedSha256);
    const intermediate = Buffer.from(decompressSomLz(encoded).data);
    const actual = Buffer.alloc(intermediate.length);
    for (let offset = 0; offset < actual.length; offset += 0x1000) {
      const count = Math.min(0x1000, actual.length - offset);
      const bytes = Buffer.from(
        await client.request(`m${(0x7f6000 + offset).toString(16)},${count.toString(16)}`),
        "hex",
      );
      assert.equal(bytes.length, count);
      bytes.copy(actual, offset);
    }
    assert.deepEqual(actual, intermediate);
    assert.equal(await client.request("z0,c22642,1"), "OK");
    assert.equal(await client.request("Z0,c225ac,1"), "OK");
    const archive = path.join(root, `.verification/compressed-runtime-${Date.now()}.act2`);
    const capture = await captureRequest(
      [
        "qUttoriCaptureFile",
        "start",
        8388608,
        "bus-ppu",
        hex(archive),
        romSha256,
        hex("ares"),
        hex(manifest.producer.revision),
      ].join(":"),
    );
    await execute(() => client.continue());
    assert.equal(pc(await registers()), 0xc225ac);
    let status = await captureRequest(
      `qUttoriCaptureFile:stop:${capture.session}`,
      capture.session,
    );
    const finishBy = Date.now() + 30000;
    while (status.state !== "complete") {
      assert.notEqual(status.state, "incomplete");
      assert.ok(Date.now() < finishBy, "Native capture did not finish");
      await delay(100);
      status = await captureRequest(
        `qUttoriCaptureFile:status:${capture.session}`,
        capture.session,
      );
    }
    const writes = [];
    const recovered = await recoverCaptureFile(archive, (chunk) => {
      assert.equal(chunk.scope, "snes.cpu-bus-ppu");
      writes.push(
        ...chunk.events.filter(
          (event) =>
            event.direction === "write" &&
            event.actor === "cpu" &&
            [0x2118, 0x2119].includes(event.address) &&
            event.pc >= 0xc2255e &&
            event.pc <= 0xc225ac,
        ),
      );
    });
    assert.equal(recovered.complete, true);
    const expected = fs.readFileSync(compressedReport.decodedPixels);
    assert.equal(sourceContentHash(expected), compressedReport.pixelsSha256);
    assert.equal(writes.length, expected.length);
    for (const [index, write] of writes.entries()) {
      assert.equal(write.address, 0x2118 + (index % 2));
      assert.equal(write.value, expected[index]);
      assert.equal(write.ppu?.outcome, "written");
      assert.equal(write.ppu?.forcedBlank, true);
      assert.deepEqual(write.ppu?.bytes, [{ address: 0xc400 + index, value: expected[index] }]);
    }
    report.checks.push({
      check:
        "native boss loader consumes the repaired split pointer, LZ decodes into WRAM, and writes every edited pixel byte to actual VRAM",
      archive,
      intermediateBytes: intermediate.length,
      vramBytes: writes.length,
      pixelsSha256: compressedReport.pixelsSha256,
    });
  } else {
    await execute(() => client.continue());
  }
  if (compressedScenario) {
    report.functionExit = pc(await registers());
  } else if (expansionScenario) {
    report.replayState = await client.request("qUttoriContext:status");
    report.endpointRegisters = (await registers()).toString("hex");
    report.endpointWramSha256 = await wramHash();
    if (mode === "expanded") {
      const baseline = JSON.parse(
        fs.readFileSync(
          path.join(root, `.verification/runtime-source-baseline-${name}.json`),
          "utf8",
        ),
      );
      assert.equal(baseline.success, true);
      assert.equal(
        baseline.romSha256,
        "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
      );
      assert.equal(report.replayState, baseline.replayState);
      assert.equal(report.endpointRegisters, baseline.endpointRegisters);
      assert.equal(report.endpointWramSha256, baseline.endpointWramSha256);
      report.checks.push({
        check:
          "expanded ROM matches modified 2 MiB baseline at replay stop: CPU registers, 128 KiB WRAM and replay status",
      });
    }
  } else if (mode !== "original") {
    const before = await registers();
    assert.equal(pc(before), 0xc8e24d);
    assert.equal(await client.request("mc8e24d,3"), "fcc0ff");
    const x = before.readUInt16LE(2);
    assert.ok(x % 2 === 0 && x < 20);
    const expectedTarget = 0xc80000 | rom.readUInt16LE(0x8ffc0 + x);
    await execute(() => client.step());
    assert.equal(pc(await registers()), expectedTarget);
    report.checks.push({
      check: "indexed JSR consumes relocated table",
      x,
      target: expectedTarget,
    });
    assert.equal(await client.request("z0,c8e24d,1"), "OK");
    if (codeScenario) {
      assert.equal(x, 6, "The recorded scenario must execute the type-three handler");
      assert.equal(expectedTarget, mode === "code-before" ? 0xc8e2b5 : 0xc8ffd4);
      const count = mode === "code-before" ? 5 : 6;
      report.instructionAddresses = [];
      for (let instruction = 0; instruction < count; instruction++) {
        report.instructionAddresses.push(pc(await registers()));
        await execute(() => client.step());
      }
      const returned = await registers();
      assert.equal(pc(returned), 0xc8e250);
      report.returnRegisters = returned.toString("hex");
      report.returnWramSha256 = await wramHash();
      if (mode === "code-after") {
        const baseline = JSON.parse(
          fs.readFileSync(
            path.join(root, `.verification/runtime-code-before-${name}.json`),
            "utf8",
          ),
        );
        assert.equal(baseline.success, true);
        assert.equal(baseline.romSha256, codeReport.beforeSha256);
        assert.equal(report.returnRegisters, baseline.returnRegisters);
        assert.equal(report.returnWramSha256, baseline.returnWramSha256);
        assert.ok(report.instructionAddresses.includes(0xc8ffde), "The inserted NOP was executed");
        report.checks.push({
          check: "grown relocated leaf returns with identical CPU registers and all 128 KiB WRAM",
          instructions: count,
        });
      }
    } else {
      await execute(() => client.continue());
      report.modifiedReplayState = await client.request("qUttoriContext:status");
    }
    if (mode === "relocation-only") {
      assert.equal(report.modifiedReplayState, "idle");
      assert.equal(pc(await registers()), manifest.boundaries.end.pc);
      report.checks.push({
        check: "relocation-only input timing and complete endpoint WRAM match",
        pc: manifest.boundaries.end.pc,
      });
    }
  } else {
    assert.equal(await client.request("qUttoriContext:status"), "idle");
    assert.equal(pc(await registers()), manifest.boundaries.end.pc);
    report.checks.push({
      check: "original input timing and complete endpoint WRAM match",
      pc: manifest.boundaries.end.pc,
    });
  }
  report.success = true;
  console.log(JSON.stringify(report));
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await client?.close().catch(() => undefined);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
  report.elapsedMs = performance.now() - started;
  report.log = log;
  if (report.success) {
    fs.rmSync(directory, { recursive: true, force: true });
    report.temporaryRuntimeRemoved = true;
  }
  fs.writeFileSync(
    path.join(root, `.verification/runtime-${mode}-${name}.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
}
