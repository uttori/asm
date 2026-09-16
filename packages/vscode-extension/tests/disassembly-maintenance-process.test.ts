import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  initializeSnesDisassemblyWorkspace,
  type ExportSnesProjectResult,
} from "@uttori/asm-plugin-snes";
import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";
import { writeCaptureFixture } from "../../../tests/helpers/capture-archive.js";
import {
  loadSourceExportManifest,
  loadAnalysisProjectSnapshot,
  openAnalysisProjectStore,
  loadAnalysisProjectViewSnapshot,
  type RuntimeEvidenceRecord,
} from "../../disassembler/src/index.js";
import { AnalysisWorkerClient } from "../src/analysis-worker-client.js";
import type { AnnotationSaveResult } from "../src/disassembly-annotation-data.js";
import { DisassemblyMaintenanceClient } from "../src/disassembly-maintenance-client.js";
import type { ResolvedProjectSource } from "../src/disassembly-maintenance-data.js";
import type { MaintenanceStageTiming } from "../src/disassembly-timings.js";

const bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-tests-"));
const processFile = path.join(bundleRoot, "maintenance.cjs");
const workerFile = path.join(bundleRoot, "analysis-worker.cjs");
await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/disassembly-maintenance-process.ts")],
  outfile: processFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/analysis-worker.ts")],
  outfile: workerFile,
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

