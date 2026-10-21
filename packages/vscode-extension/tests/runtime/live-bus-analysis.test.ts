import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { NativeCaptureFilePosition } from "@uttori/asm-capture";
import { createRuntimeBusCaptureSource } from "@uttori/asm-disassembler";
import { build } from "esbuild";

import { test } from "../../../../tests/ava-helper.js";
import { captureFixtureHeader } from "../../../../tests/helpers/capture-archive.js";
import {
  busChunk,
  busJsonFrame,
  busPosition,
  busScope,
  busSession,
} from "../../../../tests/helpers/capture-bus.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  analysisProjectRevision,
  publishAnalysisProject,
  loadAnalysisProject,
  openAnalysisProjectStore,
  createRuntimeBusTraceImporter,
  type AnalysisProject,
} from "../../../disassembler/src/index.js";
import { LiveBusAnalysis, type LiveBusProgress } from "../../src/runtime/live-bus-analysis.js";

const project: AnalysisProject = {
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(32768)).identity,
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
const header = busJsonFrame("ACS2", {
  ...captureFixtureHeader,
  scope: busScope,
  romContentSha256: project.manifest.rom.contentSha256,
});
const pair = (n: number) =>
  Buffer.concat([
    busChunk([{}], BigInt(n), BigInt(n)),
    busJsonFrame("ACK2", { session: busSession, chunkThrough: String(n), eventThrough: String(n) }),
  ]);
const position = (bytes: number, n: number, complete = false): NativeCaptureFilePosition => ({
  ...busPosition(String(n), String(n), complete ? "complete" : "recording"),
  fileState: complete ? "complete" : "writing",
  fileBytes: String(bytes),
  fileBatches: String(n),
});
let root: string, workerFile: string;
test.before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "live-bus-worker-"));
  workerFile = path.join(root, "worker.cjs");
  await build({
    entryPoints: [
      path.resolve("packages/vscode-extension/src/runtime/live-bus-analysis-process.ts"),
    ],
    outfile: workerFile,
    bundle: true,
    conditions: ["uttori-source"],
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
});
test.after.always(() => fs.rmSync(root, { recursive: true, force: true }));

test("live worker stages provisional facts, then publishes the same result as offline import", async (t) => {
  const directory = path.join(root, "success");
  const file = path.join(root, "success.act2");
  publishAnalysisProject(directory, project);
  const prefix = Buffer.concat([header, pair(1)]);
  fs.writeFileSync(file + ".partial", Buffer.concat([prefix, pair(2)]));
  let progress: LiveBusProgress | undefined;
  const client = new LiveBusAnalysis(
    workerFile,
    {
      file,
      projectDirectory: directory,
      position: position(prefix.length, 1),
      maxLagBytes: 1048576,
      maxBytes: 1048576,
      maxIndexRecords: 100,
    },
    (value) => {
      progress = value;
    },
    128,
  );
  t.teardown(() => client.cancel());
  // Progress arrives from the worker while delay yields to the event loop.
  for (let i = 0; i < 200; i++) {
    if (progress) {
      break;
    }
    await delay(10);
  }
  t.is(progress?.busEvents, 1);
  t.true(progress?.provisional);
  t.is(loadAnalysisProject(directory).shards.runtime.length, 0);
  const terminal = busJsonFrame("END2", busPosition("2", "2", "complete"));
  fs.appendFileSync(file + ".partial", terminal);
  fs.linkSync(file + ".partial", file);
  fs.unlinkSync(file + ".partial");
  client.update(position(prefix.length + pair(2).length + terminal.length, 2, true));
  const result = await client.completion;
  t.is(result.observedEvents, 2);
  t.is(result.added.runtime, 1);
  t.is(loadAnalysisProject(directory).shards.runtime[0].count, 2);
  const store = openAnalysisProjectStore(directory);
  try {
    const receipt = store.captureReceipt(result.sourceSha256);
    t.is(receipt?.observed_events, 2);
    t.true(fs.existsSync(file));
  } finally {
    store.close();
  }
  const source = await createRuntimeBusCaptureSource(file);
  const importer = createRuntimeBusTraceImporter(source.metadata, {
    sourceName: "success.act2",
    projectRomContentSha256: project.manifest.rom.contentSha256,
  });
  await source.read(importer.push);
  const offline = importer.finish();
  t.is(result.sourceSha256, offline.sourceSha256);
  t.deepEqual(result.report, offline.report);
  t.deepEqual(result.summary, offline.summary);
});

