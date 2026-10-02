import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  acceptedSourceGeneration,
  verifySourceGeneration,
  retainSourceGeneration,
  type SourceGenerationInputs,
} from "../../src/source-project/generation.js";
import {
  sourceGit,
  sourceRepository,
  sourceStatus,
  type SourceRepository,
} from "../../src/source-project/git.js";
import {
  abortSourceGeneration,
  discardSourceGeneration,
  adoptSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  previewSourceGeneration,
  sourceMergeStatus,
  type SourceBuildVerification,
} from "../../src/source-project/merge.js";
import { pruneSourcePins } from "../../src/source-project/pins.js";
import { createSourceScratch, pruneSourceScratch } from "../../src/source-project/scratch.js";

const inputs: SourceGenerationInputs = {
  project: "fixture",
  romSha256: "a".repeat(64),
  evidenceSha256: "b".repeat(64),
  researchSha256: "c".repeat(64),
  toolchainSha256: "d".repeat(64),
  optionsSha256: "e".repeat(64),
};

/** Fixtures deliberately use real Git so index stages, ancestry, and abort behavior are observable. */
async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-git-source-"));
  await sourceGit(root, ["init", "-b", "main"]);
  await sourceGit(root, ["config", "user.name", "Fixture"]);
  await sourceGit(root, ["config", "user.email", "fixture@localhost"]);
  fs.writeFileSync(path.join(root, "main.asm"), "db $01\ndb $02\ndb $03\ndb $04\ndb $05\n");
  fs.writeFileSync(path.join(root, "notes.md"), "User research\n");
  const repository = await sourceRepository(root);
  await commit(repository, "Initial source");
  const baseline = await retainSourceGeneration(repository, {
    inputs,
    files: [{ path: "main.asm", bytes: fs.readFileSync(path.join(root, "main.asm")) }],
  });
  await adoptSourceGeneration(repository, baseline);
  await finishSourceGeneration(repository, {
    message: "Adopt verified baseline",
    validate: verification,
  });
  return { repository, baseline };
}

/** A compact test receipt stands in for target-specific ROM/layout validation. */
async function verification(): Promise<SourceBuildVerification> {
  return {
    outputSha256: "1".repeat(64),
    debugMapSha256: "2".repeat(64),
    toolchainSha256: "3".repeat(64),
    checks: ["fixture"],
  };
}

async function commit(repository: SourceRepository, message: string): Promise<void> {
  await sourceGit(repository.root, ["add", "--all"]);
  await sourceGit(repository.root, ["commit", "-m", message]);
}

