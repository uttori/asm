import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  publishAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import { sourceGit } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../../tests/ava-helper.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "node:worker_threads" &&
      typeof context.parentURL === "string" &&
      /[/\\]analysis[/\\]worker\.(ts|js|mts|mjs)/.test(context.parentURL)
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

const { runAnalysisWorkerRequest } = await import("../../src/analysis/worker.js");

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFixtureManifest(value: unknown): value is {
  target: string;
  rom: { contentSha256: string; contentSize: number };
} {
  return (
    isRecord(value) &&
    typeof value.target === "string" &&
    isRecord(value.rom) &&
    typeof value.rom.contentSha256 === "string" &&
    typeof value.rom.contentSize === "number"
  );
}

const tempProject = (t: { teardown(callback: () => void): void }): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-analysis-worker-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, fixtureProject());
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
  const catalog = request(directory, "sources");
  if (!isRecord(catalog) || !Array.isArray(catalog.sources)) {
    throw new Error("expected source catalog");
  }
  t.true(catalog.sources.length >= 1);
  const manifest = request(directory, "manifest");
  if (
    !isRecord(manifest) ||
    typeof manifest.target !== "string" ||
    !isRecord(manifest.rom) ||
    typeof manifest.rom.contentSize !== "number"
  ) {
    throw new Error("expected manifest");
  }
  t.is(manifest.target, "fixture");
  t.is(manifest.rom.contentSize, 1024);
  const coverage = request(directory, "coverage");
  if (
    !isRecord(coverage) ||
    !isRecord(coverage.summary) ||
    typeof coverage.summary.totalBytes !== "number"
  ) {
    throw new Error("expected coverage");
  }
  t.is(coverage.summary.totalBytes, 1024);
  t.deepEqual(request(directory, "coverageConflicts"), { count: 0, segments: [] });
  t.deepEqual(request(directory, "annotations", { ranges: [] }), []);
  t.throws(
    () =>
      request(directory, "annotations", {
        ranges: Array.from({ length: 2001 }, () => ({})),
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
  });
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
  const manifest = request(directory, "manifest");
  if (!isFixtureManifest(manifest)) {
    throw new Error("expected manifest");
  }
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
  });
  if (
    !isRecord(navigation) ||
    !Array.isArray(navigation.lines) ||
    typeof navigation.capturedRam !== "boolean"
  ) {
    throw new Error("expected navigation");
  }
  t.true(Array.isArray(navigation.lines));
  t.is(typeof navigation.capturedRam, "boolean");
  t.truthy(request(directory, "evidenceChoices"));
  t.throws(() => request(directory, "explainEvidence"), { message: /Choose a record to explain/ });
  t.throws(() => request(directory, "sourceNotes"), { message: /Choose a source to inspect/ });
  t.throws(() => request(directory, "unknown"), {
    message: /Unknown analysis worker operation/,
  });
  for (const operation of ["graph", "heuristics"]) {
    t.throws(() => request(directory, operation), {
      message: /Unknown analysis worker operation/,
    });
  }
});

test.serial(
  "worker queries follow terminal branch changes for an external evidence store",
  async (t) => {
    const directory = tempProject(t);
    const root = path.join(directory, "source project");
    fs.mkdirSync(path.join(root, ".uttori/research"), { recursive: true });
    fs.mkdirSync(path.join(root, ".uttori-local"), { recursive: true });
    const romSha256 = fixtureProject().manifest.rom.contentSha256;
    fs.writeFileSync(
      path.join(root, ".uttori/project.json"),
      JSON.stringify({
        format: "uttori-source-project",
        version: 1,
        id: "fixture",
        target: "fixture",
        romSha256,
        sourceRoots: ["src"],
        researchRoots: [".uttori/research"],
        buildConfig: "src/config.json",
        layout: ".uttori/layout.json",
        captures: ".uttori/captures.json",
      }),
    );
    fs.writeFileSync(
      path.join(root, ".uttori-local/project.json"),
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        rom: "../original.sfc",
        evidence: directory,
      }),
    );
    fs.writeFileSync(path.join(root, ".gitignore"), ".uttori-local/\n");
    const names = path.join(root, ".uttori/research/names.json");
    const writeName = (name: string) =>
      fs.writeFileSync(
        names,
        JSON.stringify({
          format: "uttori-research",
          version: 1,
          project: "fixture",
          romSha256,
          decisions: [
            {
              collection: "labels",
              id: "entry",
              value: {
                id: "entry",
                name,
                sourceName: name,
                addressSpace: "cpu",
                address: 0,
                analysisEntryPoint: false,
                evidence: ["test"],
              },
            },
          ],
        }),
      );
    writeName("RandomByte");
    await sourceGit(root, ["init", "-b", "main"]);
    await sourceGit(root, ["config", "user.name", "Fixture"]);
    await sourceGit(root, ["config", "user.email", "fixture@localhost"]);
    await sourceGit(root, ["add", "."]);
    await sourceGit(root, ["commit", "-m", "Name entry"]);
    const readName = () => {
      const result = request(directory, "evidenceChoices", {
        sourceRoot: root,
        evidenceSelection: { labels: ["entry"] },
      });
      if (
        !isRecord(result) ||
        !isRecord(result.shards) ||
        !Array.isArray(result.shards.labels) ||
        !isRecord(result.shards.labels[0]) ||
        typeof result.shards.labels[0].sourceName !== "string"
      ) {
        throw new Error("expected evidence labels");
      }
      return result.shards.labels[0].sourceName;
    };
    t.is(readName(), "RandomByte");
    await sourceGit(root, ["switch", "-c", "alternate"]);
    writeName("AlternateRandom");
    await sourceGit(root, ["add", "."]);
    await sourceGit(root, ["commit", "-m", "Alternative research"]);
    t.is(readName(), "AlternateRandom");
    await sourceGit(root, ["switch", "main"]);
    t.is(readName(), "RandomByte");
    const before = fs.readFileSync(names, "utf8");
    const changed = JSON.parse(before);
    changed.decisions[0].value.analysisEntryPoint = true;
    fs.writeFileSync(names, JSON.stringify(changed));
    t.is(readName(), "RandomByte", "Raw observations and their selected names remain queryable");
    for (const operation of [
      "coverage",
      "coverageConflicts",
      "annotations",
      "debugAnnotations",
      "navigation",
    ] as const) {
      t.throws(() => request(directory, operation, { sourceRoot: root }), {
        message: /Analyze the selected inputs/,
      });
    }
    fs.writeFileSync(names, before);
    t.throws(() => request(directory, "annotationSave", { sourceRoot: root }), {
      message: /Unknown analysis worker operation/,
    });
    t.throws(() => request(directory, "evidenceChoices"), {
      message: /Select the Git source project/,
    });
    fs.writeFileSync(names, "{conflicted");
    t.throws(readName);
  },
);
