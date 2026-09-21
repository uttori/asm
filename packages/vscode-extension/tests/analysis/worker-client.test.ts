import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
  type AnalysisProject,
  type RomCoverageMap,
  type RomCoverageSegment,
  type InstructionAnalysisAnnotation,
  type AnalysisSourceSummary,
  type AnalysisSourceEntry,
  type AnalysisEvidenceSource,
} from "@uttori/asm-disassembler";
import test from "ava";
import { build } from "esbuild";
import sinon from "sinon";

import { AnalysisWorkerClient } from "../../src/analysis/worker-client.js";

test("analysis worker isolates validated shards, serves bounded pages, invalidates and recovers", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-test-"));
  const workerFile = path.join(directory, "worker.cjs");
  const projectDirectory = path.join(directory, "project");
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/analysis/worker.ts")],
    outfile: workerFile,
    bundle: true,
    conditions: ["uttori-source"],
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const client = new AnalysisWorkerClient(workerFile);
  const project: AnalysisProject = {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [
        { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
        { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      ],
    },
    shards: {
      analysis: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: Array.from({ length: 300 }, (_, address) => ({
        id: `execution-${address}`,
        kind: "runtime-execution",
        architecture: "fixture",
        addressSpace: "cpu",
        address,
        size: 1,
        count: 1,
        evidence: ["test"],
      })),
      imports: [],
      evidence: [{ id: "test", source: "manual", sourceId: "test", confidence: "certain" }],
      annotations: [
        ...Array.from({ length: 300 }, (_, index) => ({
          id: `item-${index}`,
          addressSpace: "rom.file",
          start: index,
          end: index + 1,
          architecture: "fixture",
          classification: "data8" as const,
          evidence: ["test"],
        })),
        ...Array.from({ length: 300 }, (_, index) => ({
          id: `cpu-${index}`,
          addressSpace: "cpu",
          start: index,
          end: index + 1,
          architecture: "fixture",
          classification: "opcode" as const,
          state: { m: true },
          evidence: ["test"],
        })),
      ],
    },
  };
  try {
    writeAnalysisProject(projectDirectory, project);
    // Invalid CFG payloads must not prevent the lightweight Sources catalog from loading.
    const database = new DatabaseSync(path.join(projectDirectory, "analysis.sqlite"));
    database.exec(
      "INSERT INTO analysis (id, kind, payload) VALUES ('invalid', 'conflict', 'invalid json')",
    );
    let sources: readonly AnalysisEvidenceSource[];
    try {
      ({ sources } = await client.request<{ sources: readonly AnalysisEvidenceSource[] }>(
        projectDirectory,
        "sources",
      ));
      t.is(sources.length, 1, "source listing needs no runtime or CFG table");
      await t.notThrowsAsync(
        client.request(projectDirectory, "sourceSummary", { sourceId: sources[0].id }),
      );
    } finally {
      database.exec("DELETE FROM analysis WHERE id='invalid'");
      database.close();
    }
    const sourceId = sources![0].id;
    const sourceSummary = await client.request<{ summary: AnalysisSourceSummary }>(
      projectDirectory,
      "sourceSummary",
      { sourceId },
    );
    t.is(sourceSummary.summary.instructionCount, 300);
    t.is(sourceSummary.summary.contributionCount, 600);
    t.is(
      (
        await client.request<AnalysisSourceEntry[]>(projectDirectory, "sourceEntries", {
          sourceId,
          sourceGroup: "instructions",
        })
      ).length,
      200,
    );
    t.is(
      (
        await client.request<AnalysisSourceEntry[]>(projectDirectory, "sourceEntries", {
          sourceId,
          sourceGroup: "instructions",
          offset: 200,
        })
      ).length,
      100,
    );
    const navigationTarget = {
      projectDirectory,
      target: "fixture",
      romContentSha256: project.manifest.rom.contentSha256,
      romContentSize: 1024,
      addressSpace: "cpu",
      address: 0,
      outputOffsets: [],
      architectureHints: ["fixture"],
      recordIds: [],
    };
    t.deepEqual(await client.request(projectDirectory, "navigation", { navigationTarget }), {
      lines: [],
      capturedRam: false,
    });
    await t.throwsAsync(
      client.request(projectDirectory, "navigation", {
        navigationTarget: { ...navigationTarget, romContentSha256: "f".repeat(64) },
      }),
      { message: /no longer matches/ },
    );
    const request = client.request(projectDirectory, "coverage");
    t.is(
      client.request(projectDirectory, "coverage"),
      request,
      "concurrent projections are deduplicated",
    );
    const map = (await request) as RomCoverageMap;
    t.is(map.summary.totalBytes, 1024);
    t.is(map.summary.classifiedBytes, 300);
    t.deepEqual(map.segments, [], "summary does not copy full projection to UI");
    const first = await client.request<RomCoverageSegment[]>(projectDirectory, "segments");
    const second = await client.request<RomCoverageSegment[]>(projectDirectory, "segments", {
      offset: 200,
    });
    t.is(first.length, 200);
    t.is(first[0].start, 0);
    t.is(second[0].start, first.at(-1)!.end);
    t.true(second.length <= 200);
    const [annotations, details] = await Promise.all([
      client.request<{ line: number; annotation: InstructionAnalysisAnnotation }[]>(
        projectDirectory,
        "annotations",
        {
          ranges: [
            {
              architecture: "fixture",
              addressSpace: "cpu",
              start: 0,
              end: 2,
              sourceId: 0,
              line: 1,
            },
          ],
        },
      ),
      client.request<{ description: string }[]>(projectDirectory, "details"),
    ]);
    t.is(annotations.length, 2);
    t.deepEqual(annotations[0].annotation.stateObservations[0].state, { m: true });
    t.deepEqual(annotations[0].annotation.stateObservations[0].evidence, ["test"]);
    t.is(details.length, 200);
    t.is(details[0].description, "non-file-address-space");
    t.is(
      (await client.request<unknown[]>(projectDirectory, "details", { offset: 400 })).length,
      200,
    );
    await t.throwsAsync(client.request(projectDirectory, "segments", { offset: -1 }), {
      message: /offset/,
    });
    await t.throwsAsync(client.request(path.join(directory, "missing"), "manifest"));
    t.deepEqual(await client.request(projectDirectory, "annotations"), []);
    writeAnalysisProject(projectDirectory, {
      ...project,
      shards: { ...project.shards, annotations: [] },
    });
    client.invalidate();
    t.is(
      (
        await client.request<{ summary: AnalysisSourceSummary }>(
          projectDirectory,
          "sourceSummary",
          { sourceId },
        )
      ).summary.contributionCount,
      0,
      "source counts follow committed database revisions",
    );
    t.is(
      (await client.request<RomCoverageMap>(projectDirectory, "coverage")).summary.classifiedBytes,
      0,
    );
    client.dispose();
    t.is(
      (await client.request<RomCoverageMap>(projectDirectory, "coverage")).summary.totalBytes,
      1024,
      "worker can restart after termination",
    );
  } finally {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const fakeProcess = (directory: string): string => {
  const file = path.join(directory, "process.cjs");
  fs.writeFileSync(
    file,
    `process.on('message', (message) => {
    if(message.directory === 'crash') { process.stderr.write('test projection failure'); process.exit(23); }
    if(message.directory === 'busy' || message.directory === 'timeout') {
      const start = Date.now(); while(Date.now() - start < (message.directory === 'timeout' ? 3000 : 400)) {}
    }
    process.send({ id: message.id, value: { pid: process.pid, args: process.execArgv, operation: message.operation } });
  });
  process.on('disconnect', () => process.exit(0));`,
  );
  return file;
};

test.serial("annotation source publication survives the read-projection timeout", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-write-timeout-"));
  const client = new AnalysisWorkerClient(fakeProcess(directory), { timeoutMs: 100 });
  // Control the parent's deadline without imposing a 100 ms scheduling budget on real IPC.
  // The child still performs its synchronous publication work in a separate process.
  const clock = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const publication = client.request<{ pid: number }>("busy", "annotationRefresh");
    t.is(clock.countTimers(), 0, "source publication has no forced termination deadline");
    clock.tick(101);
    const exported = await publication;
    const read = client.request<{ pid: number }>("ready", "manifest");
    t.is(clock.countTimers(), 1, "ordinary reads retain their execution deadline");
    const next = await read;
    t.is(next.pid, exported.pid, "the worker finishes publication before serving the next read");
    const timeout = t.throwsAsync(client.request("timeout", "manifest"), {
      message: /Analysis manifest process exceeded 0.1 seconds/,
    });
    clock.tick(100);
    await timeout;
  } finally {
    client.dispose();
    clock.restore();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("interactive annotations bypass bulk work and retain their process when a bulk view fails", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-projection-isolation-"));
  const client = new AnalysisWorkerClient(fakeProcess(directory), {
    isolateAnnotations: true,
    timeoutMs: 1000,
  });
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const bulk = client.request<{ pid: number }>("busy", "coverage");
  const annotations = client.request<{ pid: number }>("ready", "annotations");
  t.is(
    await Promise.race([bulk.then(() => "bulk"), annotations.then(() => "annotations")]),
    "annotations",
  );
  const [background, preview] = await Promise.all([bulk, annotations]);
  t.not(background.pid, preview.pid);
  const editor = await client.request<{ pid: number }>("ready", "manifest");
  t.not(editor.pid, preview.pid);
  t.not(editor.pid, background.pid);
  t.is((await client.request<{ pid: number }>("ready", "annotationSave")).pid, editor.pid);
  await t.throwsAsync(client.request("crash", "coverage"));
  t.is(
    (await client.request<{ pid: number }>("ready", "annotationRefresh")).pid,
    editor.pid,
    "bulk failure preserves the editor's saved snapshot and pending refresh",
  );
});

test("a viewport timeout cannot reject a concurrent project load or annotation edit", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-preview-isolation-"));
  const client = new AnalysisWorkerClient(fakeProcess(directory), {
    isolateAnnotations: true,
    timeoutMs: 1000,
  });
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const timedOut = t.throwsAsync(client.request("timeout", "annotations"), {
    message: /Analysis annotations process exceeded/,
  });
  const manifest = await client.request<{ pid: number }>("ready", "manifest");
  const edit = await client.request<{ pid: number }>("ready", "annotationLookup");
  t.is(edit.pid, manifest.pid);
  await timedOut;
  const saved = await client.request<{ pid: number }>("ready", "annotationSave");
  t.is(saved.pid, edit.pid, "preview failure leaves the edit worker and its queue intact");
  const preview = await client.request<{ pid: number }>("ready", "debugAnnotations");
  t.not(preview.pid, saved.pid, "preview requests restart in their own worker");
});

test("projection process gives queued pages their own timeout and keeps the parent responsive", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-projection-queue-"));
  const client = new AnalysisWorkerClient(fakeProcess(directory), { timeoutMs: 1000 });
  let heartbeats = 0;
  const heartbeat = setInterval(() => {
    heartbeats++;
  }, 20);
  t.teardown(() => {
    clearInterval(heartbeat);
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const start = performance.now();
  const results = await Promise.all(
    ["coverage", "annotations", "details"].map((operation) =>
      client.request<{ pid: number; args: string[] }>(
        "busy",
        operation as "coverage" | "annotations" | "details",
      ),
    ),
  );
  t.true(performance.now() - start > 1000, "total queue wait exceeds an individual request budget");
  t.true(heartbeats >= 20, "CPU-bound projections do not block the host event loop");
  t.not(results[0].pid, process.pid, "projections use a separate process, not another host thread");
  t.true(
    results.every(({ pid }) => pid === results[0].pid),
    "views reuse the same project cache",
  );
  t.deepEqual(results[0].args, ["--max-old-space-size=4096"]);
});

test("projection failures and timeouts report the operation/budget, reject queued work and recover", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-projection-recovery-"));
  let maxMemoryMiB = 128;
  const client = new AnalysisWorkerClient(fakeProcess(directory), {
    maxMemoryMiB: () => maxMemoryMiB,
    timeoutMs: 1000,
  });
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const first = await client.request<{ pid: number; args: string[] }>("normal", "manifest");
  t.deepEqual(first.args, ["--max-old-space-size=128"]);
  const failed = await Promise.allSettled([
    client.request("crash", "annotations"),
    client.request("normal", "details"),
  ]);
  for (const result of failed) {
    t.is(result.status, "rejected");
    if (result.status === "rejected") {
      t.regex(
        result.reason.message,
        /Analysis annotations process exited \(23\).*128 MiB.*test projection failure/s,
      );
    }
  }
  const recovered = await client.request<{ pid: number }>("normal", "details");
  t.not(recovered.pid, first.pid);
  maxMemoryMiB = 256;
  const resized = await client.request<{ pid: number; args: string[] }>("normal", "details");
  t.not(resized.pid, recovered.pid, "a changed project budget restarts the process");
  t.deepEqual(resized.args, ["--max-old-space-size=256"]);
  await t.throwsAsync(client.request("timeout", "details"), {
    message: /Analysis details process exceeded 1 seconds.*256 MiB/,
  });
  t.not((await client.request<{ pid: number }>("normal", "details")).pid, resized.pid);
  maxMemoryMiB = 0;
  await t.throwsAsync(client.request("normal", "coverage"), {
    message: /asm.analysis.maxMemoryMiB/,
  });
  maxMemoryMiB = 128;
  t.truthy(await client.request("normal", "coverage"));
});
