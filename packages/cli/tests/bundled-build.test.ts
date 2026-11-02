import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readAssemblyBuildResult } from "@uttori/asm-workflows/build-contracts";

import { test } from "../../../tests/ava-helper.js";
import {
  createAsarSourceBuildFixture,
  createLinkedBuildFixture,
} from "../../../tests/fixtures/linked-build.js";

for (const sourceAdapter of [undefined, "asar"] as const) {
  test(`shipped CLI independently assembles, archives, links and composes byte-identical ROMs (${sourceAdapter ?? "native"})`, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-cli-linked-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const createFixture = sourceAdapter ? createAsarSourceBuildFixture : createLinkedBuildFixture;
    const { manifest, original } = createFixture(directory);
    const executable = fileURLToPath(new URL("../out/cli.mjs", import.meta.url));
    const run = (args: readonly string[]) =>
      spawnSync(process.execPath, [executable, ...args], {
        cwd: directory,
        encoding: "utf8",
        timeout: 30000,
      });
    const composed = run(["build", manifest]);
    t.is(composed.status, 0, composed.stderr);
    const first = readAssemblyBuildResult(JSON.parse(composed.stdout));
    t.deepEqual(fs.readFileSync(first.outputFile), Buffer.from(original));
    for (const module of ["main", "helper"]) {
      const options = sourceAdapter ? ["--source-adapter", sourceAdapter] : [];
      const object = run(["assemble-object", `${module}.asm`, "--module", module, ...options]);
      t.is(object.status, 0, object.stderr);
    }
    const library = run(["library", "helpers.ulib", "helper.uobj"]);
    t.is(library.status, 0, library.stderr);
    for (const file of ["main.asm", "helper.asm", "payload.bin", "helper.uobj"]) {
      fs.unlinkSync(path.join(directory, file));
    }
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        format: "uttori-build",
        version: 1,
        recipe: first.kind === "linked" ? first.recipeFile : "recipe.json",
        objects: ["main.uobj"],
        libraries: ["helpers.ulib"],
        original: "original.sfc",
        outputDirectory: "build",
      }),
    );
    const linked = run(["link", manifest]);
    t.is(linked.status, 0, linked.stderr);
    const result = readAssemblyBuildResult(JSON.parse(linked.stdout));
    t.deepEqual(fs.readFileSync(result.outputFile), Buffer.from(original));
    const pointer = fs.readFileSync(path.join(directory, "build/current.json"));
    fs.writeFileSync(path.join(directory, "helpers.ulib"), "corrupt");
    const failed = run(["link", manifest]);
    t.is(failed.status, 1);
    t.deepEqual(fs.readFileSync(path.join(directory, "build/current.json")), pointer);
  });
}
