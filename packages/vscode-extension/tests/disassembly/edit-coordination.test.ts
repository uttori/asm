import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireFileLease,
  loadSourceExportManifest,
  openAnalysisProjectStore,
  publishSourceGeneration,
  recoverSourceGeneration,
  sourceGenerationIdentity,
  validateSourceExportFiles,
  sourceExportSha256,
} from "@uttori/asm-disassembler";
import { exportSnesProject } from "@uttori/asm-plugin-snes";

import { test } from "../../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../../tests/helpers/ownership-fixture.js";
import {
  coordinateEdit,
  editOperations,
  metadataRefreshEligible,
} from "../../src/disassembly/edit-coordinator.js";
import { processMetadata, type MetadataWorkerInput } from "../../src/disassembly/metadata-data.js";
import { publishVerifiedSource } from "../../src/disassembly/source-publisher.js";

/** Reopen the connection for every request to model worker/editor restarts. */
const call = (f: ReturnType<typeof ownershipFixture>, input: MetadataWorkerInput): any => {
  const store = openAnalysisProjectStore(f.projectDirectory);
  try {
    return processMetadata(store, f.projectDirectory, {
      ...input,
      sourceDirectory: f.sourceDirectory,
    });
  } finally {
    store.close();
  }
};
const comment = (f: ReturnType<typeof ownershipFixture>, id: string): MetadataWorkerInput => ({
  action: "commit",
  sourceDirectory: f.sourceDirectory,
  revision: call(f, { action: "list" }).revision,
  request: {
    id,
    evidenceId: `evidence:${id}`,
    sourceId: "test",
    description: id,
    operations: [
      {
        kind: "put",
        shard: "comments",
        record: { id, addressSpace: "rom.file", address: 0x22, text: id, evidence: [] },
      },
    ],
  },
});

test("stable saves reconcile replay, retain raw drafts, and coalesce only known presentation revisions", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const initial = call(f, { action: "list" }).revision.manifestSha256;
  const intent = comment(f, "first");
  const result = call(f, intent);
  t.deepEqual(call(f, intent), result);
  t.throws(
    () => call(f, { ...intent, request: { ...intent.request!, description: "different" } }),
    { message: /different draft/ },
  );
  const second = call(f, comment(f, "second"));
  t.true(metadataRefreshEligible(f.projectDirectory, initial, second.revision.manifestSha256));
  t.is(editOperations(f.projectDirectory).length, 2);
  call(f, {
    action: "draft-save",
    draft: { id: "a", value: { invalidJSON: "{\n unfinished", originalRevision: initial } },
  });
  t.is(call(f, { action: "draft-list" })[0].value.invalidJSON, "{\n unfinished");
  const map = call(f, {
    action: "map-read",
    map: { name: "ram-map.json", beforeSha256: "", text: "" },
  });
  const mapIntent: MetadataWorkerInput = {
    action: "map-commit",
    operationId: randomUUID(),
    revision: second.revision,
    map: { name: "ram-map.json", beforeSha256: map.sha256, text: map.text + "\n" },
  };
  const mapped = call(f, mapIntent);
  t.deepEqual(call(f, mapIntent), mapped);
  t.is(fs.readFileSync(path.join(f.sourceDirectory, "ram-map.json"), "utf8"), map.text + "\n");
});

test("lost response after SQLite commit is acknowledged without applying the operation twice", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const intent = comment(f, "lost-response");
  // Simulate the durable intent surviving a killed process immediately before response delivery.
  const saved = call(f, intent);
  const journal = path.join(
    f.projectDirectory,
    ".editing",
    "operations",
    `${sourceExportSha256(intent.request!.id)}.json`,
  );
  const operation = JSON.parse(fs.readFileSync(journal, "utf8"));
  delete operation.result;
  operation.phase = "prepared";
  fs.writeFileSync(journal, JSON.stringify(operation));
  const store = openAnalysisProjectStore(f.projectDirectory);
  try {
    const result = coordinateEdit(store, f.projectDirectory, intent, () => {
      throw new Error("Must not replay");
    }) as typeof saved;
    t.true(result.reconciled);
    t.deepEqual(result.receipt, saved.receipt);
  } finally {
    store.close();
  }
  t.is(call(f, { action: "list" }).history.length, 1);
});