/** A child may die after a successful Git write; the parent asserts durable state without its memory. */
async function faultWorker(request: Record<string, unknown>) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-fault-"));
  const file = path.join(directory, "request.json");
  fs.writeFileSync(file, JSON.stringify(request));
  try {
    return await new Promise<{ code: number | null; signal: string | null; stderr: string }>(
      (resolve, reject) => {
        const worker = spawn(
          process.execPath,
          [
            "--conditions=uttori-source",
            "--import=tsx",
            path.resolve("packages/disassembler/tests/source-project/fixtures/fault-worker.mjs"),
            file,
          ],
          { stdio: ["ignore", "ignore", "pipe"] },
        );
        let stderr = "";
        worker.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        worker.once("error", reject);
        worker.once("exit", (code, signal) => resolve({ code, signal, stderr }));
      },
    );
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

for (const failure of ["journal", "merge", "validation", "commit", "disk-full"] as const) {
  test(`native merge recovery after ${failure} interruption preserves source and honest status`, async (t) => {
    const { repository, baseline } = await fixture();
    t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
    const incoming = await retainSourceGeneration(repository, {
      inputs,
      parent: baseline.commit,
      files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
    });
    const preview = await previewSourceGeneration(repository, incoming.commit);
    const before = (await sourceMergeStatus(repository)).head;
    if (failure === "validation" || failure === "commit") {
      await applySourceGeneration(repository, incoming, preview);
    }
    const result = await faultWorker({
      root: repository.root,
      generation: incoming,
      preview,
      action: failure === "validation" || failure === "commit" ? "finish" : "apply",
      killAfterJournal: failure === "journal",
      diskFull: failure === "disk-full",
      killDuringValidation: failure === "validation",
      killAfterGit: failure === "merge" || failure === "commit" ? failure : undefined,
      verification: await verification(),
    });
    if (failure === "disk-full") {
      t.not(result.code, 0);
      t.regex(result.stderr, /ENOSPC/);
    } else {
      t.is(result.signal, "SIGKILL", result.stderr);
    }
    const status = await sourceMergeStatus(await sourceRepository(repository.root));
    if (failure === "commit") {
      t.is(status.phase, "verified");
      t.not(status.head, before);
      t.is(await acceptedSourceGeneration(repository, status.head), incoming.commit);
    } else if (failure === "merge" || failure === "validation") {
      t.is(status.phase, "merging");
      t.is(status.head, before);
      t.is(
        (
          await finishSourceGeneration(repository, {
            message: "Recovered verified merge",
            validate: verification,
          })
        ).phase,
        "verified",
      );
    } else {
      t.is(status.head, before);
      t.is(status.phase, failure === "journal" ? "checkpoint" : "verified");
      t.is(
        fs.readFileSync(path.join(repository.root, "main.asm"), "utf8"),
        "db $01\ndb $02\ndb $03\ndb $04\ndb $05\n",
      );
      if (failure === "journal") {
        // The process died before Git started a merge, so there is nothing to
        // abort. Reusing the unchanged checkpoint must reclaim its dead lease.
        await applySourceGeneration(repository, incoming, preview);
        t.is(
          (
            await finishSourceGeneration(repository, {
              message: "Retry interrupted start",
              validate: verification,
            })
          ).phase,
          "verified",
        );
      }
    }
    t.is((await sourceStatus(repository)).length, 0);
  });
}

for (const boundary of ["hash-object", "commit-tree", "update-ref"] as const) {
  test(`generation worker killed after ${boundary} keeps source intact and reclaims private temporary files`, async (t) => {
    const { repository, baseline } = await fixture();
    t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
    const head = (await sourceMergeStatus(repository)).head;
    const result = await faultWorker({
      root: repository.root,
      action: "retain",
      inputs,
      parent: baseline.commit,
      killAfterGit: boundary,
    });
    t.is(result.signal, "SIGKILL", result.stderr);
    const retained = (
      await sourceGit(repository.root, [
        "for-each-ref",
        "--format=%(objectname)",
        "refs/uttori/candidates/",
      ])
    ).stdout
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    t.is(retained.length, boundary === "update-ref" ? 1 : 0);
    if (retained.length) {
      t.is((await verifySourceGeneration(repository, retained[0])).files.length, 1);
    }
    t.is((await sourceMergeStatus(repository)).head, head);
    t.is((await sourceStatus(repository)).length, 0);
    const cleanup = pruneSourceScratch(repository);
    t.is(cleanup.removed.length, 1, "A killed worker's private index/blobs are reclaimed.");
    t.deepEqual(cleanup.retained, []);
    if (retained.length) {
      await discardSourceGeneration(repository, retained[0]);
    }
  });
}

test("scratch cleanup retains active work, unknown directories and symlinks", async (t) => {
  const { repository } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const scratch = createSourceScratch(repository, "prepare");
  const unknown = path.join(repository.stateDirectory, "scratch", "unknown");
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "notes.txt"), "Unique data");
  const link = path.join(repository.stateDirectory, "scratch", "outside");
  fs.symlinkSync(repository.root, link, "dir");
  try {
    const cleanup = pruneSourceScratch(repository);
    t.deepEqual(cleanup.removed, []);
    t.is(cleanup.retained.length, 3);
    t.true(fs.existsSync(scratch.directory));
    t.is(fs.readFileSync(path.join(unknown, "notes.txt"), "utf8"), "Unique data");
    t.true(fs.lstatSync(link).isSymbolicLink());
  } finally {
    scratch.dispose();
  }
});

