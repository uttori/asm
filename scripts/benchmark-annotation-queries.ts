/** Benchmark actual editor worker requests on an online SQLite backup; never edit the input project. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { backup, DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import type { DebugMapRange } from "@uttori/asm-core/debug-map";
import {
  openAnalysisProjectStore,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import { build } from "esbuild";

import { AnalysisWorkerClient } from "../packages/vscode-extension/src/analysis-worker-client.js";
import type { AnnotationLookupResult } from "../packages/vscode-extension/src/disassembly-annotation-data.js";

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    ranges: { type: "string" },
    output: { type: "string" },
    baseline: { type: "string" },
  },
});
if (!values.project || !values.ranges)
  throw new Error(
    "Usage: benchmark-annotation-queries.ts --project <analysis-dir> --ranges <ranges.json> [--baseline <old-worker.cjs>] [--output <report.json>]",
  );
const input = JSON.parse(fs.readFileSync(values.ranges, "utf8")) as
  | DebugMapRange[]
  | { ranges: DebugMapRange[] };
const ranges = Array.isArray(input) ? input : input.ranges;
if (!Array.isArray(ranges) || !ranges.length || ranges.length > 2000)
  throw new Error(
    "Provide 1–2000 actual debug-map ranges, or a previous report containing ranges.",
  );
const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-query-benchmark-"));
const directory = path.join(root, "analysis");
const worker = path.join(root, "worker.cjs");
const client = new AnalysisWorkerClient(worker);
const stages: Record<string, { ms: number; error?: string }> = {};

/**
 * Record process startup, query work and IPC together; propagate unexpected failures.
 * @param {string} name Stable report phase key.
 * @param {Function} action One worker request or backup operation.
 * @returns {Promise<T>} The measured operation's result.
 */
const measure = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  try {
    const result = await action();
    stages[name] = { ms: performance.now() - start };
    console.log(`${name}: ${stages[name].ms.toFixed(1)} ms`);
    return result;
  } catch (error) {
    stages[name] = { ms: performance.now() - start, error: String(error) };
    console.log(`${name}: ${JSON.stringify(stages[name])}`);
    throw error;
  }
};

try {
  fs.mkdirSync(directory);
  const database = new DatabaseSync(path.join(path.resolve(values.project), "analysis.sqlite"), {
    readOnly: true,
  });
  try {
    await measure("backup", () =>
      backup(database, path.join(directory, "analysis.sqlite"), { rate: 10_000 }),
    );
  } finally {
    database.close();
  }
  fs.copyFileSync(
    path.join(path.resolve(values.project), "analysis.json"),
    path.join(directory, "analysis.json"),
  );
  const store = openAnalysisProjectStore(directory);
  let initial;
  let counts;
  try {
    store.writePointer(directory);
    initial = store.manifest();
    counts = store.counts();
  } finally {
    store.close();
  }
  if (values.baseline) {
    const baseline = new AnalysisWorkerClient(path.resolve(values.baseline));
    try {
      await measure("baselineAnnotations", () =>
        baseline.request(directory, "annotations", { ranges }),
      );
    } catch (error) {
      // A reproduced 60-second timeout is a baseline result; other failures invalidate the comparison.
      if (!(error instanceof Error) || !error.message.includes("exceeded 60 seconds")) throw error;
    } finally {
      baseline.dispose();
    }
  }
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/analysis-worker.ts")],
    outfile: worker,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  type Row = { line: number; annotation: InstructionAnalysisAnnotation };
  const query = () => client.request<Row[]>(directory, "annotations", { ranges });
  const first = await measure("firstAnnotationsIncludingIndexSetup", query);
  await measure("warmAnnotations1", query);
  await measure("warmAnnotations2", query);
  await measure("debugPage", () => client.request(directory, "debugAnnotations", { ranges }));
  const form = await measure("namedAnnotationLookup", () =>
    client.request<AnnotationLookupResult>(directory, "annotationLookup", {
      annotationLookup: { maps: [] },
    }),
  );
  const indexed = await client.request(directory, "manifest");
  if (JSON.stringify(indexed) !== JSON.stringify(initial))
    throw new Error("Index setup changed the project manifest.");
  const selected = form.choices.find(({ hasInstruction }) => hasInstruction);
  if (!selected) throw new Error("Benchmark needs a named instruction to edit.");
  await measure("annotationSave", () =>
    client.request(directory, "annotationSave", {
      annotationSave: {
        revision: form.revision,
        request: {
          addressSpace: selected.location.addressSpace,
          address: selected.location.address,
          instructionComment: "SQLite annotation query benchmark",
          instructionCommentId: "benchmark.annotation-query.comment",
          sourceId: "benchmark.annotation-query",
          evidenceId: "benchmark.annotation-query.edit",
        },
      },
    }),
  );
  await measure("annotationsAfterSave", query);
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    databaseBytes: fs.statSync(path.join(directory, "analysis.sqlite")).size,
    revision: initial.revision,
    counts,
    ranges,
    stages,
    returnedRows: first.length,
    previewLimited: first.some(({ annotation }) => annotation.detailsLimited),
    namedChoices: form.choices.length,
    notes:
      "One local run on an online backup, with the normal 60-second/4096-MiB worker budget. First request includes index setup only if missing/stale. No UI rendering or source regeneration is timed. Setup does not change the semantic revision. Preview details are bounded; execution totals remain exact.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (values.output)
    fs.writeFileSync(path.resolve(values.output), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  client.dispose();
  fs.rmSync(root, { recursive: true, force: true });
}
