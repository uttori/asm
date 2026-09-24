import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  compactAnalysisProject,
  commitAnalysisProjectTransaction,
  commitPreparedAnalysisProjectTransaction,
  loadAnalysisProject,
  loadAnalysisProjectSnapshot,
  openAnalysisProjectStore,
  prepareAnalysisProjectTransaction,
  resolveProjectNativeAssetId,
  writeAnalysisProject,
  type AnalysisProject,
} from "../src/index.js";
import { DatabaseSync } from "./sqlite-connection.js";

const fixture = (): AnalysisProject => ({
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: [],
    imports: [],
  },
});
const changed = (project: AnalysisProject, index: number): AnalysisProject => ({
  manifest: project.manifest,
  shards: {
    ...project.shards,
    labels: [
      { id: "entry", addressSpace: "rom.file", address: 0, name: `Entry${index}`, evidence: [] },
    ],
  },
});

const temporary = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sqlite-storage-"));

test("legacy native asset declarations survive storage and resolve only for analysis", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = fixture();
  const declaration = {
    codecId: "snes.asset.tile.4bpp",
    codecVersion: "1.0.0",
    provider: { pluginId: "snes", pluginVersion: "1.0.0" },
    options: { layout: "row-major", count: 2 },
  } as const;
  const project: AnalysisProject = {
    ...original,
    shards: {
      ...original.shards,
      annotations: [
        {
          id: "tiles",
          addressSpace: "rom.file",
          start: 0,
          end: 64,
          classification: "asset",
          architecture: "snes.65816",
          asset: declaration,
          evidence: [],
        },
      ],
    },
  };
  writeAnalysisProject(root, project);
  const loaded = loadAnalysisProject(root).shards.annotations[0]?.asset;
  t.deepEqual(loaded, declaration);
  t.is(resolveProjectNativeAssetId(loaded!), "snes.tile.4bpp");
  t.is(resolveProjectNativeAssetId({ ...declaration, codecVersion: "2.0.0" }), undefined);
  t.is(resolveProjectNativeAssetId({ ...declaration, codecId: "game.asset.custom" }), undefined);
  t.deepEqual(loadAnalysisProject(root).shards.annotations[0]?.asset, declaration);
});

test("prepared edits are validated again and stale commits cannot overwrite newer rows", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, fixture());
  const snapshot = loadAnalysisProjectSnapshot(root);
  const prepared = prepareAnalysisProjectTransaction(root, changed(snapshot, 1));
  t.deepEqual(loadAnalysisProjectSnapshot(root), snapshot);
  t.false(fs.existsSync(path.join(root, "analysis")));
  t.throws(
    () =>
      commitPreparedAnalysisProjectTransaction(root, snapshot.revision, {
        project: {
          ...prepared.project,
          shards: {
            ...prepared.project.shards,
            labels: [{ ...prepared.project.shards.labels[0]!, address: -1 }],
          },
        },
      }),
    { message: /invalid address/ },
  );
  const committed = commitPreparedAnalysisProjectTransaction(root, snapshot.revision, prepared);
  t.is(committed.manifest.revision, 2);
  t.throws(() => commitAnalysisProjectTransaction(root, snapshot.revision, changed(snapshot, 2)), {
    name: "AnalysisProjectStaleError",
  });
  t.is(loadAnalysisProject(root).shards.labels[0]?.name, "Entry1");
});

test("SQL failures roll back rows, provenance and revision together", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, changed(fixture(), 1));
  const snapshot = loadAnalysisProjectSnapshot(root);
  const database = new DatabaseSync(path.join(root, "analysis.sqlite"));
  database.exec(`CREATE TRIGGER fail_revision BEFORE INSERT ON meta WHEN NEW.k='revision'
    BEGIN SELECT RAISE(ABORT, 'revision failure'); END`);
  database.close();
  t.throws(() => commitAnalysisProjectTransaction(root, snapshot.revision, changed(snapshot, 2)), {
    message: "revision failure",
  });
  t.deepEqual(loadAnalysisProjectSnapshot(root), snapshot);
});

test("database snapshots and optimistic revisions stay correct when the watcher pointer is stale", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, changed(fixture(), 1));
  const pointer = fs.readFileSync(path.join(root, "analysis.json"));
  const before = loadAnalysisProjectSnapshot(root);
  const reader = openAnalysisProjectStore(root);
  try {
    reader.transaction(() => {
      t.is(reader.manifest().revision, 1);
      commitAnalysisProjectTransaction(root, before.revision, changed(before, 2));
      t.is(reader.loadTable("labels")[0]?.name, "Entry1");
      t.is(reader.manifest().revision, 1);
    }, false);
  } finally {
    reader.close();
  }
  fs.writeFileSync(path.join(root, "analysis.json"), pointer);
  const after = loadAnalysisProjectSnapshot(root);
  t.is(after.manifest.revision, 2);
  t.is(after.shards.labels[0]?.name, "Entry2");
  t.notDeepEqual(after.revision, before.revision);
  t.throws(() => commitAnalysisProjectTransaction(root, before.revision, before), {
    name: "AnalysisProjectStaleError",
  });
  t.is(
    commitAnalysisProjectTransaction(root, after.revision, changed(after, 3)).manifest.revision,
    3,
  );
});

test("an interrupted writer leaves the last committed SQLite project readable", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, changed(fixture(), 1));
  const before = loadAnalysisProjectSnapshot(root);
  const child = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync(process.argv[1]);
    db.exec("BEGIN IMMEDIATE; DELETE FROM labels; UPDATE meta SET v='99' WHERE k='revision'");
    process.exit(17);
  `,
    path.join(root, "analysis.sqlite"),
  ]);
  t.is(child.status, 17);
  t.deepEqual(loadAnalysisProjectSnapshot(root), before);
});

test("SQLite serializes competing writers and releases locks after failure", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, changed(fixture(), 1));
  const snapshot = loadAnalysisProjectSnapshot(root);
  const writer = new DatabaseSync(path.join(root, "analysis.sqlite"));
  writer.exec("BEGIN IMMEDIATE");
  try {
    t.throws(
      () => commitAnalysisProjectTransaction(root, snapshot.revision, changed(snapshot, 2)),
      {
        message: /database is locked/,
      },
    );
  } finally {
    writer.exec("ROLLBACK");
    writer.close();
  }
  t.deepEqual(loadAnalysisProjectSnapshot(root), snapshot);
  t.is(
    commitAnalysisProjectTransaction(root, snapshot.revision, changed(snapshot, 2)).manifest
      .revision,
    2,
  );
});

test("compaction preserves logical records and revision without producing shard generations", (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, changed(fixture(), 1));
  const before = loadAnalysisProjectSnapshot(root);
  const result = compactAnalysisProject(root);
  t.deepEqual(result.revision, before.revision);
  t.deepEqual(loadAnalysisProjectSnapshot(root), before);
  t.false(fs.existsSync(path.join(root, "analysis")));
});
