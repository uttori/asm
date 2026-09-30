/** Exercise the persisted SQL query paths against an isolated online backup. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { backup, DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import {
  loadSourceExportManifest,
  openAnalysisProjectStore,
  analysisProjectRevision,
} from "@uttori/asm-disassembler";
import { exportSnesProject, verifySnesProjectRoundTrip } from "@uttori/asm-plugin-snes";
import { build } from "esbuild";

import { AnalysisWorkerClient } from "../packages/vscode-extension/src/analysis/worker-client.js";

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    rom: { type: "string" },
    output: { type: "string" },
    keep: { type: "boolean" },
    variants: { type: "boolean" },
  },
});
if (!values.source || !values.rom)
  throw new Error(
    "Usage: node --expose-gc --import=tsx scripts/benchmark-sql-views.ts --source <source tree> --rom <ROM> [--output <JSON>] [--variants] [--keep]",
  );
const source = path.resolve(values.source),
  romFile = path.resolve(values.rom);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-views-"));
const sourceDirectory = path.join(root, "source"),
  projectDirectory = path.join(sourceDirectory, "analysis");
let dataset:
  | {
      records: Readonly<Record<string, number>>;
      analysis: Readonly<Record<string, number>>;
      execution: { records: number; events: number };
    }
  | undefined;
const timings: Record<string, { milliseconds: number; heapMiB: number; error?: string }> = {};
/** Record a phase separately so setup, cold queries and warm queries are not conflated.
 * @param {string} name Phase key.
 * @param {Function} action Timed operation.
 * @returns {Promise<T>} Operation result.
 */
