import { parentPort } from "node:worker_threads";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadAnalysisProject,
  migrateManifest,
  buildRomCoverageMap,
  buildAnalysisCallGraph,
  buildInstructionAnalysisAnnotations,
  HalfOpenIntervalIndex,
  type LoadedAnalysisProject,
  type RomCoverageMap,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import type { DebugMapRange } from "@uttori/asm-core/debug-map";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
  type InstructionAnnotationIndex,
} from "./analysis-annotation-index.js";
import { formatInstructionAnnotationSummary } from "./analysis-annotation-format.js";

let current:
  | {
      directory: string;
      revision: string;
      project: LoadedAnalysisProject;
      coverage?: RomCoverageMap;
      instructions?: readonly InstructionAnalysisAnnotation[];
      index?: InstructionAnnotationIndex;
    }
  | undefined;

export interface AnalysisWorkerRequest {
  readonly id: number;
  readonly directory: string;
  readonly operation:
    | "clear"
    | "manifest"
    | "coverage"
    | "segments"
    | "details"
    | "graph"
    | "annotations"
    | "debugAnnotations";
  readonly offset?: number;
  readonly ranges?: readonly DebugMapRange[];
}

/**
 * Runs only in a worker: full native shards never cross into the extension UI heap.
 * @param {AnalysisWorkerRequest} message Bounded projection request.
 * @returns {unknown} Compact result without persisted shards.
 */
const request = (message: AnalysisWorkerRequest): unknown => {
  if (message.operation === "clear") {
    current = undefined;
    return undefined;
  }
  const revision = fs.readFileSync(path.join(message.directory, "analysis.json"), "utf8");
  if (message.operation === "manifest") return migrateManifest(JSON.parse(revision));
  if (!current || current.directory !== message.directory || current.revision !== revision)
    current = {
      directory: message.directory,
      revision,
      project: loadAnalysisProject(message.directory),
    };
  const { project } = current;
  if (["coverage", "segments", "details"].includes(message.operation)) {
    const map = (current.coverage ??= buildRomCoverageMap(project.manifest, project.shards));
    if (message.operation === "coverage")
      return {
        ...map,
        segments: [],
        unprojected: [],
        diagnostics: [],
        detailCount: map.unprojected.length + map.diagnostics.length,
      };
    const offset = message.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Invalid analysis page offset.");
    if (message.operation === "segments") return map.segments.slice(offset, offset + 200);
    const details = [];
    for (
      let index = offset;
      index < Math.min(offset + 200, map.unprojected.length + map.diagnostics.length);
      index++
    ) {
      if (index < map.unprojected.length) {
        const record = map.unprojected[index];
        details.push({
          id: `${record.kind}:${record.id}:${record.reason}`,
          label: record.id,
          description: record.reason,
          icon: "debug-disconnect",
        });
      } else {
        const record = map.diagnostics[index - map.unprojected.length];
        details.push({
          id: `diagnostic:${index}`,
          label: record.recordId,
          description: "clipped",
          tooltip: record.message,
          icon: "warning",
        });
      }
    }
    return details;
  }
  if (message.operation === "graph") {
    const graph = buildAnalysisCallGraph(project.shards);
    const fileSpaces = new Set(
      project.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id),
    );
    const indexes = new Map(
      project.manifest.addressSpaces.map(({ id }) => [
        id,
        new HalfOpenIntervalIndex(
          project.shards.annotations.filter(({ addressSpace }) => addressSpace === id),
        ),
      ]),
    );
    const summaries = [
      ...new Set(
        project.shards.analysis.flatMap((record) =>
          record.kind === "summary" ? [record.architecture] : [],
        ),
      ),
    ];
    const hints: Record<string, readonly string[]> = {};
    for (const location of [
      ...graph.functions,
      ...graph.unresolved,
      ...graph.calls.map((call) => ({
        addressSpace: call.addressSpace,
        address: call.fromAddress,
        outputOffsets: call.fromOutputOffsets,
      })),
    ]) {
      const key = `${location.addressSpace}:${location.address}`;
      if (hints[key]) continue;
      const annotations = [
        ...(indexes.get(location.addressSpace)?.at(location.address) ?? []),
        ...[...fileSpaces].flatMap((space) =>
          location.outputOffsets.flatMap((offset) => indexes.get(space)?.at(offset) ?? []),
        ),
      ];
      const runtime = project.shards.runtime.filter(
        (record) =>
          "addressSpace" in record &&
          record.addressSpace === location.addressSpace &&
          (("address" in record && record.address === location.address) ||
            (record.kind === "runtime-coverage" &&
              record.start <= location.address &&
              location.address < record.end)),
      );
      const architectures = [
        ...new Set([
          ...annotations.map(({ architecture }) => architecture),
          ...runtime.map(({ architecture }) => architecture),
        ]),
      ];
      const fallback = summaries.length === 1 ? summaries : [];
      hints[key] = architectures.length ? architectures : fallback;
    }
    return { manifest: project.manifest, graph, hints };
  }
  if (message.operation === "annotations" && !message.ranges?.length) return [];
  current.instructions ??= buildInstructionAnalysisAnnotations(
    project.manifest,
    project.shards,
  ).instructions;
  if (message.operation === "debugAnnotations")
    return current.instructions
      .map((entry) => ({
        addressSpace: entry.addressSpace,
        address: entry.address,
        outputOffsets: entry.outputOffsets,
        architectures: entry.architectures,
        text: formatInstructionAnnotationSummary(entry),
      }))
      .filter(({ text }) => text);
  if ((message.ranges?.length ?? 0) > 2000)
    throw new Error("At most 2000 visible source ranges may be projected per request.");
  current.index ??= createInstructionAnnotationIndex(current.instructions);
  const output: { line: number; annotation: InstructionAnalysisAnnotation }[] = [];
  for (const range of message.ranges ?? []) {
    for (const annotation of instructionAnnotationsForDebugRange(current.index, range)) {
      output.push({ line: range.line, annotation });
      if (output.length === 2000) return output;
    }
  }
  return output;
};

parentPort?.on("message", (message: AnalysisWorkerRequest) => {
  try {
    parentPort!.postMessage({ id: message.id, value: request(message) });
  } catch (error) {
    parentPort!.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
