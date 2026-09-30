/** Compare old detailed projection and compact counts on an existing read-only project snapshot. */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import type { DebugMapRange } from "@uttori/asm-core/debug-map";
import {
  buildInstructionAnalysisAnnotations,
  type AnalysisProjectManifest,
  registerRuntimeHistory,
} from "@uttori/asm-disassembler";

import {
  annotationQueryIndexesReady,
  readInstructionExecutionSummary,
  readSqliteAnnotationView,
} from "../packages/disassembler/src/storage/sqlite-annotation-query.js";
import { parseSqlitePayload } from "../packages/disassembler/src/storage/sqlite-payload.js";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
} from "../packages/vscode-extension/src/analysis/annotation-index.js";

const { values } = parseArgs({
  options: { project: { type: "string" }, ranges: { type: "string" }, output: { type: "string" } },
});
if (!values.project || !values.ranges) {
  throw new Error(
    "Usage: benchmark-editor-information.ts --project <analysis directory> --ranges <debug-map ranges JSON> [--output <report.json>]",
  );
}
const input = JSON.parse(fs.readFileSync(values.ranges, "utf8")) as
  | DebugMapRange[]
  | { ranges: DebugMapRange[] };
const ranges = Array.isArray(input) ? input : input.ranges;
const database = new DatabaseSync(path.join(values.project, "analysis.sqlite"), { readOnly: true });
registerRuntimeHistory(database);
try {
  database.exec("BEGIN");
  if (!annotationQueryIndexesReady(database)) {
    throw new Error(
      "Prepare indexes through the normal project workflow before running this read-only comparison.",
    );
  }
  const manifest = parseSqlitePayload<AnalysisProjectManifest>(
    database.prepare("SELECT v FROM meta WHERE k='manifest'").get()?.v,
  );
  const measurements: { mode: string; ms: number; bytes: number; rows: number }[] = [];
  for (let repetition = 0; repetition < 4; repetition++) {
    // Alternate order to reduce the influence of filesystem/SQLite page-cache warming.
    const modes = repetition % 2 ? ["compact", "detailed"] : ["detailed", "compact"];
    for (const mode of modes) {
      const start = performance.now();
      let result: unknown[] | readonly unknown[];
      if (mode === "compact") {
        result = readInstructionExecutionSummary(database, manifest, ranges);
      } else {
        const view = readSqliteAnnotationView(database, manifest, ranges);
        const instructions = buildInstructionAnalysisAnnotations(
          manifest,
          view.shards,
        ).instructions.map((entry) => ({
          ...entry,
          executionCount:
            view.executionCounts.get(`${entry.addressSpace}:${entry.address}`) ??
            entry.executionCount,
          ...(view.limited ? { detailsLimited: true } : {}),
        }));
        const index = createInstructionAnnotationIndex(instructions);
        result = ranges
          .flatMap((range) =>
            instructionAnnotationsForDebugRange(index, range).map((annotation) => ({
              line: range.line,
              annotation,
            })),
          )
          .slice(0, 2000);
      }
      const serialized = JSON.stringify(result);
      measurements.push({
        mode,
        ms: performance.now() - start,
        bytes: Buffer.byteLength(serialized),
        rows: result.length,
      });
    }
  }
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    ranges,
    measurements,
    notes:
      "Read-only transaction on existing prepared indexes. Timing includes query, semantic projection and JSON serialization; excludes worker startup/IPC and VS Code rendering. First runs are not guaranteed cold OS-cache measurements. Counts remain qualified; compact rows group locations per requested range.",
  };
  if (values.output) {
    fs.writeFileSync(values.output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(measurements, null, 2));
} finally {
  database.close();
}
