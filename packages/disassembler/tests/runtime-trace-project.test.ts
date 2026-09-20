import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  importRuntimeInstructionTrace,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  validateRuntimeInstructionTraceMetadata,
  loadAnalysisProject,
  loadAnalysisProjectViewSnapshot,
  mergeRuntimeEvidence,
  writeAnalysisProject,
  type AnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "../src/index.js";
import { RecordIdSet } from "../src/record-id-set.js";

const fixture = (): AnalysisProject => ({
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    imports: [],
    evidence: [],
    runtime: [
      {
        id: "existing",
        kind: "runtime-execution",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 1,
        count: 7,
        evidence: [],
      },
    ],
  },
});

test("in-memory chunks publish the same facts and roll back on a late producer failure", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-memory-source-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const artifact = trace(project);
  const directory = path.join(root, "analysis");
  writeAnalysisProject(directory, project);
  const before = loadAnalysisProject(directory);
  const context = {
    projectRomContentSha256: artifact.romContentSha256,
    sourceName: "live capture",
  };
  const source = {
    metadata: validateRuntimeInstructionTraceMetadata(artifact),
    read: async (accept: (chunk: unknown) => void) => {
      for (const chunk of artifact.chunks) {
        accept(chunk);
      }
    },
  };
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(
      {
        ...source,
        read: async (accept) => {
          await source.read(accept);
          throw new Error("Producer tail failed");
        },
      },
      directory,
      context,
    ),
    { message: "Producer tail failed" },
  );
  t.deepEqual(loadAnalysisProject(directory), before);
  const expected = importRuntimeInstructionTrace(artifact, context);
  const progress: [number, number][] = [];
  const stages: string[] = [];
  const actual = await importRuntimeTraceSourceIntoProject(source, directory, context, {
    onMergeProgress: (processed, total) => progress.push([processed, total]),
    onStage: (stage) => stages.push(stage),
  });
  const totalRecords = expected.batch.runtime!.length;
  t.deepEqual(progress[0], [0, totalRecords]);
  t.deepEqual(progress.at(-1), [totalRecords, totalRecords]);
  t.true(
    stages.indexOf("Committing runtime import transaction…") <
      stages.indexOf("Runtime import committed. Project pointer updated."),
  );
  t.deepEqual(actual.report, expected.report);
  const merged = mergeRuntimeEvidence(project.shards, expected.batch);
  const expectedDirectory = path.join(root, "expected");
  writeAnalysisProject(expectedDirectory, { ...project, shards: merged.shards });
  t.deepEqual(loadAnalysisProject(directory).shards, loadAnalysisProject(expectedDirectory).shards);
});

const trace = (project: AnalysisProject): RuntimeInstructionTraceArtifact => {
  const detail = {
    bytes: [0xea],
    state: { p: 0x30, e: 1, a: 9 },
    memoryAccesses: [
      {
        access: "write" as const,
        addressSpace: "snes.cpu",
        address: 0x2118,
        width: 1 as const,
        value: 2,
      },
    ],
  };
  return {
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: project.manifest.rom.contentSha256,
    producer: { id: "test", revision: "1" },
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x8000, 0x8000],
        details: [detail, detail],
        droppedEvents: 0,
        active: true,
      },
      {
        sequenceStart: 3,
        addresses: [0x8000],
        details: [{ ...detail, state: { ...detail.state, a: 10 } }],
        droppedEvents: 0,
        active: false,
      },
    ],
  };
};

for (const indexMode of ["full", "65816-disassembly"] as const) {
  test(`disk import preserves canonical ${indexMode} facts and repairs incomplete reimports`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = path.join(root, "analysis");
    const project = fixture();
    const artifact = trace(project);
    const file = path.join(root, "trace.json");
    fs.writeFileSync(file, JSON.stringify(artifact));
    writeAnalysisProject(directory, project);
    const context = {
      projectRomContentSha256: artifact.romContentSha256,
      sourceName: "trace.json",
      indexMode,
    };
    const expected = importRuntimeInstructionTrace(artifact, context);
    const merged = mergeRuntimeEvidence(project.shards, expected.batch);
    writeAnalysisProject(path.join(root, "expected"), {
      ...project,
      shards: merged.shards,
    });
    const result = await importRuntimeTraceIntoProject(file, directory, context);
    t.deepEqual(result.report, expected.report);
    t.deepEqual(result.added, { runtime: merged.added.runtime, evidence: merged.added.evidence });
    t.deepEqual(
      loadAnalysisProject(directory).shards,
      loadAnalysisProject(path.join(root, "expected")).shards,
    );
    const revision = loadAnalysisProjectViewSnapshot(directory).revision;
    t.false((await importRuntimeTraceIntoProject(file, directory, context)).changed);
    t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, revision);
    const reused = await importRuntimeTraceIntoProject(file, directory, {
      ...context,
      indexMode: indexMode === "full" ? "65816-disassembly" : "full",
    });
    t.false(reused.changed);
    t.true(reused.warnings.some((warning) => warning.includes("different profile")));
    t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, revision);
    // An import report alone must not suppress a missing fact, or hide a changed fact's content.
    const complete = loadAnalysisProject(directory);
    const shortened = {
      ...complete,
      shards: {
        ...complete.shards,
        runtime: complete.shards.runtime.filter((record) => record.kind !== "runtime-cpu-state"),
      },
    };
    writeAnalysisProject(directory, shortened);
    const repaired = await importRuntimeTraceIntoProject(file, directory, context);
    t.is(repaired.added.runtime, complete.shards.runtime.length - shortened.shards.runtime.length);
    t.deepEqual(loadAnalysisProject(directory).shards, complete.shards);
    writeAnalysisProject(directory, {
      ...complete,
      shards: {
        ...complete.shards,
        runtime: complete.shards.runtime.map((record) =>
          record.id === "existing" ? record : { ...record, count: record.count + 1 },
        ),
      },
    });
    const altered = loadAnalysisProjectViewSnapshot(directory).revision;
    await t.throwsAsync(importRuntimeTraceIntoProject(file, directory, context), {
      message: /changed content/,
    });
    t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, altered);
  });
}

