import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "node:worker_threads" &&
      typeof context.parentURL === "string" &&
      /[/\\]analysis-worker\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      return { shortCircuit: true, url: "analysis-worker-test:worker-threads" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "analysis-worker-test:worker-threads") {
      return {
        shortCircuit: true,
        format: "module",
        source: "export const parentPort = null;",
      };
    }
    return nextLoad(url, context);
  },
});

const { runAnalysisWorkerRequest } = await import("../src/analysis-worker.js");

const emptyShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  imports: [],
  evidence: [],
  runtime: [],
} as const;

const fixtureProject = (): AnalysisProject => {
  const rom = new RomImage(new Uint8Array(1024), { headerSize: 0 });
  return {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom: rom.identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [
        { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
        { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      ],
    },
    shards: {
      ...emptyShards,
      evidence: [{ id: "test", source: "manual", sourceId: "test", confidence: "certain" }],
      runtime: Array.from({ length: 8 }, (_, address) => ({
        id: `execution-${address}`,
        kind: "runtime-execution" as const,
        architecture: "fixture",
        addressSpace: "cpu",
        address,
        size: 1,
        count: 1,
        evidence: ["test"],
      })),
      annotations: [
        {
          id: "cpu-0",
          addressSpace: "cpu",
          start: 0,
          end: 1,
          architecture: "fixture",
          classification: "opcode" as const,
          state: { m: true },
          evidence: ["test"],
        },
      ],
    },
  };
};

const tempProject = (t: { teardown(callback: () => void): void }): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-analysis-worker-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, fixtureProject());
  return directory;
};

const request = (
  directory: string,
  operation: Parameters<typeof runAnalysisWorkerRequest>[0]["operation"],
  extra: Omit<
    Parameters<typeof runAnalysisWorkerRequest>[0],
    "id" | "directory" | "operation"
  > = {},
): unknown => runAnalysisWorkerRequest({ id: 1, directory, operation, ...extra });

test.serial("analysis worker projects catalog, coverage and bounded annotation ranges", (t) => {
  const directory = tempProject(t);
  t.is(request(directory, "clear"), undefined);
  const catalog = request(directory, "sources") as {
    sources: readonly { id: string }[];
  };
  t.true(catalog.sources.length >= 1);
  const manifest = request(directory, "manifest") as {
    target: string;
    rom: { contentSize: number };
  };
  t.is(manifest.target, "fixture");
  t.is(manifest.rom.contentSize, 1024);
  const coverage = request(directory, "coverage") as { summary: { totalBytes: number } };
  t.is(coverage.summary.totalBytes, 1024);
  t.true(Array.isArray(request(directory, "segments")));
  t.true(Array.isArray(request(directory, "details")));
  const graph = request(directory, "graph") as {
    manifest: unknown;
    graph: unknown;
    hints: unknown;
  };
  t.truthy(graph.manifest);
  t.truthy(graph.graph);
  t.truthy(graph.hints);
  t.deepEqual(request(directory, "annotations", { ranges: [] }), []);
  t.throws(
    () =>
      request(directory, "annotations", {
        ranges: Array.from({ length: 2001 }, () => ({}) as never),
      }),
    {
      message: /At most 2000/,
    },
  );
  const annotated = request(directory, "annotations", {
    ranges: [
      {
        architecture: "fixture",
        addressSpace: "cpu",
        start: 0,
        end: 1,
        sourceId: 0,
        line: 1,
      },
    ],
  }) as unknown[];
  t.true(Array.isArray(annotated));
  t.true(
    Array.isArray(
      request(directory, "debugAnnotations", {
        ranges: [
          {
            architecture: "fixture",
            addressSpace: "cpu",
            start: 0,
            end: 1,
            sourceId: 0,
            line: 1,
          },
        ],
      }),
    ),
  );
});

test.serial("analysis worker navigation, evidence and missing payloads throw closed", (t) => {
  const directory = tempProject(t);
  const manifest = request(directory, "manifest") as {
    target: string;
    rom: { contentSha256: string; contentSize: number };
  };
  t.throws(() => request(directory, "navigation"), { message: /Choose an analysis location/ });
  t.throws(
    () =>
      request(directory, "navigation", {
        navigationTarget: {
          projectDirectory: directory,
          target: manifest.target,
          romContentSha256: "f".repeat(64),
          romContentSize: manifest.rom.contentSize,
          addressSpace: "cpu",
          address: 0,
          outputOffsets: [],
          architectureHints: ["fixture"],
          recordIds: [],
        },
      }),
    { message: /no longer matches/ },
  );
  const navigation = request(directory, "navigation", {
    navigationTarget: {
      projectDirectory: directory,
      target: manifest.target,
      romContentSha256: manifest.rom.contentSha256,
      romContentSize: manifest.rom.contentSize,
      addressSpace: "cpu",
      address: 0,
      outputOffsets: [],
      architectureHints: ["fixture"],
      recordIds: [],
    },
  }) as { lines: unknown[]; capturedRam: boolean };
  t.true(Array.isArray(navigation.lines));
  t.is(typeof navigation.capturedRam, "boolean");
  t.truthy(request(directory, "evidenceChoices"));
  t.throws(() => request(directory, "explainEvidence"), { message: /Choose a record to explain/ });
  t.throws(() => request(directory, "annotationLookup"), { message: /Missing annotation lookup/ });
  t.throws(() => request(directory, "annotationSave"), { message: /Missing annotation edit/ });
  t.throws(() => request(directory, "sourceSummary"), { message: /Choose a source to inspect/ });
  t.throws(() => request(directory, "sourceEntries"), { message: /Choose a source to inspect/ });
  t.throws(() => request(directory, "annotationRefresh"), {
    message: /Missing annotation refresh/,
  });
  t.throws(() => request(directory, "unknown" as never), {
    message: /Unknown analysis worker operation/,
  });
  t.throws(() => request(directory, "heuristics"), {
    message: /Function heuristics require a SNES analysis project/,
  });
});