test("staged source is verified before publication; old generation is retained and valid", async (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  call(f, comment(f, "publish-comment"));
  const result = await publishVerifiedSource(
    {
      projectDirectory: f.projectDirectory,
      sourceDirectory: f.sourceDirectory,
      romFile: f.romFile,
      sourceManifest: loadSourceExportManifest(f.sourceDirectory),
    },
    new AbortController().signal,
    () => {},
  );
  t.teardown(() => {
    fs.rmSync(result.publication.previous, { recursive: true, force: true });
    fs.rmSync(result.publication.candidate, { recursive: true, force: true });
  });
  t.true(result.verified.comparison.equal);
  t.is(result.publication.phase, "published");
  t.notThrows(() => validateSourceExportFiles(f.sourceDirectory));
  t.notThrows(() => validateSourceExportFiles(result.publication.previous));
  t.true(fs.readFileSync(f.file, "utf8").includes("publish-comment"));
});

test("OS metadata is omitted from both stages and may change during verification", async (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  call(f, comment(f, "metadata-independent-publication"));
  const metadata = [
    ".DS_Store",
    "banks/.DS_Store",
    "banks/._bank-000.asm",
    "banks/THUMBS.DB",
    "desktop.ini",
    "ehthumbs.db",
    ".LSOverride",
    ".directory",
    ".AppleDouble/info",
    ".Spotlight-V100/index",
    ".Trashes/info",
    ".fseventsd/events",
    ".TemporaryItems/info",
    "__MACOSX/info",
    ".Trash-1000/info",
  ];
  for (const name of metadata) {
    const file = path.join(f.sourceDirectory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "before verification");
  }
  // Sidecars must be ignored before the regular-file guard, even when they are dangling links.
  const sidecar = path.join(f.sourceDirectory, "._main.asm");
  fs.symlinkSync("missing-os-metadata", sidecar);
  const hiddenInput = "banks/.project-input.inc";
  fs.writeFileSync(path.join(f.sourceDirectory, hiddenInput), "; hidden project input\n");
  let metadataChanged = false;
  const result = await publishVerifiedSource(
    {
      projectDirectory: f.projectDirectory,
      sourceDirectory: f.sourceDirectory,
      romFile: f.romFile,
      sourceManifest: loadSourceExportManifest(f.sourceDirectory),
    },
    new AbortController().signal,
    (message) => {
      if (message === "Verifying candidate ROM bytes before publication…") {
        for (const name of metadata) {
          fs.writeFileSync(path.join(f.sourceDirectory, name), "updated by OS");
        }
        fs.rmSync(path.join(f.sourceDirectory, ".DS_Store"));
        fs.writeFileSync(path.join(f.sourceDirectory, "banks/desktop.ini"), "new OS metadata");
        metadataChanged = true;
      }
    },
  );
  t.true(metadataChanged);
  t.true(result.verified.comparison.equal);
  t.is(result.publication.phase, "published");
  for (const stage of [result.publication.previous, result.publication.candidate]) {
    for (const name of [...metadata, "._main.asm", "banks/desktop.ini"]) {
      t.false(fs.existsSync(path.join(stage, name)), `${name} must not be staged`);
    }
    // lstat detects a dangling symlink, which existsSync would treat as absent.
    t.throws(() => fs.lstatSync(path.join(stage, "._main.asm")), { code: "ENOENT" });
    t.is(fs.readFileSync(path.join(stage, hiddenInput), "utf8"), "; hidden project input\n");
    t.notThrows(() => validateSourceExportFiles(stage));
  }
  t.is(fs.readFileSync(path.join(f.sourceDirectory, "banks/.DS_Store"), "utf8"), "updated by OS");
  t.false(fs.existsSync(path.join(f.sourceDirectory, ".DS_Store")));
  t.true(fs.lstatSync(sidecar).isSymbolicLink());
  t.notThrows(() => validateSourceExportFiles(f.sourceDirectory));
});

