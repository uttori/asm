import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../../tests/ava-helper.js";
import { captureBuildControls, changedBuildInputs } from "../../src/source/build-inputs.js";

test("build controls follow the current saved project selection and detect layout changes outside assembly dependencies", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-build-controls-"));
  t.teardown(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".uttori"));
  await fs.mkdir(path.join(root, "selected"));
  const configuration = {
    format: "uttori-source-project",
    version: 1,
    id: "controls",
    target: "snes.sfc",
    romSha256: "0".repeat(64),
    sourceRoots: ["selected"],
    researchRoots: ["research"],
    layout: ".uttori/new-layout.json",
    buildConfig: "selected/new-config.json",
    captures: ".uttori/captures.json",
  };
  await fs.writeFile(path.join(root, ".uttori/project.json"), JSON.stringify(configuration));
  for (const file of [
    configuration.layout,
    configuration.buildConfig,
    "selected/source-raw.json",
  ]) {
    await fs.writeFile(path.join(root, file), "{}");
  }
  const inputs = await captureBuildControls(root);
  t.deepEqual(
    inputs.map((input) => input.path),
    [
      ".uttori/project.json",
      configuration.layout,
      configuration.buildConfig,
      "selected/source-raw.json",
    ],
  );
  await fs.writeFile(path.join(root, configuration.layout), '{"size":65536}');
  t.deepEqual(await changedBuildInputs(root, inputs), [configuration.layout]);
});

test("build freshness follows saved bytes, not notifications, mtime or private evidence/output", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-build-inputs-"));
  t.teardown(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "main.asm");
  const asset = path.join(root, "tiles.bin");
  await fs.writeFile(source, "LDA #$01\n");
  await fs.writeFile(asset, Uint8Array.from([0, 128, 255]));
  const inputs = await Promise.all(
    [source, asset].map(async (file) => ({
      path: path.relative(root, file),
      sha256: sourceContentHash(await fs.readFile(file)),
    })),
  );
  // A delayed save notification and an atomic replacement with identical bytes are harmless.
  await fs.utimes(source, new Date(), new Date());
  await fs.writeFile(`${source}.next`, await fs.readFile(source));
  await fs.rename(`${source}.next`, source);
  await fs.mkdir(path.join(root, ".uttori-local"));
  await fs.writeFile(path.join(root, ".uttori-local/current.json"), "{}");
  await fs.writeFile(path.join(root, "capture.act2"), "new evidence");
  t.deepEqual(await changedBuildInputs(root, inputs), []);
  await fs.writeFile(source, "LDA #$02\n");
  await fs.rm(asset);
  t.deepEqual(await changedBuildInputs(root, inputs), ["main.asm", "tiles.bin"]);
  await fs.writeFile(source, "LDA #$01\n");
  await fs.writeFile(asset, Uint8Array.from([0, 128, 255]));
  t.deepEqual(await changedBuildInputs(root, inputs), []);
});
