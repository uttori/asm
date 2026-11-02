import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readAssemblyBuildResult } from "@uttori/asm-workflows/build";

import { test } from "../../../../tests/ava-helper.js";
import {
  createAsarSourceBuildFixture,
  createLinkedBuildFixture,
} from "../../../../tests/fixtures/linked-build.js";
import { SourceProcessClient } from "../../src/source/process-client.js";

test("shipped editor worker composes, assembles objects, creates a library and links identical ROM bytes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bundled-link-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { manifest, original } = createLinkedBuildFixture(directory);
  const worker =
    process.env.UTTORI_TEST_SOURCE_WORKER ??
    fileURLToPath(new URL("../../out/source-process.mjs", import.meta.url));
  const client = new SourceProcessClient(worker);
  t.teardown(() => client.dispose());
  let checked = false;
  const controls = {
    maxMemoryMiB: 512,
    readResult: readAssemblyBuildResult,
    onBeforePublish: (paths: readonly string[]) => {
      checked = true;
      t.true(
        paths.includes(manifest) ||
          paths.some((file) => file.endsWith(".asm") || file.endsWith(".uobj")),
      );
    },
  };
  const composed = await client.run({ action: "build-linked", directory, manifest }, controls);
  t.is(composed.kind, "linked");
  t.true(checked);
  t.deepEqual(fs.readFileSync(composed.outputFile), Buffer.from(original));
  for (const module of ["main", "helper"]) {
    const object = await client.run(
      {
        action: "assemble-object",
        directory,
        source: `${module}.asm`,
        output: `${module}.uobj`,
        module,
      },
      controls,
    );
    t.is(object.kind, "object");
  }
  const library = await client.run(
    { action: "library", directory, output: "helpers.ulib", objects: ["helper.uobj"] },
    controls,
  );
  t.is(library.kind, "library");
  for (const file of ["main.asm", "helper.asm", "payload.bin", "helper.uobj"]) {
    fs.unlinkSync(path.join(directory, file));
  }
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      recipe: "recipe.json",
      objects: ["main.uobj"],
      libraries: ["helpers.ulib"],
      original: "original.sfc",
      outputDirectory: "build",
    }),
  );
  const linked = await client.run({ action: "link", directory, manifest }, controls);
  t.deepEqual(fs.readFileSync(linked.outputFile), Buffer.from(original));
  const pointer = fs.readFileSync(path.join(directory, "build/current.json"));
  await t.throwsAsync(
    client.run(
      { action: "link", directory, manifest },
      {
        ...controls,
        onBeforePublish: () => {
          throw new Error("Editor input changed.");
        },
      },
    ),
    { message: /Editor input changed/ },
  );
  t.deepEqual(fs.readFileSync(path.join(directory, "build/current.json")), pointer);
});

test("shipped editor worker adapts authored Asar layout and relinks its published recipe without sources", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bundled-adapter-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { manifest, original } = createAsarSourceBuildFixture(directory);
  const worker =
    process.env.UTTORI_TEST_SOURCE_WORKER ??
    fileURLToPath(new URL("../../out/source-process.mjs", import.meta.url));
  const client = new SourceProcessClient(worker);
  t.teardown(() => client.dispose());
  const controls = { maxMemoryMiB: 512, readResult: readAssemblyBuildResult, onBeforePublish() {} };
  const built = await client.run({ action: "build-linked", directory, manifest }, controls);
  if (built.kind !== "linked" || !built.recipeFile) {
    throw new Error("Expected a published source recipe.");
  }
  t.deepEqual(fs.readFileSync(built.outputFile), Buffer.from(original));
  for (const module of ["main", "helper"]) {
    const object = await client.run(
      {
        action: "assemble-object",
        directory,
        source: `${module}.asm`,
        output: `${module}.uobj`,
        module,
        sourceAdapter: "asar",
      },
      controls,
    );
    if (object.kind !== "object") {
      throw new Error("Expected an object receipt.");
    }
    t.truthy(object.linkRecipe);
    fs.unlinkSync(path.join(directory, `${module}.asm`));
  }
  fs.unlinkSync(path.join(directory, "payload.bin"));
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      recipe: built.recipeFile,
      objects: ["main.uobj", "helper.uobj"],
      original: "original.sfc",
    }),
  );
  const relinked = await client.run({ action: "link", directory, manifest }, controls);
  t.deepEqual(fs.readFileSync(relinked.outputFile), Buffer.from(original));
});
