import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "./ava-helper.js";
import { emptyOutputMessage, resolveBuildEntry } from "../packages/language-server/src/build.js";

function makeWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-build-entry-"));
  fs.mkdirSync(path.join(workspace, "objects"));
  fs.writeFileSync(path.join(workspace, "game.asm"), "nop\n");
  fs.writeFileSync(path.join(workspace, "objects/knife.asm"), "nop\n");
  return workspace;
}

test("resolveBuildEntry prefers the project entry point over an include", (t) => {
  const workspace = makeWorkspace();
  try {
    const resolved = resolveBuildEntry(
      path.join(workspace, "objects/knife.asm"),
      ["game.asm"],
      workspace,
    );
    t.is(resolved.file, path.join(workspace, "game.asm"));
    t.true(resolved.usedEntryPoint);
    t.true(resolved.reason.includes("not a project entry point"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolveBuildEntry keeps the active file when it is an entry point", (t) => {
  const workspace = makeWorkspace();
  try {
    const game = path.join(workspace, "game.asm");
    const resolved = resolveBuildEntry(game, [game], workspace);
    t.is(resolved.file, game);
    t.true(resolved.usedEntryPoint);
    t.is(resolved.reason, "active file is a project entry point");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolveBuildEntry uses the active file when no entry points are set", (t) => {
  const workspace = makeWorkspace();
  try {
    const knife = path.join(workspace, "objects/knife.asm");
    const resolved = resolveBuildEntry(knife, [], workspace);
    t.is(resolved.file, knife);
    t.false(resolved.usedEntryPoint);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolveBuildEntry falls back to the first entry point without an editor", (t) => {
  const workspace = makeWorkspace();
  try {
    const resolved = resolveBuildEntry(undefined, ["game.asm"], workspace);
    t.is(resolved.file, path.join(workspace, "game.asm"));
    t.true(resolved.usedEntryPoint);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolveBuildEntry throws when there is nothing to build", (t) => {
  const workspace = makeWorkspace();
  try {
    t.throws(() => resolveBuildEntry(undefined, [], workspace), {
      message: /Open a source file or set asm.entryPoints/,
    });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("emptyOutputMessage tells include builds to use the project entry", (t) => {
  t.true(emptyOutputMessage("knife.asm", false).includes("asm.entryPoints"));
  t.true(emptyOutputMessage("game.asm", true).includes("0 bytes"));
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
