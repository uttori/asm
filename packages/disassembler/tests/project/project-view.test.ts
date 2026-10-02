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
