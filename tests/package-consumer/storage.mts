import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AnalysisProjectStaleError,
  commitAnalysisProjectTransaction,
  commitAnalysisProjectViewUpdate,
  loadAnalysisProjectSnapshot,
  loadAnalysisProjectViewSnapshot,
  openAnalysisProjectStore,
  type ProjectLabel,
} from "@uttori/asm-disassembler";
import { sourceGit, openSourceProject } from "@uttori/asm-disassembler/source-project";
import type { PreparedSnesGeneration, SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import {
  analyzeSnesProject,
  SnesProjectInitializationCancelledError,
} from "@uttori/asm-plugin-snes/disassembler";
import { executeSourceOperation } from "@uttori/asm-workflows/source";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isSnesSourceBuild(value: unknown): value is SnesSourceBuild {
  return isRecord(value) && typeof value.outputFile === "string";
}

function isPreparedSnesGeneration(value: unknown): value is PreparedSnesGeneration {
  return (
    isRecord(value) && isRecord(value.generation) && typeof value.generation.commit === "string"
  );
}

function readPhase(value: unknown): string {
  if (!isRecord(value) || typeof value.phase !== "string") {
    throw new Error("Source apply result is missing its phase.");
  }
  return value.phase;
}

/** Synthetic LoROM with a reset vector into NOP/NOP/STP and an explicit cartridge header. */
const fixtureRom = (headerSize: number): Uint8Array => {
  // Unused vectors must not seed long accidental NOP paths. This fixture exercises storage.
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
    const built = await executeSourceOperation({
      action: "build",
      directory: source,
    });
    if (!isSnesSourceBuild(built)) {
      throw new Error("Source build did not return an output file.");
    }
    assert.deepEqual(
      fs.readFileSync(built.outputFile),
      fs.readFileSync(romFile).subarray(headerSize),
    );
    assert.ok(
      fs
        .readdirSync(path.join(source, "source/banks"))
        .some((file) =>
          fs
            .readFileSync(path.join(source, "source/banks", file), "utf8")
            .includes("ReviewedStart"),
        ),
    );
    assert.deepEqual(
      loadAnalysisProjectSnapshot(path.join(workspace, "restored")),
      loadAnalysisProjectSnapshot(path.join(source, ".uttori-local/evidence")),
    );
  }

  const sourceDirectory = path.join(scratch, "workflow-0", "source");
  const ramFile = path.join(sourceDirectory, "source/ram-map.json");
  const structFile = path.join(sourceDirectory, "source/struct-map.json");
  const ramInput = JSON.stringify({
    format: "uttori-asm-snes-ram-map",
    schemaVersion: 1,
    variables: [
      { name: "PlayerHealth", address: "$7E0100", size: 2, description: "Current health." },
    ],
  });
  const structInput = JSON.stringify({
    format: "uttori-asm-snes-struct-map",
    schemaVersion: 1,
    structures: [
      {
        id: "Stats",
        size: 3,
        fields: [
          { name: "hp", offset: 0, size: 2, type: "dw" },
          { name: "flags", offset: 2, size: 1, type: "db[1]" },
        ],
      },
    ],
    bindings: [
      { name: "Levels", structure: "Stats", address: 0x808100, fileOffset: 0x100, count: 2 },
    ],
  });
  fs.writeFileSync(ramFile, ramInput);
  fs.writeFileSync(structFile, structInput);
  // New recipe files must be explicit generation inputs before a pure render may read them.
  const generatorFile = path.join(sourceDirectory, ".uttori/generation-inputs.json");
  const generator = JSON.parse(fs.readFileSync(generatorFile, "utf8"));
  generator.recipes.push("struct-map.json");
  fs.writeFileSync(generatorFile, JSON.stringify(generator, null, 2) + "\n");
  await sourceGit(sourceDirectory, [
    "add",
    "source/ram-map.json",
    "source/struct-map.json",
    ".uttori/generation-inputs.json",
  ]);
  await sourceGit(sourceDirectory, ["commit", "-m", "Declare research maps"]);
  for (let pass = 0; pass < 2; pass++) {
    const prepared = await executeSourceOperation({
      action: "prepare",
      directory: sourceDirectory,
    });
    if (!isPreparedSnesGeneration(prepared)) {
      throw new Error("Source prepare did not return a generation commit.");
    }
    await executeSourceOperation({
      action: "preview",
      directory: sourceDirectory,
      candidate: prepared.generation.commit,
    });
    const applied = await executeSourceOperation({
      action: "apply",
      directory: sourceDirectory,
      candidate: prepared.generation.commit,
    });
    if (["merging", "committed"].includes(readPhase(applied))) {
      await executeSourceOperation({ action: "finish", directory: sourceDirectory });
    }
    assert.equal(fs.readFileSync(ramFile, "utf8"), ramInput);
    assert.equal(fs.readFileSync(structFile, "utf8"), structInput);
    assert.match(
      fs.readFileSync(path.join(sourceDirectory, "source/ram-defines.asm"), "utf8"),
      /PlayerHealth/,
    );
    assert.match(
      fs.readFileSync(path.join(sourceDirectory, "source/structs.asm"), "utf8"),
      /Levels/,
    );
    const built = await executeSourceOperation({
      action: "build",
      directory: sourceDirectory,
    });
    if (!isSnesSourceBuild(built)) {
      throw new Error("Source build did not return an output file.");
    }
    assert.deepEqual(
      fs.readFileSync(built.outputFile),
      fs.readFileSync(path.join(scratch, "fixture-0.sfc")),
    );
  }

  const directory = path.join(sourceDirectory, ".uttori-local/evidence");
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
  // Storage projection writes must retain runtime history and enforce optimistic revisions.
  // User-facing research authority is exercised through the Git-backed guide above.
  const updates = {
    labels: snapshot.view.labels.map((label) => ({ ...label, name: "SavedStart" })),
  };
  commitAnalysisProjectViewUpdate(directory, snapshot, updates);
  const saved = loadAnalysisProjectSnapshot(directory);
  assert.deepEqual(saved.shards.runtime, runtime);
  assert.deepEqual(saved.shards.analysis, original.shards.analysis);
  assert.throws(
    () => commitAnalysisProjectViewUpdate(directory, snapshot, updates),
    AnalysisProjectStaleError,
  );
  assert.throws(() =>
    commitAnalysisProjectViewUpdate(directory, loadAnalysisProjectViewSnapshot(directory), {
      ...updates,
      labels: updates.labels.map((label) => Object.assign({}, label, { address: -1 })),
    }),
  );
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), saved);

  const view = loadAnalysisProjectViewSnapshot(directory);
  const labels: ProjectLabel[] = [...view.view.labels];
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
    assert.throws(() => store.transaction(asyncAction), /synchronous/);
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

  const research = (await openSourceProject(sourceDirectory)).research;
  const cancellation = new AbortController();
  assert.throws(
    () =>
      analyzeSnesProject({
        projectDirectory: directory,
        research,
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
