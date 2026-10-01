import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { constants } from "node:sqlite";

import { test } from "../../../../tests/ava-helper.js";
import {
  buildAnalysisSourceCatalog,
  openAnalysisProjectStore,
  publishAnalysisProject,
  RomImage,
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  type AnalysisProject,
  type RuntimeExecutionRecord,
  type RuntimeInstructionRecord,
} from "../../src/index.js";
import { readSourcePage, readSourceSummary } from "../../src/storage/sqlite-source-query.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

const fixture = (): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [
      { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      { id: "ram", name: "RAM", kind: "ram", addressBits: 16 },
      { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
    ],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: ["a", "b", "c"].map((id) => ({
      id,
      source: "runtime",
      sourceId: "same-emulator",
      confidence: "certain",
      artifact: {
        format: "trace",
        sha256: id.repeat(64),
        romContentSha256: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity
          .contentSha256,
      },
    })),
    imports: ["a", "b", "c"].map((id) => ({
      id: `import:${id}`,
      format: "trace",
      sourceName: id === "a" ? "chest.json" : "idle.json",
      sourceSha256: id.repeat(64),
      imported: { instructions: 1 },
      warnings: id === "a" ? ["12 instruction events dropped"] : [],
      unsupported: [],
    })),
  },
});
const execution = (
  source: string,
  address: number,
  size?: number,
  addressSpace = "cpu",
  architecture = "fixture",
): RuntimeExecutionRecord => ({
  id: `${source}:${addressSpace}:${architecture}:${address}`,
  kind: "runtime-execution",
  architecture,
  addressSpace,
  address,
  count: 100,
  evidence: [source],
  ...(size ? { size } : {}),
});
const instruction = (
  source: string,
  address: number,
  bytes: number[],
  state = {},
): RuntimeInstructionRecord => ({
  id: `detail:${source}:${address}:${JSON.stringify(state)}`,
  kind: "runtime-instruction",
  architecture: "fixture",
  addressSpace: "cpu",
  address,
  bytes,
  state,
  count: 20,
  evidence: [source],
});
test("source identity uses artifact hashes, supports legacy imports, and preserves empty imports", (t) => {
  const { shards } = fixture();
  const imports = [
    ...shards.imports,
    {
      id: "legacy",
      format: "diz",
      sourceName: "game.diz",
      sourceSha256: "d".repeat(64),
      imported: {},
      warnings: [],
      unsupported: [],
    },
    {
      id: "empty",
      format: "trace",
      sourceName: "empty.json",
      sourceSha256: "e".repeat(64),
      imported: {},
      warnings: [],
      unsupported: [],
    },
  ];
  const evidence = [
    ...shards.evidence,
    {
      id: "legacy",
      source: "import" as const,
      sourceId: "d".repeat(64),
      confidence: "certain" as const,
    },
    { id: "manual", source: "manual" as const, sourceId: "editor", confidence: "certain" as const },
  ];
  const catalog = buildAnalysisSourceCatalog({ imports, evidence });
  t.is(catalog.length, 6);
  t.is(
    catalog.filter((source) => source.name === "idle.json").length,
    2,
    "same filename and producer do not merge different captures",
  );
  t.deepEqual(catalog.find((source) => source.name === "game.diz")?.evidenceIds, ["legacy"]);
  t.deepEqual(catalog.find((source) => source.name === "empty.json")?.evidenceIds, []);
  t.deepEqual(
    buildAnalysisSourceCatalog({ imports: imports.toReversed(), evidence: evidence.toReversed() }),
    catalog,
  );
});

