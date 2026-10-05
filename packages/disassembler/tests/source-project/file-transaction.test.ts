import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "../../../../tests/ava-helper.js";
import {
  applySourceFileTransaction,
  readSourceFileTransaction,
  recoverSourceFileTransaction,
  sourceFilePublicationEpoch,
} from "../../src/source-project/file-transaction.js";
import type { SourceRepository } from "../../src/source-project/git.js";

/** A temporary source host needs no ROM, editor, Git commits or local research checkout. */
function fixture(): {
  repository: SourceRepository;
  changes: { path: string; before: Uint8Array; after: Uint8Array }[];
  cleanup: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-publication-"));
  fs.writeFileSync(path.join(root, "one.bin"), Uint8Array.of(1));
  fs.writeFileSync(path.join(root, "two.bin"), Uint8Array.of(2));
  return {
    repository: {
      root,
      gitDirectory: path.join(root, ".git"),
      stateDirectory: path.join(root, ".git/state"),
    },
    changes: [
      { path: "one.bin", before: Uint8Array.of(1), after: Uint8Array.of(3) },
      { path: "two.bin", before: Uint8Array.of(2), after: Uint8Array.of(4) },
    ],
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("no-edit publication changes neither bytes, modification times nor private state", (t) => {
  const { repository, changes, cleanup } = fixture();
  try {
    const file = path.join(repository.root, "one.bin"),
      before = fs.statSync(file, { bigint: true }).mtimeNs;
    t.is(
      applySourceFileTransaction(repository, [{ ...changes[0], after: changes[0].before }]),
      undefined,
    );
    t.deepEqual([...fs.readFileSync(file)], [1]);
    t.is(fs.statSync(file, { bigint: true }).mtimeNs, before);
    t.false(fs.existsSync(repository.stateDirectory));
  } finally {
    cleanup();
  }
});

test("accepted ordinary source replacements retain a complete durable receipt", (t) => {
  const { repository, changes, cleanup } = fixture();
  try {
    const result = applySourceFileTransaction(repository, changes);
    t.is(result?.state, "completed");
    t.deepEqual([...fs.readFileSync(path.join(repository.root, "one.bin"))], [3]);
    t.deepEqual(readSourceFileTransaction(repository), result);
    t.notThrows(() => sourceFilePublicationEpoch(repository));
  } finally {
    cleanup();
  }
});

test("interruption at every publication boundary blocks readers and recovery completes or rolls back exactly", (t) => {
  for (const boundary of ["staged", "publishing", "published:0", "published:1"]) {
    for (const direction of ["before", "after"] as const) {
      const { repository, changes, cleanup } = fixture();
      try {
        t.throws(() =>
          applySourceFileTransaction(repository, changes, {
            onStage(stage) {
              if (stage === boundary) {
                throw new Error("Simulated termination boundary");
              }
            },
          }),
        );
        t.throws(() => sourceFilePublicationEpoch(repository), { message: /recovery/ });
        t.is(recoverSourceFileTransaction(repository, direction)?.state, "completed");
        changes.forEach((change) =>
          t.deepEqual(
            fs.readFileSync(path.join(repository.root, change.path)),
            Buffer.from(change[direction]),
          ),
        );
        t.notThrows(() => sourceFilePublicationEpoch(repository));
      } finally {
        cleanup();
      }
    }
  }
});

test("third-party replacements prevent all recovery writes and stale proposals do not publish", (t) => {
  const { repository, changes, cleanup } = fixture();
  try {
    t.throws(() =>
      applySourceFileTransaction(repository, changes, {
        onStage(stage) {
          if (stage === "published:0") {
            throw new Error("Interrupt");
          }
        },
      }),
    );
    fs.writeFileSync(path.join(repository.root, "two.bin"), Uint8Array.of(99));
    t.throws(() => recoverSourceFileTransaction(repository, "before"), { message: /third-party/ });
    t.deepEqual([...fs.readFileSync(path.join(repository.root, "one.bin"))], [3]);
    t.deepEqual([...fs.readFileSync(path.join(repository.root, "two.bin"))], [99]);
  } finally {
    cleanup();
  }
  const fresh = fixture();
  try {
    fs.writeFileSync(path.join(fresh.repository.root, "two.bin"), Uint8Array.of(99));
    t.throws(() => applySourceFileTransaction(fresh.repository, fresh.changes), {
      message: /Stale/,
    });
    t.deepEqual([...fs.readFileSync(path.join(fresh.repository.root, "one.bin"))], [1]);
    t.is(readSourceFileTransaction(fresh.repository), undefined);
  } finally {
    fresh.cleanup();
  }
});

test("cancellation and path redirection preserve source data", (t) => {
  const { repository, changes, cleanup } = fixture();
  try {
    const controller = new AbortController();
    controller.abort();
    t.throws(() => applySourceFileTransaction(repository, changes, { signal: controller.signal }));
    t.false(fs.existsSync(repository.stateDirectory));
    fs.symlinkSync(path.join(repository.root, "one.bin"), path.join(repository.root, "alias.bin"));
    t.throws(() => applySourceFileTransaction(repository, [{ ...changes[0], path: "alias.bin" }]), {
      message: /regular in-project/,
    });
    t.deepEqual([...fs.readFileSync(path.join(repository.root, "one.bin"))], [1]);
    t.throws(
      () => applySourceFileTransaction(repository, [{ ...changes[0], path: "../elsewhere.bin" }]),
      { message: /Invalid source project path/ },
    );
  } finally {
    cleanup();
  }
});

test("actual process termination leaves durable known states at every publication boundary", (t) => {
  for (const boundary of ["staged", "publishing", "published:0", "published:1", "completed"]) {
    const { repository, changes, cleanup } = fixture();
    try {
      const child = spawnSync(
        process.execPath,
        [
          "--conditions=uttori-source",
          "--import=tsx",
          fileURLToPath(new URL("./fixtures/file-publication-fault.mjs", import.meta.url)),
          repository.root,
          boundary,
        ],
        { encoding: "utf8" },
      );
      t.is(child.signal, "SIGKILL", child.stderr);
      if (boundary === "completed") {
        t.notThrows(() => sourceFilePublicationEpoch(repository));
      } else {
        t.throws(() => sourceFilePublicationEpoch(repository), { message: /recovery/ });
        t.is(recoverSourceFileTransaction(repository, "after")?.state, "completed");
      }
      changes.forEach((change) =>
        t.deepEqual(
          fs.readFileSync(path.join(repository.root, change.path)),
          Buffer.from(change.after),
        ),
      );
    } finally {
      cleanup();
    }
  }
});

test("replacement preserves source permissions and rejects redirected private recovery parents", (t) => {
  const { repository, changes, cleanup } = fixture();
  try {
    fs.chmodSync(path.join(repository.root, "one.bin"), 0o755);
    applySourceFileTransaction(repository, changes);
    t.is(fs.statSync(path.join(repository.root, "one.bin")).mode & 0o777, 0o755);
    const stage = path.join(repository.stateDirectory, "file-transactions"),
      saved = stage + ".saved";
    fs.renameSync(stage, saved);
    fs.symlinkSync(saved, stage, "dir");
    const next = changes.map((change) => ({
      ...change,
      before: change.after,
      after: change.before,
    }));
    t.throws(() => applySourceFileTransaction(repository, next), { message: /staging directory/ });
    t.deepEqual(
      fs.readFileSync(path.join(repository.root, "one.bin")),
      Buffer.from(changes[0].after),
    );
  } finally {
    cleanup();
  }
});