test("disk import rejects invalid tails, budgets and cancellation without publication", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-failure-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  const project = fixture();
  writeAnalysisProject(directory, project);
  const file = path.join(root, "trace.json");
  const artifact = trace(project);
  const context = { projectRomContentSha256: artifact.romContentSha256, sourceName: "trace.json" };
  const revision = loadAnalysisProjectViewSnapshot(directory).revision;
  fs.writeFileSync(file, `${JSON.stringify(artifact)} invalid`);
  await t.throwsAsync(importRuntimeTraceIntoProject(file, directory, context));
  t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, revision);
  fs.writeFileSync(file, JSON.stringify(artifact));
  await t.throwsAsync(
    importRuntimeTraceIntoProject(file, directory, { ...context, maxIndexRecords: 1 }),
    { message: /index exceeds/ },
  );
  await t.throwsAsync(importRuntimeTraceIntoProject(file, directory, context, { maxBytes: 1 }), {
    message: /maxImportSizeMiB/,
  });
  // Abort after each expensive phase has begun, including after the write transaction begins.
  for (const phase of ["Indexing", "Finalizing", "Validating"]) {
    const controller = new AbortController();
    await t.throwsAsync(
      importRuntimeTraceIntoProject(file, directory, context, {
        signal: controller.signal,
        onStage: (message) => {
          if (message.startsWith(phase)) {
            controller.abort();
          }
        },
      }),
      { name: "AbortError" },
    );
    t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, revision);
  }
  t.true((await importRuntimeTraceIntoProject(file, directory, context)).changed);
});

test("disk import refuses to overwrite a project edited after runtime merging", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-stale-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  const project = fixture();
  writeAnalysisProject(directory, project);
  const artifact = trace(project);
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  const concurrent = {
    ...project,
    shards: {
      ...project.shards,
      labels: [
        {
          id: "concurrent",
          name: "Concurrent",
          addressSpace: "snes.cpu",
          address: 1,
          evidence: [],
        },
      ],
    },
  };
  await t.throwsAsync(
    importRuntimeTraceIntoProject(
      file,
      directory,
      {
        projectRomContentSha256: artifact.romContentSha256,
        sourceName: "trace.json",
      },
      {
        onStage: (message) => {
          if (message.startsWith("Validating")) {
            writeAnalysisProject(directory, concurrent);
          }
        },
      },
    ),
    { name: "AnalysisProjectStaleError" },
  );
  t.deepEqual(loadAnalysisProject(directory).shards, concurrent.shards);
});

test("record ID validation preserves exact duplicate detection after spilling to disk", (t) => {
  const ids = new RecordIdSet();
  t.teardown(() => ids.close());
  t.true(ids.add("first"));
  for (let index = 0; index < 3000; index++) {
    t.true(ids.add(`${index}:${"x".repeat(2048)}`));
  }
  t.false(ids.add("first"));
  t.false(ids.add(`2999:${"x".repeat(2048)}`));
  t.true(ids.add("after"));
  t.false(ids.add("after"));
});

test("SQLite import rolls back emitted facts when final provenance publication fails", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-import-atomic-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(trace(project)));
  writeAnalysisProject(root, project);
  const before = loadAnalysisProject(root);
  const database = new DatabaseSync(path.join(root, "analysis.sqlite"));
  database.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON imports
    BEGIN SELECT RAISE(ROLLBACK, 'import publication failed'); END`);
  try {
    await t.throwsAsync(
      importRuntimeTraceIntoProject(file, root, {
        projectRomContentSha256: project.manifest.rom.contentSha256,
        sourceName: "trace.json",
      }),
      { message: "import publication failed" },
    );
    t.deepEqual(loadAnalysisProject(root), before);
    database.exec("DROP TRIGGER fail_import");
    // Imports must not even attempt a metadata rewrite outside provenance tables.
    database.exec(`CREATE TRIGGER keep_annotations BEFORE INSERT ON annotations
      BEGIN SELECT RAISE(ABORT, 'unexpected annotation rewrite'); END`);
    t.true(
      (
        await importRuntimeTraceIntoProject(file, root, {
          projectRomContentSha256: project.manifest.rom.contentSha256,
          sourceName: "trace.json",
        })
      ).changed,
    );
  } finally {
    database.close();
  }
});

test("SQLite import validates the actual destination ROM before publishing any facts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-import-rom-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const artifact = trace(project);
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  writeAnalysisProject(root, {
    ...project,
    manifest: { ...project.manifest, rom: new RomImage(new Uint8Array(0x8000).fill(1)).identity },
  });
  const before = loadAnalysisProject(root);
  await t.throwsAsync(
    importRuntimeTraceIntoProject(file, root, {
      projectRomContentSha256: artifact.romContentSha256,
      sourceName: "trace.json",
    }),
    { message: /ROM\/project mismatch/ },
  );
  t.deepEqual(loadAnalysisProject(root), before);
});