for (const boundary of ["payload", "active.lock", "owner.json", "directory"] as const) {
  test(`scratch cleanup killed after ${boundary} resumes without losing ownership or source`, async (t) => {
    const { repository } = await fixture();
    t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
    const active = createSourceScratch(repository, "prepare");
    t.teardown(() => active.dispose());
    fs.writeFileSync(path.join(active.directory, "live-work"), "Live operation");
    const parent = path.dirname(active.directory);
    const unknown = path.join(parent, "unknown");
    fs.mkdirSync(unknown);
    fs.writeFileSync(path.join(unknown, "research"), "Retain unrecognized data");
    const before = {
      head: (await sourceMergeStatus(repository)).head,
      index: fs.readFileSync(path.join(repository.gitDirectory, "index")),
      refs: (await sourceGit(repository.root, ["show-ref"])).stdout,
      source: fs.readFileSync(path.join(repository.root, "main.asm")),
    };
    t.is((await faultWorker({ root: repository.root, action: "scratch" })).signal, "SIGKILL");
    const entry = fs
      .readdirSync(parent)
      .find((name) => name !== path.basename(active.directory) && name !== "unknown");
    t.truthy(entry);
    const directory = path.join(parent, entry!);
    const result = await faultWorker({
      root: repository.root,
      action: "clean",
      cleanupDirectory: directory,
      killCleanup: boundary,
    });
    t.is(result.signal, "SIGKILL", result.stderr);
    const retried = pruneSourceScratch(repository);
    t.deepEqual(retried.removed, boundary === "directory" ? [] : [directory]);
    t.deepEqual(
      retried.retained.map((item) => item.path).toSorted(),
      [active.directory, unknown].toSorted(),
    );
    t.false(fs.existsSync(directory));
    t.is(fs.readFileSync(path.join(active.directory, "live-work"), "utf8"), "Live operation");
    t.is(fs.readFileSync(path.join(unknown, "research"), "utf8"), "Retain unrecognized data");
    t.is((await sourceMergeStatus(repository)).head, before.head);
    t.deepEqual(fs.readFileSync(path.join(repository.gitDirectory, "index")), before.index);
    t.deepEqual((await sourceGit(repository.root, ["show-ref"])).stdout, before.refs);
    t.deepEqual(fs.readFileSync(path.join(repository.root, "main.asm")), before.source);
    t.is((await sourceStatus(repository)).length, 0);
    t.deepEqual(pruneSourceScratch(repository).removed, []);
  });
}