test("each publication interruption rejects readers and recovers old or completely published bytes", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const previous = fs.mkdtempSync(path.join(path.dirname(f.sourceDirectory), ".previous-test-"));
  const candidate = fs.mkdtempSync(path.join(path.dirname(f.sourceDirectory), ".candidate-test-"));
  t.teardown(() => {
    fs.rmSync(previous, { recursive: true, force: true });
    fs.rmSync(candidate, { recursive: true, force: true });
  });
  const manifest = loadSourceExportManifest(f.sourceDirectory);
  for (const root of [previous, candidate]) {
    for (const file of [
      ...manifest.files.map((entry) => entry.path),
      ...(manifest.inputs ?? []).map((entry) => entry.path),
      "generated-files.json",
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.copyFileSync(path.join(f.sourceDirectory, file), path.join(root, file));
    }
  }
  // Produce a legitimate candidate through the exporter, never edit a generated file by hand.
  call(f, comment(f, "interrupted-comment"));
  exportSnesProject({
    sourceDirectory: candidate,
    projectDirectory: f.projectDirectory,
    romFile: f.romFile,
  });
  // The asynchronous publisher is tested above; this journal test interrupts exact replacements.
  const changedFile = manifest.files.find((file) => file.kind === "source")!.path;
  const next = loadSourceExportManifest(candidate);
  const finalBoundary =
    new Set([...manifest.files, ...next.files].map((file) => file.path)).size +
    (next.inputs ?? []).filter((input) => !fs.existsSync(path.join(previous, input.path))).length;
  for (const boundary of Array.from({ length: finalBoundary + 1 }, (_, index) => index)) {
    t.throws(
      () =>
        publishSourceGeneration(
          f.sourceDirectory,
          previous,
          candidate,
          manifest.rom.sha256,
          (index) => {
            if (index === boundary) {
              throw new Error("worker killed");
            }
          },
        ),
      { message: "worker killed" },
    );
    t.throws(() => sourceGenerationIdentity(f.sourceDirectory), { message: /requires recovery/ });
    t.is(
      recoverSourceGeneration(f.sourceDirectory)?.phase,
      boundary === finalBoundary ? "published" : "rolled-back",
    );
    t.notThrows(() => validateSourceExportFiles(f.sourceDirectory));
  }
  for (const file of next.files) {
    if (!manifest.files.some((old) => old.path === file.path)) {
      fs.rmSync(path.join(f.sourceDirectory, file.path), { force: true });
    }
  }
  for (const file of [...manifest.files.map((entry) => entry.path), "generated-files.json"]) {
    fs.copyFileSync(path.join(previous, file), path.join(f.sourceDirectory, file));
  }
  t.throws(
    () =>
      publishSourceGeneration(f.sourceDirectory, previous, candidate, manifest.rom.sha256, () => {
        throw new Error("worker killed");
      }),
    { message: "worker killed" },
  );
  fs.appendFileSync(path.join(f.sourceDirectory, changedFile), "; external source draft\n");
  t.throws(() => recoverSourceGeneration(f.sourceDirectory), {
    message: /preserved external edits/,
  });
  t.true(
    fs
      .readFileSync(path.join(f.sourceDirectory, changedFile), "utf8")
      .endsWith("; external source draft\n"),
  );
});

test("per-project leases reject a live writer without affecting another project", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const lock = path.join(f.projectDirectory, ".editing", "writer.lock");
  const lease = acquireFileLease(lock);
  try {
    t.throws(() => call(f, comment(f, "locked")), { message: /operation owns/ });
    const other = acquireFileLease(`${lock}-other`);
    other.release();
    t.pass();
  } finally {
    lease.release();
  }
});

test("a killed writer's lease is reclaimed without deleting live locks", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const lock = path.join(f.projectDirectory, ".editing", "writer.lock");
  const child = spawnSync(process.execPath, [
    "--conditions=uttori-source",
    "--import=tsx",
    "--input-type=module",
    "-e",
    `
    import { acquireFileLease } from '@uttori/asm-disassembler';
    acquireFileLease(${JSON.stringify(lock)});
    process.kill(process.pid, 'SIGKILL');
  `,
  ]);
  t.is(child.signal, "SIGKILL");
  t.true(fs.existsSync(lock));
  const replacement = acquireFileLease(lock);
  try {
    t.throws(() => acquireFileLease(lock), { message: /operation owns/ });
  } finally {
    replacement.release();
  }
  t.false(fs.existsSync(lock));
});

