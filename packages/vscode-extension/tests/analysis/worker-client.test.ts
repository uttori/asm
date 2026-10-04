import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  publishAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import test from "ava";
import { build } from "esbuild";

import { AnalysisWorkerClient } from "../../src/analysis/worker-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSources(
  value: unknown,
): value is { readonly sources: readonly { readonly id: string }[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.sources) &&
    value.sources.every((source) => isRecord(source) && typeof source.id === "string")
  );
}

function isCoverage(value: unknown): value is {
  readonly summary: { readonly totalBytes: number; readonly classifiedBytes: number };
  readonly segments: readonly unknown[];
} {
  return (
    isRecord(value) &&
    isRecord(value.summary) &&
    typeof value.summary.totalBytes === "number" &&
    typeof value.summary.classifiedBytes === "number" &&
    Array.isArray(value.segments)
  );
}

function isAnnotationRows(value: unknown): value is readonly {
  readonly annotation: {
    readonly stateObservations: readonly { readonly state: unknown; readonly evidence: unknown }[];
  };
}[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        isRecord(row) &&
        isRecord(row.annotation) &&
        Array.isArray(row.annotation.stateObservations) &&
        row.annotation.stateObservations.every((observation) => isRecord(observation)),
    )
  );
}

function isPid(value: unknown): value is { readonly pid: number } {
  return isRecord(value) && typeof value.pid === "number";
}

function isPidArgs(
  value: unknown,
): value is { readonly pid: number; readonly args: readonly string[] } {
  return (
    isRecord(value) &&
    typeof value.pid === "number" &&
    Array.isArray(value.args) &&
    value.args.every((arg) => typeof arg === "string")
  );
}

async function pidOf(pending: Promise<unknown>): Promise<{ readonly pid: number }> {
  const value = await pending;
  if (!isPid(value)) {
    throw new Error("expected worker pid");
  }
  return value;
}

async function pidArgsOf(
  pending: Promise<unknown>,
): Promise<{ readonly pid: number; readonly args: readonly string[] }> {
  const value = await pending;
  if (!isPidArgs(value)) {
    throw new Error("expected worker pid and args");
  }
  return value;
}

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
    // Match the shipped worker: optional Data Tools debug branches contain top-level await.
    define: {
      "process.env.UTTORI_DATA_DEBUG": "false",
      "process.env.UTTORI_AUDIOWAV_DEBUG": "false",
    },
    logLevel: "silent",
  });
  const logs: { level: string; message: string }[] = [];
  const client = new AnalysisWorkerClient(workerFile, {
    log: (level, message) => logs.push({ level, message }),
  });
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
          id: `conflicting-${index}`,
          addressSpace: "rom.file",
          start: index,
          end: index + 1,
          architecture: "fixture",
          classification: "opcode" as const,
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
    publishAnalysisProject(projectDirectory, project);
    fs.unlinkSync(path.join(projectDirectory, "analysis.json"));
    // Invalid CFG payloads must not prevent the lightweight Sources catalog from loading.
    const database = new DatabaseSync(path.join(projectDirectory, "analysis.sqlite"));
    database.exec(
      "INSERT INTO analysis (id, kind, payload) VALUES ('invalid', 'conflict', 'invalid json')",
    );
    let sources: readonly { readonly id: string }[];
    try {
      const catalog = await client.request(projectDirectory, "sources");
      if (!isSources(catalog)) {
        throw new Error("expected sources");
      }
      ({ sources } = catalog);
      t.is(sources.length, 1, "source listing needs no runtime or CFG table");
      t.true(fs.existsSync(path.join(projectDirectory, "analysis.json")));
      await t.notThrowsAsync(
        client.request(projectDirectory, "sourceNotes", { sourceId: sources[0].id }),
      );
    } finally {
      database.exec("DELETE FROM analysis WHERE id='invalid'");
      database.close();
    }
    const sourceId = sources![0].id;
    t.is(
      await client.request(projectDirectory, "sourceNotes", { sourceId }),
      null,
      "legacy imports need no capture archive or fabricated report",
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
    const map = await request;
    if (!isCoverage(map)) {
      throw new Error("expected coverage");
    }
    t.is(map.summary.totalBytes, 1024);
    t.is(map.summary.classifiedBytes, 0);
    t.deepEqual(map.segments, [], "summary does not copy full projection to UI");
    const conflicts = await client.request(projectDirectory, "coverageConflicts");
    const laterConflicts = await client.request(projectDirectory, "coverageConflicts", {
      offset: 200,
    });
    if (
      !isRecord(conflicts) ||
      !Array.isArray(conflicts.segments) ||
      !isRecord(laterConflicts) ||
      !Array.isArray(laterConflicts.segments)
    )
      throw new Error("expected conflict pages");
    t.is(conflicts.count, 300);
    t.is(conflicts.segments.length, 200);
    t.is(laterConflicts.segments.length, 100);
    t.deepEqual(conflicts.segments[0].classifications, ["opcode", "data"]);
    t.is(laterConflicts.segments[0].start, 200);
    const annotationRows = await client.request(projectDirectory, "annotations", {
      ranges: [
        { architecture: "fixture", addressSpace: "cpu", start: 0, end: 2, sourceId: 0, line: 1 },
      ],
    });
    if (!isAnnotationRows(annotationRows)) throw new Error("expected annotations");
    t.is(annotationRows.length, 2);
    t.deepEqual(annotationRows[0].annotation.stateObservations[0].state, { m: true });
    t.deepEqual(annotationRows[0].annotation.stateObservations[0].evidence, ["test"]);
    await t.throwsAsync(client.request(projectDirectory, "coverageConflicts", { offset: -1 }), {
      message: /offset/,
    });
    await t.throwsAsync(client.request(path.join(directory, "missing"), "manifest"));
    t.true(
      logs.some(({ level, message }) => level === "debug" && message.includes("Analysis sources:")),
    );
    t.true(
      logs.some(
        ({ level, message }) =>
          level === "error" && message.includes("Analysis manifest") && message.includes("missing"),
      ),
    );
    t.deepEqual(await client.request(projectDirectory, "annotations"), []);
    publishAnalysisProject(projectDirectory, {
      ...project,
      shards: { ...project.shards, annotations: [] },
    });
    client.invalidate();
    const revisedCoverage = await client.request(projectDirectory, "coverage");
    if (!isCoverage(revisedCoverage)) throw new Error("expected revised coverage");
    t.is(revisedCoverage.summary.classifiedBytes, 0);
    client.dispose();
    const restarted = await client.request(projectDirectory, "coverage");
    if (!isCoverage(restarted)) {
      throw new Error("expected restarted coverage");
    }
    t.is(restarted.summary.totalBytes, 1024, "worker can restart after termination");
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
  const bulk = pidOf(client.request("busy", "coverage"));
  const annotations = pidOf(client.request("ready", "annotations"));
  t.is(
    await Promise.race([bulk.then(() => "bulk"), annotations.then(() => "annotations")]),
    "annotations",
  );
  const [background, preview] = await Promise.all([bulk, annotations]);
  t.not(background.pid, preview.pid);
  const editor = await pidOf(client.request("ready", "manifest"));
  t.not(editor.pid, preview.pid);
  t.not(editor.pid, background.pid);
  t.is((await pidOf(client.request("ready", "manifest"))).pid, editor.pid);
  await t.throwsAsync(client.request("crash", "coverage"));
  t.is(
    (await pidOf(client.request("ready", "manifest"))).pid,
    editor.pid,
    "bulk failure preserves the manifest worker",
  );
});

