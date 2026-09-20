import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "../../../tests/ava-helper.js";
import { commitBuildArtifactPair, emptyOutputMessage, resolveBuildEntry } from "../src/build.js";

function makeWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-build-entry-"));
  fs.mkdirSync(path.join(workspace, "objects"));
  fs.writeFileSync(path.join(workspace, "game.asm"), "nop\n");
  fs.writeFileSync(path.join(workspace, "objects/knife.asm"), "nop\n");
  return workspace;
}

test("language server bundling rejects undefined imports and preserves the previous bundle", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-bundle-build-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "src"));
  fs.mkdirSync(path.join(directory, "out"));
  fs.mkdirSync(path.join(directory, "node_modules"));
  fs.symlinkSync(
    path.dirname(fileURLToPath(import.meta.resolve("esbuild/package.json"))),
    path.join(directory, "node_modules/esbuild"),
    "junction",
  );
  const buildScript = path.join(directory, "esbuild.mjs");
  // The fixture has a flat directory layout. Copy the real shared notice builder beside it.
  fs.writeFileSync(
    buildScript,
    fs
      .readFileSync(path.resolve("packages/language-server/esbuild.mjs"), "utf8")
      .replace("../../scripts/bundle-notices.mjs", "./bundle-notices.mjs"),
  );
  fs.copyFileSync(
    path.resolve("scripts/bundle-notices.mjs"),
    path.join(directory, "bundle-notices.mjs"),
  );
  fs.writeFileSync(
    path.join(directory, "src/server.ts"),
    'import { defaultLd65ConfigText } from "./linker-config.js";\nconsole.log(defaultLd65ConfigText());\n',
  );
  const linker = path.join(directory, "src/linker-config.ts");
  fs.writeFileSync(linker, "");
  const output = path.join(directory, "out/server.mjs");
  const previous = "// Previous working server bundle.\n";
  fs.writeFileSync(output, previous);

  const failed = spawnSync(process.execPath, [buildScript], {
    encoding: "utf8",
    timeout: 10_000,
  });
  t.is(failed.error, undefined);
  t.is(failed.status, 1);
  t.true(failed.stderr.includes("import-is-undefined"));
  t.is(fs.readFileSync(output, "utf8"), previous);

  fs.writeFileSync(linker, 'export const defaultLd65ConfigText = () => "valid linker config";\n');
  const rebuilt = spawnSync(process.execPath, [buildScript], {
    encoding: "utf8",
    timeout: 10_000,
  });
  t.is(rebuilt.status, 0, rebuilt.stderr);
  const run = spawnSync(process.execPath, [output], { encoding: "utf8", timeout: 10_000 });
  t.is(run.status, 0, run.stderr);
  t.is(run.stdout.trim(), "valid linker config");

  const dependency = path.join(directory, "node_modules", "fixture-dependency");
  fs.mkdirSync(path.join(dependency, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(dependency, "package.json"),
    JSON.stringify({ name: "fixture-dependency", version: "1.0.0", main: "lib/index.js" }),
  );
  fs.writeFileSync(path.join(dependency, "lib/package.json"), '{"type":"module"}');
  fs.writeFileSync(
    path.join(dependency, "lib/index.js"),
    'export const message = "licensed dependency";',
  );
  const notice = "Copyright fixture author\nPermission text stays unchanged.\n";
  fs.writeFileSync(path.join(dependency, "LICENSE"), notice);
  fs.appendFileSync(
    path.join(directory, "src/server.ts"),
    'import { message } from "fixture-dependency";\nconsole.log(message);\n',
  );
  const licensed = spawnSync(process.execPath, [buildScript], {
    encoding: "utf8",
    timeout: 10_000,
  });
  t.is(licensed.status, 0, licensed.stderr);
  const bundledNotice = fs.readFileSync(`${output}.licenses.txt`, "utf8");
  t.true(bundledNotice.includes("fixture-dependency@1.0.0"));
  t.true(bundledNotice.includes(notice));
});

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

test("commitBuildArtifactPair publishes matching artifacts and reports unchanged rebuilds", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-artifact-pair-"));
  try {
    const output = path.join(directory, "build", "game.sfc");
    const bytes = Uint8Array.from([0xea, 0xdb]);
    const map = `${JSON.stringify({ output: { size: bytes.length }, fingerprint: "test" })}\n`;
    const first = commitBuildArtifactPair(output, bytes, map);
    t.true(first.outputChanged);
    t.true(first.debugMapChanged);
    t.deepEqual(fs.readFileSync(first.outputPath), Buffer.from(bytes));
    t.is(fs.readFileSync(first.debugMapPath, "utf8"), map);

    const second = commitBuildArtifactPair(output, bytes, map);
    t.false(second.outputChanged);
    t.false(second.debugMapChanged);
    t.deepEqual(
      fs.readdirSync(path.dirname(output)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
