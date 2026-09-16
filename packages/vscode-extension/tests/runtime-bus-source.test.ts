import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";
import {
  captureFixtureHeader,
  writeCaptureFixture,
} from "../../../tests/helpers/capture-archive.js";
import {
  busChunk,
  busJsonFrame,
  busPosition,
  busScope,
  busSession,
  type BusWireAccess,
} from "../../../tests/helpers/capture-bus.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  createRuntimeBusTraceImporter,
  importRuntimeBusTraceSourceIntoProject,
  loadAnalysisProject,
  openAnalysisProjectStore,
  writeAnalysisProject,
  type AnalysisProject,
} from "../../disassembler/src/index.js";
import { renderBusTraceReport } from "../src/bus-trace-report.js";
import { DisassemblyMaintenanceClient } from "../src/disassembly-maintenance-client.js";
import { createEditorRuntimeBusSource } from "../src/runtime-bus-source.js";

const project: AnalysisProject = {
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
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
};
const context = {
  projectRomContentSha256: project.manifest.rom.contentSha256,
  sourceName: "bus.act2",
};
const header = {
  ...captureFixtureHeader,
  romContentSha256: context.projectRomContentSha256,
  scope: busScope,
};
const records: BusWireAccess[] = [
  {},
  { actor: 1, channel: 0, phase: 1 },
  { actor: 1, channel: 0, phase: 1, direction: 1 },
  { actor: 2, channel: 1, phase: 2 },
  { actor: 2, channel: 1, phase: 3 },
  { actor: 2, channel: 1, phase: 4, direction: 1 },
  { ordinal: 0n, context: 2 },
];
const bytes = Buffer.concat([
  busJsonFrame("ACS2", header),
  busChunk(records),
  busJsonFrame("ACK2", { session: busSession, chunkThrough: "1", eventThrough: "7" }),
  busJsonFrame("END2", busPosition("7", "1", "complete")),
]);

test("ACT2 bus import runs in a bounded worker and reports channel activity without source regeneration", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-worker-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "bus.act2");
  const directory = path.join(root, "analysis");
  const processFile = path.join(root, "maintenance.cjs");
  fs.writeFileSync(file, bytes);
  writeAnalysisProject(directory, project);
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/disassembly-maintenance-process.ts")],
    outfile: processFile,
    bundle: true,
    conditions: ["uttori-source"],
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const client = new DisassemblyMaintenanceClient(processFile);
  t.teardown(() => client.dispose());
  const input = {
    projectDirectory: directory,
    romContentSha256: context.projectRomContentSha256,
    traceFile: file,
    maxBytes: bytes.length,
  };
  const result = await client.run("importBus", input, { maxMemoryMiB: 256 });
  t.is(result.observedEvents, 7);
  t.is(result.summary.contexts.interrupt, 1);
  t.true(result.archive.archived);
  t.is(result.summary.activity.length, 5);
  const report = renderBusTraceReport(result);
  t.regex(report, /DMA \| 0 \| dma \| 1 \| 1/);
  t.regex(report, /HDMA \| 1 \| hdma-indirect \| 1 \| 0/);
  t.regex(report, /interrupt: 1/);
  t.regex(report, /not transfer counts/);
  t.regex(report, /require the capture archive/);
  const duplicate = await client.run("importBus", input, { maxMemoryMiB: 256 });
  t.false(duplicate.changed);
  t.is(duplicate.added.runtime, 0);
  const expired = await client.run(
    "importBus",
    { ...input, storagePolicy: { archiveMaxBytes: 0 } },
    { maxMemoryMiB: 256 },
  );
  t.false(expired.archive.archived);
  t.false(expired.changed);
  t.true(fs.existsSync(file));
  const store = openAnalysisProjectStore(directory);
  try {
    t.is(store.captureReceipt(result.sourceSha256)?.availability, "expired");
    t.is([...store.runtimeRecordsByKinds(["runtime-bus-access"])].length, 7);
    t.deepEqual(store.runtimeExecutionCounts(), { records: 0, events: 0 });
  } finally {
    store.close();
  }

  // Exercise graphics reconstruction through ACT2 framing, the worker boundary, SQL
  // publication and renamed reimports. The derived view must not alter retained fact identities.
  const graphicsRecords: BusWireAccess[] = [
    { address: 0x2100n, value: 0x80, direction: 1 },
    { address: 0x2115n, value: 0x80, direction: 1 },
    { address: 0x2116n, value: 0xff, direction: 1 },
    { address: 0x2117n, value: 0x7f, direction: 1 },
    { address: 0x2118n, value: 0xab, direction: 1, actor: 1, channel: 0, phase: 1 },
    { address: 0x2119n, value: 0xcd, direction: 1, actor: 1, channel: 0, phase: 1 },
    { address: 0x2104n, value: 0xef, direction: 1, actor: 2, channel: 1, phase: 4 },
  ];
  const graphicsFile = path.join(root, "graphics.act2");
  const graphicsBytes = Buffer.concat([
    busJsonFrame("ACS2", header),
    busChunk(graphicsRecords),
    busJsonFrame("ACK2", { session: busSession, chunkThrough: "1", eventThrough: "7" }),
    busJsonFrame("END2", busPosition("7", "1", "complete")),
  ]);
  fs.writeFileSync(graphicsFile, graphicsBytes);
  const graphicsInput = { ...input, traceFile: graphicsFile, maxBytes: graphicsBytes.length };
  const graphics = await client.run("importBus", graphicsInput, { maxMemoryMiB: 256 });
  t.deepEqual(
    graphics.summary.graphics?.writes.slice(0, 2).map((w) => w.bytes[0]!.address),
    [0xfffe, 0xffff],
  );
  t.is(graphics.summary.graphics?.writes[2]!.status, "unknown");
  const graphicsReport = renderBusTraceReport(graphics);
  t.regex(graphicsReport, /Graphics port destinations/);
  t.regex(graphicsReport, /DMA\/0 \| VRAM \| 2 \| 2 \| 0 \| 0 \| 2 \| 2/);
  t.regex(graphicsReport, /\$0FFFE = \$AB \(event 5\)/);
  t.regex(graphicsReport, /missing-oam-state/);
  t.regex(graphicsReport, /not verified graphics memory updates/);
  t.regex(graphicsReport, /before the physical 64\/128 KiB mask/);
  t.regex(
    graphicsReport,
    /Archive expiry retains bus facts and transfer totals, not this graphics view/,
  );
  const renamed = path.join(root, "renamed-graphics.act2");
  fs.copyFileSync(graphicsFile, renamed);
  const graphicsAgain = await client.run(
    "importBus",
    { ...graphicsInput, traceFile: renamed },
    { maxMemoryMiB: 256 },
  );
  t.false(graphicsAgain.changed);
  t.is(graphicsAgain.added.runtime, 0);
  t.deepEqual(graphicsAgain.summary, graphics.summary);
  t.deepEqual(graphicsAgain.report, graphics.report);
});