test("SQL source counts deduplicate instruction variants, keep qualified identities, and page before decoding", (t) => {
  const project = fixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-sources-"));
  const records = Array.from({ length: 450 }, (_, address) => execution("a", address));
  publishAnalysisProject(directory, {
    ...project,
    shards: {
      ...project.shards,
      runtime: [
        ...records,
        instruction("a", 0, [0xea]),
        execution("a", 0, 1, "ram"),
        execution("b", 999),
        {
          id: "state",
          kind: "runtime-cpu-state",
          architecture: "fixture",
          addressSpace: "cpu",
          address: 0,
          count: 1,
          state: {},
          evidence: ["a"],
        },
      ],
      comments: [
        {
          id: "comment",
          addressSpace: "cpu",
          address: 0,
          text: "Attributed",
          evidence: ["a", "b"],
        },
      ],
    },
  });
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const sql = new DatabaseSync(store.file);
  try {
    sql.exec(
      "UPDATE runtime SET payload='malformed unrelated state' WHERE kind='runtime-cpu-state'",
    );
  } finally {
    sql.close();
  }
  store.prepareSourceQueries();
  store.prepareAnnotationQueries();
  const catalog = store.sourceCatalog();
  const a = catalog.sources.find((source) => source.evidenceIds.includes("a"))!.id;
  const b = catalog.sources.find((source) => source.evidenceIds.includes("b"))!.id;
  const summary = store.transaction(() => store.sourceSummary(a).summary, false);
  t.is(summary.instructionCount, 451);
  t.is(
    summary.contributionCount,
    1,
    "multiple matching evidence links never double count one record",
  );
  t.is(store.sourceSummary(b).summary.instructionCount, 1);
  t.is(store.sourcePage(a, "instructions").length, 200);
  t.is(store.sourcePage(a, "instructions", 400).length, 51);
  t.is(store.sourcePage(a, "instructions", 200)[0].address, 200);
  t.is(store.sourcePage(a, "contributions")[0].label, "Attributed");
  const physical = new DatabaseSync(store.file, { readOnly: true });
  try {
    // This catches the old global execution self-join without relying on machine-specific timing.
    // Counts and instruction pages must use physical observations, never the virtual CPU-state union.
    physical.setAuthorizer((action, table, _column, _database, view) =>
      action === constants.SQLITE_READ && (table === "runtime" || view === "runtime")
        ? constants.SQLITE_DENY
        : constants.SQLITE_OK,
    );
    const source = catalog.sources.find((candidate) => candidate.id === a)!;
    t.deepEqual(readSourceSummary(physical, source), summary);
    t.deepEqual(
      readSourcePage(physical, source, "instructions"),
      store.sourcePage(a, "instructions"),
    );
  } finally {
    physical.close();
  }
  t.throws(() => store.sourcePage(a, "instructions", -1), { message: /offset/ });
  t.throws(() => store.sourceSummary("unknown"), { message: /Unknown analysis source/ });
  store.transaction(() =>
    store.replaceTables({
      comments: [
        { id: "comment", addressSpace: "cpu", address: 0, text: "Moved", evidence: ["b"] },
      ],
    }),
  );
  store.prepareSourceQueries();
  t.is(store.sourceSummary(a).summary.contributionCount, 0);
  t.is(store.sourcePage(b, "contributions")[0].label, "Moved");
  store.compact();
  t.is(store.sourceSummary(b).summary.contributionCount, 1, "stable record IDs survive VACUUM");
});

test("source catalog orders durable import receipts newest first across reimports and compaction", (t) => {
  const project = fixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-recency-"));
  publishAnalysisProject(directory, project);
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  store.transaction(() => {
    for (const report of project.shards.imports.slice(0, 2)) {
      store.recordCaptureReceipt({ ...report, format: "uttori-asm-instruction-trace" });
    }
  });
  const sql = new DatabaseSync(store.file);
  try {
    sql
      .prepare("UPDATE capture_catalog SET imported_at=?,last_seen_at=? WHERE sha256=?")
      .run(100, 100, "a".repeat(64));
    sql
      .prepare("UPDATE capture_catalog SET imported_at=?,last_seen_at=? WHERE sha256=?")
      .run(200, 200, "b".repeat(64));
  } finally {
    sql.close();
  }
  const hashes = () => store.sourceCatalog().sources.map(({ sha256 }) => sha256?.[0]);
  t.deepEqual(
    hashes(),
    ["b", "a", "c"],
    "recency precedes filenames; undated sources remain visible",
  );
  t.deepEqual(
    store.sourceCatalog().sources.map(({ lastImportedAt }) => lastImportedAt),
    [200, 100, undefined],
  );
  store.transaction(() =>
    store.recordCaptureReceipt({
      ...project.shards.imports[0],
      format: "uttori-asm-instruction-trace",
    }),
  );
  t.deepEqual(
    hashes(),
    ["a", "b", "c"],
    "an identical reimport moves its existing identity to the top",
  );
  store.compact();
  t.deepEqual(hashes(), ["a", "b", "c"], "recency is independent of SQLite physical row order");
});
