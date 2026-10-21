import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  importRuntimeInstructionTrace,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  validateRuntimeInstructionTraceMetadata,
  loadAnalysisProject,
  loadAnalysisProjectViewSnapshot,
  openAnalysisProjectStore,
  mergeRuntimeEvidence,
  publishAnalysisProject,
  analysisProjectRevision,
  type AnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "../../src/index.js";
import { RecordIdSet } from "../../src/internal/record-id-set.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

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
  publishAnalysisProject(directory, project);
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
  publishAnalysisProject(expectedDirectory, { ...project, shards: merged.shards });
  t.deepEqual(loadAnalysisProject(directory).shards, loadAnalysisProject(expectedDirectory).shards);
});

const instructionTraceSource = (value: RuntimeInstructionTraceArtifact) => ({
  metadata: validateRuntimeInstructionTraceMetadata(value),
  read: async (accept: (chunk: unknown) => void) => value.chunks.forEach(accept),
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

test("validated disk counters survive failed publication and retry without reading the archive", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-validated-retry-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(directory, project);
  const before = loadAnalysisProject(directory);
  const artifact = trace(project);
  const context = { projectRomContentSha256: artifact.romContentSha256, sourceName: "retry.act2" };
  let reads = 0;
  let companionChecks = 0;
  let companionChanged = true;
  let fingerprints = 0;
  const source = {
    ...instructionTraceSource(artifact),
    read: async (accept: (chunk: unknown) => void) => {
      reads++;
      artifact.chunks.forEach(accept);
    },
    verifyRetained: async () => {
      companionChecks++;
      if (companionChanged) {
        throw new Error("Companion changed");
      }
    },
  };
  const validatedIndex = {
    directory: path.join(directory, "validated-traces"),
    identity: "archive-and-importer-1",
    verify: async () => {
      fingerprints++;
    },
  };
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(source, directory, context, {
      validatedIndex,
      onMergeProgress: (processed) => {
        if (processed > 0) {
          throw new Error("Publication interrupted");
        }
      },
    }),
    { message: "Publication interrupted" },
  );
  t.deepEqual(loadAnalysisProject(directory), before);
  t.is(
    fs
      .readdirSync(path.join(directory, "validated-traces"))
      .filter((name) => name.endsWith(".sqlite")).length,
    1,
  );
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(source, directory, context, { validatedIndex }),
    {
      message: "Companion changed",
    },
  );
  t.deepEqual(loadAnalysisProject(directory), before);
  companionChanged = false;
  const stages: string[] = [];
  const retried = await importRuntimeTraceSourceIntoProject(source, directory, context, {
    validatedIndex,
    onStage: (message) => stages.push(message),
  });
  t.is(reads, 1);
  t.is(companionChecks, 2);
  t.is(fingerprints, 3);
  t.true(stages.some((message) => message.startsWith("Reusing validated trace index")));
  const expected = importRuntimeInstructionTrace(artifact, context);
  t.deepEqual(retried.report, expected.report);
  t.deepEqual(retried.added.runtime, expected.batch.runtime!.length);
  t.deepEqual(
    loadAnalysisProject(directory)
      .shards.runtime.filter((record) => record.id !== "existing")
      .map((record) => ({ id: record.id, count: "count" in record ? record.count : undefined })),
    expected.batch
      .runtime!.toSorted((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({ id: record.id, count: "count" in record ? record.count : undefined })),
  );
  t.deepEqual(fs.readdirSync(path.join(directory, "validated-traces")), []);
});

test("an unverified fingerprint never seals a retry cache, and changed identities reindex", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-validated-identity-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(directory, project);
  const artifact = trace(project);
  const context = {
    projectRomContentSha256: artifact.romContentSha256,
    sourceName: "identity.act2",
  };
  let reads = 0;
  const source = {
    ...instructionTraceSource(artifact),
    read: async (accept: (chunk: unknown) => void) => {
      reads++;
      artifact.chunks.forEach(accept);
    },
  };
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(source, directory, context, {
      validatedIndex: {
        directory: path.join(directory, "validated-traces"),
        identity: "first",
        verify: async () => {
          throw new Error("Archive changed");
        },
      },
    }),
    { message: "Archive changed" },
  );
  for (const identity of ["first", "changed-archive-or-importer"]) {
    await t.throwsAsync(
      importRuntimeTraceSourceIntoProject(source, directory, context, {
        validatedIndex: {
          directory: path.join(directory, "validated-traces"),
          identity,
          verify: async () => {},
        },
        onStage: (message) => {
          if (message.startsWith("Validating destination revision")) {
            throw new Error("Stop before publication");
          }
        },
      }),
      { message: "Stop before publication" },
    );
  }
  t.is(reads, 3);
  t.deepEqual(loadAnalysisProject(directory).shards, project.shards);
});