test("annotation refresh reuses analysis, preserves runtime, verifies renamed source, and guards stale receipts", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-refresh-"));
  const client = new DisassemblyMaintenanceClient(processFile);
  const annotations = new AnalysisWorkerClient(workerFile, { maxMemoryMiB: () => 256 });
  t.teardown(() => {
    client.dispose();
    annotations.dispose();
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
  const retainedRuntime: RuntimeEvidenceRecord = {
    id: "pending-execution",
    kind: "runtime-execution",
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x8000,
    count: 7,
    evidence: [],
  };
  const store = openAnalysisProjectStore(target.projectDirectory);
  try {
    store.transaction(() => {
      store.insertRuntime(retainedRuntime);
      store.publishManifest(store.manifest());
    });
    store.writePointer(target.projectDirectory);
  } finally {
    store.close();
  }
  const snapshot = loadAnalysisProjectViewSnapshot(target.projectDirectory);
  const saved = await annotations.request<AnnotationSaveResult>(
    target.projectDirectory,
    "annotationSave",
    {
      annotationSave: {
        revision: snapshot.revision,
        sourceDirectory,
        request: {
          addressSpace: "snes.cpu",
          address: 0x8000,
          labelId: "manual.entry",
          name: "AnnotatedEntry",
          comment: "Entry documentation",
          inlineComment: "Label note",
          instructionCommentId: "manual.instruction",
          instructionComment: "Instruction note",
          evidenceId: "manual.annotation",
          sourceId: "test",
        },
      },
    },
  );
  const receipt = saved.refresh;
  const beforeCoverage = await client.run("coverage", target, budget);
  t.is(beforeCoverage.runtimeRecords, 1);
  t.is(beforeCoverage.runtimeEvents, 7);
  t.is(
    await client.run("refresh", { target, receipt: { ...receipt, after: "stale" } }, budget),
    undefined,
  );
  const exported = await annotations.request<ExportSnesProjectResult | undefined>(
    target.projectDirectory,
    "annotationRefresh",
    { annotationRefresh: { target, receipt } },
  );
  t.truthy(exported);
  t.is(exported?.manifest.sourceProjectSha256, receipt.after);
  const text = exported!.manifest.files
    .filter((file) => file.path.endsWith(".asm"))
    .map((file) => fs.readFileSync(path.join(sourceDirectory, file.path), "utf8"))
    .join("\n");
  for (const value of ["AnnotatedEntry", "Entry documentation", "Label note", "Instruction note"])
    t.true(text.includes(value));
  t.true((await client.run("verify", target, budget)).comparison.equal);
  t.is(await client.run("revision", target, budget), receipt.after);
  t.deepEqual(
    loadAnalysisProjectViewSnapshot(target.projectDirectory).view.analysis,
    snapshot.view.analysis,
  );
  const afterCoverage = await client.run(
    "coverage",
    { ...target, sourceManifest: exported!.manifest },
    budget,
  );
  t.is(afterCoverage.instructions, beforeCoverage.instructions);
  t.is(afterCoverage.runtimeEvents, beforeCoverage.runtimeEvents);
  t.is(
    await annotations.request(target.projectDirectory, "annotationRefresh", {
      annotationRefresh: { target, receipt: { after: "stale" } },
    }),
    undefined,
  );
  t.deepEqual(loadAnalysisProjectSnapshot(target.projectDirectory).shards.runtime, [
    retainedRuntime,
  ]);
  fs.appendFileSync(path.join(sourceDirectory, "ram-map.json"), "\n");
  t.is(
    await client.run(
      "refresh",
      {
        target: { ...target, sourceManifest: exported!.manifest },
        receipt,
      },
      budget,
    ),
    undefined,
  );
});

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
          addresses: [0x008000],
          details: [{ bytes: [0xea], state: { p: 0x30, e: 1, a: 3, x: 1 } }],
          droppedEvents: 0,
          active: false,
        },
        { sequenceStart: 2, addresses: [0x008001, 0x008002], droppedEvents: 0, active: false },
      ],
    }),
  );
  const input = {
    target,
    traceFile,
    maxBytes: 1024 * 1024,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    indexMode: "65816-disassembly" as const,
  };
  const imported = await client.run("import", input, budget);
  t.is(imported.observedEvents, 3);
  t.true(imported.changed);
  t.is(imported.seeds.length, 3);
  t.false("batch" in imported);
  const indexed = loadAnalysisProjectSnapshot(target.projectDirectory);
  t.true(indexed.shards.runtime.some((record) => record.kind === "runtime-instruction"));
  t.true(
    indexed.shards.runtime
      .filter((record) => record.kind === "runtime-cpu-state")
      .every((record) => !("a" in record.state)),
  );
  t.false((await client.run("import", input, budget)).changed);
  const prepared = await client.run("prepare", { target, seeds: imported.seeds }, budget);
  t.false("shards" in prepared);
  const prior = loadAnalysisProjectSnapshot(target.projectDirectory).revision;
  const stages: MaintenanceStageTiming[] = [];
  const timedBudget = {
    ...budget,
    onProgress: ({ timing }: { timing?: MaintenanceStageTiming }) => {
      if (timing) stages.push(timing);
    },
  };
  await t.throwsAsync(
    client.run("analyze", { target, entryPoints: [], maxWorkItems: 1 }, timedBudget),
    {
      message: /known code.*preserved/s,
    },
  );
  t.is(stages.at(-1)?.status, "failed", "worker failure preserves the interrupted stage's timing");
  stages.length = 0;
  t.deepEqual(loadAnalysisProjectSnapshot(target.projectDirectory).revision, prior);
  const analyzed = await client.run(
    "analyze",
    { target, entryPoints: prepared.entryPoints, maxWorkItems: 100000 },
    timedBudget,
  );
  t.true(stages.some(({ step }) => step === "Preparing SQL instruction indexes."));
  t.true(stages.some(({ step }) => step === "Grouping captured instruction variants in SQLite."));
  t.true(
    stages.some(({ step }) => step === "Publishing analysis after checking for concurrent edits."),
  );
  t.true(
    stages.every(
      ({ durationMs, status }) =>
        Number.isFinite(durationMs) && durationMs >= 0 && status === "completed",
    ),
  );
  t.is(analyzed.status, "complete");
  t.is(analyzed.manifest.db, "analysis.sqlite");
  const exported = await client.run("export", target, budget);
  t.true((await client.run("verify", target, budget)).comparison.equal);
  const after = await client.run(
    "coverage",
    { ...target, sourceManifest: exported.manifest },
    budget,
  );
  t.is(after.manifestSha256, exported.manifest.sourceProjectSha256);
  t.true(after.codeBytes >= prepared.before.codeBytes);
});

test("maintenance workers import ACT2 directly and reject a bad tail without changing the project", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-act2-"));
  const logs: string[] = [];
  const client = new DisassemblyMaintenanceClient(processFile, {
    info: (message) => logs.push(message),
    warn: (message) => logs.push(message),
    error: (message) => logs.push(message),
  });
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
  const traceFile = path.join(directory, "capture.act2");
  await writeCaptureFixture(traceFile, 3, 2, target.sourceManifest.rom.contentSha256);
  const input = {
    target,
    traceFile,
    maxBytes: 1024 * 1024,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
  };
  const imported = await client.run("import", input, budget);
  t.is(imported.observedEvents, 3);
  t.is(imported.seeds.length, 3);
  t.true(logs.some((message) => message.includes(`capture=${traceFile}`)));
  t.true(logs.some((message) => message.includes("provisional records merged")));
  t.true(logs.some((message) => message.includes("Runtime import committed")));
  t.true(logs.some((message) => message.includes("Completed; worker exited")));
  t.false(fs.existsSync(`${traceFile}.json`));

  const before = loadAnalysisProjectSnapshot(target.projectDirectory);
  fs.appendFileSync(traceFile, "bad tail");
  await t.throwsAsync(client.run("import", input, budget), { message: /incomplete/ });
  t.true(logs.some((message) => message.includes("Capture archive is incomplete")));
  t.deepEqual(loadAnalysisProjectSnapshot(target.projectDirectory), before);
});

