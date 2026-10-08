import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  applySourceFileTransaction,
  recoverSourceFileTransaction,
} from "../../src/source-project/file-transaction.js";

test("mixed create, replace and remove publication recovers either absence state at every boundary", (t) => {
  for (const boundary of ["staged", "publishing", "published:0", "published:1", "published:2"]) {
    for (const direction of ["before", "after"] as const) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-create-"));
      const repository = {
        root,
        gitDirectory: path.join(root, ".git"),
        stateDirectory: path.join(root, ".git/state"),
      };
      fs.writeFileSync(path.join(root, "reference.asm"), "old");
      fs.writeFileSync(path.join(root, "old.png"), "pixels");
      const changes = [
        { path: "new.aseprite", before: null, after: Buffer.from("indexed") },
        { path: "reference.asm", before: Buffer.from("old"), after: Buffer.from("new") },
        { path: "old.png", before: Buffer.from("pixels"), after: null },
      ];
      try {
        t.throws(() =>
          applySourceFileTransaction(repository, changes, {
            onStage(stage) {
              if (stage === boundary) {
                throw new Error("interrupted");
              }
            },
          }),
        );
        t.is(recoverSourceFileTransaction(repository, direction)?.state, "completed");
        for (const change of changes) {
          const expected = change[direction];
          if (expected === null) {
            t.false(fs.existsSync(path.join(root, change.path)));
          } else {
            t.deepEqual(fs.readFileSync(path.join(root, change.path)), expected);
          }
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  }
});

test("creation collisions and third-party recovery bytes never become owned files", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-collision-"));
  const repository = {
    root,
    gitDirectory: path.join(root, ".git"),
    stateDirectory: path.join(root, ".git/state"),
  };
  try {
    const file = path.join(root, "new.png");
    fs.writeFileSync(file, "unrelated");
    t.throws(
      () =>
        applySourceFileTransaction(repository, [
          { path: "new.png", before: null, after: Buffer.from("owned") },
        ]),
      { message: /Stale/ },
    );
    t.is(fs.readFileSync(file, "utf8"), "unrelated");
    fs.unlinkSync(file);
    t.throws(() =>
      applySourceFileTransaction(
        repository,
        [{ path: "new.png", before: null, after: Buffer.from("owned") }],
        {
          onStage(stage) {
            if (stage === "staged") {
              throw new Error("stop");
            }
          },
        },
      ),
    );
    fs.writeFileSync(file, "external");
    t.throws(() => recoverSourceFileTransaction(repository, "after"), { message: /third-party/ });
    t.is(fs.readFileSync(file, "utf8"), "external");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
