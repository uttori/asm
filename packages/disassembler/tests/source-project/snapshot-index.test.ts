import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { sourceGit, sourceRepository } from "../../src/source-project/git.js";
import { SourceSnapshotIndex } from "../../src/source-project/snapshot-index.js";

test("reused snapshots match fresh Git while preserving staging, flags and exact current bytes", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-snapshot-reuse-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init", "-b", "main"]);
  await sourceGit(root, ["config", "user.name", "Fixture"]);
  await sourceGit(root, ["config", "user.email", "fixture@localhost"]);
  await sourceGit(root, ["config", "core.hooksPath", ".git/no-hooks"]);
  const main = path.join(root, "main.asm");
  fs.writeFileSync(main, "db 1\n");
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested/notes.txt"), "notes\n");
  await sourceGit(root, ["add", "--all"]);
  await sourceGit(root, ["commit", "-m", "Baseline"]);
  const repository = await sourceRepository(root);
  const snapshot = new SourceSnapshotIndex(repository);
  t.teardown(() => snapshot.dispose());
  const realIndex = path.join(repository.gitDirectory, "index");

  /** Compare with the original fresh-index algorithm, including path and attribute semantics. */
  const compare = async (): Promise<void> => {
    const before = fs.readFileSync(realIndex);
    const indexFile = path.join(root, ".git/comparison-index");
    await sourceGit(root, ["read-tree", "HEAD"], { indexFile });
    await sourceGit(root, ["add", "--all", "--", "."], { indexFile });
    const expected = (await sourceGit(root, ["write-tree"], { indexFile })).stdout
      .toString()
      .trim();
    t.is(await snapshot.snapshot(), expected);
    t.deepEqual(fs.readFileSync(realIndex), before);
    fs.rmSync(indexFile);
  };
  await compare();
  // A partially staged edit must stay staged exactly as it was, while snapshots see saved bytes.
  fs.writeFileSync(main, "db 2\n");
  await sourceGit(root, ["add", "main.asm"]);
  const stat = fs.statSync(main);
  fs.writeFileSync(main, "db 3\n");
  fs.utimesSync(main, stat.atime, stat.mtime);
  await sourceGit(root, ["update-index", "--assume-unchanged", "main.asm"]);
  await compare();
  if (process.platform !== "win32") {
    fs.writeFileSync(path.join(root, ":(exclude)literal.txt"), "literal\n");
  }
  fs.writeFileSync(path.join(root, "[literal].txt"), "literal\n");
  fs.writeFileSync(path.join(root, "new.txt"), "new\n");
  await compare();
  fs.writeFileSync(path.join(root, ".gitignore"), "new.txt\n");
  fs.unlinkSync(path.join(root, "nested/notes.txt"));
  fs.chmodSync(main, 0o755);
  await sourceGit(root, ["config", "core.filemode", "01"]);
  await compare();
  await sourceGit(root, ["config", "core.filemode", "no"]);
  await compare();
  await sourceGit(root, ["config", "core.filemode", "true"]);
  await compare();
  if (process.platform !== "win32") {
    fs.rmdirSync(path.join(root, "nested"));
    fs.symlinkSync(".", path.join(root, "nested"));
    await compare();
  }
  // Filtered files and newline normalization must use Git's canonical blob bytes.
  fs.writeFileSync(path.join(root, ".gitattributes"), "*.txt text eol=lf\n");
  fs.writeFileSync(path.join(root, "filtered.txt"), "first\r\nsecond\r\n");
  await sourceGit(root, ["config", "core.autocrlf", "yes"]);
  await compare();
  if (fs.lstatSync(path.join(root, "nested")).isSymbolicLink()) {
    fs.unlinkSync(path.join(root, "nested"));
    fs.mkdirSync(path.join(root, "nested"));
  }
  const notes = path.join(root, "nested/notes.txt");
  fs.writeFileSync(notes, "notes\n");
  await sourceGit(root, ["config", "core.autocrlf", "false"]);
  await sourceGit(root, ["config", "core.ignorestat", "true"]);
  await compare();
  const notesStat = fs.statSync(notes);
  fs.unlinkSync(path.join(root, ".gitattributes"));
  fs.writeFileSync(notes, "other\n");
  fs.utimesSync(notes, notesStat.atime, notesStat.mtime);
  await compare();
});