test("disk import preserves canonical full facts and repairs incomplete reimports", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  const project = fixture();
  const artifact = trace(project);
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  publishAnalysisProject(directory, project);
  const context = {
    projectRomContentSha256: artifact.romContentSha256,
    sourceName: "trace.json",
    indexMode: "full" as const,
  };
  const expected = importRuntimeInstructionTrace(artifact, context);
  const merged = mergeRuntimeEvidence(project.shards, expected.batch);
  publishAnalysisProject(path.join(root, "expected"), {
    ...project,
    shards: merged.shards,
  });
  // SQLite accepts explicit budgets beyond the old Map ceiling without projecting away
  // full register variants. Compare every stored fact against the small in-memory fixture.
  const result = await importRuntimeTraceIntoProject(file, directory, {
    ...context,
    maxIndexRecords: 8_000_001,
  });
  t.deepEqual(result.report, expected.report);
  t.deepEqual(result.added, { runtime: merged.added.runtime, evidence: merged.added.evidence });
  t.deepEqual(
    loadAnalysisProject(directory).shards,
    loadAnalysisProject(path.join(root, "expected")).shards,
  );
  const revision = loadAnalysisProjectViewSnapshot(directory).revision;
  t.false((await importRuntimeTraceIntoProject(file, directory, context)).changed);
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
  publishAnalysisProject(directory, shortened, analysisProjectRevision(complete.manifest));
  const repaired = await importRuntimeTraceIntoProject(file, directory, context);
  t.is(repaired.added.runtime, complete.shards.runtime.length - shortened.shards.runtime.length);
  t.deepEqual(loadAnalysisProject(directory).shards, complete.shards);
  const repairedRevision = loadAnalysisProjectViewSnapshot(directory).revision;
  publishAnalysisProject(
    directory,
    {
      ...complete,
      shards: {
        ...complete.shards,
        runtime: complete.shards.runtime.map((record) =>
          record.id === "existing"
            ? record
            : Object.assign({}, record, { count: record.count + 1 }),
        ),
      },
    },
    repairedRevision,
  );
  const altered = loadAnalysisProjectViewSnapshot(directory).revision;
  await t.throwsAsync(importRuntimeTraceIntoProject(file, directory, context), {
    message: /changed content/,
  });
  t.deepEqual(loadAnalysisProjectViewSnapshot(directory).revision, altered);
});

test("historical capture receipts remain readable and reimports preserve retained Secret of Mana facts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-retained-trace-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const artifact = trace(project);
  const context = {
    projectRomContentSha256: artifact.romContentSha256,
    sourceName: "retained.json",
  };
  const imported = importRuntimeInstructionTrace(artifact, context);
  const merged = mergeRuntimeEvidence(project.shards, imported.batch);
  // Existing databases own their historical receipt metadata. Reading it needs no projection
  // implementation, and a reimport must not pretend previously omitted fields were restored.
  const report = {
    ...imported.report,
    id: `${imported.report.id}:retained`,
    indexProfile: "retained-index",
  };
  const retained = { ...project, shards: { ...merged.shards, imports: [report] } };
  const directory = path.join(root, "analysis");
  publishAnalysisProject(directory, retained);
  const store = openAnalysisProjectStore(directory);
  try {
    store.transaction(() => store.recordCaptureReceipt(report));
  } finally {
    store.close();
  }
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  const before = loadAnalysisProject(directory);
  const result = await importRuntimeTraceIntoProject(file, directory, context);
  t.false(result.changed);
  t.deepEqual(result.report, report);
  t.true(result.warnings.some((warning) => warning.includes("did not restore omitted registers")));
  t.deepEqual(loadAnalysisProject(directory), before);
});

