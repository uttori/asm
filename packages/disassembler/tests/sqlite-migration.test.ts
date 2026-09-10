import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import sinon from "sinon";

import { test } from "../../../tests/ava-helper.js";
import {
  RomImage,
  loadAnalysisProject,
  migrateAnalysisProjectStorage,
  SqliteAnalysisStore,
  type AnalysisProject,
  type RuntimeEvidenceRecord,
} from "../src/index.js";
import { SQLITE_MIGRATION_DIRECTORY, SQLITE_MIGRATION_BACKUP } from "../src/sqlite-maintenance.js";
import { writeLegacySqliteProject } from "./fixtures/legacy-sqlite.js";

const fixture = (): AnalysisProject => {
  const base = { architecture: "fixture", count: 1, evidence: ["evidence:1"] };
  const runtime: RuntimeEvidenceRecord[] = [
    {
      ...base,
      id: `capture:code:${"a".repeat(64)}`,
      kind: "runtime-instruction",
      addressSpace: "rom.file",
      address: 0,
      bytes: [0, 255],
      state: { a: 0, flag: false, text: "日本語" },
    },
    {
      ...base,
      id: `capture:state:${"a".repeat(64)}`,
      kind: "runtime-cpu-state",
      addressSpace: "rom.file",
      address: 0,
      state: { a: 0, flag: false, text: "日本語" },
    },
    {
      ...base,
      id: "standalone:state",
      kind: "runtime-cpu-state",
      addressSpace: "rom.file",
      address: 1,
      state: { e: true },
    },
    {
      ...base,
      id: "manual:日本語😀",
      kind: "runtime-execution",
      addressSpace: "rom.file",
      address: 2,
      opcode: 0,
      fileOffset: 0,
      size: 1,
    },
    {
      ...base,
      id: `capture:${"A".repeat(64)}`,
      kind: "runtime-coverage",
      addressSpace: "rom.file",
      start: 3,
      end: 5,
      coverage: "read",
    },
    {
      ...base,
      id: "memory:1",
      kind: "runtime-memory-access",
      instructionAddressSpace: "rom.file",
      instructionAddress: 0,
      accessedAddressSpace: "rom.file",
      accessedAddress: 4,
      access: "write",
      width: 1,
      actor: "dma",
      channel: 0,
      value: 0,
    },
    {
      ...base,
      id: "branch:1",
      kind: "runtime-control-target",
      fromAddressSpace: "rom.file",
      fromAddress: 0,
      toAddressSpace: "rom.file",
      toAddress: 2,
      flowKind: "branch",
      indirect: false,
    },
  ];
  return {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "fixture",
      rom: new RomImage(new Uint8Array(0x8000)).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
    },
    shards: {
      evidence: [{ id: "evidence:1", source: "manual", sourceId: "test", confidence: "certain" }],
      labels: [
        {
          id: "entry",
          addressSpace: "rom.file",
          address: 0,
          name: "Entry",
          evidence: ["evidence:1"],
        },
      ],
      comments: [
        {
          id: "comment",
          addressSpace: "rom.file",
          address: 0,
          text: "日本語 repeated comment ".repeat(1000),
          evidence: ["evidence:1"],
        },
      ],
      regions: [],
      annotations: [],
      analysis: [],
      imports: [],
      runtime,
    },
  };
};
const temporary = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sqlite-migration-"));

test("migration preserves every semantic record, logical revision and original database", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  const manifest = writeLegacySqliteProject(directory, project);
  const file = path.join(directory, "analysis.sqlite");
  t.throws(() => new SqliteAnalysisStore(file, false), { message: /project-migrate/ });
  const migrated = await migrateAnalysisProjectStorage(directory);
  t.true(migrated.changed);
  t.is(migrated.tables.runtime.records, project.shards.runtime.length);
  t.true(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
  const loaded = loadAnalysisProject(directory);
  t.deepEqual(loaded.manifest, manifest);
  t.deepEqual(
    Object.fromEntries(loaded.shards.runtime.map((r) => [r.id, r])),
    Object.fromEntries(project.shards.runtime.map((r) => [r.id, r])),
  );
  t.deepEqual(loaded.shards.comments, project.shards.comments);
  const database = new DatabaseSync(file);
  t.is(database.prepare("PRAGMA user_version").get()?.user_version, 1);
  t.is(database.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
  t.is(database.prepare("SELECT typeof(payload) AS type FROM comments").get()?.type, "blob");
  t.is(database.prepare("SELECT count(*) AS n FROM runtime_evidence").get()?.n, 1);
  t.is(database.prepare("SELECT count(*) AS n FROM runtime WHERE typeof(id)='blob'").get()?.n, 2);
  t.is(
    database.prepare("SELECT name FROM sqlite_schema WHERE name='runtime_from'").get(),
    undefined,
  );
  const plan = database
    .prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM runtime WHERE kind='runtime-memory-access' AND instruction_address_space='rom.file' AND instruction_address=0",
    )
    .all();
  t.true(plan.some((row) => String(row.detail).includes("runtime_memory")));
  database.close();
  t.false((await migrateAnalysisProjectStorage(directory)).changed);
});

