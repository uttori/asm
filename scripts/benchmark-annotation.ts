/**
 * Benchmark annotation save and source refresh on an isolated SQLite backup and copied source.
 * The selected project and ROM are read-only inputs. Temporary edits are removed on completion.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { backup, DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import {
  applyDisassemblyAnnotationEdit,
  commitAnalysisProjectViewUpdate,
  loadAnalysisProjectViewSnapshot,
  loadSourceExportManifest,
  openAnalysisProjectStore,
  type DisassemblyAnnotationEditRequest,
} from "@uttori/asm-disassembler";
import {
  loadSnesRamMap,
  snesSourceLabelNames,
  type SnesMapper,
  type ExportSnesProjectResult,
} from "@uttori/asm-plugin-snes";
import { build } from "esbuild";

import { AnalysisWorkerClient } from "../packages/vscode-extension/src/analysis/worker-client.js";
import { DisassemblyMaintenanceClient } from "../packages/vscode-extension/src/disassembly/maintenance-client.js";

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    rom: { type: "string" },
    output: { type: "string" },
    "keep-temp": { type: "boolean", default: false },
    "reuse-source": { type: "string" },
  },
});
if (!values.source || !values.rom) {
  throw new Error(
    "Usage: npm run benchmark:annotation -- --source <disassembly-directory> --rom <rom-file> [--output <report.json>]",
  );
}
const source = path.resolve(values.source);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-benchmark-"));
const sourceDirectory = values["reuse-source"]
  ? path.resolve(values["reuse-source"])
  : path.join(root, "source");
console.log(`Benchmark source: ${sourceDirectory}`);
const projectDirectory = path.join(sourceDirectory, "analysis");
const processFile = path.join(root, "maintenance.cjs");
const annotationFile = path.join(root, "annotation.cjs");
const workerFile = path.join(root, "analysis-worker.cjs");
const stages: Record<string, number> = {};

/**
 * Measure wall time including process startup/exit for worker jobs.
 * @param {string} name Stable phase key in the machine-readable report.
 * @param {Function} action Work performed once against the isolated copy.
 * @returns {Promise<T>} The operation's result, with elapsed milliseconds recorded separately.
 */
const measure = async <T>(name: string, action: () => T | Promise<T>): Promise<T> => {
  const start = performance.now();
  const result = await action();
  stages[name] = performance.now() - start;
  console.log(`${name}: ${stages[name].toFixed(1)} ms`);
  return result;
};

