import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

import { importRuntimeTraceSourceIntoProject } from "@uttori/asm-disassembler";

import { createEditorRuntimeTraceSource } from "../packages/vscode-extension/src/runtime/trace-source.js";

/** Required path arguments are resolved before creating any temporary project data.
 * @param {string} name Required command-line option.
 * @returns {string} Absolute path. Malformed or absent arguments throw before copying anything.
 */
const argument = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a path.`);
  }
  return path.resolve(value);
};

const project = argument("--project");
const trace = argument("--trace");
const output = argument("--output");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-project-import-benchmark-"));
try {
  const pointer = await fs.readFile(path.join(project, "analysis.json"));
  const manifest = JSON.parse(pointer.toString()) as { db?: string };
  if (manifest.db !== "analysis.sqlite") {
    throw new Error("Benchmark requires a SQLite project.");
  }
  const original = new DatabaseSync(path.join(project, "analysis.sqlite"), { readOnly: true });
  try {
    // Online backup reads a consistent committed snapshot even when the editor is importing.
    // Never copy a live database file directly: its latest committed pages may be in the WAL.
    await backup(original, path.join(directory, "analysis.sqlite"));
  } finally {
    original.close();
  }
  await fs.writeFile(path.join(directory, "analysis.json"), pointer);
  const started = performance.now();
  let stage = "Open trace metadata";
  let stageStarted = started;
  const timings: { step: string; durationMs: number }[] = [];
  const finishStage = (): void => {
    const ended = performance.now();
    timings.push({ step: stage, durationMs: ended - stageStarted });
    stageStarted = ended;
  };
  const source = await createEditorRuntimeTraceSource(trace, { maxBytes: Number.MAX_SAFE_INTEGER });
  const result = await importRuntimeTraceSourceIntoProject(
    source,
    directory,
    {
      projectRomContentSha256: source.metadata.romContentSha256,
      sourceName: path.basename(trace),
    },
    {
      onStage: (message) => {
        finishStage();
        stage = message;
        console.log(`${((performance.now() - started) / 1000).toFixed(1)}s ${message}`);
      },
      onMergeProgress: (processed, total) =>
        console.log(`${processed}/${total} provisional records merged`),
    },
  );
  finishStage();
  const report = {
    project,
    trace,
    runtime: process.versions,
    traceBytes: (await fs.stat(trace)).size,
    durationMs: performance.now() - started,
    // Analysis/export/verification are separate commands and excluded from these timings.
    scope: "Isolated SQLite import. Excludes backup and regeneration",
    timings,
    result: {
      sourceSha256: result.sourceSha256,
      observedEvents: result.observedEvents,
      droppedEvents: result.droppedEvents,
      executionRecords: result.execution.length,
      changed: result.changed,
      added: result.added,
      newFacts: result.storage.newFacts,
      reusedFacts: result.storage.reusedFacts,
      warnings: result.warnings,
    },
  };
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  // Remove only this invocation's isolated project, including any temporary SQL/WAL files.
  await fs.rm(directory, { recursive: true, force: true });
}
