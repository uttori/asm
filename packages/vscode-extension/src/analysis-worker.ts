import { createHash } from "node:crypto";
import {
  analyzeSnesFunctionRoles,
  validateSnesHeuristicConfiguration,
} from "@uttori/asm-plugin-snes";
import { parentPort } from "node:worker_threads";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadAnalysisProjectSnapshot,
  AnalysisSourceIndex,
  type AnalysisSourceGroup,
  migrateManifest,
  buildRomCoverageMap,
  buildAnalysisCallGraph,
  buildInstructionAnalysisAnnotations,
  HalfOpenIntervalIndex,
  type AnalysisProjectSnapshot,
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

import {
  annotationFileSignature,
  lookupDisassemblyAnnotation,
  saveDisassemblyAnnotation,
  type AnnotationLookup,
  type AnnotationSave,
} from "./disassembly-annotation-data.js";

import { projectAnalysisNavigation } from "./analysis-navigation-data.js";
import type { AnalysisGraphNavigationTarget } from "./analysis-graph-tree.js";
import { readAnalysisSourceCatalog } from "./analysis-sources-data.js";

let current:
  | {
      directory: string;
      revision: string;
      project: AnalysisProjectSnapshot;
      shardSignature: string;
      coverage?: RomCoverageMap;
      sources?: AnalysisSourceIndex;
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
    | "debugAnnotations"
    | "annotationLookup"
    | "annotationSave"
    | "heuristics"
    | "navigation"
    | "sources"
    | "sourceSummary"
    | "sourceEntries";
  readonly navigationTarget?: AnalysisGraphNavigationTarget;
  readonly sourceId?: string;
  readonly baselineIds?: readonly string[];
  readonly sourceGroup?: AnalysisSourceGroup;
  readonly annotationLookup?: AnnotationLookup;
  readonly annotationSave?: AnnotationSave;
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
    // Refresh derived views, but keep validated shards until their files actually change.
    if (current) {
      current.coverage = undefined;
      current.sources = undefined;
      current.instructions = undefined;
      current.index = undefined;
    }
    return undefined;
  }
  if (message.operation === "sources") return readAnalysisSourceCatalog(message.directory);
  const revision = fs.readFileSync(path.join(message.directory, "analysis.json"), "utf8");
  if (message.operation === "manifest") return migrateManifest(JSON.parse(revision));
  const shardSignature = (): string =>
    current!.project.manifest.shards
      .map(({ path: file }) => annotationFileSignature(path.join(message.directory, file)))
      .join("|");
  if (
    !current ||
    current.directory !== message.directory ||
    current.revision !== revision ||
    current.shardSignature !== shardSignature()
  ) {
    // Release the previous project and projections before loading a new multi-gigabyte revision.
    current = undefined;
    current = {
      directory: message.directory,
      revision,
      project: loadAnalysisProjectSnapshot(message.directory),
      shardSignature: "",
    };
    current.shardSignature = shardSignature();
  }
  const { project } = current;
  if (message.operation === "navigation") {
    if (!message.navigationTarget) throw new Error("Choose an analysis location.");
    return projectAnalysisNavigation(project, message.navigationTarget);
  }
  if (message.operation === "sourceSummary" || message.operation === "sourceEntries") {
    if (!message.sourceId) throw new Error("Choose a source to inspect.");
    current.sources ??= new AnalysisSourceIndex(project.manifest, project.shards);
    if (message.operation === "sourceSummary")
      return {
        manifest: project.manifest,
        comparison: current.sources.compare(message.sourceId, message.baselineIds),
      };
    if (!message.sourceGroup) throw new Error("Choose a source contribution group.");
    return current.sources.page(
      message.sourceId,
      message.sourceGroup,
      message.offset,
      message.baselineIds,
    );
  }
  if (message.operation === "annotationLookup") {
    if (!message.annotationLookup) throw new Error("Missing annotation lookup.");
    return lookupDisassemblyAnnotation(project, message.annotationLookup);
  }
  if (message.operation === "annotationSave") {
    if (!message.annotationSave) throw new Error("Missing annotation edit.");
    const saved = saveDisassemblyAnnotation(message.directory, project, message.annotationSave);
    try {
      const published = fs.readFileSync(path.join(message.directory, "analysis.json"), "utf8");
      // A subsequent writer may publish before we observe the manifest again.
      if (
        createHash("sha256").update(published).digest("hex") ===
        saved.snapshot.revision.manifestSha256
      ) {
        current = {
          directory: message.directory,
          revision: published,
          project: saved.snapshot,
          shardSignature: "",
        };
        current.shardSignature = shardSignature();
      } else current = undefined;
    } catch {
      // Publication succeeded; an optional cache refresh must not report the save as failed.
      current = undefined;
    }
    return saved.inverse;
  }
  if (message.operation === "heuristics") {
    if (project.manifest.target !== "snes.sfc")
      throw new Error("Function heuristics require a SNES analysis project.");
    const file = path.join(message.directory, "heuristics.json");
    const config = validateSnesHeuristicConfiguration(
      fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {},
    );
    const result = analyzeSnesFunctionRoles(project.shards, config);
    return {
      enabled: config.enabled !== false,
      total: result.roles.length,
      roles: result.roles.slice(0, 500),
    };
  }
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

const handleMessage = (message: AnalysisWorkerRequest): void => {
  const send = (response: unknown): void => {
    if (parentPort) parentPort.postMessage(response);
    else process.send?.(response as Parameters<NonNullable<typeof process.send>>[0]);
  };
  try {
    send({ id: message.id, value: request(message) });
  } catch (error) {
    send({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

if (parentPort) parentPort.on("message", handleMessage);
else {
  process.on("message", handleMessage);
  process.on("disconnect", () => process.exit(0));
}
