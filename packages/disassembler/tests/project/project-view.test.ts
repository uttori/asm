import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  commitAnalysisProjectViewUpdate,
  loadAnalysisProject,
  loadAnalysisProjectViewSnapshot,
  publishAnalysisProject,
  withAnalysisReadSession,
  type AnalysisReadSession,
  type AnalysisProject,
  type RuntimeEvidenceRecord,
  type ProjectLabel,
} from "../../src/index.js";

function isMutableLabels(value: readonly ProjectLabel[]): value is ProjectLabel[] {
  return Array.isArray(value);
}

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
    imports: [],
    evidence: [{ id: "capture", source: "runtime", sourceId: "test", confidence: "certain" }],
    runtime: [
      {
        id: "pc",
        kind: "runtime-execution",
        architecture: "test",
        addressSpace: "rom.file",
        address: 1,
        count: 5,
        evidence: ["capture"],
      },
      {
        id: "state",
        kind: "runtime-cpu-state",
        architecture: "test",
        addressSpace: "rom.file",
        address: 1,
        count: 5,
        state: { a: 17 },
        evidence: ["capture"],
      },
    ],
  },
});

test("read sessions bound pages and expire cursors while preserving a concurrent writer's old snapshot", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-read-session-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(directory, {
    ...project,
    shards: {
      ...project.shards,
      labels: Array.from({ length: 205 }, (_, index) => ({
        id: `label-${String(index).padStart(3, "0")}`,
        addressSpace: "rom.file",
        address: index,
        name: `Label${index}`,
        evidence: [],
      })),
    },
  });
  const before = loadAnalysisProjectViewSnapshot(directory);
  let escaped: AnalysisReadSession | undefined;
  let cursor: IterableIterator<RuntimeEvidenceRecord> | undefined;
  withAnalysisReadSession(directory, (session) => {
    escaped = session;
    t.false("replaceTables" in session);
    const first = session.metadataPage("labels");
    t.is(first.records.length, 200);
    t.is(session.metadataPage("labels", first.next).records.length, 5);
    t.throws(() => session.metadataPage("labels", undefined, 201), { message: /1 to 200/ });
    cursor = session.runtimeRecords();
    t.false(cursor.next().done);
    commitAnalysisProjectViewUpdate(directory, before, { labels: [] });
    t.is(session.metadataPage("labels").records.length, 200);
    t.deepEqual(session.revision, before.revision);
  });
  t.throws(() => escaped!.metadataPage("labels"), { message: /closed/ });
  t.throws(() => cursor!.next(), { message: /closed/ });
  t.is(
    withAnalysisReadSession(directory, (session) => session.metadataPage("labels").records.length),
    0,
  );
  t.throws(() => publishAnalysisProject(directory, project), { message: /already exists/ });
});

test("explicit view replacements are persisted even when a JavaScript caller reuses an array", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-view-mutable-array-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, fixture());
  const snapshot = loadAnalysisProjectViewSnapshot(directory);
  if (!isMutableLabels(snapshot.view.labels)) {
    throw new Error("Expected a label array.");
  }
  const labels = snapshot.view.labels;
  labels.push({
    id: "entry",
    addressSpace: "rom.file",
    address: 1,
    name: "Entry",
    evidence: ["capture"],
  });
  commitAnalysisProjectViewUpdate(directory, snapshot, { labels });
  const loaded = loadAnalysisProject(directory);
  t.deepEqual(loaded.shards.labels, labels);
  t.deepEqual(loaded.shards.runtime, fixture().shards.runtime);
});

test("project views preserve complete runtime bytes through metadata updates and stale revisions", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-project-view-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixture();
  publishAnalysisProject(directory, project);
  const originalRecords = loadAnalysisProject(directory).shards.runtime;
  const snapshot = loadAnalysisProjectViewSnapshot(directory, () => {
    const records: RuntimeEvidenceRecord[] = [];
    return {
      push: (record) => {
        if (record.kind === "runtime-execution") {
          records.push(record);
        }
      },
      finish: () => records,
    };
  });
  t.deepEqual(snapshot.view.runtime, [project.shards.runtime[0]]);
  const result = commitAnalysisProjectViewUpdate(directory, snapshot, {
    labels: [
      { id: "entry", addressSpace: "rom.file", address: 1, name: "Entry", evidence: ["capture"] },
    ],
  });
  t.is(result.manifest.revision, snapshot.manifest.revision! + 1);
  t.deepEqual(loadAnalysisProject(directory).shards.runtime, originalRecords);
  t.throws(() => commitAnalysisProjectViewUpdate(directory, snapshot, { comments: [] }), {
    name: "AnalysisProjectStaleError",
  });
  const current = loadAnalysisProjectViewSnapshot(directory);
  t.deepEqual(current.view.runtime, []);
  t.throws(() => commitAnalysisProjectViewUpdate(directory, current, { evidence: [] }), {
    message: /missing evidence/,
  });
  const runtimeUpdate: Partial<Omit<AnalysisProjectShards, "runtime">> = {};
  Object.assign(runtimeUpdate, { runtime: [] });
  t.throws(() => commitAnalysisProjectViewUpdate(directory, current, runtimeUpdate), {
    message: /cannot replace runtime history/,
  });
  t.is(
    loadAnalysisProjectViewSnapshot(directory).revision.manifestSha256,
    current.revision.manifestSha256,
  );
});