test("cancellation discards only staging data and leaves format-zero records retryable", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  const controller = new AbortController();
  await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
    { name: "AbortError" },
  );
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  const source = new DatabaseSync(path.join(directory, "analysis.sqlite"), { readOnly: true });
  t.is(source.prepare("PRAGMA user_version").get()?.user_version, 0);
  t.is(
    source.prepare("SELECT count(*) AS n FROM runtime").get()?.n,
    fixture().shards.runtime.length,
  );
  source.close();
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
});

test("cancellation at the final publication callback still preserves the original", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  const controller = new AbortController();
  await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, {
      signal: controller.signal,
      onProgress: ({ phase }) => {
        if (phase === "publish") controller.abort();
      },
    }),
    { name: "AbortError" },
  );
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
});

test("cancellation queued during synchronous index construction is observed before publication", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = writeLegacySqliteProject(directory, fixture());
  const controller = new AbortController();
  await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, {
      signal: controller.signal,
      onProgress: ({ phase }) => {
        if (phase === "indexes")
          setImmediate(() => controller.abort(new Error("cancel after indexes")));
      },
    }),
    { message: "cancel after indexes" },
  );
  const source = new DatabaseSync(path.join(directory, "analysis.sqlite"), { readOnly: true });
  try {
    t.is(source.prepare("PRAGMA user_version").get()?.user_version, 0);
  } finally {
    source.close();
  }
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
  t.deepEqual(loadAnalysisProject(directory).manifest, manifest);
});

test("migration refuses an open SQLite reader and succeeds after it closes", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  const reader = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  reader.prepare("SELECT * FROM meta").get();
  try {
    await t.throwsAsync(migrateAnalysisProjectStorage(directory), { message: /locked/ });
  } finally {
    reader.close();
  }
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
});

for (const phase of ["copy", "linked", "published"] as const) {
  test(`a crashed ${phase} migration recovers without losing records or the original`, async (t) => {
    const directory = temporary();
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const project = fixture();
    const manifest = writeLegacySqliteProject(directory, project);
    const child = spawnSync(
      process.execPath,
      [
        "--import=tsx",
        "--input-type=module",
        "-e",
        `
      import fs from 'node:fs';
      import path from 'node:path';
      import { migrateAnalysisProjectStorage } from './packages/disassembler/src/sqlite-migration.ts';
      const root = process.argv[1];
      const phase = process.argv[2];
      const link = fs.linkSync;
      const rename = fs.renameSync;
      fs.linkSync = (...args) => { link(...args); if (phase === 'linked') process.exit(73); };
      fs.renameSync = (...args) => {
        rename(...args);
        if (phase === 'published' && args[1] === path.join(root, 'analysis.sqlite')) process.exit(73);
      };
      await migrateAnalysisProjectStorage(root, { onProgress: (progress) => {
        if (phase === 'copy' && progress.phase === 'copy') process.exit(73);
      }});
    `,
        directory,
        phase,
      ],
      { encoding: "utf8" },
    );
    t.is(child.status, 73, child.stderr);
    t.true(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
    const result = await migrateAnalysisProjectStorage(directory);
    t.true(result.changed);
    t.is(result.recovered, phase === "published");
    t.deepEqual(loadAnalysisProject(directory).manifest, manifest);
    t.is(loadAnalysisProject(directory).shards.runtime.length, project.shards.runtime.length);
    const backup = new DatabaseSync(path.join(directory, SQLITE_MIGRATION_BACKUP), {
      readOnly: true,
    });
    t.is(backup.prepare("PRAGMA user_version").get()?.user_version, 0);
    t.is(
      backup.prepare("SELECT count(*) AS n FROM runtime").get()?.n,
      project.shards.runtime.length,
    );
    backup.close();
  });
}

test.serial(
  "failed atomic publication leaves the original and permits a clean retry",
  async (t) => {
    const directory = temporary();
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    writeLegacySqliteProject(directory, fixture());
    const rename = fs.renameSync;
    const stub = sinon.stub(fs, "renameSync").callsFake((from, to) => {
      if (to === path.join(directory, "analysis.sqlite"))
        throw new Error("simulated publication failure");
      rename(from, to);
    });
    try {
      await t.throwsAsync(migrateAnalysisProjectStorage(directory), {
        message: "simulated publication failure",
      });
    } finally {
      stub.restore();
    }
    t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
    t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
    t.true((await migrateAnalysisProjectStorage(directory)).changed);
  },
);

test.serial("migration detects low workspace before creating a staging directory", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  const available = fs.statfsSync(directory);
  const stub = sinon.stub(fs, "statfsSync").returns({ ...available, bavail: 0 });
  try {
    await t.throwsAsync(migrateAnalysisProjectStorage(directory), {
      message: /Insufficient migration workspace/,
    });
  } finally {
    stub.restore();
  }
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
});