test("pin cleanup requires removed linked-worktree administration and keeps live or unknown owners", async (t) => {
  const { repository, baseline } = await fixture();
  const linkedPath = repository.root + "-linked";
  const hiddenPath = linkedPath + "-offline";
  t.teardown(() => {
    for (const directory of [repository.root, linkedPath, hiddenPath]) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  await sourceGit(repository.root, ["worktree", "add", "-b", "disposable", linkedPath]);
  const linked = await sourceRepository(linkedPath);
  const options = {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
  };
  const currentCandidate = await retainSourceGeneration(repository, options);
  const removedCandidate = await retainSourceGeneration(linked, options);
  const preview = await previewSourceGeneration(linked, removedCandidate.commit);
  const unknown = `refs/uttori/candidates/${"f".repeat(24)}-${currentCandidate.commit}`;
  await sourceGit(repository.root, ["update-ref", unknown, currentCandidate.commit]);
  const symbolic = removedCandidate.ref.replace(removedCandidate.commit, baseline.commit);
  await sourceGit(repository.root, ["symbolic-ref", symbolic, "refs/heads/main"]);
  const head = (await sourceMergeStatus(repository)).head;
  fs.renameSync(linkedPath, hiddenPath);
  t.deepEqual(
    (await pruneSourcePins(repository)).removed,
    [],
    "An offline checkout is not a deleted worktree.",
  );
  fs.renameSync(hiddenPath, linkedPath);
  await sourceGit(repository.root, ["worktree", "remove", linkedPath]);
  const cleanup = await pruneSourcePins(repository);
  t.deepEqual(cleanup.removed.toSorted(), [removedCandidate.ref, preview.ref!].toSorted());
  t.deepEqual(cleanup.retained.toSorted(), [currentCandidate.ref, unknown, symbolic].toSorted());
  t.is(
    (await sourceMergeStatus(repository)).head,
    head,
    "Cleanup must never dereference a replaced pin into a source branch.",
  );
  t.deepEqual((await pruneSourcePins(repository)).removed, []);
  await sourceGit(repository.root, ["gc", "--prune=now"]);
  t.is((await verifySourceGeneration(repository, currentCandidate.commit)).files.length, 1);
  t.is((await sourceStatus(repository)).length, 0);
});

for (const count of [1, 2]) {
  test(`pin cleanup resumes after a worker dies after ref deletion ${count}`, async (t) => {
    const { repository, baseline } = await fixture();
    const linkedPath = repository.root + "-cleanup";
    t.teardown(() => {
      for (const directory of [repository.root, linkedPath]) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
    await sourceGit(repository.root, ["worktree", "add", "--detach", linkedPath]);
    const linked = await sourceRepository(linkedPath);
    const incoming = await retainSourceGeneration(linked, {
      inputs,
      parent: baseline.commit,
      files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
    });
    const preview = await previewSourceGeneration(linked, incoming.commit);
    const before = (await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout;
    await sourceGit(repository.root, ["worktree", "remove", linkedPath]);
    const result = await faultWorker({
      root: repository.root,
      action: "clean-pins",
      killAfterGit: "update-ref",
      killAfterGitCount: count,
    });
    t.is(result.signal, "SIGKILL", result.stderr);
    const remaining = await pruneSourcePins(repository);
    t.deepEqual(remaining.removed, count === 1 ? [preview.ref!] : []);
    t.deepEqual(remaining.retained, []);
    t.deepEqual(await pruneSourcePins(repository), { removed: [], retained: [] });
    const id = incoming.ref.split("/").at(-1)!.slice(0, 24);
    t.false(
      fs.existsSync(path.join(repository.gitDirectory, "uttori-source/pin-owners", `${id}.json`)),
    );
    t.deepEqual((await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout, before);
    await sourceGit(repository.root, ["gc", "--prune=now"]);
    t.is(await acceptedSourceGeneration(repository, before.toString().trim()), baseline.commit);
    t.is((await sourceStatus(repository)).length, 0);
  });
}

test("squashing away pure ancestry is rejected even when the descriptor and source tree survive", async (t) => {
  const { repository } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const tree = (await sourceGit(repository.root, ["write-tree"])).stdout.toString().trim();
  const squashed = (
    await sourceGit(repository.root, ["commit-tree", tree], { input: "Squashed source\n" })
  ).stdout
    .toString()
    .trim();
  const before = (await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  await sourceGit(repository.root, ["update-ref", "refs/heads/main", squashed, before]);
  await t.throwsAsync(acceptedSourceGeneration(repository, squashed), {
    message: /missing from source ancestry/,
  });
  t.is((await sourceMergeStatus(repository)).phase, "diverged");
  t.is((await sourceStatus(repository)).length, 0);
});

test("discard releases candidate and preview pins while merged baselines remain cloneable", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
  });
  const preview = await previewSourceGeneration(repository, incoming.commit);
  const head = (await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  await discardSourceGeneration(repository, incoming.commit);
  const refs = (
    await sourceGit(repository.root, ["for-each-ref", "--format=%(refname)", "refs/uttori/"])
  ).stdout.toString();
  t.false(refs.includes(incoming.ref));
  t.false(refs.includes(preview.ref!));
  await sourceGit(repository.root, ["gc", "--prune=now"]);
  t.is(await acceptedSourceGeneration(repository, head), baseline.commit);
  t.is((await sourceStatus(repository)).length, 0);
});

test("native regeneration keeps edits, advances ancestry, and survives an ordinary clone", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const file = path.join(repository.root, "main.asm");
  fs.writeFileSync(file, "db $09\ndb $02\ndb $03\ndb $04\ndb $05\n");
  await commit(repository, "Edit first instruction");
  const incoming = await retainSourceGeneration(repository, {
    inputs: { ...inputs, evidenceSha256: "f".repeat(64) },
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\ndb $02\ndb $03\ndb $04\ndb $06\n") }],
  });
  const preview = await previewSourceGeneration(repository, incoming.commit);
  t.deepEqual(preview.conflicts, []);
  t.is(fs.readFileSync(file, "utf8"), "db $09\ndb $02\ndb $03\ndb $04\ndb $05\n");
  await applySourceGeneration(repository, incoming, preview);
  t.is(fs.readFileSync(file, "utf8"), "db $09\ndb $02\ndb $03\ndb $04\ndb $06\n");
  t.is(
    (
      await finishSourceGeneration(repository, {
        message: "Integrate capture",
        validate: verification,
      })
    ).phase,
    "verified",
  );
  t.is(
    await acceptedSourceGeneration(repository, (await sourceMergeStatus(repository)).head),
    incoming.commit,
  );
  t.is(fs.readFileSync(path.join(repository.root, "notes.md"), "utf8"), "User research\n");
  const clone = repository.root + "-clone";
  t.teardown(() => fs.rmSync(clone, { recursive: true, force: true }));
  await sourceGit(repository.root, ["clone", "--no-local", repository.root, clone]);
  const cloned = await sourceRepository(clone);
  const head = (await sourceMergeStatus(cloned)).head;
  t.is(await acceptedSourceGeneration(cloned, head), incoming.commit);
});

for (const renamed of ["engine.asm", "Main.asm"]) {
  test(`source rename to ${renamed} survives repeated incoming edits without recreating the old path`, async (t) => {
    const { repository, baseline } = await fixture();
    t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
    // Use Git's explicit rename so the case-only scenario also works on a case-insensitive volume.
    await sourceGit(repository.root, ["mv", "-f", "main.asm", renamed]);
    await commit(repository, "Rename editable source");
    let parent = baseline.commit;
    for (const [identity, value] of [
      ["f", "06"],
      ["0", "07"],
    ]) {
      const bytes = Buffer.from(`db $01\ndb $02\ndb $03\ndb $04\ndb $${value}\n`);
      const incoming = await retainSourceGeneration(repository, {
        inputs: { ...inputs, evidenceSha256: identity.repeat(64) },
        parent,
        files: [{ path: "main.asm", bytes }],
      });
      const preview = await previewSourceGeneration(repository, incoming.commit);
      t.deepEqual(preview.conflicts, []);
      await applySourceGeneration(repository, incoming, preview);
      await finishSourceGeneration(repository, {
        message: "Update renamed source",
        validate: verification,
      });
      t.deepEqual(fs.readFileSync(path.join(repository.root, renamed)), bytes);
      const paths = (await sourceGit(repository.root, ["ls-files", "-z"])).stdout
        .toString()
        .split("\0");
      t.true(paths.includes(renamed));
      t.false(paths.includes("main.asm"));
      parent = incoming.commit;
    }
  });
}

test("identical generation is a no-op and customized commits cannot become pure parents", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const same = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: fs.readFileSync(path.join(repository.root, "main.asm")) }],
  });
  t.is(same.commit, baseline.commit);
  const preview = await previewSourceGeneration(repository, same.commit);
  const before = (await sourceMergeStatus(repository)).head;
  await applySourceGeneration(repository, same, preview);
  t.is((await sourceMergeStatus(repository)).head, before);
  await t.throwsAsync(verifySourceGeneration(repository, before), { message: /payload differs/ });
  await t.throwsAsync(retainSourceGeneration(repository, { inputs, parent: before, files: [] }), {
    message: /payload differs/,
  });
});

