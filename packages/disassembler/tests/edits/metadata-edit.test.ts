import fs from "node:fs";
import path from "node:path";

import {
  analyzeSnesProject,
  exportSnesProject,
  snesSourceLabelNames,
  verifySnesProjectRoundTrip,
} from "@uttori/asm-plugin-snes";

import { test } from "../../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../../tests/helpers/ownership-fixture.js";
import {
  applyMetadataEdit,
  commitAnalysisProjectSelectedEdit,
  loadAnalysisProjectSnapshot,
  mergeRuntimeEvidence,
  openAnalysisProjectStore,
  type MetadataOperation,
} from "../../src/index.js";

test("removing a mirrored imported label preserves comments and seeds, survives import/reopen, and restores exactly", async (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const original = f.snapshot.shards.labels[0];
  const edit = applyMetadataEdit(f.snapshot, {
    id: "edit:remove",
    evidenceId: "manual:remove",
    sourceId: "test",
    description: "Remove Candy name",
    operations: [{ kind: "remove-label", id: original.id }],
  });
  t.true(edit.project.shards.labels[0].suppressed);
  t.is(edit.project.shards.labels[0].comment, original.comment);
  t.is(edit.project.shards.labels[0].analysisEntryPoint, original.analysisEntryPoint);
  commitAnalysisProjectSelectedEdit(f.projectDirectory, f.snapshot, edit.project);
  const reopened = loadAnalysisProjectSnapshot(f.projectDirectory);
  const merged = mergeRuntimeEvidence(reopened.shards, { labels: [original] });
  t.true(merged.shards.labels[0].suppressed);
  const store = openAnalysisProjectStore(f.projectDirectory);
  try {
    store.transaction(() => store.mergeEvidenceBatch({ labels: [original] }));
  } finally {
    store.close();
  }
  exportSnesProject({
    projectDirectory: f.projectDirectory,
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
  });
  const source = fs.readFileSync(f.file, "utf8");
  t.false(source.includes("L_Item_Price_Candy:"));
  t.regex(source, /A wrapped imported description/);
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory: f.sourceDirectory, romFile: f.romFile }))
      .comparison.equal,
  );
  const fresh = loadAnalysisProjectSnapshot(f.projectDirectory);
  const undo = applyMetadataEdit(fresh, {
    id: "edit:undo",
    evidenceId: "manual:undo",
    sourceId: "test",
    description: "Restore Candy name",
    operations: [{ kind: "restore", receiptId: "edit:remove" }],
  });
  t.deepEqual(undo.project.shards.labels[0], original);
  commitAnalysisProjectSelectedEdit(f.projectDirectory, fresh, undo.project);
  t.deepEqual(loadAnalysisProjectSnapshot(f.projectDirectory).shards.labels[0], original);
});

test("metadata supports standalone comment removal, state clearing, splitting and exact target replacement", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const annotation = {
    id: "range",
    addressSpace: "rom.file",
    start: 0x50,
    end: 0x60,
    classification: "data8" as const,
    architecture: "snes.65816",
    state: { m: true },
    points: ["in" as const],
    evidence: ["guide"],
  };
  const target = {
    id: "target",
    kind: "target-override" as const,
    addressSpace: "snes.cpu",
    address: 0xc00010,
    targets: [0xc00020, 0xc00030],
    evidence: ["guide"],
  };
  const initial = {
    ...f.snapshot,
    shards: { ...f.snapshot.shards, annotations: [annotation], analysis: [target] },
  };
  const operations: MetadataOperation[] = [
    { kind: "remove", shard: "comments", id: "note" },
    { kind: "put", shard: "annotations", record: { ...annotation, state: {}, points: [] } },
    { kind: "put", shard: "analysis", record: { ...target, targets: [0xc00030] } },
  ];
  const edit = applyMetadataEdit(initial, {
    id: "edit:replace",
    evidenceId: "manual:replace",
    sourceId: "test",
    description: "Correct interpretation",
    operations,
  });
  t.deepEqual(edit.project.shards.annotations[0].state, {});
  t.deepEqual(edit.project.shards.annotations[0].points, []);
  t.is(edit.project.shards.comments.length, 0);
  t.deepEqual(
    edit.project.shards.analysis.find((record) => record.kind === "target-override")?.targets,
    [0xc00030],
  );
  t.deepEqual(
    mergeRuntimeEvidence(edit.project.shards, {
      comments: f.snapshot.shards.comments,
      annotations: [annotation],
      analysis: [target],
    }).shards,
    edit.project.shards,
  );
  const split = applyMetadataEdit(edit.project, {
    id: "edit:split",
    evidenceId: "manual:split",
    sourceId: "test",
    description: "Split interval",
    operations: [{ kind: "split-classification", id: "range", at: 0x58, rightId: "range:right" }],
  });
  t.deepEqual(
    split.project.shards.annotations.map(({ start, end }) => [start, end]),
    [
      [0x50, 0x58],
      [0x58, 0x60],
    ],
  );
  const stale = {
    ...edit.project,
    shards: {
      ...edit.project.shards,
      comments: [{ ...f.snapshot.shards.comments[0], text: "Newer edit" }],
    },
  };
  t.throws(
    () =>
      applyMetadataEdit(stale, {
        id: "edit:stale",
        evidenceId: "manual:stale",
        sourceId: "test",
        description: "Old undo",
        operations: [{ kind: "restore", receiptId: "edit:replace" }],
      }),
    { message: /Cannot restore changed/ },
  );
  t.false(fs.existsSync(path.join(f.sourceDirectory, "build")));
});