test("bulk trace publication crosses batches losslessly, shares facts and rolls back flushed rows", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bulk-trace-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const directory = path.join(root, "analysis");
  publishAnalysisProject(directory, project);
  const addresses = Array.from({ length: 1500 }, (_, index) => 0xc0800a + index);
  const details = addresses.map((_, index) => ({
    bytes: [0xea],
    // Half use an extra register so bulk publication also exercises the general payload codec.
    state:
      index % 2 === 0 ? { p: 0x31, e: 0, a: index } : { p: 0x31, e: 0, a: index, extra: index },
    memoryAccesses: [
      { access: "write" as const, addressSpace: "snes.cpu", address: 0x2118, width: 1, value: 0 },
    ],
  }));
  const artifact: RuntimeInstructionTraceArtifact = {
    ...trace(project),
    chunks: [{ sequenceStart: 1, addresses, details, droppedEvents: 0, active: false }],
  };
  const context = {
    sourceName: "bulk-fixture",
    projectRomContentSha256: artifact.romContentSha256,
    indexMode: "full" as const,
  };
  // Several complete SQL batches have flushed by this phase; none may survive a late failure.
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(instructionTraceSource(artifact), directory, context, {
      onStage: (stage) => {
        if (stage === "Validating merged runtime provenance…") {
          throw new Error("Stop after flush");
        }
      },
    }),
    { message: "Stop after flush" },
  );
  t.deepEqual(loadAnalysisProject(directory).shards, project.shards);
  const expected = importRuntimeInstructionTrace(artifact, context);
  const actual = await importRuntimeTraceSourceIntoProject(
    instructionTraceSource(artifact),
    directory,
    context,
  );
  const merged = mergeRuntimeEvidence(project.shards, expected.batch);
  publishAnalysisProject(path.join(root, "expected"), { ...project, shards: merged.shards });
  t.deepEqual(
    loadAnalysisProject(directory).shards,
    loadAnalysisProject(path.join(root, "expected")).shards,
  );
  t.is(actual.added.runtime, 6000);
  const second = { ...artifact, producer: { ...artifact.producer, revision: "2" } };
  const reused = await importRuntimeTraceSourceIntoProject(
    instructionTraceSource(second),
    directory,
    context,
  );
  t.is(reused.storage.newFacts, 0);
  t.is(reused.added.runtime, actual.added.runtime);
  t.false(
    (await importRuntimeTraceSourceIntoProject(instructionTraceSource(second), directory, context))
      .changed,
  );
});

test("trace publication rejects inconsistent pairs, duplicate IDs and escaped source provenance", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bulk-trace-invalid-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(root, project);
  const sha256 = "1".repeat(64);
  const evidence = [`runtime:instruction-trace:${sha256}`];
  const instruction = {
    id: `${evidence[0]}:code:${"2".repeat(64)}`,
    kind: "runtime-instruction" as const,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0xc0800a,
    count: 1,
    evidence,
    bytes: [0xea],
    state: { p: 0x31, e: 0, a: 42 },
  };
  const state = {
    ...instruction,
    id: instruction.id.replace(":code:", ":state:"),
    kind: "runtime-cpu-state" as const,
  };
  const store = openAnalysisProjectStore(root);
  try {
    for (const invalid of [
      { ...state, count: 2 },
      { ...state, state: { ...state.state, a: 43 } },
    ]) {
      t.throws(
        () =>
          store.transaction(() => {
            const sink = store.runtimeTracePublicationSink(sha256);
            sink.add(instruction);
            sink.add(invalid);
            sink.finish();
          }),
        { message: /inconsistent code\/state pair/ },
      );
    }
    t.throws(
      () =>
        store.transaction(() => {
          const sink = store.runtimeTracePublicationSink(sha256);
          sink.add(instruction);
          sink.finish();
        }),
      { message: /without its paired state/ },
    );
    t.throws(
      () =>
        store.transaction(() => {
          const sink = store.runtimeTracePublicationSink(sha256);
          sink.add({ ...instruction, evidence: [] });
        }),
      { message: /escaped/ },
    );
    t.throws(
      () =>
        store.transaction(() => {
          const sink = store.runtimeTracePublicationSink(sha256);
          sink.add(instruction);
          sink.add(state);
          sink.add(instruction);
          sink.add(state);
          sink.finish();
        }),
      { message: /UNIQUE/ },
    );
    t.deepEqual(loadAnalysisProject(root).shards, project.shards);
  } finally {
    store.close();
  }
});