const measure = async <T>(name: string, action: () => T | Promise<T>): Promise<T> => {
  globalThis.gc?.();
  const started = performance.now();
  try {
    const result = await action();
    timings[name] = {
      milliseconds: performance.now() - started,
      heapMiB: process.memoryUsage().heapUsed / 1048576,
    };
    console.log(name, JSON.stringify(timings[name]));
    return result;
  } catch (error) {
    timings[name] = {
      milliseconds: performance.now() - started,
      heapMiB: process.memoryUsage().heapUsed / 1048576,
      error: String(error),
    };
    console.log(name, JSON.stringify(timings[name]));
    throw error;
  }
};
const workerFile = path.join(root, "worker.cjs");
const client = new AnalysisWorkerClient(workerFile, { timeoutMs: 60000, isolateAnnotations: true });
try {
  fs.mkdirSync(projectDirectory, { recursive: true });
  const db = new DatabaseSync(path.join(source, "analysis/analysis.sqlite"), { readOnly: true });
  try {
    await measure("backup", () =>
      backup(db, path.join(projectDirectory, "analysis.sqlite"), { rate: 10000 }),
    );
  } finally {
    db.close();
  }
  const generated = loadSourceExportManifest(source);
  for (const file of new Set([
    ...generated.files.map((f) => f.path),
    ...(generated.inputs ?? []).map((f) => f.path),
    "generated-files.json",
    "analysis/analysis.json",
  ])) {
    const target = path.resolve(sourceDirectory, file);
    if (!target.startsWith(sourceDirectory + path.sep)) throw new Error("Unsafe generated path.");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, file), target);
  }
  const store = openAnalysisProjectStore(projectDirectory);
  try {
    store.writePointer(projectDirectory);
    dataset = {
      records: store.counts(),
      analysis: store.analysisCounts(),
      execution: store.runtimeExecutionCounts(),
    };
    await measure("instructionIndexes", () => store.prepareAnnotationQueries());
  } finally {
    store.close();
  }
  const first = await measure("exportCold", () =>
    exportSnesProject({ projectDirectory, sourceDirectory, romFile }),
  );
  await measure("exportWarm", () =>
    exportSnesProject({ projectDirectory, sourceDirectory, romFile }),
  );
  const verified = await measure("verify", () =>
    verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false }),
  );
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/analysis/worker.ts")],
    outfile: workerFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node26",
    logLevel: "silent",
  });
  for (const operation of ["coverage"] as const) {
    try {
      await measure(operation + "Cold", () => client.request(projectDirectory, operation));
      await measure(operation + "Warm", () => client.request(projectDirectory, operation));
    } catch {
      /* A timeout is a benchmark result. Continue to check independent projections. */
    }
  }
  await measure("segmentsPage", () =>
    client.request(projectDirectory, "segments", { offset: 200 }),
  );
  const reopened = openAnalysisProjectStore(projectDirectory);
  try {
    await measure("sourceIndexes", () => reopened.prepareSourceQueries());
    const sources = reopened.sourceCatalog().sources;
    for (const [index, entry] of sources.slice(0, 2).entries()) {
      // Captures can share the same kinds. Keep each sampled source's measurements distinct.
      const sample = `${index + 1}:${entry.kinds.join("+")}`;
      await measure("sourceSummary:" + sample, () => reopened.sourceSummary(entry.id));
      await measure("sourcePage:" + sample, () => reopened.sourcePage(entry.id, "instructions"));
    }
    if (values.variants) {
      const variants = (): number => {
        const records = reopened.runtimeInstructionVariants(
          "snes.65816",
          "snes.cpu",
          ["p", "P", "e", "E", "db", "DB", "d", "D"],
          { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } },
        );
        let count = 0;
        for (const _record of records) count++;
        return count;
      };
      await measure("instructionVariantsCold", variants);
      await measure("instructionVariantsWarm", variants);
    }
  } finally {
    reopened.close();
  }
  // Exercise the actual annotation worker after all bulk views are prepared. A comment edit
  // must preserve both the analysis counts and byte-identical output while reusing runtime indexes.
  const editStore = openAnalysisProjectStore(projectDirectory);
  const editing = (() => {
    try {
      const view = editStore.annotationEditView();
      return {
        ...view,
        revision: analysisProjectRevision(view.manifest),
        counts: editStore.analysisCounts(),
        execution: editStore.runtimeExecutionCounts(),
      };
    } finally {
      editStore.close();
    }
  })();
  const label = editing.shards.labels.find((label) => label.addressSpace === "snes.cpu");
  if (!label) throw new Error("Benchmark requires a persisted SNES label.");
  const saved = await measure("annotationSave", () =>
    client.request<{ refresh: { after: string } }>(projectDirectory, "annotationSave", {
      annotationSave: {
        revision: editing.revision,
        sourceDirectory,
        request: {
          addressSpace: label.addressSpace,
          address: label.address,
          labelId: label.id,
          name: label.sourceName ?? label.name,
          comment: "SQL annotation benchmark.",
          inlineComment: label.inlineComment ?? "",
          sourceId: "benchmark.sql",
          evidenceId: `benchmark.sql.${editing.revision.manifestSha256}`,
        },
      },
    }),
  );
  const refreshed = await measure("annotationRefresh", () =>
    client.request(projectDirectory, "annotationRefresh", {
      annotationRefresh: {
        target: {
          sourceDirectory,
          projectDirectory,
          romFile,
          sourceManifest: loadSourceExportManifest(sourceDirectory),
        },
        receipt: saved.refresh,
      },
    }),
  );
  if (!refreshed) throw new Error("Annotation source refresh unexpectedly requested reanalysis.");
  const checked = await measure("annotationVerify", () =>
    verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false }),
  );
  const checkStore = openAnalysisProjectStore(projectDirectory);
  try {
    if (
      JSON.stringify(checkStore.analysisCounts()) !== JSON.stringify(editing.counts) ||
      JSON.stringify(checkStore.runtimeExecutionCounts()) !== JSON.stringify(editing.execution) ||
      !checked.comparison.equal
    )
      throw new Error("Annotation edit changed analysis/runtime facts or rebuilt ROM bytes.");
    await measure("coverageAfterComment", () => checkStore.coverageSummary());
  } finally {
    checkStore.close();
  }
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    dataset,
    timings,
    codeBytes: first.codeBytes,
    comparison: verified.comparison,
  };
  if (values.output)
    fs.writeFileSync(path.resolve(values.output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  client.dispose();
  if (values.keep) console.log("Isolated backup:", root);
  else fs.rmSync(root, { recursive: true, force: true });
}
