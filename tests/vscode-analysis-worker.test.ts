import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import test from "ava";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
  type AnalysisProject,
  type RomCoverageMap,
  type RomCoverageSegment,
  type InstructionAnalysisAnnotation,
  type AnalysisSourceComparison,
  type AnalysisSourceEntry,
  type AnalysisEvidenceSource,
} from "@uttori/asm-disassembler";
import { AnalysisWorkerClient } from "../packages/vscode-extension/src/analysis-worker-client.js";

test("analysis worker isolates validated shards, serves bounded pages, invalidates and recovers", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-test-"));
  const workerFile = path.join(directory, "worker.cjs");
  const projectDirectory = path.join(directory, "project");
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/analysis-worker.ts")],
    outfile: workerFile,
    bundle: true,
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
    const persisted = JSON.parse(
      fs.readFileSync(path.join(projectDirectory, "analysis.json"), "utf8"),
    ) as { shards: { kind: string; path: string }[] };
    const runtimeFile = path.join(
      projectDirectory,
      persisted.shards.find(({ kind }) => kind === "runtime")!.path,
    );
    fs.renameSync(runtimeFile, `${runtimeFile}.held`);
    let sources: readonly AnalysisEvidenceSource[];
    try {
      ({ sources } = await client.request<{ sources: readonly AnalysisEvidenceSource[] }>(
        projectDirectory,
        "sources",
      ));
      t.is(sources.length, 1, "source listing needs no runtime or CFG shard");
      await t.throwsAsync(
        client.request(projectDirectory, "sourceSummary", { sourceId: sources[0].id }),
        { message: /ENOENT/ },
      );
    } finally {
      fs.renameSync(`${runtimeFile}.held`, runtimeFile);
    }
    const sourceId = sources![0].id;
    const sourceSummary = await client.request<{ comparison: AnalysisSourceComparison }>(
      projectDirectory,
      "sourceSummary",
      { sourceId },
    );
    t.is(sourceSummary.comparison.uniqueInstructionCount, 300);
    t.is(sourceSummary.comparison.contributionCount, 600);
    t.is(
      (
        await client.request<AnalysisSourceEntry[]>(projectDirectory, "sourceEntries", {
          sourceId,
          sourceGroup: "uniqueInstructions",
        })
      ).length,
      200,
    );
    t.is(
      (
        await client.request<AnalysisSourceEntry[]>(projectDirectory, "sourceEntries", {
          sourceId,
          sourceGroup: "uniqueInstructions",
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
        await client.request<{ comparison: AnalysisSourceComparison }>(
          projectDirectory,
          "sourceSummary",
          { sourceId },
        )
      ).comparison.contributionCount,
      0,
      "source comparisons follow committed shard revisions",
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
    if (result.status === "rejected")
      t.regex(
        result.reason.message,
        /Analysis annotations process exited \(23\).*128 MiB.*test projection failure/s,
      );
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