test("disk import rejects invalid tails, budgets and cancellation without publication", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-failure-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  const project = fixture();
  publishAnalysisProject(directory, project);
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
  for (const phase of ["Decoding", "Finalizing", "Validating"]) {
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

test("disk import rejects invalid record budgets before reading the capture body", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-import-preflight-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(root, project);
  const before = loadAnalysisProject(root);
  const source = {
    metadata: validateRuntimeInstructionTraceMetadata(trace(project)),
    read: async () => {
      t.fail("An invalid record budget must fail before capture decoding");
    },
  };
  for (const maxIndexRecords of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await t.throwsAsync(
      importRuntimeTraceSourceIntoProject(source, root, {
        projectRomContentSha256: project.manifest.rom.contentSha256,
        sourceName: "invalid-budget.act2",
        maxIndexRecords,
      }),
      { message: /safe integer/ },
    );
    t.deepEqual(loadAnalysisProject(root), before);
  }
});

test("disk import refuses to overwrite a project edited after runtime merging", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disk-import-stale-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  const project = fixture();
  publishAnalysisProject(directory, project);
  const artifact = trace(project);
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  const concurrentRevision = loadAnalysisProjectViewSnapshot(directory).revision;
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
            publishAnalysisProject(directory, concurrent, concurrentRevision);
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
  publishAnalysisProject(root, project);
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
  publishAnalysisProject(root, {
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

test("NES disk imports retain distinct banks at one CPU PC and match the memory importer", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-banks-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = fixture();
  const project: AnalysisProject = {
    ...original,
    manifest: {
      ...original.manifest,
      target: "65xx.nes",
      addressSpaces: [{ id: "nes.cpu", name: "CPU", addressBits: 16, kind: "cpu" }],
    },
    shards: { ...original.shards, runtime: [] },
  };
  publishAnalysisProject(directory, project);
  const artifact: RuntimeInstructionTraceArtifact = {
    ...trace(project),
    architecture: "65xx.2a03",
    romFileSha256: project.manifest.rom.sha256,
    addressSpace: "nes.cpu",
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x8000, 0x8000, 0x8000],
        active: false,
        droppedEvents: 0,
        details: [0, 1, 0].map((bank) => ({
          bytes: [0xea],
          state: { mapper: 4, prgMode: 0, r6: bank, r7: 0, prg0: bank * 8192 },
        })),
      },
    ],
  };
  const context = { projectRomContentSha256: artifact.romContentSha256, sourceName: "NES banks" };
  const expected = importRuntimeInstructionTrace(artifact, context);
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(
      instructionTraceSource({ ...artifact, romFileSha256: "f".repeat(64) }),
      directory,
      context,
    ),
    { message: /full-file identity/ },
  );
  t.is(loadAnalysisProject(directory).shards.runtime.length, 0);
  await importRuntimeTraceSourceIntoProject(instructionTraceSource(artifact), directory, context);
  const actual = loadAnalysisProject(directory).shards.runtime;
  const executions = actual.filter((record) => record.kind === "runtime-execution");
  t.is(executions.length, 2);
  t.deepEqual(executions.map((record) => record.count).toSorted(), [1, 2]);
  t.is(new Set(executions.map((record) => record.id)).size, 2);
  t.deepEqual(
    actual.toSorted((a, b) => a.id.localeCompare(b.id)),
    expected.batch.runtime!.toSorted((a, b) => a.id.localeCompare(b.id)),
  );
  // Reimport uses the collision-checking path, independently of the optimized initial batch.
  await importRuntimeTraceSourceIntoProject(instructionTraceSource(artifact), directory, context);
  t.deepEqual(loadAnalysisProject(directory).shards.runtime, actual);
});

