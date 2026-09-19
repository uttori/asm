import * as fs from "node:fs";
import * as path from "node:path";
import { parentPort } from "node:worker_threads";

import type { DebugMapRange } from "@uttori/asm-core/debug-map";
import {
  ANALYSIS_PROJECT_SQLITE_FILE,
  SqliteAnalysisStore,
  buildInstructionAnalysisAnnotations,
  HalfOpenIntervalIndex,
  canonicalJson,
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  openAnalysisProjectStore,
  type AnalysisProjectSnapshot,
  type AnalysisSourceGroup,
  type ShardKind,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import {
  analyzeSnesFunctionRoles,
  validateSnesHeuristicConfiguration,
  snesHardwareDefines,
} from "@uttori/asm-plugin-snes";

import { formatInstructionAnnotationSummary } from "./analysis-annotation-format.js";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
} from "./analysis-annotation-index.js";
import type { AnalysisGraphNavigationTarget } from "./analysis-graph-tree.js";
import { projectAnalysisNavigation } from "./analysis-navigation-data.js";
import { readAnalysisSourceCatalog } from "./analysis-sources-data.js";
import {
  lookupDisassemblyAnnotation,
  saveDisassemblyAnnotation,
  refreshDisassemblyAnnotation,
  type AnnotationLookup,
  type AnnotationSave,
  type AnnotationRefreshInput,
} from "./disassembly-annotation-data.js";

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
    | "annotationRefresh"
    | "heuristics"
    | "navigation"
    | "evidenceChoices"
    | "explainEvidence"
    | "sources"
    | "sourceSummary"
    | "sourceEntries";
  readonly navigationTarget?: AnalysisGraphNavigationTarget;
  readonly sourceId?: string;
  readonly evidenceSelection?: Partial<Record<ShardKind, readonly string[]>>;
  readonly evidenceRecord?: { kind: ShardKind; id: string };
  readonly sourceGroup?: AnalysisSourceGroup;
  readonly annotationLookup?: AnnotationLookup;
  readonly annotationSave?: AnnotationSave;
  readonly annotationRefresh?: AnnotationRefreshInput;
  readonly offset?: number;
  readonly ranges?: readonly DebugMapRange[];
}

/** The worker owns one connection until it switches projects or the database inode is replaced. */
let database: { directory: string; identity: string; store: SqliteAnalysisStore } | undefined;
const projectDatabase = (directory: string): SqliteAnalysisStore => {
  const stat = fs.statSync(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE), { bigint: true });
  const identity = `${stat.dev}:${stat.ino}`;
  if (database?.directory !== directory || database.identity !== identity) {
    database?.store.close();
    database = { directory, identity, store: openAnalysisProjectStore(directory) };
  }
  return database.store;
};

/**
 * Label/comment editing needs names and selected instruction boundaries, not every CFG variant.
 * @param {SqliteAnalysisStore} store Connection inside a read transaction.
 * @returns {AnalysisProjectSnapshot} Validated editing view; never substitute it for a full export snapshot.
 */
const annotationEditSnapshot = (store: SqliteAnalysisStore): AnalysisProjectSnapshot => {
  const { manifest, shards } = store.annotationEditView();
  return { manifest, shards, revision: analysisProjectRevision(manifest) };
};

/**
 * Runs only in a worker: full native shards never cross into the extension UI heap.
 * @param {AnalysisWorkerRequest} message Bounded projection request.
 * @returns {unknown} Compact result without persisted shards.
 */