test("unsaved preview includes editor buffers and cannot apply before those bytes are checkpointed", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const file = path.join(repository.root, "main.asm");
  const before = fs.readFileSync(file);
  const staged = (await sourceGit(repository.root, ["ls-files", "--stage", "-z"])).stdout;
  const incoming = await retainSourceGeneration(repository, {
    inputs: { ...inputs, evidenceSha256: "f".repeat(64) },
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\ndb $02\ndb $03\ndb $04\ndb $06\n") }],
  });
  const overlay = Buffer.from("db $09\ndb $02\ndb $03\ndb $04\ndb $05\n");
  const preview = await previewSourceGeneration(repository, incoming.commit, [
    { path: "main.asm", bytes: overlay },
  ]);
  t.deepEqual(preview.conflicts, []);
  t.is(
    (
      await sourceGit(repository.root, ["show", `${preview.resultTree}:main.asm`])
    ).stdout.toString(),
    "db $09\ndb $02\ndb $03\ndb $04\ndb $06\n",
  );
  t.deepEqual(fs.readFileSync(file), before);
  t.deepEqual((await sourceGit(repository.root, ["ls-files", "--stage", "-z"])).stdout, staged);
  await t.throwsAsync(applySourceGeneration(repository, incoming, preview), {
    message: /preview is stale/,
  });
  fs.writeFileSync(file, overlay);
  await commit(repository, "Checkpoint editor text");
  await applySourceGeneration(repository, incoming, preview);
  t.is((await sourceMergeStatus(repository)).phase, "merging");
  await abortSourceGeneration(repository);
  t.deepEqual(fs.readFileSync(file), overlay);
});

