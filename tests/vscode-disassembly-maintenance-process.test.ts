import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { loadSourceExportManifest, loadAnalysisProjectSnapshot } from "@uttori/asm-disassembler";
import { initializeSnesDisassemblyWorkspace } from "@uttori/asm-plugin-snes";
import { DisassemblyMaintenanceClient } from "../packages/vscode-extension/src/disassembly-maintenance-client.js";
import type { ResolvedProjectSource } from "../packages/vscode-extension/src/disassembly-maintenance-data.js";
import { test } from "./ava-helper.js";

const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-tests-"));
const processFile = path.join(bundleRoot, "maintenance.cjs");
await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/disassembly-maintenance-process.ts")],
  outfile: processFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
test.after.always(() => fs.rmSync(bundleRoot, { recursive: true, force: true }));
const budget = { maxMemoryMiB: 256 };

const fixtureRom = (): Uint8Array => {
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xea, 0xea, 0xdb]);
  bytes.fill(0x20, 0x7fc0, 0x7fd5);
  bytes.set(new TextEncoder().encode("MAINTENANCE TEST"), 0x7fc0);
  bytes[0x7fd5] = 0x20;
  bytes[0x7fd7] = 0x05;
  bytes.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  bytes.fill(0, 0x7fe0);
  bytes.set([0, 0x80], 0x7ffc);
  return bytes;
};

test("maintenance processes import, analyze, export and verify without returning loaded shards", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-roundtrip-"));
  const client = new DisassemblyMaintenanceClient(processFile);
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const romFile = path.join(directory, "rom.sfc");
  const sourceDirectory = path.join(directory, "source");
  fs.writeFileSync(romFile, fixtureRom());
  await initializeSnesDisassemblyWorkspace({
    romFile,
    outputDirectory: sourceDirectory,
    mapper: "lorom",
  });
  const target = {
    romFile,
    sourceDirectory,
    projectDirectory: path.join(sourceDirectory, "analysis"),
    sourceManifest: loadSourceExportManifest(sourceDirectory),
  };
  const traceFile = path.join(directory, "trace.json");
  fs.writeFileSync(
    traceFile,
    JSON.stringify({
      format: "uttori-asm-instruction-trace",
      schemaVersion: 1,
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      romContentSha256: target.sourceManifest.rom.contentSha256,
      producer: { id: "test", revision: "1" },
      chunks: [
        {
          sequenceStart: 1,
          addresses: [0x008000, 0x008001, 0x008002],
          droppedEvents: 0,
          active: false,
        },
      ],
    }),
  );
  const input = {
    target,
    traceFile,
    maxBytes: 1024 * 1024,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
  };
  const imported = await client.run("import", input, budget);
  t.is(imported.observedEvents, 3);
  t.true(imported.changed);
  t.is(imported.seeds.length, 3);
  t.false("batch" in imported);
  t.false((await client.run("import", input, budget)).changed);
  const prepared = await client.run("prepare", { target, seeds: imported.seeds }, budget);
  t.false("shards" in prepared);
  const prior = loadAnalysisProjectSnapshot(target.projectDirectory).revision;
  await t.throwsAsync(client.run("analyze", { target, entryPoints: [], maxWorkItems: 1 }, budget), {
    message: /known code.*preserved/s,
  });
  t.deepEqual(loadAnalysisProjectSnapshot(target.projectDirectory).revision, prior);
  const analyzed = await client.run(
    "analyze",
    { target, entryPoints: prepared.entryPoints, maxWorkItems: 100000 },
    budget,
  );
  t.is(analyzed.status, "complete");
  t.true(analyzed.manifest.shards.every((shard) => shard.path.includes("/generations/")));
  const exported = await client.run("export", target, budget);
  t.true((await client.run("verify", target, budget)).comparison.equal);
  const after = await client.run(
    "coverage",
    { ...target, sourceManifest: exported.manifest },
    budget,
  );
  t.is(after.manifestSha256, exported.manifest.sourceProjectSha256);
  t.true(after.codeBytes >= prepared.before.codeBytes);
  const execution = await client.run(
    "execution",
    { projectDirectory: target.projectDirectory, traceFile, maxBytes: 1024 * 1024 },
    budget,
  );
  t.is(execution.observedEvents, 3);
});

const fakeFile = path.join(bundleRoot, "child.cjs");
fs.writeFileSync(
  fakeFile,
  `process.on('message', (message) => {
 if (message.type !== 'run') return;
 if (message.job.input.projectDirectory === 'crash') { process.stderr.write('test child failure'); process.exit(23); }
 process.send({type:'progress',progress:{message:'busy'}});
 const start=Date.now();while(Date.now()-start<200) {}
 process.send({type:'result',value:{manifestSha256:String(process.pid)}});
 setTimeout(() => process.disconnect(), 100);
});`,
);
const fakeInput = { projectDirectory: "normal" } as ResolvedProjectSource;

test("CPU-heavy maintenance keeps the host responsive and exits before resolving each phase", async (t) => {
  const client = new DisassemblyMaintenanceClient(fakeFile);
  t.teardown(() => client.dispose());
  let ticks = 0;
  const heartbeat = setInterval(() => ticks++, 10);
  t.teardown(() => clearInterval(heartbeat));
  const first = await client.run("coverage", fakeInput, budget);
  t.true(ticks >= 5);
  t.not(Number(first.manifestSha256), process.pid);
  t.throws(() => process.kill(Number(first.manifestSha256), 0), { code: "ESRCH" });
  const second = await client.run("coverage", fakeInput, budget);
  t.not(first.manifestSha256, second.manifestSha256);
});

test("abnormal child exit reports diagnostics and a fresh process can retry", async (t) => {
  const client = new DisassemblyMaintenanceClient(fakeFile);
  t.teardown(() => client.dispose());
  await t.throwsAsync(client.run("coverage", { ...fakeInput, projectDirectory: "crash" }, budget), {
    message: /exited \(23\).*asm.analysis.maxMemoryMiB.*test child failure/s,
  });
  t.truthy(await client.run("coverage", fakeInput, budget));
});

test("cancellation waits for the current phase, then prevents further jobs", async (t) => {
  const client = new DisassemblyMaintenanceClient(fakeFile);
  t.teardown(() => client.dispose());
  const cancellation = new AbortController();
  await t.throwsAsync(
    client.run("coverage", fakeInput, {
      ...budget,
      signal: cancellation.signal,
      onProgress: ({ message }) => {
        if (message === "busy") cancellation.abort();
      },
    }),
    { message: /cancelled after finishing the current step/ },
  );
  await t.throwsAsync(
    client.run("coverage", fakeInput, { ...budget, signal: cancellation.signal }),
    { message: /cancelled/ },
  );
  t.truthy(await client.run("coverage", fakeInput, budget));
  client.dispose();
  await t.throwsAsync(client.run("coverage", fakeInput, budget), { message: /disposed/ });
});
