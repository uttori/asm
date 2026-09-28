import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { applyAssetFileChanges } from "../src/node.js";

/** Each case owns its files, including injected failure recovery. */
function files() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asset-edit-test-"));
  const changes = ["a", "b"].map((name) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, "old");
    return { path: file, before: Buffer.from("old"), after: Buffer.from("new") };
  });
  return { directory, changes };
}

test.serial("coordinated writes reject stale and duplicate files before publication", (t) => {
  const { directory, changes } = files();
  try {
    t.throws(() => applyAssetFileChanges([changes[0], changes[0]]), { message: /Duplicate/ });
    fs.writeFileSync(changes[1].path, "other edit");
    t.throws(() => applyAssetFileChanges(changes), { message: /changed/ });
    t.is(fs.readFileSync(changes[0].path, "utf8"), "old");
    t.deepEqual(fs.readdirSync(directory).sort(), ["a", "b"]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test.serial("a failed second rename restores the first file and removes staging", (t) => {
  const { directory, changes } = files();
  const rename = fs.renameSync;
  let calls = 0;
  try {
    fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
      if (++calls === 2) {
        throw new Error("injected publication failure");
      }
      return rename(...args);
    }) as typeof fs.renameSync;
    t.throws(() => applyAssetFileChanges(changes), { message: /injected/ });
    for (const change of changes) {
      t.is(fs.readFileSync(change.path, "utf8"), "old");
    }
    t.deepEqual(fs.readdirSync(directory).sort(), ["a", "b"]);
  } finally {
    fs.renameSync = rename;
    fs.rmSync(directory, { recursive: true });
  }
});

test.serial("successful coordinated writes publish every replacement", (t) => {
  const { directory, changes } = files();
  try {
    applyAssetFileChanges(changes);
    for (const change of changes) {
      t.is(fs.readFileSync(change.path, "utf8"), "new");
    }
    t.deepEqual(fs.readdirSync(directory).sort(), ["a", "b"]);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test.serial("recovery conflicts keep somebody else's edit and retain backup paths", (t) => {
  const { directory, changes } = files();
  const rename = fs.renameSync;
  let calls = 0;
  try {
    fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
      if (++calls === 2) {
        fs.writeFileSync(changes[0].path, "concurrent edit");
        throw new Error("injected publication failure");
      }
      return rename(...args);
    }) as typeof fs.renameSync;
    t.throws(() => applyAssetFileChanges(changes), {
      instanceOf: AggregateError,
      message: /Backups:/,
    });
    t.is(fs.readFileSync(changes[0].path, "utf8"), "concurrent edit");
    const backups = fs.readdirSync(directory).filter((name) => name.startsWith(".asset-edit-"));
    t.is(backups.length, 2);
    for (const backup of backups) {
      t.is(fs.readFileSync(path.join(directory, backup, "before"), "utf8"), "old");
    }
  } finally {
    fs.renameSync = rename;
    fs.rmSync(directory, { recursive: true });
  }
});