test("invalid source semantics fail validation without replacing the source", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  writeLegacySqliteProject(directory, {
    ...project,
    shards: { ...project.shards, runtime: project.shards.runtime.map((r) => ({ ...r, count: 0 })) },
  });
  await t.throwsAsync(migrateAnalysisProjectStorage(directory), {
    message: /invalid observation count/,
  });
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  const source = new DatabaseSync(path.join(directory, "analysis.sqlite"), { readOnly: true });
  t.is(source.prepare("PRAGMA user_version").get()?.user_version, 0);
  source.close();
});

test("current and future physical versions are never downgraded on open or migration", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  const file = path.join(directory, "analysis.sqlite");
  const source = new DatabaseSync(file);
  source.exec("PRAGMA user_version=99");
  source.close();
  t.throws(() => new SqliteAnalysisStore(file), { message: /storage format 99/ });
  await t.throwsAsync(migrateAnalysisProjectStorage(directory), { message: /storage format 99/ });
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_DIRECTORY)));
});

test("an automatic SQLite rollback during copy retains its original error and leaves the source retryable", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, {
      onProgress: ({ phase, table }) => {
        if (phase !== "copy" || table !== "evidence") return;
        const staged = new DatabaseSync(
          path.join(directory, SQLITE_MIGRATION_DIRECTORY, "analysis.sqlite"),
        );
        staged.exec(
          "CREATE TRIGGER fail_copy BEFORE INSERT ON runtime BEGIN SELECT RAISE(ROLLBACK, 'simulated disk exhaustion'); END",
        );
        staged.close();
      },
    }),
    { message: "simulated disk exhaustion" },
  );
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
});

test("migration digest comparison catches changed destination facts before publication", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeLegacySqliteProject(directory, fixture());
  await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, {
      onProgress: ({ phase, table }) => {
        if (phase !== "copy" || table !== "runtime") return;
        const staged = new DatabaseSync(
          path.join(directory, SQLITE_MIGRATION_DIRECTORY, "analysis.sqlite"),
        );
        staged.exec("UPDATE runtime SET count=count+1");
        staged.close();
      },
    }),
    { message: /runtime records differ/ },
  );
  t.false(fs.existsSync(path.join(directory, SQLITE_MIGRATION_BACKUP)));
  t.true((await migrateAnalysisProjectStorage(directory)).changed);
});

test("migration streams history larger than a 96 MiB child heap", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  writeLegacySqliteProject(directory, { ...project, shards: { ...project.shards, runtime: [] } });
  const source = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  const insert = source.prepare(
    "INSERT INTO runtime (id,kind,architecture,count,address_space,address,evidence,payload) VALUES (?,?,?,?,?,?,?,?)",
  );
  const payload = JSON.stringify({ state: { note: "history ".repeat(512) } });
  source.exec("BEGIN");
  for (let index = 0; index < 40000; index++)
    insert.run(
      `large:state:${String(index).padStart(8, "0")}`,
      "runtime-cpu-state",
      "fixture",
      1,
      "rom.file",
      index % 0x8000,
      '["evidence:1"]',
      payload,
    );
  source.exec("COMMIT");
  source.close();
  t.true(fs.statSync(path.join(directory, "analysis.sqlite")).size > 96 * 1024 * 1024);
  const child = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=96",
      "--import=tsx",
      "--input-type=module",
      "-e",
      `
    import { migrateAnalysisProjectStorage } from './packages/disassembler/src/sqlite-migration.ts';
    const result = await migrateAnalysisProjectStorage(process.argv[1]);
    process.stdout.write(JSON.stringify({ records: result.tables.runtime.records, bytes: result.afterBytes }));
  `,
      directory,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
  t.is(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout) as { records: number; bytes: number };
  t.is(result.records, 40000);
  t.true(result.bytes < 96 * 1024 * 1024);
});