test("binary and delete conflicts use native index stages and survive garbage collection", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const first = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [
      { path: "main.asm", bytes: fs.readFileSync(path.join(repository.root, "main.asm")) },
      { path: "assets/name with\ttab.bin", bytes: Uint8Array.of(0, 1, 2, 3) },
    ],
  });
  await applySourceGeneration(
    repository,
    first,
    await previewSourceGeneration(repository, first.commit),
  );
  await finishSourceGeneration(repository, { message: "Add binary", validate: verification });
  fs.writeFileSync(
    path.join(repository.root, "assets/name with\ttab.bin"),
    Uint8Array.of(0, 9, 2, 3),
  );
  fs.writeFileSync(path.join(repository.root, "main.asm"), "db $09\n");
  await commit(repository, "Edit binary and source");
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: first.commit,
    files: [{ path: "assets/name with\ttab.bin", bytes: Uint8Array.of(0, 8, 2, 3) }],
  });
  const preview = await previewSourceGeneration(repository, incoming.commit);
  t.deepEqual([...preview.conflicts].toSorted(), ["assets/name with\ttab.bin", "main.asm"]);
  await sourceGit(repository.root, ["gc", "--prune=now"]);
  t.is(
    (await sourceGit(repository.root, ["rev-parse", `${preview.ref}^{tree}`])).stdout
      .toString()
      .trim(),
    preview.resultTree,
  );
  await applySourceGeneration(repository, incoming, preview);
  t.deepEqual(
    (await sourceGit(repository.root, ["show", ":1:assets/name with\ttab.bin"])).stdout,
    Buffer.from([0, 1, 2, 3]),
  );
  t.deepEqual(
    (await sourceGit(repository.root, ["show", ":2:assets/name with\ttab.bin"])).stdout,
    Buffer.from([0, 9, 2, 3]),
  );
  t.deepEqual(
    (await sourceGit(repository.root, ["show", ":3:assets/name with\ttab.bin"])).stdout,
    Buffer.from([0, 8, 2, 3]),
  );
  await sourceGit(repository.root, ["merge", "--abort"]);
  t.is((await sourceMergeStatus(repository)).phase, "checkpoint");
  t.is(fs.readFileSync(path.join(repository.root, "main.asm"), "utf8"), "db $09\n");
});

test("linked worktrees keep separate recovery state and reject a stale preview", async (t) => {
  const { repository, baseline } = await fixture();
  const linkedPath = repository.root + " linked";
  t.teardown(() => {
    fs.rmSync(linkedPath, { recursive: true, force: true });
    fs.rmSync(repository.root, { recursive: true, force: true });
  });
  await sourceGit(repository.root, ["worktree", "add", "-b", "linked", linkedPath]);
  const linked = await sourceRepository(linkedPath);
  t.not(linked.stateDirectory, repository.stateDirectory);
  const incoming = await retainSourceGeneration(linked, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\ndb $02\ndb $03\ndb $04\ndb $06\n") }],
  });
  const preview = await previewSourceGeneration(linked, incoming.commit);
  fs.writeFileSync(path.join(linkedPath, "notes.md"), "Another research checkpoint\n");
  await commit(linked, "Research");
  await t.throwsAsync(applySourceGeneration(linked, incoming, preview), { message: /stale/ });
  await applySourceGeneration(
    linked,
    incoming,
    await previewSourceGeneration(linked, incoming.commit),
  );
  t.is((await sourceMergeStatus(linked)).phase, "merging");
  t.is((await sourceMergeStatus(repository)).phase, "verified");
  await abortSourceGeneration(linked);
});

test("discard in one worktree cannot release another worktree's identical candidate", async (t) => {
  const { repository, baseline } = await fixture();
  const linkedPath = repository.root + "-linked";
  t.teardown(() => {
    fs.rmSync(linkedPath, { recursive: true, force: true });
    fs.rmSync(repository.root, { recursive: true, force: true });
  });
  await sourceGit(repository.root, ["worktree", "add", "-b", "linked", linkedPath]);
  const linked = await sourceRepository(linkedPath);
  const options = {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $99\n") }],
  };
  const first = await retainSourceGeneration(repository, options);
  const second = await retainSourceGeneration(linked, options);
  t.is(first.commit, second.commit);
  t.not(first.ref, second.ref);
  await discardSourceGeneration(repository, first.commit);
  await sourceGit(repository.root, ["gc", "--prune=now"]);
  t.is(
    (await sourceGit(linked.root, ["rev-parse", second.ref])).stdout.toString().trim(),
    second.commit,
  );
  await applySourceGeneration(linked, second, await previewSourceGeneration(linked, second.commit));
  await abortSourceGeneration(linked);
});

