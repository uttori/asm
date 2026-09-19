import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AnalysisProjectStaleError,
  applyDisassemblyAnnotationEdit,
  commitAnalysisProjectAnnotationUpdate,
  commitAnalysisProjectTransaction,
  commitAnalysisProjectViewUpdate,
  loadAnalysisProjectSnapshot,
  loadAnalysisProjectViewSnapshot,
  loadSourceExportManifest,
  openAnalysisProjectStore,
  type ProjectLabel,
  type SqliteAnalysisStore,
} from "@uttori/asm-disassembler";
import {
  analyzeSnesProject,
  SnesProjectInitializationCancelledError,
} from "@uttori/asm-plugin-snes";

/** Compile-only checks: consumers must prepare asynchronous work outside a transaction. */
const checkCallbackTypes = (store: SqliteAnalysisStore): void => {
  // @ts-expect-error Async callbacks would escape the transaction's lifetime.
  void store.transaction(async () => 1);
  // @ts-expect-error Returning a Promise without async has the same lifetime problem.
  void store.transaction(() => Promise.resolve(1));
};
void checkCallbackTypes;

/** Synthetic LoROM with a reset vector into NOP/NOP/STP and an explicit cartridge header. */
const fixtureRom = (headerSize: number): Uint8Array => {
  // Unused vectors must not seed long accidental NOP paths; this fixture exercises storage.
  const content = new Uint8Array(0x8000).fill(0xdb);
  content.set([0xea, 0xea, 0xdb]);
  content.fill(0x20, 0x7fc0, 0x7fc0 + 0x15);
  content.set(new TextEncoder().encode("STORAGE FIXTURE"), 0x7fc0);
  content[0x7fd5] = 0x20;
  content[0x7fd7] = 5;
  content.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  content.fill(0, 0x7fe0);
  content.set([0, 0x80], 0x7ffc);
  const image = new Uint8Array(headerSize + content.length).fill(0x5a);
  image.set(content, headerSize);
  return image;
};

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-storage-consumer-"));
try {
  for (const headerSize of [0, 512]) {
    const romFile = path.join(scratch, `fixture-${headerSize}.sfc`);
    const workspace = path.join(scratch, `workflow-${headerSize}`);
    fs.writeFileSync(romFile, fixtureRom(headerSize));
    // Execute the actual guide, extracted by pack:check, with ordinary installed-package imports.
    const run = spawnSync(process.execPath, ["analysis-workflow.mjs", romFile, workspace], {
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(run.status, 0, `${run.error ?? ""}\n${run.stderr}\n${run.stdout}`);
    const source = path.join(workspace, "source");
    const manifest = loadSourceExportManifest(source);
    assert.deepEqual(
      fs.readFileSync(path.join(source, manifest.finalOutput)),
      fs.readFileSync(romFile),
    );
    assert.ok(
      manifest.files.some(
        ({ path: file }) =>
          file.endsWith(".asm") &&
          fs.readFileSync(path.join(source, file), "utf8").includes("ReviewedStart"),
      ),
    );
    assert.deepEqual(
      loadAnalysisProjectSnapshot(path.join(workspace, "restored")),
      loadAnalysisProjectSnapshot(path.join(workspace, "analysis")),
    );
  }

  const directory = path.join(scratch, "workflow-0", "analysis");
  const original = loadAnalysisProjectSnapshot(directory);
  const runtime = [
    {
      id: "capture.pc",
      kind: "runtime-execution" as const,
      architecture: "fixture",
      addressSpace: "rom.file",
      address: 1,
      count: 7,
      evidence: ["capture"],
    },
  ];
  commitAnalysisProjectTransaction(directory, original.revision, {
    manifest: original.manifest,
    shards: {
      ...original.shards,
      evidence: [
        ...original.shards.evidence,
        {
          id: "capture",
          source: "runtime",
          sourceId: "fixture",
          confidence: "certain",
        },
      ],
      runtime,
    },
  });
  const snapshot = loadAnalysisProjectViewSnapshot(directory);
  assert.deepEqual(snapshot.view.runtime, []);
  const edit = applyDisassemblyAnnotationEdit(
    { manifest: snapshot.manifest, shards: snapshot.view },
    {
      addressSpace: "rom.file",
      address: 0,
      labelId: "manual.reviewed-start",
      name: "SavedStart",
      comment: "Retained through backup.",
      evidenceId: "manual.rename",
      sourceId: "installed-consumer",
    },
  );
  const updates = {
    labels: edit.project.shards.labels,
    comments: edit.project.shards.comments,
    evidence: edit.project.shards.evidence,
  };
  commitAnalysisProjectAnnotationUpdate(directory, snapshot.revision, updates);
  const saved = loadAnalysisProjectSnapshot(directory);
  assert.deepEqual(saved.shards.runtime, runtime);
  assert.deepEqual(saved.shards.analysis, original.shards.analysis);
  assert.throws(
    () => commitAnalysisProjectAnnotationUpdate(directory, snapshot.revision, updates),
    AnalysisProjectStaleError,
  );
  assert.throws(() =>
    commitAnalysisProjectAnnotationUpdate(directory, saved.revision, {
      ...updates,
      labels: updates.labels.map((label) => ({
        ...label,
        address: -1,
      })),
    }),
  );
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), saved);

  const view = loadAnalysisProjectViewSnapshot(directory);
  const labels = view.view.labels as ProjectLabel[];
  labels.push({
    id: "extra",
    name: "Extra",
    addressSpace: "rom.file",
    address: 1,
    evidence: ["capture"],
  });
  commitAnalysisProjectViewUpdate(directory, view, { labels });
  const beforeFailure = loadAnalysisProjectSnapshot(directory);
  assert.deepEqual(
    beforeFailure.shards.labels.find(({ id }) => id === "extra"),
    labels.at(-1),
  );
  assert.deepEqual(
    beforeFailure.shards.labels.filter(({ id }) => id !== "extra"),
    saved.shards.labels,
  );
  const store = openAnalysisProjectStore(directory);
  try {
    const failure = new Error("transaction failure");
    assert.throws(
      () =>
        store.transaction(() => {
          store.replaceTables({ labels: [] });
          store.publishManifest(beforeFailure.manifest);
          throw failure;
        }),
      (error) => error === failure,
    );
    const controller = new AbortController();
    assert.throws(
      () =>
        store.transaction(() => {
          store.replaceTables({ labels: [] });
          store.publishManifest(beforeFailure.manifest);
          controller.abort(failure);
          controller.signal.throwIfAborted();
        }),
      (error) => error === failure,
    );
    // Untyped JavaScript callers also get a runtime guard, after their synchronous writes roll back.
    const asyncAction = async (): Promise<boolean> => {
      store.replaceTables({ labels: [] });
      store.publishManifest(beforeFailure.manifest);
      return true;
    };
    assert.throws(() => store.transaction(asyncAction as unknown as () => boolean), /synchronous/);
  } finally {
    store.close();
  }
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), beforeFailure);

  // Process termination bypasses the JavaScript catch/finally path and exercises SQLite recovery.
  const interrupted = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { openAnalysisProjectStore } from "@uttori/asm-disassembler";
    const store = openAnalysisProjectStore(process.argv[1]);
    store.transaction(() => {
      store.replaceTables({ labels: [] });
      store.publishManifest(store.manifest());
      process.exit(17);
    });
  `,
      directory,
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(interrupted.status, 17, `${interrupted.error ?? ""}\n${interrupted.stderr}`);
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), beforeFailure);

  const cancellation = new AbortController();
  assert.throws(
    () =>
      analyzeSnesProject({
        projectDirectory: directory,
        romFile: path.join(scratch, "fixture-0.sfc"),
        signal: cancellation.signal,
        onProgress: ({ stage }) => {
          if (stage === "commit") {
            cancellation.abort();
          }
        },
      }),
    SnesProjectInitializationCancelledError,
  );
  assert.equal(cancellation.signal.aborted, true);
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), beforeFailure);

  const restored = path.join(scratch, "restored-runtime");
  fs.cpSync(directory, restored, { recursive: true, errorOnExist: true, force: false });
  assert.deepEqual(loadAnalysisProjectSnapshot(restored), beforeFailure);
  console.log(
    "Installed storage: edits, stale/invalid writes, rollback, cancellation, process recovery, backup, and guide round trips passed",
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
