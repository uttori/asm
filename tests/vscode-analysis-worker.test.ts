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
      addressSpaces: [{ id: "rom.file", name: "ROM", kind: "file", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      imports: [],
      evidence: [{ id: "test", source: "manual", sourceId: "test", confidence: "certain" }],
      annotations: Array.from({ length: 300 }, (_, index) => ({
        id: `item-${index}`,
        addressSpace: "rom.file",
        start: index,
        end: index + 1,
        architecture: "fixture",
        classification: "data8",
        evidence: ["test"],
      })),
    },
  };
  try {
    writeAnalysisProject(projectDirectory, project);
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
