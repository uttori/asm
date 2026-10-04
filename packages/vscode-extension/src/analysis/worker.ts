import * as fs from "node:fs";
import * as path from "node:path";
import { parentPort } from "node:worker_threads";

import type { DebugMapRange } from "@uttori/asm-core/debug-map";
import {
  ANALYSIS_PROJECT_SQLITE_FILE,
  SqliteAnalysisStore,
  buildInstructionAnalysisAnnotations,
  openAnalysisProjectStore,
  readCaptureImportNotes,
  type ShardKind,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";

import { formatInstructionAnnotationSummary } from "../editor-info/format.js";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
} from "./annotation-index.js";
import { projectAnalysisNavigation } from "./navigation-data.js";
import type { AnalysisNavigationTarget } from "./navigation-target.js";
import { analysisResearchContext } from "./research-context.js";
import { readAnalysisSourceCatalog } from "./sources-data.js";

/** Operations the extension host may request. The worker still rejects any other string. */
export type AnalysisWorkerOperation =
  | "clear"
  | "manifest"
  | "coverage"
  | "coverageConflicts"
  | "annotationSummary"
  | "annotations"
  | "debugAnnotations"
  | "navigation"
  | "evidenceChoices"
  | "explainEvidence"
  | "sources"
  | "sourceNotes";

/**
 * IPC request with a correlation ID, project directory, and operation-specific selectors; loaded
 * project shards never enter the message.
 */