test("bus source rejects torn tails, replacement, wrong scope, byte budgets and cancellation", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-source-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "bus.act2");
  const directory = path.join(root, "analysis");
  writeAnalysisProject(directory, project);
  const before = loadAnalysisProject(directory);
  fs.writeFileSync(file, bytes);
  await t.throwsAsync(createEditorRuntimeBusSource(file, { maxBytes: 10 }), {
    message: /byte limit/,
  });
  for (const broken of [
    bytes.subarray(0, bytes.length - 1),
    Buffer.concat([bytes, Buffer.from("junk")]),
  ]) {
    fs.writeFileSync(file, broken);
    const source = await createEditorRuntimeBusSource(file);
    await t.throwsAsync(importRuntimeBusTraceSourceIntoProject(source, directory, context), {
      message: /incomplete/,
    });
    t.deepEqual(loadAnalysisProject(directory), before);
  }
  fs.writeFileSync(file, bytes);
  const source = await createEditorRuntimeBusSource(file);
  fs.writeFileSync(
    file,
    Buffer.concat([
      busJsonFrame("ACS2", { ...header, producer: { id: "replacement", revision: "2" } }),
      bytes.subarray(busJsonFrame("ACS2", header).length),
    ]),
  );
  await t.throwsAsync(
    source.read(() => {}),
    { message: /identity changed/ },
  );
  fs.writeFileSync(file, bytes);
  const controller = new AbortController();
  const cancelled = await createEditorRuntimeBusSource(file, {
    signal: controller.signal,
    onProgress: () => controller.abort(),
  });
  await t.throwsAsync(
    cancelled.read(() => {}),
    { name: "AbortError" },
  );
  const consumerError = new Error("consumer budget");
  const fresh = await createEditorRuntimeBusSource(file);
  t.is(
    await t.throwsAsync(
      fresh.read(() => {
        throw consumerError;
      }),
    ),
    consumerError,
  );
  const importer = createRuntimeBusTraceImporter(fresh.metadata, context);
  await fresh.read(importer.push);
  t.is(importer.finish().observedEvents, 7);
  const instructionFile = path.join(root, "instruction.act2");
  await writeCaptureFixture(instructionFile, 1);
  await t.throwsAsync(createEditorRuntimeBusSource(instructionFile), {
    message: /requires a lossless.*bus capture/,
  });
});
