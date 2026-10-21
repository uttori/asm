import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { host, resetHost } from "../helpers/editor-host.js";

const ui = await import("../../src/source/ui-contracts.js");
const { SourceGitFiles } = await import("../../src/source/git-files.js");
const { Uri, FileType, TreeItemCollapsibleState } = await import("vscode");

test.beforeEach(() => resetHost());

test("UI result guards retain complete build and merge contracts and reject partial replies", (t) => {
  const build = {
    outputFile: "program.sfc",
    debugMapFile: "program.map.json",
    inputSha256: "a",
    inputs: [{ path: "main.asm", sha256: "b" }],
    outputSize: 32768,
    debugMapFingerprint: "c",
    verification: {
      outputSha256: "d",
      debugMapSha256: "e",
      toolchainSha256: "f",
      checks: ["assembly"],
    },
    contracts: { cpuStates: 1, fixedExtents: 2 },
  };
  t.true(ui.isSnesSourceBuild(build));
  t.true(ui.isSnesSourceBuild({ ...build, cacheWarnings: ["cleanup deferred"] }));
  for (const value of [
    null,
    [],
    {},
    { ...build, inputs: [null] },
    { ...build, inputs: [{ path: 2, sha256: "b" }] },
    { ...build, contracts: null },
    { ...build, verification: { ...build.verification, checks: [true] } },
    { ...build, cacheWarnings: {} },
    { ...build, cacheWarnings: [false] },
  ]) {
    t.false(ui.isSnesSourceBuild(value));
  }
  const preview = {
    head: "h",
    sourceTree: "s",
    candidate: "c",
    base: "b",
    resultTree: "r",
    messages: "",
    conflicts: ["main.asm"],
  };
  t.true(ui.isSourceMergePreview(preview));
  t.true(ui.isSourceMergePreview({ ...preview, ref: "refs/uttori/preview" }));
  for (const value of [null, {}, { ...preview, conflicts: [12] }, { ...preview, ref: false }]) {
    t.false(ui.isSourceMergePreview(value));
  }
});

test("relocation and layout guards require explicit identities before a workspace edit", (t) => {
  const edit = { path: "main.asm", beforeSha256: "a", before: "db 1", after: "db 2" };
  t.deepEqual(ui.relocationEdits({ edits: [edit] }), [edit]);
  for (const value of [
    null,
    {},
    { edits: {} },
    { edits: [null] },
    { edits: [{ ...edit, after: 3 }] },
  ]) {
    t.throws(() => ui.relocationEdits(value), { message: "Invalid source relocation." });
  }
  t.true(ui.isLayoutObject({ id: "room", kind: "asset" }));
  t.false(ui.isLayoutObject({ id: "room" }));
  t.false(ui.isLayoutObject(null));
  t.true(ui.isGenerationCommit({ generation: { commit: "a" } }));
  for (const value of [
    null,
    {},
    { generation: null },
    { generation: { commit: "" } },
    { generation: { commit: 1 } },
  ]) {
    t.false(ui.isGenerationCommit(value));
  }
  for (const mapper of [
    "lorom",
    "hirom",
    "exlorom",
    "exhirom",
    "sfxrom",
    "sa1rom",
    "bigsa1rom",
    "norom",
  ]) {
    t.true(ui.isSnesMapper(mapper));
  }
  t.false(ui.isSnesMapper("custom"));
});

test.serial(
  "tree actions and cancelled file picks preserve their native UI contracts",
  async (t) => {
    const child = new ui.SourceRow("Prepare", [], "asm.source.prepare", ["project"]);
    const parent = new ui.SourceRow("Regeneration", [child]);
    t.is(child.collapsibleState, TreeItemCollapsibleState.None);
    t.deepEqual(child.command, {
      command: "asm.source.prepare",
      title: "Prepare",
      arguments: ["project"],
    });
    t.is(parent.collapsibleState, TreeItemCollapsibleState.Expanded);
    t.is(parent.command, undefined);
    t.is(await ui.chooseAssetFile("Choose", ["png"]), undefined);
    host.openFiles = [];
    t.is(await ui.chooseAssetFile("Choose", ["png"]), undefined);
    host.openFiles = [{ fsPath: "/assets/sprite.png" }];
    t.is(await ui.chooseAssetFile("Choose", ["png"]), "/assets/sprite.png");
  },
);

test("Git virtual files preserve exact binary history and deny mutation or unselected roots", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-git-provider-"));
  const files = new SourceGitFiles();
  t.teardown(() => {
    files.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const git = (...args: string[]): string =>
    execFileSync(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        ...args,
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  git("init", "-b", "main");
  const original = Uint8Array.of(0, 255, 128, 10);
  fs.writeFileSync(path.join(root, "sprite pixels.bin"), original);
  git("add", ".");
  git("commit", "-m", "Fixture");
  const revision = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(root, "sprite pixels.bin"), Uint8Array.of(7));
  const uri = files.uri(root, revision, "sprite pixels.bin");
  t.deepEqual(new Uint8Array(await files.readFile(uri)), original);
  t.deepEqual(await files.stat(uri), { type: FileType.File, ctime: 0, mtime: 0, size: 4 });
  t.deepEqual(await files.readFile(files.uri(root, null, "added.asm")), new Uint8Array());
  const unknown = Uri.from({
    scheme: "uttori-source",
    path: "/x",
    query: new URLSearchParams({ root: "/unselected", revision, file: "x" }).toString(),
  });
  await t.throwsAsync(files.readFile(unknown), { message: /Select this source project/ });
  for (const file of ["../outside", "/absolute", ""]) {
    await t.throwsAsync(files.readFile(files.uri(root, revision, file)));
  }
  await t.throwsAsync(files.readFile(files.uri(root, "HEAD:other", "sprite pixels.bin")));
  await t.throwsAsync(files.readFile(files.uri(root, revision, "missing.bin")));
  for (const mutate of [
    () => files.createDirectory(),
    () => files.writeFile(),
    () => files.delete(),
    () => files.rename(),
  ]) {
    t.throws(mutate, { message: "Git history is immutable." });
  }
  t.deepEqual(files.readDirectory(), []);
  files.watch().dispose();
  t.deepEqual(fs.readFileSync(path.join(root, "sprite pixels.bin")), Buffer.from([7]));
  t.is(git("rev-parse", "HEAD"), revision);
});