test("generation bytes ignore text filters and reject ambiguous portable names", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repository.root, ".gitattributes"), "*.asm text eol=lf\n");
  await commit(repository, "Configure source text");
  const bytes = Buffer.from("db $01\r\n");
  const candidate = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes }],
  });
  t.deepEqual(
    (await sourceGit(repository.root, ["show", `${candidate.commit}:main.asm`])).stdout,
    bytes,
  );
  for (const files of [
    [
      { path: "A.asm", bytes },
      { path: "a.asm", bytes },
    ],
    [{ path: "../outside.asm", bytes }],
    [{ path: ".git/config", bytes }],
  ]) {
    await t.throwsAsync(
      retainSourceGeneration(repository, { inputs, parent: baseline.commit, files }),
    );
  }
});

test("preview preserves partially staged edits and apply refuses until checkpointed", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const file = path.join(repository.root, "main.asm");
  fs.writeFileSync(file, "db $09\ndb $02\ndb $03\ndb $04\ndb $05\n");
  await sourceGit(repository.root, ["add", "main.asm"]);
  fs.appendFileSync(file, "; unfinished comment\n");
  const index = fs.readFileSync(path.join(repository.gitDirectory, "index"));
  const status = await sourceStatus(repository);
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\ndb $02\ndb $03\ndb $04\ndb $06\n") }],
  });
  const preview = await previewSourceGeneration(repository, incoming.commit);
  t.deepEqual(fs.readFileSync(path.join(repository.gitDirectory, "index")), index);
  t.deepEqual(await sourceStatus(repository), status);
  await t.throwsAsync(applySourceGeneration(repository, incoming, preview), {
    message: /Commit or move/,
  });
  await commit(repository, "Checkpoint edited source");
  await applySourceGeneration(repository, incoming, preview);
  await abortSourceGeneration(repository);
  t.true(fs.readFileSync(file, "utf8").endsWith("; unfinished comment\n"));
});

test("conflicts retain exact stages and abort restores the clean checkpoint", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const file = path.join(repository.root, "main.asm");
  fs.writeFileSync(file, "db $09\n");
  await commit(repository, "Local replacement");
  const checkpoint = (await sourceMergeStatus(repository)).head;
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $08\n") }],
  });
  const preview = await previewSourceGeneration(repository, incoming.commit);
  t.deepEqual(preview.conflicts, ["main.asm"]);
  const status = await applySourceGeneration(repository, incoming, preview);
  t.deepEqual(status.conflicts, ["main.asm"]);
  t.is((await sourceGit(repository.root, ["show", ":2:main.asm"])).stdout.toString(), "db $09\n");
  t.is((await sourceGit(repository.root, ["show", ":3:main.asm"])).stdout.toString(), "db $08\n");
  t.true(
    (await sourceGit(repository.root, ["show", ":1:main.asm"])).stdout
      .toString()
      .startsWith("db $01\n"),
  );
  await t.throwsAsync(
    finishSourceGeneration(repository, { message: "Invalid", validate: verification }),
    { message: /every merge conflict/ },
  );
  await abortSourceGeneration(repository);
  t.is((await sourceMergeStatus(repository)).head, checkpoint);
  t.is(fs.readFileSync(file, "utf8"), "db $09\n");
  t.is((await sourceStatus(repository)).length, 0);
});

test("a build failure or concurrent edit cannot finish a regeneration", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\n") }],
  });
  await applySourceGeneration(
    repository,
    incoming,
    await previewSourceGeneration(repository, incoming.commit),
  );
  await t.throwsAsync(
    finishSourceGeneration(repository, {
      message: "Fail",
      validate: async () => {
        throw new Error("Bank overflow");
      },
    }),
    { message: "Bank overflow" },
  );
  t.is((await sourceMergeStatus(repository)).phase, "merging");
  await t.throwsAsync(
    finishSourceGeneration(repository, {
      message: "Race",
      validate: async () => {
        fs.appendFileSync(path.join(repository.root, "main.asm"), "; concurrent edit\n");
        return verification();
      },
    }),
    { message: /changed during validation/ },
  );
  t.is((await sourceMergeStatus(repository)).phase, "merging");
});

