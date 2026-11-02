import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  analysisProjectRevision,
  loadAnalysisProject,
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

function isEvidenceChoices(
  value: unknown,
): value is { readonly shards: { readonly annotations: readonly unknown[] } } {
  return isRecord(value) && isRecord(value.shards) && Array.isArray(value.shards.annotations);
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

test("analysis worker isolates validated shards, serves bounded evidence choices, invalidates and recovers", async (t) => {
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
    const request = client.request(projectDirectory, "evidenceChoices");
    t.is(
      client.request(projectDirectory, "evidenceChoices"),
      request,
      "concurrent projections are deduplicated",
    );
    const choices = await request;
    if (!isEvidenceChoices(choices)) {
      throw new Error("expected bounded evidence choices");
    }
    t.is(choices.shards.annotations.length, 200, "inspection choices stay bounded per collection");
    const annotationRows = await client.request(projectDirectory, "annotations", {
      ranges: [
        { architecture: "fixture", addressSpace: "cpu", start: 0, end: 2, sourceId: 0, line: 1 },
      ],
    });
    if (!isAnnotationRows(annotationRows)) {
      throw new Error("expected annotations");
    }
    t.is(annotationRows.length, 2);
    t.deepEqual(annotationRows[0].annotation.stateObservations[0].state, { m: true });
    t.deepEqual(annotationRows[0].annotation.stateObservations[0].evidence, ["test"]);
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
    const current = loadAnalysisProject(projectDirectory);
    publishAnalysisProject(
      projectDirectory,
      { ...current, shards: { ...current.shards, annotations: [] } },
      analysisProjectRevision(current.manifest),
    );
    client.invalidate();
    const revisedChoices = await client.request(projectDirectory, "evidenceChoices");
    if (!isEvidenceChoices(revisedChoices)) {
      throw new Error("expected revised evidence choices");
    }
    t.deepEqual(revisedChoices.shards.annotations, []);
    client.dispose();
    await t.throwsAsync(client.request(projectDirectory, "evidenceChoices"), {
      message: /disposed/,
    });
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

test("distinct read admission is bounded, duplicate requests share capacity, and invalidation settles old work", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-bound-"));
  const logs: { level: string; message: string }[] = [];
  const client = new AnalysisWorkerClient(fakeProcess(directory), {
    maxPending: 2,
    log: (level, message) => logs.push({ level, message }),
  });
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const active = client.request("busy", "evidenceChoices");
  t.is(client.request("busy", "evidenceChoices"), active);
  const queued = client.request("busy", "explainEvidence", {
    evidenceRecord: { kind: "annotations", id: "first" },
  });
  const results = Promise.allSettled([active, queued]);
  await t.throwsAsync(
    client.request("busy", "explainEvidence", {
      evidenceRecord: { kind: "annotations", id: "second" },
    }),
    {
      message: /capacity/,
    },
  );
  client.invalidate();
  t.true((await results).every((result) => result.status === "rejected"));
  const invalidations = logs.filter((entry) =>
    entry.message.includes("Analysis project invalidated."),
  );
  t.is(invalidations.length, 2);
  t.true(invalidations.every((entry) => entry.level === "debug"));
  t.truthy(
    await client.request("ready", "evidenceChoices"),
    "new generation starts after invalidation",
  );
  client.dispose();
  await t.throwsAsync(client.request("ready", "manifest"), { message: /disposed/ });
});

test("new viewport reads replace queued stale ranges without replacing the active result", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-view-"));
  const client = new AnalysisWorkerClient(fakeProcess(directory), { maxPending: 2 });
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const active = client.request("busy", "annotations", {
    ranges: [
      { architecture: "fixture", addressSpace: "cpu", start: 0, end: 1, sourceId: 0, line: 1 },
    ],
  });
  const stale = t.throwsAsync(
    client.request("busy", "annotations", {
      ranges: [
        { architecture: "fixture", addressSpace: "cpu", start: 1, end: 2, sourceId: 0, line: 2 },
      ],
    }),
    {
      message: /superseded/,
    },
  );
  const latest = client.request("busy", "annotations", {
    ranges: [
      { architecture: "fixture", addressSpace: "cpu", start: 2, end: 3, sourceId: 0, line: 3 },
    ],
  });
  await stale;
  t.truthy(await active);
  t.truthy(await latest);
});

test("malformed worker envelopes fail and settle the whole lane", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-wire-"));
  const file = path.join(directory, "bad.cjs");
  fs.writeFileSync(file, "process.on('message', () => process.send(null));");
  const client = new AnalysisWorkerClient(file);
  t.teardown(() => {
    client.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const results = await Promise.allSettled([
    client.request("ready", "manifest"),
    client.request("ready", "evidenceChoices"),
  ]);
  t.true(results.every((result) => result.status === "rejected"));
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
  const bulk = pidOf(client.request("busy", "evidenceChoices"));
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
  await t.throwsAsync(client.request("crash", "evidenceChoices"));
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

test("projection process gives queued requests their own timeout and keeps the parent responsive", async (t) => {
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
    (["evidenceChoices", "annotations", "explainEvidence"] as const).map((operation) =>
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
    client.request("normal", "explainEvidence"),
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
  const recovered = await pidOf(client.request("normal", "explainEvidence"));
  t.not(recovered.pid, first.pid);
  maxMemoryMiB = 256;
  const resized = await pidArgsOf(client.request("normal", "explainEvidence"));
  t.not(resized.pid, recovered.pid, "a changed project budget restarts the process");
  t.deepEqual(resized.args, ["--max-old-space-size=256"]);
  await t.throwsAsync(client.request("timeout", "explainEvidence"), {
    message: /Analysis explainEvidence process exceeded 1 seconds.*256 MiB/,
  });
  t.not((await pidOf(client.request("normal", "explainEvidence"))).pid, resized.pid);
  maxMemoryMiB = 0;
  await t.throwsAsync(client.request("normal", "evidenceChoices"), {
    message: /asm.analysis.maxMemoryMiB/,
  });
  maxMemoryMiB = 128;
  t.truthy(await client.request("normal", "evidenceChoices"));
});