test.serial(
  "import and regeneration preserve runtime history larger than the child heap",
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-large-history-"));
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
    const projectDirectory = path.join(sourceDirectory, "analysis");
    const manifestFile = path.join(projectDirectory, "analysis.json");
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    // Each unique history value expands independently on load: over 156 MiB of text alone.
    // Streaming fixture construction keeps both the test host and the 128 MiB child bounded.
    function* history(): Generator<RuntimeEvidenceRecord> {
      for (let index = 0; index < 40_000; index++)
        yield {
          id: `state:${index}`,
          kind: index % 2 ? "runtime-instruction" : "runtime-cpu-state",
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
          address: 0x8000,
          count: 1,
          state: { p: 0x30, e: 1, a: index, history: `${index}:${"x".repeat(4096)}` },
          ...(index % 2 ? { bytes: [0xea] } : {}),
          evidence: [],
        };
      yield {
        id: "executed",
        kind: "runtime-execution",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x8000,
        count: 40_000,
        evidence: [],
      };
    }
    const store = openAnalysisProjectStore(projectDirectory);
    try {
      store.transaction(() => {
        for (const record of history()) store.insertRuntime(record);
        store.publishManifest(manifest);
      });
      store.writePointer(projectDirectory);
    } finally {
      store.close();
    }
    const runtimeCount = (): number => {
      const store = openAnalysisProjectStore(projectDirectory);
      try {
        return store.counts().runtime!;
      } finally {
        store.close();
      }
    };
    const target = {
      romFile,
      sourceDirectory,
      projectDirectory,
      sourceManifest: loadSourceExportManifest(sourceDirectory),
    };
    const smallHeap = { maxMemoryMiB: 128 };
    const prepared = await client.run("prepare", { target }, smallHeap);
    t.is(prepared.before.runtimeEvents, 40_000);
    const analyzed = await client.run(
      "analyze",
      { target, entryPoints: [], maxWorkItems: 100_000 },
      smallHeap,
    );
    t.is(analyzed.status, "complete");
    t.is(analyzed.capturedInstructions, 1);
    t.is(runtimeCount(), 40_001);
    const exported = await client.run("export", target, smallHeap);
    t.true((await client.run("verify", target, smallHeap)).comparison.equal);
    const after = await client.run(
      "coverage",
      { ...target, sourceManifest: exported.manifest },
      smallHeap,
    );
    t.is(after.runtimeEvents, 40_000);
    // The incoming capture also exceeds the child heap, with every snapshot distinct. This exercises
    // disk aggregation, merging against existing history, ID validation and exact reimport together.
    const traceFile = path.join(directory, "large-trace.json");
    const descriptor = fs.openSync(traceFile, "wx");
    try {
      const header = JSON.stringify({
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: target.sourceManifest.rom.contentSha256,
        producer: { id: "test", revision: "large" },
      });
      fs.writeSync(descriptor, `${header.slice(0, -1)},"chunks":[`);
      for (let index = 0; index < 20_000; index++) {
        if (index) fs.writeSync(descriptor, ",");
        fs.writeSync(
          descriptor,
          JSON.stringify({
            sequenceStart: index + 1,
            addresses: [0x8000],
            droppedEvents: 0,
            active: false,
            details: [
              {
                bytes: [0xea],
                state: { p: 0x30, e: 1, a: index, history: `${index}:${"y".repeat(8192)}` },
              },
            ],
          }),
        );
      }
      fs.writeSync(descriptor, "]}");
    } finally {
      fs.closeSync(descriptor);
    }
    t.true(fs.statSync(traceFile).size > 128 * 1024 * 1024);
    const input = {
      target,
      traceFile,
      maxBytes: 256 * 1024 * 1024,
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      indexMode: "full" as const,
    };
    const imported = await client.run("import", input, smallHeap);
    t.is(imported.observedEvents, 20_000);
    t.is(imported.added.runtime, 40_001);
    t.false((await client.run("import", input, smallHeap)).changed);
    const updated = await client.run(
      "analyze",
      { target, entryPoints: [], maxWorkItems: 100_000 },
      smallHeap,
    );
    t.is(updated.capturedInstructions, 1);
    t.is(runtimeCount(), 80_002);
  },
);

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