test("explicit ACT2 recovery publishes only checkpointed prefixes and retains incomplete provenance", async (t) => {
  const { writeCaptureFixture } = await import("../../../../tests/helpers/capture-archive.js");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-prefix-import-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture();
  const directory = path.join(root, "analysis");
  const file = path.join(root, "recording.act2.partial");
  const complete = path.join(root, "complete.act2");
  publishAnalysisProject(directory, project);
  await writeCaptureFixture(file, 3, 1, project.manifest.rom.contentSha256);
  const bytes = fs.readFileSync(file);
  // The third decoded chunk has no durable ACK. Recovery must discard it along with the tail.
  fs.writeFileSync(file, bytes.subarray(0, bytes.lastIndexOf(Buffer.from("ACK2"))));
  const context = {
    projectRomContentSha256: project.manifest.rom.contentSha256,
    sourceName: "recording.act2.partial",
  };
  const before = loadAnalysisProject(directory);
  await t.throwsAsync(importRuntimeTraceIntoProject(file, directory, context), {
    message: /incomplete/,
  });
  t.deepEqual(loadAnalysisProject(directory), before);
  const result = await importRuntimeTraceIntoProject(file, directory, context, {
    recoverPartial: true,
  });
  t.is(result.observedEvents, 2);
  t.is(result.report.imported.recoveredChunks, 2);
  t.is(result.report.imported.recoveredEvents, 2);
  t.true(result.report.warnings.some((warning) => warning.includes("unrecorded tail")));
  t.true(result.warnings.some((warning) => warning.includes("incomplete ACT2")));
  const retried = await importRuntimeTraceIntoProject(file, directory, context, {
    recoverPartial: true,
  });
  t.false(retried.changed);
  t.is(retried.sourceSha256, result.sourceSha256);
  await writeCaptureFixture(complete, 2, 1, project.manifest.rom.contentSha256);
  const full = await importRuntimeTraceIntoProject(complete, directory, context);
  const completeRetry = await importRuntimeTraceIntoProject(complete, directory, context, {
    recoverPartial: true,
  });
  t.is(completeRetry.sourceSha256, full.sourceSha256);
  t.false(completeRetry.changed);
  const partialBytes = fs.readFileSync(file);
  const beforeDrift = loadAnalysisProject(directory);
  let mutated = false;
  await t.throwsAsync(
    importRuntimeTraceIntoProject(file, directory, context, {
      recoverPartial: true,
      onProgress: () => {
        if (!mutated) {
          fs.appendFileSync(file, "x");
          mutated = true;
        }
      },
    }),
    { message: /changed while importing/ },
  );
  t.deepEqual(loadAnalysisProject(directory), beforeDrift);
  fs.writeFileSync(file, partialBytes);
  const cancellation = new AbortController();
  await t.throwsAsync(
    importRuntimeTraceIntoProject(file, directory, context, {
      recoverPartial: true,
      signal: cancellation.signal,
      onProgress: () => cancellation.abort(),
    }),
    { name: "AbortError" },
  );
  t.deepEqual(loadAnalysisProject(directory), beforeDrift);
  t.not(
    full.sourceSha256,
    result.sourceSha256,
    "recovery does not claim terminally verified identity",
  );
  // An acknowledged prefix does not turn a checksummed/structural corruption into EOF recovery.
  const prefix = fs
    .readFileSync(file)
    .subarray(0, fs.readFileSync(file).lastIndexOf(Buffer.from("ACT2")));
  fs.writeFileSync(file, Buffer.concat([prefix, Buffer.from("BAD2"), Buffer.alloc(8)]));
  const snapshot = loadAnalysisProject(directory);
  await t.throwsAsync(
    importRuntimeTraceIntoProject(file, directory, context, { recoverPartial: true }),
    { message: /incomplete/ },
  );
  t.deepEqual(loadAnalysisProject(directory), snapshot);
});

test("compact source imports preserve exact facts and counts while omitting global storage accounting", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-compact-import-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = fixture(),
    artifact = trace(project);
  const full = path.join(root, "full"),
    compact = path.join(root, "compact");
  publishAnalysisProject(full, project);
  publishAnalysisProject(compact, project);
  const context = { projectRomContentSha256: artifact.romContentSha256, sourceName: "trace" };
  const baseline = await importRuntimeTraceSourceIntoProject(
    instructionTraceSource(artifact),
    full,
    context,
  );
  const result = await importRuntimeTraceSourceIntoProject(
    instructionTraceSource(artifact),
    compact,
    context,
    { storageStatistics: false },
  );
  t.false("storage" in result);
  t.is(result.sourceSha256, baseline.sourceSha256);
  t.deepEqual(result.added, baseline.added);
  t.deepEqual(result.report, baseline.report);
  t.deepEqual(loadAnalysisProject(compact).shards, loadAnalysisProject(full).shards);
  const retried = await importRuntimeTraceSourceIntoProject(
    instructionTraceSource(artifact),
    compact,
    context,
    { storageStatistics: false },
  );
  t.false(retried.changed);
});
