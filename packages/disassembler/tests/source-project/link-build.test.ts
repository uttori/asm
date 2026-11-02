import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AssemblyModule, AssemblyLinkRecipe } from "@uttori/asm-core";
import { artifactHash, encodeObject, linkObjects } from "@uttori/asm-core/linker";

import { test } from "../../../../tests/ava-helper.js";
import { buildLinkedObjects, publishLinkedBuild } from "../../src/source-project/link-build.js";

const recipe: AssemblyLinkRecipe = {
  target: "tiny.raw",
  regions: [{ name: "ROM", start: 0, size: 1, outputOffset: 0 }],
  placements: [{ section: "Code", load: "ROM", run: "ROM" }],
};
function object(byte: number): Uint8Array {
  const module: AssemblyModule = {
    id: "tiny",
    target: "tiny.raw",
    targetOptions: {},
    sections: [
      {
        name: "Code",
        kind: "code",
        alignment: 1,
        addressSpace: "cpu",
        size: 1,
        bytes: Uint8Array.of(byte),
      },
    ],
    fixups: [],
    symbols: [],
    ranges: [],
    fields: [],
    assets: [],
    instructions: [],
    dependencies: [],
  };
  return encodeObject(module);
}

test("linked publication selects a complete immutable ROM/map/symbol/allocation set", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "linked-build-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = { directory, objects: [object(1)], recipe, original: Uint8Array.of(1) };
  const first = buildLinkedObjects(options);
  for (const [name, hash] of Object.entries(first.hashes)) {
    t.is(artifactHash(fs.readFileSync(path.join(path.dirname(first.outputFile), name))), hash);
  }
  t.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "current.json"), "utf8")), first);
  t.deepEqual(buildLinkedObjects(options), first);
  const originalReceipt = fs.readFileSync(path.join(directory, "current.json"));
  t.throws(() => buildLinkedObjects({ ...options, objects: [object(2)] }), {
    message: /differs from the original/,
  });
  t.deepEqual(fs.readFileSync(path.join(directory, "current.json")), originalReceipt);
  t.deepEqual([...fs.readFileSync(first.outputFile)], [1]);
  const changed = buildLinkedObjects({ ...options, objects: [object(2)], original: undefined });
  t.not(changed.inputSha256, first.inputSha256);
  t.deepEqual([...fs.readFileSync(changed.outputFile)], [2]);
  t.deepEqual([...fs.readFileSync(first.outputFile)], [1]);
  fs.writeFileSync(changed.symbolsFile, "corrupt");
  t.throws(() => buildLinkedObjects({ ...options, objects: [object(2)], original: undefined }), {
    message: /corrupt/,
  });
});

test("publication rejects malformed identities, inconsistent maps, reserved names and cancellation", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "linked-build-validation-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = linkObjects({ objects: [object(1)], recipe });
  t.throws(() => publishLinkedBuild({ ...result, inputSha256: "../bad" }, directory), {
    message: /valid input identity/,
  });
  t.throws(() => publishLinkedBuild({ ...result, output: Uint8Array.of(2) }, directory), {
    message: /matching debug map/,
  });
  t.throws(() => publishLinkedBuild(result, directory, "build.json"), {
    message: /plain filename/,
  });
  const controller = new AbortController();
  controller.abort();
  t.throws(() => publishLinkedBuild(result, directory, "program.rom", controller.signal), {
    name: "AbortError",
  });
  t.deepEqual(fs.readdirSync(directory), []);
});

for (const boundary of [
  "program.rom",
  "program.rom.debug.json",
  "program.rom.symbols.json",
  "program.rom.link.json",
  "directory",
  "current.json",
]) {
  test(`linked publication recovers a complete artifact set after interruption at ${boundary}`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "linked-interruption-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = path.join(root, "build");
    const before = buildLinkedObjects({ objects: [object(1)], recipe, directory });
    fs.writeFileSync(path.join(root, "input.uobj"), object(2));
    fs.writeFileSync(path.join(root, "recipe.json"), JSON.stringify(recipe));
    const child = spawnSync(
      process.execPath,
      [
        "--conditions=uttori-source",
        "--import=tsx",
        path.resolve("packages/disassembler/tests/source-project/fixtures/link-build-fault.mjs"),
        root,
        boundary,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    t.is(child.signal, "SIGKILL", child.stderr);
    const selected = JSON.parse(fs.readFileSync(path.join(directory, "current.json"), "utf8"));
    if (boundary !== "current.json") {
      t.is(selected.inputSha256, before.inputSha256);
    }
    for (const [name, hash] of Object.entries(selected.hashes)) {
      t.is(artifactHash(fs.readFileSync(path.join(path.dirname(selected.outputFile), name))), hash);
    }
    const recovered = buildLinkedObjects({ objects: [object(2)], recipe, directory });
    t.deepEqual([...fs.readFileSync(recovered.outputFile)], [2]);
    t.deepEqual(
      JSON.parse(fs.readFileSync(path.join(directory, "current.json"), "utf8")),
      recovered,
    );
  });
}