test("live worker cancellation, lag exhaustion and corrupt completion never publish facts", async (t) => {
  for (const failure of ["cancel", "lag", "budget", "corrupt", "stale"] as const) {
    const directory = path.join(root, failure);
    const file = path.join(root, failure + ".act2");
    publishAnalysisProject(directory, project);
    const prefix = Buffer.concat([header, pair(1)]);
    fs.writeFileSync(file + ".partial", prefix);
    let progress = false;
    const client = new LiveBusAnalysis(
      workerFile,
      {
        file,
        projectDirectory: directory,
        position: position(prefix.length, 1),
        maxLagBytes: failure === "lag" ? 1 : 1048576,
        maxBytes: failure === "budget" ? header.length : 1048576,
        maxIndexRecords: 100,
      },
      () => {
        progress = true;
      },
      128,
    );
    t.teardown(() => client.cancel());
    const sawProgress = (): boolean => progress;
    if (failure !== "lag" && failure !== "budget") {
      for (let i = 0; !sawProgress() && i < 200; i++) {
        await delay(10);
      }
      t.true(progress);
    }
    if (failure === "cancel") {
      client.cancel();
    }
    if (failure === "stale") {
      const changed = loadAnalysisProject(directory);
      publishAnalysisProject(
        directory,
        { ...changed, manifest: { ...changed.manifest, target: "edited" } },
        analysisProjectRevision(changed.manifest),
      );
    }
    if (failure === "corrupt" || failure === "stale") {
      const terminal = busJsonFrame("END2", busPosition("1", "1", "complete"));
      if (failure === "corrupt") {
        terminal[12] ^= 1;
      }
      fs.appendFileSync(file + ".partial", terminal);
      fs.linkSync(file + ".partial", file);
      fs.unlinkSync(file + ".partial");
      client.update(position(prefix.length + terminal.length, 1, true));
    }
    await t.throwsAsync(client.completion);
    const after = loadAnalysisProject(directory);
    t.is(after.shards.runtime.length, 0);
    t.is(after.shards.imports.length, 0);
    t.true(fs.existsSync(file) || fs.existsSync(file + ".partial"));
  }
});

test("terminal results survive preview acknowledgments after the worker disconnects", async (t) => {
  const fixture = path.join(root, "terminal-race.cjs");
  const disconnected = path.join(root, "terminal-race.closed");
  fs.writeFileSync(
    fixture,
    `const fs = require('node:fs');
process.once('message', () => {
  process.send({ type: 'progress', progress: { provisional: true } }, () => {
    process.send({ type: 'result', value: { observedEvents: 7 } }, () => process.disconnect());
  });
});
process.once('disconnect', () => fs.writeFileSync(${JSON.stringify(disconnected)}, 'closed'));
`,
  );
  const client = new LiveBusAnalysis(
    fixture,
    {
      file: "unused",
      projectDirectory: root,
      position: position(0, 0),
      maxLagBytes: 1048576,
      maxBytes: 1048576,
      maxIndexRecords: 100,
    },
    () => {
      // Hold delivery of the terminal message until IPC has closed, reproducing a busy editor.
      const deadline = Date.now() + 5000;
      const wait = new Int32Array(new SharedArrayBuffer(4));
      while (!fs.existsSync(disconnected) && Date.now() < deadline) {
        Atomics.wait(wait, 0, 0, 10);
      }
      t.true(fs.existsSync(disconnected));
    },
    128,
  );
  t.teardown(() => client.cancel());
  t.is((await client.completion).observedEvents, 7);
});

test("worker exit without a terminal result still rejects completion", async (t) => {
  const fixture = path.join(root, "premature-exit.cjs");
  fs.writeFileSync(
    fixture,
    "process.once('message', () => process.send({ type: 'progress', progress: { provisional: true } }, () => process.exit(1)));",
  );
  const client = new LiveBusAnalysis(
    fixture,
    {
      file: "unused",
      projectDirectory: root,
      position: position(0, 0),
      maxLagBytes: 1048576,
      maxBytes: 1048576,
      maxIndexRecords: 100,
    },
    () => undefined,
    128,
  );
  t.teardown(() => client.cancel());
  await t.throwsAsync(client.completion, { message: /process exited \(1\)/ });
});
