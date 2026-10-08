import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sourceGit, type SourceMergePreview } from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import { readSourceGenerationReview } from "../../src/source/generation-review.js";

test("preview diffs show the proposed merge against current source before applying or committing", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-generation-review-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init", "-b", "main"]);
  await sourceGit(root, ["config", "user.name", "Fixture"]);
  await sourceGit(root, ["config", "user.email", "fixture@localhost"]);
  const write = (file: string, text: string) => fs.writeFileSync(path.join(root, file), text);
  const commit = async (message: string): Promise<string> => {
    await sourceGit(root, ["add", "--all"]);
    await sourceGit(root, ["commit", "-m", message]);
    return (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  };
  write("already-combined.asm", "db $01\n");
  write("conflict.asm", "; Original comment\ndb $02\n");
  const base = await commit("Generation baseline");
  await sourceGit(root, ["switch", "-c", "generated"]);
  write("already-combined.asm", "db $03\n");
  write("conflict.asm", "; Generated comment\ndb $02\n");
  write("new asset.bin", "New asset\n");
  const candidate = await commit("New generation");
  await sourceGit(root, ["switch", "main"]);
  write("already-combined.asm", "db $03\n");
  write("conflict.asm", "; Authored comment\ndb $02\n");
  const head = await commit("Reviewed source");
  const sourceTree = (await sourceGit(root, ["rev-parse", "HEAD^{tree}"])).stdout.toString().trim();
  const indexBefore = fs.readFileSync(path.join(root, ".git/index"));
  const merged = await sourceGit(
    root,
    ["merge-tree", "--write-tree", "--name-only", "-z", head, candidate],
    { acceptedCodes: [1] },
  );
  const preview: SourceMergePreview = {
    base,
    candidate,
    head,
    sourceTree,
    resultTree: merged.stdout.toString().split("\0")[0],
    conflicts: ["conflict.asm"],
    messages: "",
  };
  const generated = await readSourceGenerationReview(root, candidate);
  t.true(generated.files.some((file) => file.path === "already-combined.asm"));
  const reviewed = await readSourceGenerationReview(root, candidate, preview);
  t.is(reviewed.before, sourceTree);
  t.is(reviewed.after, preview.resultTree);
  t.true(reviewed.previewed);
  t.deepEqual(
    reviewed.localChanges,
    [],
    "Clean source uses the existing commit without another checkpoint.",
  );
  t.deepEqual(reviewed.files, [
    { path: "conflict.asm", status: "M", conflict: true },
    { path: "new asset.bin", status: "A", conflict: false },
  ]);
  const conflict = (
    await sourceGit(root, ["show", `${reviewed.after}:conflict.asm`])
  ).stdout.toString();
  t.true(conflict.includes("<<<<<<<"), "Conflicting hunks are reviewable before Apply.");
  t.true(conflict.includes("; Authored comment"));
  t.true(conflict.includes("; Generated comment"));
  t.is((await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim(), head);
  t.deepEqual(fs.readFileSync(path.join(root, ".git/index")), indexBefore);
  t.is(fs.readFileSync(path.join(root, "conflict.asm"), "utf8"), "; Authored comment\ndb $02\n");
  t.false(fs.existsSync(path.join(root, "new asset.bin")));

  // Staging and then restoring a working file can hide local edits from the captured tree.
  write("already-combined.asm", "db $04\n");
  await sourceGit(root, ["add", "already-combined.asm"]);
  write("already-combined.asm", "db $03\n");
  const stagedIndex = fs.readFileSync(path.join(root, ".git/index"));
  const staged = await readSourceGenerationReview(root, candidate, preview);
  t.deepEqual(staged.localChanges, ["already-combined.asm"]);
  t.deepEqual(fs.readFileSync(path.join(root, ".git/index")), stagedIndex);
});
