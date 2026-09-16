import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  applyLabelRenameEdit,
  applyRangeClassificationEdit,
  applyStateEntryPointEdit,
  applyTargetResolutionEdit,
  buildRomCoverageMap,
  commitAnalysisProjectAnnotationUpdate,
  explainProjectEvidence,
  loadAnalysisProjectSnapshot,
  revertLabelRenameEdit,
  revertRangeClassificationEdit,
  revertStateEntryPointEdit,
  revertTargetResolutionEdit,
  writeAnalysisProject,
  type AnalysisProject,
} from "../src/index.js";

const projectFor = (rom: RomImage): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture.target",
    rom: rom.identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
  },
  shards: {
    analysis: [],
    annotations: [
      {
        id: "imported.asset",
        addressSpace: "rom.file",
        start: 0,
        end: 4,
        classification: "asset",
        architecture: "fixture.architecture",
        evidence: ["imported.evidence"],
      },
    ],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: [
      {
        id: "imported.evidence",
        source: "import",
        sourceId: "fixture.importer",
        confidence: "high",
      },
    ],
    imports: [],
  },
});

test("annotation transactions validate only editable metadata, preserve provenance, and reject stale saves", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-annotation-transaction-"));
  t.teardown(() => fs.rm(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const before = loadAnalysisProjectSnapshot(directory);
  const updates = {
    evidence: before.shards.evidence,
    labels: [
      {
        id: "label",
        name: "Start",
        sourceName: "Start",
        addressSpace: "rom.file",
        address: 0,
        evidence: ["imported.evidence"],
      },
    ],
    comments: [
      {
        id: "comment",
        text: "Entry",
        addressSpace: "rom.file",
        address: 0,
        evidence: ["imported.evidence"],
      },
    ],
  };
  const commit = (value: typeof updates) =>
    commitAnalysisProjectAnnotationUpdate(directory, before.revision, value);
  t.throws(() => commit({ ...updates, evidence: [] }), { message: /preserve existing evidence/ });
  t.throws(
    () => commit({ ...updates, evidence: [{ ...updates.evidence[0], sourceId: "changed" }] }),
    { message: /preserve existing evidence/ },
  );
  t.throws(() => commit({ ...updates, labels: [{ ...updates.labels[0], address: -1 }] }), {
    message: /invalid address/,
  });
  t.throws(
    () => commit({ ...updates, comments: [{ ...updates.comments[0], evidence: ["missing"] }] }),
    { message: /missing evidence/ },
  );
  t.throws(() => commit({ ...updates, labels: [...updates.labels, ...updates.labels] }), {
    message: /duplicate id/,
  });
  t.throws(
    () =>
      commitAnalysisProjectAnnotationUpdate(directory, before.revision, {
        ...updates,
        runtime: [],
      } as typeof updates),
    { message: /only replace labels/ },
  );
  t.deepEqual(loadAnalysisProjectSnapshot(directory), before);
  const published = commit(updates);
  const after = loadAnalysisProjectSnapshot(directory);
  t.deepEqual(after.revision, published.revision);
  t.deepEqual(after.shards, { ...before.shards, ...updates });
  t.throws(() => commit(updates), { message: /changed since it was loaded/ });
});

test("range classification is evidence-preserving, visibly conflicting, and exactly undoable", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-range-edit-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const applied = applyRangeClassificationEdit(snapshot, {
      annotationId: "manual.text.2-6",
      evidenceId: "manual.evidence.text.2-6",
      addressSpace: "rom.file",
      start: 2,
      end: 6,
      classification: "text",
      architecture: "fixture.architecture",
      sourceId: "vscode.analysis-coverage",
      detail: "Confirmed dialogue text",
    });

    t.is(applied.project.shards.annotations.length, 2);
    t.is(applied.project.shards.evidence.at(-1)?.source, "manual");
    t.deepEqual(applied.inverse.conflicts, [
      {
        id: "conflict:manual-range:manual.text.2-6:imported.asset",
        kind: "conflict",
        addressSpace: "rom.file",
        address: 2,
        end: 4,
        conflictKind: "manual-range-classification",
        message:
          "Manual annotation 'manual.text.2-6' (text, fixture.architecture) contradicts 'imported.asset' (asset, fixture.architecture) over [2, 4).",
        nodes: [],
        evidence: ["imported.evidence", "manual.evidence.text.2-6"],
      },
    ]);
    const map = buildRomCoverageMap(snapshot.manifest, applied.project.shards);
    t.is(map.summary.conflictBytes, 2);
    t.deepEqual(map.segments.find(({ start, end }) => start === 2 && end === 4)?.conflictIds, [
      "conflict:manual-range:manual.text.2-6:imported.asset",
    ]);

    const reverted = revertRangeClassificationEdit(applied.project, applied.inverse);
    t.deepEqual(reverted.shards, snapshot.shards);
    const changed = {
      ...applied.project,
      shards: {
        ...applied.project.shards,
        annotations: applied.project.shards.annotations.map((annotation) =>
          annotation.id === applied.inverse.annotation.id
            ? { ...annotation, end: annotation.end + 1 }
            : annotation,
        ),
      },
    };
    t.throws(() => revertRangeClassificationEdit(changed, applied.inverse), {
      message: /Cannot undo changed analysis annotation/,
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("state and entry-point overlays preserve contradictory state and undo exactly", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-state-edit-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const withState = {
      ...snapshot,
      shards: {
        ...snapshot.shards,
        annotations: snapshot.shards.annotations.map((annotation) => ({
          ...annotation,
          state: { m: false },
        })),
      },
    };
    const applied = applyStateEntryPointEdit(withState, {
      annotationId: "manual.state.asset",
      evidenceId: "manual.evidence.state.asset",
      baseAnnotationId: "imported.asset",
      state: { m: true, x: false, dataBank: 0x7e },
      entryPoint: true,
      sourceId: "vscode.analysis-coverage",
      detail: "Observed 8-bit accumulator at entry",
    });

    t.deepEqual(applied.inverse.annotation.state, { m: true, x: false, dataBank: 0x7e });
    t.deepEqual(applied.inverse.annotation.points, ["in"]);
    t.deepEqual(
      applied.inverse.conflicts.map(({ conflictKind }) => conflictKind),
      ["manual-state"],
    );
    t.true(applied.project.shards.annotations.some(({ id }) => id === "imported.asset"));
    const explanation = explainProjectEvidence(
      applied.project.shards,
      "annotations",
      "manual.state.asset",
    );
    t.deepEqual(
      explanation.evidence.map(({ id }) => id),
      ["manual.evidence.state.asset"],
    );
    t.deepEqual(
      explanation.conflicts.map(({ id }) => id),
      ["conflict:manual-state:manual.state.asset:imported.asset"],
    );
    t.deepEqual(
      revertStateEntryPointEdit(applied.project, applied.inverse).shards,
      withState.shards,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("target resolutions union prior targets and provenance and restore the prior override", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-target-edit-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const withOverride = {
      ...snapshot,
      shards: {
        ...snapshot.shards,
        analysis: [
          {
            id: "runtime.target.10",
            kind: "target-override" as const,
            addressSpace: "rom.file",
            address: 0x10,
            targets: [0x20],
            evidence: ["imported.evidence"],
          },
        ],
      },
    };
    const applied = applyTargetResolutionEdit(withOverride, {
      overrideId: "runtime.target.10",
      evidenceId: "manual.evidence.target.10",
      addressSpace: "rom.file",
      address: 0x10,
      targets: [0x30, 0x20],
      sourceId: "vscode.analysis-coverage",
    });

    t.deepEqual(applied.inverse.after.targets, [0x20, 0x30]);
    t.deepEqual(applied.inverse.after.evidence, ["imported.evidence", "manual.evidence.target.10"]);
    t.deepEqual(
      revertTargetResolutionEdit(applied.project, applied.inverse).shards,
      withOverride.shards,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("label rename records manual provenance, explains it, and restores the exact label", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-label-edit-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const withLabel = {
      ...snapshot,
      shards: {
        ...snapshot.shards,
        labels: [
          {
            id: "imported.label.start",
            addressSpace: "rom.file",
            address: 0x10,
            name: "OldName",
            evidence: ["imported.evidence"],
          },
        ],
      },
    };
    const applied = applyLabelRenameEdit(withLabel, {
      labelId: "imported.label.start",
      evidenceId: "manual.evidence.rename.start",
      name: "GameStart",
      sourceId: "vscode.analysis-coverage",
    });

    t.is(applied.inverse.after.name, "GameStart");
    const explanation = explainProjectEvidence(
      applied.project.shards,
      "labels",
      "imported.label.start",
    );
    t.deepEqual(
      explanation.evidence.map(({ id }) => id),
      ["imported.evidence", "manual.evidence.rename.start"],
    );
    t.true(explanation.referencedBy.includes("labels:imported.label.start"));
    t.deepEqual(revertLabelRenameEdit(applied.project, applied.inverse).shards, withLabel.shards);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