const request = (message: AnalysisWorkerRequest): unknown => {
  if (message.operation === "clear") {
    return undefined;
  }
  if (message.operation === "sources") {
    return readAnalysisSourceCatalog(message.directory);
  }
  const store = projectDatabase(message.directory);
  if (message.operation === "evidenceChoices") {
    return store.transaction(
      () => ({
        manifest: store.manifest(),
        shards: store.evidenceChoices(message.evidenceSelection),
      }),
      false,
    );
  }
  if (message.operation === "explainEvidence") {
    if (!message.evidenceRecord) {
      throw new Error("Choose a record to explain.");
    }
    store.prepareSourceQueries();
    return store.explainEvidence(message.evidenceRecord.kind, message.evidenceRecord.id);
  }
  if (message.operation === "annotationLookup" || message.operation === "annotationSave") {
    store.prepareAnnotationQueries();
    const readNodes = (range: { addressSpace: string; start: number; outputStart?: number }) =>
      store
        .annotationNodesAt(range.addressSpace, range.start, range.outputStart)
        .filter((record) => record.kind === "cfg-node");
    if (message.operation === "annotationLookup") {
      if (!message.annotationLookup) {
        throw new Error("Missing annotation lookup.");
      }
      return store.transaction(
        () =>
          lookupDisassemblyAnnotation(
            annotationEditSnapshot(store),
            message.annotationLookup!,
            readNodes,
          ),
        false,
      );
    }
    if (!message.annotationSave) {
      throw new Error("Missing annotation edit.");
    }
    const input = message.annotationSave;
    const snapshot = store.transaction(() => {
      const snapshot = annotationEditSnapshot(store);
      const request = input.request;
      const fileSpace = snapshot.manifest.addressSpaces.some(
        (space) => space.id === request.addressSpace && space.kind === "file",
      );
      const nodes = readNodes({
        addressSpace: request.addressSpace,
        start: request.address,
        ...(fileSpace ? { outputStart: request.address } : {}),
      });
      return {
        ...snapshot,
        shards: { ...snapshot.shards, analysis: [...snapshot.shards.analysis, ...nodes] },
      };
    }, false);
    const saved = saveDisassemblyAnnotation(message.directory, snapshot, input);
    return { ...saved.inverse, refresh: { after: saved.snapshot.revision.manifestSha256 } };
  }
  if (message.operation === "annotations" || message.operation === "debugAnnotations") {
    const ranges = message.ranges ?? [];
    // Reject unbounded requests before loading metadata or initializing any query index.
    if (!ranges.length) {
      return [];
    }
    if (ranges.length > 2000) {
      throw new Error("At most 2000 visible source ranges may be projected per request.");
    }
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const manifest = store.manifest();
      const view = store.instructionAnnotationView(ranges);
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
      const output: { line: number; annotation: InstructionAnalysisAnnotation }[] = [];
      for (const range of ranges) {
        for (const annotation of instructionAnnotationsForDebugRange(index, range)) {
          output.push({ line: range.line, annotation });
          if (output.length >= 2000) {
            break;
          }
        }
        if (output.length >= 2000) {
          break;
        }
      }
      if (message.operation === "debugAnnotations") {
        return [...new Map(output.map(({ annotation }) => [annotation.id, annotation])).values()]
          .map((entry) => ({
            addressSpace: entry.addressSpace,
            address: entry.address,
            outputOffsets: entry.outputOffsets,
            architectures: entry.architectures,
            text: formatInstructionAnnotationSummary(entry),
          }))
          .filter(({ text }) => text);
      }
      return output;
    }, false);
  }
  if (message.operation === "sourceSummary" || message.operation === "sourceEntries") {
    if (!message.sourceId) {
      throw new Error("Choose a source to inspect.");
    }
    store.prepareSourceQueries();
    if (message.operation === "sourceEntries" && message.sourceGroup === "instructions") {
      store.prepareAnnotationQueries();
    }
    return store.transaction(() => {
      if (message.operation === "sourceSummary") {
        return store.sourceSummary(message.sourceId!);
      }
      if (!message.sourceGroup) {
        throw new Error("Choose a source contribution group.");
      }
      return store.sourcePage(message.sourceId!, message.sourceGroup, message.offset);
    }, false);
  }
  if (message.operation === "annotationRefresh") {
    if (!message.annotationRefresh) {
      throw new Error("Missing annotation refresh.");
    }
    if (
      path.resolve(message.annotationRefresh.target.projectDirectory) !==
      path.resolve(message.directory)
    ) {
      throw new Error("Annotation refresh target differs from the loaded project.");
    }
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const view = store.sourceExportView();
      const snapshot = { ...view, revision: analysisProjectRevision(view.manifest) };
      return refreshDisassemblyAnnotation(
        snapshot,
        message.annotationRefresh!,
        store.instructionExportGroups(),
      );
    }, false);
  }
  const manifest = store.transaction(() => store.manifest(), false);
  if (message.operation === "manifest") {
    return manifest;
  }
  if (message.operation === "navigation") {
    if (!message.navigationTarget) {
      throw new Error("Choose an analysis location.");
    }
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const target = message.navigationTarget!;
      const analysis = store.navigationNodes(
        target.addressSpace,
        target.address,
        target.architectureHints,
      );
      const ranges = analysis.flatMap((record) => {
        if (record.kind !== "cfg-node") {
          return [];
        }
        const outputRange =
          record.fileOffset === undefined
            ? {}
            : { outputStart: record.fileOffset, outputEnd: record.fileOffset + record.size };
        return [
          {
            addressSpace: record.addressSpace,
            start: record.address,
            end: record.address + record.size,
            ...outputRange,
          },
        ];
      });
      if (!ranges.some((range) => range.start === target.address)) {
        ranges.push({
          addressSpace: target.addressSpace,
          start: target.address,
          end: target.address + 1,
        });
      }
      const view = store.instructionAnnotationView(ranges);
      return projectAnalysisNavigation(
        { manifest: store.manifest(), shards: { ...view.shards, analysis } },
        target,
        view.executionCounts,
      );
    }, false);
  }
  if (message.operation === "heuristics") {
    if (manifest.target !== "snes.sfc") {
      throw new Error("Function heuristics require a SNES analysis project.");
    }
    const file = path.join(message.directory, "heuristics.json");
    const config = validateSnesHeuristicConfiguration(
      fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {},
    );
    return store.cachedProjection(
      "snes_roles",
      canonicalJson([1, config]),
      ["analysis", "runtime", "evidence"],
      () => {
        const shards = {
          labels: [],
          comments: [],
          annotations: [],
          regions: [],
          imports: [],
          evidence: store.loadTable("evidence"),
          runtime: [],
          analysis: store.analysisByKinds(["cfg-node", "cfg-edge", "function"]),
        };
        const registers = [...new Set(snesHardwareDefines().map(([, address]) => address))];
        const addresses = [];
        for (let bank = 0; bank < 256; bank++) {
          if (bank <= 0x3f || (bank >= 0x80 && bank <= 0xbf)) {
            for (const low of registers) {
              addresses.push((bank << 16) | low);
            }
          }
        }
        const result = analyzeSnesFunctionRoles(
          shards,
          config,
          store.runtimeMemoryAtAddresses("snes.65816", "snes.cpu", addresses),
        );
        return {
          enabled: config.enabled !== false,
          total: result.roles.length,
          roles: result.roles.slice(0, 500),
        };
      },
    );
  }
  if (message.operation === "coverage") {
    return store.coverageSummary();
  }
  if (message.operation === "segments" || message.operation === "details") {
    return store.coveragePage(message.operation, message.offset);
  }
  if (message.operation === "graph") {
    const graphRevision = analysisProjectRevision(store.manifest());
    const graph = store.callGraph();
    store.prepareRuntimeArchitectures();
    return store.transaction(() => {
      assertAnalysisProjectRevision(store, graphRevision);
      const manifest = store.manifest();
      const annotations = store.loadTable("annotations");
      const fileSpaces = manifest.addressSpaces.filter((s) => s.kind === "file").map((s) => s.id);
      const indexes = new Map(
        manifest.addressSpaces.map(({ id }) => [
          id,
          new HalfOpenIntervalIndex(annotations.filter((a) => a.addressSpace === id)),
        ]),
      );
      const summaries = [
        ...new Set(
          store
            .analysisByKinds(["summary"])
            .flatMap((r) => (r.kind === "summary" ? [r.architecture] : [])),
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
        if (hints[key]) {
          continue;
        }
        const relevant = [
          ...(indexes.get(location.addressSpace)?.at(location.address) ?? []),
          ...fileSpaces.flatMap((space) =>
            location.outputOffsets.flatMap((offset) => indexes.get(space)?.at(offset) ?? []),
          ),
        ];
        const architectures = [
          ...new Set([
            ...relevant.map((a) => a.architecture),
            ...store.runtimeArchitecturesAt(location.addressSpace, location.address),
          ]),
        ];
        const fallback = summaries.length === 1 ? summaries : [];
        hints[key] = architectures.length ? architectures : fallback;
      }
      return { manifest, graph, hints };
    }, false);
  }
  throw new Error("Unknown analysis worker operation.");
};

const handleMessage = (message: AnalysisWorkerRequest): void => {
  const send = (response: unknown): void => {
    if (parentPort) {
      parentPort.postMessage(response);
    } else {
      process.send?.(response as Parameters<NonNullable<typeof process.send>>[0]);
    }
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

export const runAnalysisWorkerRequest = request;

if (parentPort) {
  parentPort.on("message", handleMessage);
} else if (typeof process.send === "function") {
  process.on("message", handleMessage);
  process.on("disconnect", () => process.exit(0));
}