test("renames reset to imported policy; no-op, malformed target and out-of-ROM drafts are rejected", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const label = f.snapshot.shards.labels[0];
  const intent = (id: string, operations: readonly MetadataOperation[]) => ({
    id: `edit:${id}`,
    evidenceId: `manual:${id}`,
    sourceId: "test",
    description: id,
    operations,
  });
  t.throws(
    () =>
      applyMetadataEdit(
        f.snapshot,
        intent("noop", [{ kind: "put", shard: "labels", record: label }]),
      ),
    { message: /no changes/ },
  );
  const renamed = applyMetadataEdit(
    f.snapshot,
    intent("rename", [
      { kind: "put", shard: "labels", record: { ...label, sourceName: "CandyPrice" } },
    ]),
  );
  // Offline callers can compose edits before publication; lexical IDs must not reorder history.
  const renamedAgain = applyMetadataEdit(
    renamed.project,
    intent("a", [
      {
        kind: "put",
        shard: "labels",
        record: { ...renamed.project.shards.labels[0], sourceName: "AnotherCandyPrice" },
      },
    ]),
  );
  const reset = applyMetadataEdit(
    renamedAgain.project,
    intent("reset", [{ kind: "reset-label", id: label.id }]),
  );
  t.is(reset.project.shards.labels[0].name, label.name);
  t.is(reset.project.shards.labels[0].sourceName, undefined);
  t.is(reset.project.shards.labels[0].comment, label.comment);
  t.throws(
    () =>
      applyMetadataEdit(
        f.snapshot,
        intent("bounds", [
          {
            kind: "put",
            shard: "comments",
            record: {
              id: "bad",
              addressSpace: "rom.file",
              address: 0x10000,
              text: "outside",
              evidence: [],
            },
          },
        ]),
      ),
    { message: /bounds/ },
  );
  t.throws(
    () =>
      applyMetadataEdit(
        f.snapshot,
        intent("target", [
          {
            kind: "put",
            shard: "analysis",
            record: {
              id: "bad",
              kind: "target-set",
              addressSpace: "snes.cpu",
              name: "",
              targets: [],
              evidence: [],
            },
          },
        ]),
      ),
    { message: /needs a name/ },
  );
  const created = applyMetadataEdit(
    f.snapshot,
    intent("create", [
      {
        kind: "put",
        shard: "labels",
        record: {
          id: "new",
          name: "NewLabel",
          addressSpace: "rom.file",
          address: 0x80,
          suppressed: true,
          analysisEntryPoint: false,
          evidence: [],
        },
      },
    ]),
  );
  const resetNew = applyMetadataEdit(
    created.project,
    intent("resetnew", [{ kind: "reset-label", id: "new" }]),
  );
  t.false(resetNew.project.shards.labels.some(({ id }) => id === "new"));
});

test("generated function suppression is presentation-only and persisted receipts survive reanalysis", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const fn = {
    id: "function:fixture",
    kind: "function" as const,
    addressSpace: "snes.cpu",
    address: 0xc00080,
    source: "manual",
    evidencePath: [],
    evidence: ["guide"],
  };
  const initial = { ...f.snapshot, shards: { ...f.snapshot.shards, analysis: [fn] } };
  const removed = applyMetadataEdit(initial, {
    id: "edit:fn",
    evidenceId: "manual:fn",
    sourceId: "test",
    description: "Suppress inferred name",
    operations: [
      {
        kind: "put",
        shard: "labels",
        record: {
          id: "hidden:fn",
          name: "Fn_C00080",
          suppressed: true,
          analysisEntryPoint: false,
          addressSpace: fn.addressSpace,
          address: fn.address,
          evidence: [],
        },
      },
      {
        kind: "put",
        shard: "annotations",
        record: {
          id: "all-data",
          addressSpace: "rom.file",
          architecture: "snes.65816",
          start: 0,
          end: f.rom.length,
          classification: "data8",
          evidence: [],
        },
      },
    ],
  });
  t.deepEqual(
    removed.project.shards.analysis.find(({ id }) => id === fn.id),
    fn,
  );
  commitAnalysisProjectSelectedEdit(f.projectDirectory, f.snapshot, removed.project);
  exportSnesProject({
    projectDirectory: f.projectDirectory,
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
  });
  t.false(fs.readFileSync(f.file, "utf8").includes("Fn_C00080:"));
  t.throws(() => snesSourceLabelNames(initial.shards, "hirom", f.rom.length, ["Fn_C00080"]), {
    message: /conflicts/,
  });
  analyzeSnesProject({
    projectDirectory: f.projectDirectory,
    romFile: f.romFile,
    maxWorkItems: 100,
  });
  const reopened = loadAnalysisProjectSnapshot(f.projectDirectory);
  t.true(reopened.shards.labels.find(({ id }) => id === "hidden:fn")?.suppressed);
  t.true(reopened.shards.analysis.some(({ id }) => id === "edit:fn"));
});