test("a viewport timeout cannot reject a concurrent project load", async (t) => {
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
  const manifest = await pidOf(client.request("ready", "manifest"));
  const edit = await pidOf(client.request("ready", "manifest"));
  t.is(edit.pid, manifest.pid);
  await timedOut;
  const saved = await pidOf(client.request("ready", "manifest"));
  t.is(saved.pid, edit.pid, "preview failure leaves the manifest worker and its queue intact");
  const preview = await pidOf(client.request("ready", "debugAnnotations"));
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
    (["coverage", "annotations", "coverageConflicts"] as const).map((operation) =>
      pidArgsOf(client.request("busy", operation)),
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
  const first = await pidArgsOf(client.request("normal", "manifest"));
  t.deepEqual(first.args, ["--max-old-space-size=128"]);
  const failed = await Promise.allSettled([
    client.request("crash", "annotations"),
    client.request("normal", "coverageConflicts"),
  ]);
  for (const result of failed) {
    t.is(result.status, "rejected");
    if (result.status !== "rejected") {
      continue;
    }
    t.regex(
      result.reason.message,
      /Analysis annotations process exited \(23\).*128 MiB.*test projection failure/s,
    );
  }
  const recovered = await pidOf(client.request("normal", "coverageConflicts"));
  t.not(recovered.pid, first.pid);
  maxMemoryMiB = 256;
  const resized = await pidArgsOf(client.request("normal", "coverageConflicts"));
  t.not(resized.pid, recovered.pid, "a changed project budget restarts the process");
  t.deepEqual(resized.args, ["--max-old-space-size=256"]);
  await t.throwsAsync(client.request("timeout", "coverageConflicts"), {
    message: /Analysis coverageConflicts process exceeded 1 seconds.*256 MiB/,
  });
  t.not((await pidOf(client.request("normal", "coverageConflicts"))).pid, resized.pid);
  maxMemoryMiB = 0;
  await t.throwsAsync(client.request("normal", "coverage"), {
    message: /asm.analysis.maxMemoryMiB/,
  });
  maxMemoryMiB = 128;
  t.truthy(await client.request("normal", "coverage"));
});