export interface AnalysisWorkerRequest {
  readonly id: number;
  readonly directory: string;
  /** Selected worktree, needed when a private evidence store lives outside that repository. */
  readonly sourceRoot?: string;
  /** Untrusted IPC may name an operation this process does not implement. */
  readonly operation: string;
  readonly navigationTarget?: AnalysisNavigationTarget;
  readonly sourceId?: string;
  readonly evidenceSelection?: Partial<Record<ShardKind, readonly string[]>>;
  readonly evidenceRecord?: { kind: ShardKind; id: string };
  readonly offset?: number;
  readonly ranges?: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Visible editor ranges keep their debug-map identity; length limits run before this check. */
function isDebugMapRange(value: unknown): value is DebugMapRange {
  return (
    isRecord(value) &&
    typeof value.architecture === "string" &&
    typeof value.addressSpace === "string" &&
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.sourceId === "number" &&
    typeof value.line === "number" &&
    (value.outputStart === undefined || typeof value.outputStart === "number") &&
    (value.outputEnd === undefined || typeof value.outputEnd === "number")
  );
}

function debugMapRanges(values: readonly unknown[]): readonly DebugMapRange[] {
  if (!values.every(isDebugMapRange)) {
    throw new Error("Invalid debug-map range.");
  }
  return values;
}

/** The worker owns one connection until it switches projects or the database inode is replaced. */
let database: { directory: string; identity: string; store: SqliteAnalysisStore } | undefined;
/**
 * Reuse the worker-owned SQLite connection while both project directory and device/inode
 * identity match.
 * Close it before switching projects or opening a replaced database; filesystem/open failures
 * propagate.
 * @param {string} directory Absolute native project directory.
 * @returns {SqliteAnalysisStore} Worker-owned connection, reopened if its database identity changes.
 */
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
 * Runs only in a worker: full native shards never cross into the extension UI heap.
 * @param {AnalysisWorkerRequest} message Bounded projection request.
 * @returns {unknown} Compact result without persisted shards.
 */
const projectRequest = (message: AnalysisWorkerRequest): unknown => {
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
  if (message.operation === "annotationSummary") {
    const supplied = message.ranges ?? [];
    if (!supplied.length) {
      return [];
    }
    if (supplied.length > 2000) {
      throw new Error("At most 2000 visible source ranges may be projected per request.");
    }
    const ranges = debugMapRanges(supplied);
    store.prepareAnnotationQueries();
    return store.transaction(() => store.instructionExecutionSummary(ranges), false);
  }
  if (message.operation === "annotations" || message.operation === "debugAnnotations") {
    const supplied = message.ranges ?? [];
    // Reject unbounded requests before loading metadata or initializing any query index.
    if (!supplied.length) {
      return [];
    }
    if (supplied.length > 2000) {
      throw new Error("At most 2000 visible source ranges may be projected per request.");
    }
    const ranges = debugMapRanges(supplied);
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const manifest = store.manifest();
      const view = store.instructionAnnotationView(ranges);
      const instructions = buildInstructionAnalysisAnnotations(
        manifest,
        view.shards,
      ).instructions.map((entry) =>
        Object.assign(
          {},
          entry,
          {
            executionCount:
              view.executionCounts.get(`${entry.addressSpace}:${entry.address}`) ??
              entry.executionCount,
          },
          view.limited ? { detailsLimited: true } : {},
        ),
      );
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
  if (message.operation === "sourceNotes") {
    const source = store.transaction(
      () => store.sourceCatalog().sources.find(({ id }) => id === message.sourceId),
      false,
    );
    if (!source) {
      throw new Error("Choose a source to inspect.");
    }
    return source.sha256
      ? (readCaptureImportNotes(message.directory, source.sha256) ?? null)
      : null;
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
  if (message.operation === "coverage") {
    return store.coverageSummary();
  }
  if (message.operation === "coverageConflicts") {
    return store.coverageConflicts(message.offset);
  }
  throw new Error("Unknown analysis worker operation.");
};

/**
 * Project the selected saved research before every query. Check the input identity again before
 * returning: another window may select a different branch over the same private evidence store.
 * Failed or concurrent projections produce an error instead of names from the wrong branch.
 */
const request = (message: AnalysisWorkerRequest): unknown => {
  if (message.operation === "clear") {
    return undefined;
  }
  const store = projectDatabase(message.directory);
  const research = analysisResearchContext(message.directory, message.sourceRoot);
  if (!research) {
    if (store.researchInputsIdentity()) {
      throw new Error("Select the Git source project before querying its research index.");
    }
    return projectRequest(message);
  }
  // Visible-source requests are frequent. A matching projection only needs reads; opening a
  // write transaction would also run evidence maintenance and compete with imports for the lock.
  if (!store.researchInputsAreCurrent(research.snapshot.hash)) {
    const changed = store.transaction(() => store.synchronizeResearchInputs(research.snapshot));
    if (changed) {
      store.writePointer(message.directory);
    }
  }
  if (
    ["coverage", "coverageConflicts", "annotations", "debugAnnotations", "navigation"].includes(
      message.operation,
    )
  ) {
    // Captured observations remain queryable while new classification/CPU/target declarations
    // await analysis. Graph-derived views must not display an earlier branch's interpretation.
    store.assertCurrentAnalysis();
  }
  const revision = store.revision();
  const value = projectRequest(message);
  const current = analysisResearchContext(message.directory, research.root);
  if (
    current?.snapshot.hash !== research.snapshot.hash ||
    store.researchInputsIdentity() !== research.snapshot.hash ||
    store.revision() !== revision
  ) {
    throw new Error("Research inputs changed during this query. Retry with the selected branch.");
  }
  return value;
};

const send = (response: unknown): void => {
  if (parentPort) {
    parentPort.postMessage(response);
  } else {
    process.send?.(response);
  }
};

/**
 * Execute one projection and send its correlation ID with either the value or serialized error
 * over worker-thread or child-process IPC.
 * @param {AnalysisWorkerRequest} message Projection operation and correlation ID received from the parent.
 */
const handleMessage = (message: AnalysisWorkerRequest): void => {
  try {
    const value = request(message);
    if (value instanceof Promise) {
      void value
        .then((result: unknown) => send({ id: message.id, value: result }))
        .catch((error: unknown) =>
          send({ id: message.id, error: error instanceof Error ? error.message : String(error) }),
        );
    } else {
      send({ id: message.id, value });
    }
  } catch (error) {
    send({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

/**
 * Expose the worker dispatcher for direct callers and tests. Projections/edits are synchronous;
 * source publication returns a promise because trusted plugin loading is asynchronous. Both
 * paths propagate errors, and the client serializes requests until their response arrives.
 */
export const runAnalysisWorkerRequest = request;

if (parentPort) {
  parentPort.on("message", handleMessage);
} else if (typeof process.send === "function") {
  process.on("message", handleMessage);
  process.on("disconnect", () => process.exit(0));
}
