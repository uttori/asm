import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  importRuntimeInstructionTrace,
  publishAnalysisProject,
  openAnalysisProjectStore,
  loadAnalysisProject,
  type RuntimeInstructionTraceArtifact,
  type RuntimeEvidenceRecord,
} from "../../src/index.js";
import { reconcileSourceCaptureCatalog } from "../../src/source-project/captures.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

/** Same instruction with different arithmetic flags/registers and one distinct decoder width. */
function fixture() {
  const rom = new RomImage(new Uint8Array(0x8000));
  const trace: RuntimeInstructionTraceArtifact = {
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: rom.identity.contentSha256,
    producer: { id: "test", revision: "retention" },
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x808000, 0x808000, 0x808000],
        active: false,
        droppedEvents: 0,
        details: [
          {
            bytes: [0xea],
            state: { p: 0x30, e: 0, a: 1 },
            memoryAccesses: [
              { addressSpace: "snes.cpu", address: 0x7e0010, value: 42, width: 1, access: "write" },
            ],
          },
          { bytes: [0xea], state: { p: 0x31, e: 0, a: 2 } },
          { bytes: [0xea], state: { p: 0x20, e: 0, a: 3 } },
        ],
      },
    ],
  };
  const context = {
    sourceName: "removed.act2",
    projectRomContentSha256: rom.identity.contentSha256,
  };
  return { rom, trace, context };
}

test("compact imports retain decoder pairs, memory and exact totals while hashing every input register", (t) => {
  const { trace, context } = fixture();
  const full = importRuntimeInstructionTrace(trace, context);
  const compact = importRuntimeInstructionTrace(trace, { ...context, indexMode: "analysis" });
  t.is(full.sourceSha256, compact.sourceSha256);
  const changed = structuredClone(trace);
  Object.assign(changed.chunks[0].details![0].state, { a: 99 });
  t.not(
    compact.sourceSha256,
    importRuntimeInstructionTrace(changed, { ...context, indexMode: "analysis" }).sourceSha256,
  );
  t.is(compact.report.indexProfile, "65816-analysis-v3");
  const instructions = compact.batch.runtime!.filter((r) => r.kind === "runtime-instruction");
  t.is(instructions.length, 2);
  t.is(
    instructions.reduce((n, r) => n + r.count, 0),
    3,
  );
  t.true(instructions.every((r) => !("a" in r.state)));
  t.deepEqual(
    compact.batch.runtime!.filter((r) => r.kind === "runtime-memory-access"),
    full.batch.runtime!.filter((r) => r.kind === "runtime-memory-access"),
  );
});

test("retention migrates without archives, preserves metadata, rolls back table swaps and remains idempotent", (t) => {
  const { rom, trace, context } = fixture();
  const full = importRuntimeInstructionTrace(trace, context);
  const compact = importRuntimeInstructionTrace(trace, { ...context, indexMode: "analysis" });
  const root = `runtime:instruction-trace:${"b".repeat(64)}`;
  const suffix = "c".repeat(64);
  const base = {
    architecture: "snes.spc700",
    addressSpace: "snes.cpu",
    address: 0x2000,
    state: { a: 1 },
    count: 7,
    evidence: [full.batch.evidence![0].id],
  };
  const untouched: RuntimeEvidenceRecord[] = [
    { ...base, id: `${root}:code:${suffix}`, kind: "runtime-instruction", bytes: [0xea] },
    { ...base, id: `${root}:state:${suffix}`, kind: "runtime-cpu-state" },
  ];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-retention-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      labels: [],
      comments: [],
      annotations: [],
      regions: [],
      analysis: [],
      evidence: full.batch.evidence!,
      imports: full.batch.imports!,
      runtime: [...full.batch.runtime!, ...untouched],
    },
  });
  const before = loadAnalysisProject(directory);
  const store = openAnalysisProjectStore(directory);
  try {
    store.prepareAnnotationQueries();
    store.prepareSourceQueries();
    t.throws(
      () =>
        store.retainSnesAnalysisEvidence((message) => {
          if (message.startsWith("Validated compact runtime tables")) {
            throw new Error("abort retention");
          }
        }),
      { message: "abort retention" },
    );
    t.deepEqual(loadAnalysisProject(directory), before);
    store.retainSnesAnalysisEvidence();
    store.writePointer(directory);
    const after = loadAnalysisProject(directory);
    const sorted = [...compact.batch.runtime!, ...untouched].toSorted((a, b) =>
      a.id.localeCompare(b.id),
    );
    t.deepEqual(after.shards.runtime, sorted);
    t.deepEqual(after.shards.evidence, before.shards.evidence);
    t.is(String(store.captureReceipt(full.sourceSha256)?.profile), "65816-analysis-v3");
    store.prepareAnnotationQueries();
    store.prepareSourceQueries();
    const database = new DatabaseSync(store.file);
    try {
      t.is(
        Number(
          database
            .prepare(
              "SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='trigger' AND name IN ('query_instruction_insert','query_instruction_update','query_execution_update')",
            )
            .get()!.n,
        ),
        3,
      );
    } finally {
      database.close();
    }
    store.retainSnesAnalysisEvidence();
    t.deepEqual(loadAnalysisProject(directory).shards.runtime, sorted);
    store.transaction(() => {
      for (const record of compact.batch.runtime!) {
        t.false(store.insertRuntime(record));
      }
    });
    const prior = {
      format: "uttori-capture-catalog" as const,
      version: 1 as const,
      romSha256: rom.identity.contentSha256,
      captures: [
        {
          sha256: full.sourceSha256,
          sourceName: context.sourceName,
          profile: "full",
          observedEvents: 3,
          droppedEvents: 0,
          archives: [],
        },
      ],
    };
    t.is(
      reconcileSourceCaptureCatalog(prior, after.shards.imports).captures[0].profile,
      "65816-analysis-v3",
    );
  } finally {
    store.close();
  }
});