test("failed candidate verification never exposes candidate source", async (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  call(f, comment(f, "unverified-candidate"));
  const before = fs.readFileSync(path.join(f.sourceDirectory, "generated-files.json"));
  await t.throwsAsync(
    publishVerifiedSource(
      {
        projectDirectory: f.projectDirectory,
        sourceDirectory: f.sourceDirectory,
        romFile: f.romFile,
        sourceManifest: loadSourceExportManifest(f.sourceDirectory),
      },
      new AbortController().signal,
      (message) => {
        if (message === "Verifying candidate ROM bytes before publication…") {
          const folder = path.join(f.projectDirectory, ".editing", "publications");
          const journal = JSON.parse(
            fs.readFileSync(path.join(folder, fs.readdirSync(folder)[0]), "utf8"),
          );
          // Deliberate fault injection into a disposable stage proves verification gates publication.
          fs.appendFileSync(
            path.join(journal.candidateDirectory, "main.asm"),
            "; corrupted stage\n",
          );
        }
      },
    ),
    { message: /Generated source differs/ },
  );
  t.deepEqual(fs.readFileSync(path.join(f.sourceDirectory, "generated-files.json")), before);
  t.notThrows(() => validateSourceExportFiles(f.sourceDirectory));
});

for (const input of ["ram-map.json", "banks/.project-input.inc"]) {
  test(`an edit to ${input} during verification preserves visible source and records the failed publication`, async (t) => {
    const f = ownershipFixture();
    t.teardown(f.cleanup);
    call(f, comment(f, "staged-only"));
    const before = fs.readFileSync(path.join(f.sourceDirectory, "generated-files.json"));
    const inputFile = path.join(f.sourceDirectory, input);
    if (!fs.existsSync(inputFile)) {
      fs.writeFileSync(inputFile, "; hidden project input\n");
    }
    const originalInput = fs.readFileSync(inputFile, "utf8");
    await t.throwsAsync(
      publishVerifiedSource(
        {
          projectDirectory: f.projectDirectory,
          sourceDirectory: f.sourceDirectory,
          romFile: f.romFile,
          sourceManifest: loadSourceExportManifest(f.sourceDirectory),
        },
        new AbortController().signal,
        (message) => {
          if (message === "Verifying candidate ROM bytes before publication…") {
            fs.appendFileSync(inputFile, "\n");
          }
        },
      ),
      {
        message: `Source input changed during staging: ${path.normalize(input)}. Visible source was preserved.`,
      },
    );
    t.deepEqual(fs.readFileSync(path.join(f.sourceDirectory, "generated-files.json")), before);
    t.is(fs.readFileSync(inputFile, "utf8"), originalInput + "\n");
    t.notThrows(() => validateSourceExportFiles(f.sourceDirectory));
    const folder = path.join(f.projectDirectory, ".editing", "publications");
    const journal = JSON.parse(
      fs.readFileSync(path.join(folder, fs.readdirSync(folder)[0]), "utf8"),
    );
    t.is(journal.phase, "failed");
    t.notThrows(() => validateSourceExportFiles(journal.previousDirectory));
    t.notThrows(() => validateSourceExportFiles(journal.candidateDirectory));
  });
}

test("map response recovery distinguishes a committed write from an external conflict", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const page = call(f, { action: "list" });
  const map = call(f, {
    action: "map-read",
    map: { name: "ram-map.json", beforeSha256: "", text: "" },
  });
  const id = randomUUID();
  const intent: MetadataWorkerInput = {
    action: "map-commit",
    operationId: id,
    revision: page.revision,
    map: { name: "ram-map.json", beforeSha256: map.sha256, text: map.text + "\n" },
  };
  const saved = call(f, intent);
  const journal = path.join(
    f.projectDirectory,
    ".editing",
    "operations",
    `${sourceExportSha256(id)}.json`,
  );
  const pending = JSON.parse(fs.readFileSync(journal, "utf8"));
  delete pending.result;
  pending.phase = "prepared";
  fs.writeFileSync(journal, JSON.stringify(pending));
  t.deepEqual(call(f, intent).receipt, saved.receipt);
  fs.writeFileSync(journal, JSON.stringify(pending));
  const file = path.join(f.sourceDirectory, "ram-map.json");
  fs.writeFileSync(file, "external draft with invalid JSON");
  t.throws(() => call(f, intent), { message: /changed outside this interrupted operation/ });
  t.is(fs.readFileSync(file, "utf8"), "external draft with invalid JSON");
  t.is(editOperations(f.projectDirectory)[0].phase, "conflict");
});
