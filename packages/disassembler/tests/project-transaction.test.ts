import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_LOCK_DIRECTORY,
  ANALYSIS_PROJECT_MANIFEST,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  AnalysisProjectLockedError,
  AnalysisProjectStaleError,
  RomImage,
  applyLabelRenameEdit,
  applyRangeClassificationEdit,
  applyStateEntryPointEdit,
  applyTargetResolutionEdit,
  buildRomCoverageMap,
  canonicalJson,
  commitPreparedAnalysisProjectTransaction,
  explainProjectEvidence,
  loadAnalysisProject,
  loadAnalysisProjectSnapshot,
  prepareAnalysisProjectTransaction,
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

test("prepared transaction validation rejects correctly hashed malformed JSON and wrong counts before publication", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-forged-"));
  try {
    const project = projectFor(new RomImage(new Uint8Array(0x8000)));
    writeAnalysisProject(directory, project);
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const active = await fs.readFile(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8");
    const prepared = prepareAnalysisProjectTransaction(directory, project);
    const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
    for (const [text, count, expectedError] of [
      ['[{"id":"bad",}]', 1, { instanceOf: SyntaxError }],
      ['[{"id":"valid"}]', 2, { message: /wrong record count/ }],
      ["[null]", 1, { message: /not a valid JSON object-record array/ }],
    ] as const) {
      const descriptors = prepared.manifest.shards.map((descriptor) =>
        descriptor.kind === "labels"
          ? { ...descriptor, sha256: sha256(text), records: count }
          : descriptor,
      );
      const generation = sha256(
        canonicalJson(
          descriptors.map(({ id, kind, sha256, records }) => ({ id, kind, sha256, records })),
        ),
      );
      const folder = `analysis/generations/${generation}`;
      await fs.mkdir(path.join(directory, folder), { recursive: true });
      const shards = [];
      for (const descriptor of descriptors) {
        const destination = `${folder}/${path.basename(descriptor.path)}`;
        if (descriptor.kind === "labels")
          await fs.writeFile(path.join(directory, destination), text);
        else
          await fs.copyFile(
            path.join(directory, descriptor.path),
            path.join(directory, destination),
          );
        shards.push({ ...descriptor, path: destination });
      }
      t.throws(
        () =>
          commitPreparedAnalysisProjectTransaction(directory, snapshot.revision, {
            ...prepared,
            generation,
            manifest: { ...prepared.manifest, shards },
          }),
        expectedError,
      );
      t.is(await fs.readFile(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8"), active);
      await t.throwsAsync(fs.stat(path.join(directory, ANALYSIS_PROJECT_LOCK_DIRECTORY)), {
        code: "ENOENT",
      });
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("project transactions prepare immutable generations and publish only the manifest", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-transaction-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const originalManifest = await fs.readFile(
      path.join(directory, ANALYSIS_PROJECT_MANIFEST),
      "utf8",
    );
    const original = loadAnalysisProjectSnapshot(directory);
    const next: AnalysisProject = {
      manifest: {
        format: original.manifest.format,
        schemaVersion: original.manifest.schemaVersion,
        target: original.manifest.target,
        rom: original.manifest.rom,
        mapping: original.manifest.mapping,
        addressSpaces: original.manifest.addressSpaces,
      },
      shards: {
        ...original.shards,
        labels: [
          {
            id: "label.entry",
            addressSpace: "rom.file",
            address: 8,
            name: "Entry",
            evidence: ["imported.evidence"],
          },
        ],
      },
    };

    const prepared = prepareAnalysisProjectTransaction(directory, next);
    t.is(
      await fs.readFile(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8"),
      originalManifest,
    );
    t.is(loadAnalysisProject(directory).shards.labels.length, 0);
    t.true(
      prepared.manifest.shards.every(({ path: shardPath }) =>
        shardPath.startsWith(`analysis/generations/${prepared.generation}/`),
      ),
    );
    t.throws(() =>
      commitPreparedAnalysisProjectTransaction(directory, original.revision, {
        ...prepared,
        manifest: { ...prepared.manifest, shards: prepared.manifest.shards.slice(1) },
      }),
    );
    t.is(
      await fs.readFile(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8"),
      originalManifest,
    );

    const committed = commitPreparedAnalysisProjectTransaction(
      directory,
      original.revision,
      prepared,
    );
    const loaded = loadAnalysisProjectSnapshot(directory);
    t.is(loaded.shards.labels[0]?.name, "Entry");
    t.deepEqual(loaded.revision, committed.revision);
    t.true(
      loaded.manifest.shards.every(({ path: shardPath }) =>
        shardPath.startsWith(`analysis/generations/${prepared.generation}/`),
      ),
    );

    const stalePrepared = prepareAnalysisProjectTransaction(directory, projectFor(rom));
    const error = t.throws(() =>
      commitPreparedAnalysisProjectTransaction(directory, original.revision, stalePrepared),
    );
    t.true(error instanceof AnalysisProjectStaleError);
    t.is(loadAnalysisProject(directory).shards.labels[0]?.name, "Entry");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("project transactions reject active locks and recover bounded dead-process locks", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-lock-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const prepared = prepareAnalysisProjectTransaction(directory, projectFor(rom));
    const lockDirectory = path.join(directory, ANALYSIS_PROJECT_LOCK_DIRECTORY);
    await fs.mkdir(lockDirectory);
    await fs.writeFile(
      path.join(lockDirectory, "owner.json"),
      canonicalJson({
        format: "uttori-asm-analysis-lock",
        version: 1,
        token: "active-lock",
        processId: 4242,
        createdAtMilliseconds: 10_000,
      }),
    );
    const locked = t.throws(() =>
      commitPreparedAnalysisProjectTransaction(directory, snapshot.revision, prepared, {
        now: () => 10_001,
        processIsAlive: () => true,
        staleLockMilliseconds: 1_000,
      }),
    );
    t.true(locked instanceof AnalysisProjectLockedError);

    const committed = commitPreparedAnalysisProjectTransaction(
      directory,
      snapshot.revision,
      prepared,
      {
        now: () => 20_000,
        processIsAlive: () => false,
        staleLockMilliseconds: 1_000,
      },
    );
    t.is(
      loadAnalysisProjectSnapshot(directory).revision.manifestSha256,
      committed.revision.manifestSha256,
    );
    await t.throwsAsync(fs.access(lockDirectory));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
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