test("terminal merge commits remain unverified until their exact tree passes validation", async (t) => {
  const { repository, baseline } = await fixture();
  t.teardown(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const incoming = await retainSourceGeneration(repository, {
    inputs,
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
  });
  await applySourceGeneration(
    repository,
    incoming,
    await previewSourceGeneration(repository, incoming.commit),
  );
  await sourceGit(repository.root, ["commit", "-m", "Finish from terminal"]);
  const committed = await sourceMergeStatus(repository);
  t.is(committed.phase, "committed");
  const reopened = await sourceRepository(repository.root);
  const finished = await finishSourceGeneration(reopened, {
    message: "Unused",
    validate: verification,
  });
  t.is(finished.phase, "verified");
  t.is(finished.head, committed.head);
  t.is(await acceptedSourceGeneration(reopened, finished.head), incoming.commit);
  // A later source checkpoint needs fresh validation, but the accepted merge already released its pin.
  fs.appendFileSync(path.join(repository.root, "main.asm"), "; reviewed after merge\n");
  await sourceGit(repository.root, ["add", "main.asm"]);
  await sourceGit(repository.root, ["commit", "-m", "Review the merged source"]);
  const later = await sourceMergeStatus(reopened);
  t.is(later.phase, "committed");
  const revalidated = await finishSourceGeneration(reopened, {
    message: "Unused",
    validate: verification,
  });
  t.is(revalidated.phase, "verified");
  t.is(revalidated.head, later.head);
  await discardSourceGeneration(reopened, incoming.commit);
  t.is(await acceptedSourceGeneration(reopened, later.head), incoming.commit);
  // Idempotence must not weaken compare-and-delete protection for a ref replaced by another writer.
  await sourceGit(repository.root, ["update-ref", incoming.ref, baseline.commit]);
  await t.throwsAsync(discardSourceGeneration(reopened, incoming.commit), {
    message: /Candidate pin could not be released/,
  });
  t.is(
    (await sourceGit(repository.root, ["rev-parse", incoming.ref])).stdout.toString().trim(),
    baseline.commit,
  );
});

test("deleted source stays deleted across unchanged generations and normal remote clones retain ancestry", async (t) => {
  const { repository, baseline } = await fixture();
  const bare = repository.root + "-remote.git";
  const cloned = repository.root + "-clone";
  const shallow = repository.root + "-shallow";
  t.teardown(() => {
    for (const directory of [repository.root, bare, cloned, shallow]) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  fs.rmSync(path.join(repository.root, "main.asm"));
  await commit(repository, "Remove obsolete source");
  const incoming = await retainSourceGeneration(repository, {
    inputs: { ...inputs, evidenceSha256: "9".repeat(64) },
    parent: baseline.commit,
    files: [{ path: "main.asm", bytes: Buffer.from("db $01\ndb $02\ndb $03\ndb $04\ndb $05\n") }],
  });
  await applySourceGeneration(
    repository,
    incoming,
    await previewSourceGeneration(repository, incoming.commit),
  );
  await finishSourceGeneration(repository, { message: "Keep deletion", validate: verification });
  t.false(fs.existsSync(path.join(repository.root, "main.asm")));
  await sourceGit(repository.root, ["init", "--bare", bare]);
  await sourceGit(repository.root, ["push", bare, "HEAD:refs/heads/main"]);
  await sourceGit(repository.root, ["clone", "--branch", "main", bare, cloned]);
  const remote = await sourceRepository(cloned);
  t.is(
    await acceptedSourceGeneration(remote, (await sourceMergeStatus(remote)).head),
    incoming.commit,
  );
  t.false(fs.existsSync(path.join(cloned, "main.asm")));
  await sourceGit(repository.root, [
    "clone",
    "--depth",
    "1",
    "--branch",
    "main",
    `file://${bare}`,
    shallow,
  ]);
  const truncated = await sourceRepository(shallow);
  await t.throwsAsync(
    acceptedSourceGeneration(truncated, (await sourceMergeStatus(truncated)).head),
    { message: /missing from source ancestry/ },
  );
});