const client = new DisassemblyMaintenanceClient(processFile);
const annotationClient = new AnalysisWorkerClient(workerFile);
try {
  fs.mkdirSync(projectDirectory, { recursive: true });
  if (!values["reuse-source"]) {
    // SQLite's online backup includes a consistent WAL snapshot while the editor keeps working.
    const database = new DatabaseSync(path.join(source, "analysis/analysis.sqlite"), {
      readOnly: true,
    });
    try {
      await measure("setupBackup", () =>
        backup(database, path.join(projectDirectory, "analysis.sqlite"), { rate: 10_000 }),
      );
    } finally {
      database.close();
    }
  }
  const sourceManifest = loadSourceExportManifest(source);
  const files = new Set([
    ...sourceManifest.files.map((file) => file.path),
    ...(sourceManifest.inputs ?? []).map((file) => file.path),
    "generated-files.json",
    "analysis/analysis.json",
  ]);
  if (!values["reuse-source"]) {
    for (const file of files) {
      const destination = path.resolve(sourceDirectory, file);
      if (!destination.startsWith(`${sourceDirectory}${path.sep}`)) {
        throw new Error("Unsafe source path.");
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(source, file), destination);
    }
  }
  const store = openAnalysisProjectStore(projectDirectory);
  const storageBeforeQueries = store.storageSnapshot();
  try {
    store.writePointer(projectDirectory);
  } finally {
    store.close();
  }
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/disassembly/maintenance-process.ts")],
    outfile: processFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  // Match the extension's bundled package conditions instead of importing its CJS sources directly.
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/disassembly/annotation-data.ts")],
    outfile: annotationFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const { saveDisassemblyAnnotation } = createRequire(import.meta.url)(
    annotationFile,
  ) as typeof import("../packages/vscode-extension/src/disassembly/annotation-data.js");
  await build({
    entryPoints: [path.resolve("packages/vscode-extension/src/analysis/worker.ts")],
    outfile: workerFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
  });
  const target = {
    sourceDirectory,
    projectDirectory,
    sourceManifest,
    romFile: path.resolve(values.rom),
  };
  const budget = { maxMemoryMiB: 4096 };
  const before = await measure("prepare", () => client.run("prepare", { target }, budget));

  // Keep the large metadata view inside this scope so it can be collected before export.
  const receipt = await (async () => {
    const loaded = await measure("coldMetadataLoad", () =>
      loadAnalysisProjectViewSnapshot(projectDirectory),
    );
    const snapshot = { ...loaded, shards: loaded.view };
    const label = snapshot.shards.labels.find((record) =>
      ["snes.cpu", "rom.file"].includes(record.addressSpace),
    );
    if (!label) {
      throw new Error("Benchmark needs an existing SNES or ROM label.");
    }
    const request: DisassemblyAnnotationEditRequest = {
      addressSpace: label.addressSpace,
      address: label.address,
      labelId: label.id,
      name: label.sourceName ?? "BenchmarkAnnotation",
      comment: "Annotation benchmark: save and regenerate.",
      inlineComment: label.inlineComment ?? "",
      sourceId: "benchmark.annotation",
      evidenceId: `benchmark.annotation.legacy.${snapshot.revision.manifestSha256}`,
    };
    const prior = await measure("legacySave", () => {
      const applied = applyDisassemblyAnnotationEdit(snapshot, request);
      snesSourceLabelNames(
        applied.project.shards,
        snapshot.manifest.mapping.mapper as SnesMapper,
        snapshot.manifest.rom.contentSize,
        loadSnesRamMap(sourceDirectory).variables.map(({ name }) => name),
      );
      const { runtime: _runtime, ...updates } = applied.project.shards;
      const committed = commitAnalysisProjectViewUpdate(projectDirectory, loaded, updates);
      return { ...committed, shards: applied.project.shards };
    });
    const saved = await measure("annotationSave", () =>
      saveDisassemblyAnnotation(projectDirectory, prior, {
        revision: prior.revision,
        sourceDirectory,
        request: {
          ...request,
          comment: "Annotation benchmark: updated comment.",
          evidenceId: `benchmark.annotation.fast.${prior.revision.manifestSha256}`,
        },
      }),
    );
    return { after: saved.snapshot.revision.manifestSha256 };
  })();
  global.gc?.();
  // Form lookup now uses a small SQL view. It no longer warms the full export metadata.
  // the following first refresh includes that cold load in its elapsed time.
  await measure("annotationLookup", () =>
    annotationClient.request(projectDirectory, "annotationLookup", {
      annotationLookup: { maps: [] },
    }),
  );
  const exported = await measure("annotationRefresh", () =>
    annotationClient.request<ExportSnesProjectResult | undefined>(
      projectDirectory,
      "annotationRefresh",
      { annotationRefresh: { target, receipt } },
    ),
  );
  if (!exported) {
    throw new Error("Source inputs changed. Annotation refresh requires stable inputs.");
  }
  const verification = await measure("verify", () => client.run("verify", target, budget));
  const after = await measure("coverage", () =>
    client.run("coverage", { ...target, sourceManifest: exported.manifest }, budget),
  );
  if (
    !verification.comparison.equal ||
    before.before.instructions !== after.instructions ||
    before.before.runtimeEvents !== after.runtimeEvents ||
    after.manifestSha256 !== receipt.after
  ) {
    throw new Error(
      "Annotation refresh changed analysis counts or failed ROM/revision verification.",
    );
  }
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    stagesMs: stages,
    storageBeforeQueries,
    annotationSaveAndRegenerateMs: stages.annotationSave + stages.annotationRefresh + stages.verify,
    instructions: after.instructions,
    runtimeRecords: after.runtimeRecords,
    runtimeEvents: after.runtimeEvents,
    sourceFiles: exported.manifest.files.length,
    codeBytes: exported.codeBytes,
    roundTripSha256: verification.comparison.actualSha256,
    notes:
      "One local run. The first annotation refresh includes cold export metadata loading. Setup and the separate legacy comparison load are excluded. Legacy save retains full validation. No legacy reanalysis is timed by this script. Background annotation queries are measured separately by benchmark-annotation-queries.ts.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (values.output) {
    fs.writeFileSync(path.resolve(values.output), `${JSON.stringify(report, null, 2)}\n`);
  }
} finally {
  client.dispose();
  annotationClient.dispose();
  if (!values["keep-temp"]) {
    fs.rmSync(root, { recursive: true, force: true });
  } else {
    console.log(`Retained benchmark workspace: ${root}`);
  }
}
