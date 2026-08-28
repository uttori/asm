import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "./ava-helper.js";
import { emptyOutputMessage, resolveBuildEntry } from "../language-server/src/build.js";

const workspace = "/Users/matthew/uttori/snes-asm-js/fixtures/integration/chou";

test("resolveBuildEntry prefers the project entry point over an include", (t) => {
  const resolved = resolveBuildEntry(
    path.join(workspace, "objects/knife.asm"),
    ["Chou.asm"],
    workspace,
  );
  t.is(resolved.file, path.join(workspace, "Chou.asm"));
  t.true(resolved.usedEntryPoint);
  t.true(resolved.reason.includes("not a project entry point"));
});

test("resolveBuildEntry keeps the active file when it is an entry point", (t) => {
  const chou = path.join(workspace, "Chou.asm");
  const resolved = resolveBuildEntry(chou, [chou], workspace);
  t.is(resolved.file, chou);
  t.true(resolved.usedEntryPoint);
  t.is(resolved.reason, "active file is a project entry point");
});

test("resolveBuildEntry uses the active file when no entry points are set", (t) => {
  const knife = path.join(workspace, "objects/knife.asm");
  const resolved = resolveBuildEntry(knife, [], workspace);
  t.is(resolved.file, knife);
  t.false(resolved.usedEntryPoint);
});

test("resolveBuildEntry falls back to the first entry point without an editor", (t) => {
  const resolved = resolveBuildEntry(undefined, ["Chou.asm"], workspace);
  t.is(resolved.file, path.join(workspace, "Chou.asm"));
  t.true(resolved.usedEntryPoint);
});

test("resolveBuildEntry throws when there is nothing to build", (t) => {
  t.throws(() => resolveBuildEntry(undefined, [], workspace), {
    message: /Open a source file or set asm.entryPoints/,
  });
});

test("emptyOutputMessage tells include builds to use the project entry", (t) => {
  t.true(emptyOutputMessage("knife.asm", false).includes("asm.entryPoints"));
  t.true(emptyOutputMessage("Chou.asm", true).includes("0 bytes"));
});

test("Build Binary refuses to write a 0-byte image from an include fragment", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-empty-build-"));
  try {
    const output = path.join(directory, "game.sfc");
    fs.writeFileSync(output, Buffer.alloc(4, 0xff));
    t.true(fs.statSync(output).size > 0);
    t.true(emptyOutputMessage("fragment.asm", false).includes("0 bytes"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
