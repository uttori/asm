import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decodeLibrary, decodeObject } from "@uttori/asm-core/linker";
import snesPlugin from "@uttori/asm-plugin-snes";

import { test } from "../../../tests/ava-helper.js";
import { createLinkedBuildFixture } from "../../../tests/fixtures/linked-build.js";
import { resolveAssemblyBuildSelection } from "../src/build-selection.js";
import {
  createAssemblyBuildHost,
  executeAssemblyBuildOperation,
  readAssemblyBuildManifest,
  readAssemblyBuildOperation,
  type AssemblyLinkedResult,
} from "../src/build.js";

/** Fixture hosts retain real plugin loading/policies while avoiding repeated package hashing in unit tests. */
const host = { ...createAssemblyBuildHost(), fingerprint: () => ({ sha256: "a".repeat(64) }) };

test("native editor selection resolves config-relative manifests and explicit workspace overrides", async (t) => {
  const fixture = setup(t);
  const selected = await resolveAssemblyBuildSelection(fixture.directory);
  t.is(selected.manifest, fixture.manifest);
  t.is(selected.configurationFile, path.join(fixture.directory, "uttori-asm.config.json"));
  const override = await resolveAssemblyBuildSelection(
    fixture.directory,
    undefined,
    "other/build.json",
  );
  t.is(override.manifest, path.join(fixture.directory, "other/build.json"));
  fs.appendFileSync(path.join(fixture.directory, "uttori-asm.config.json"), " ");
  await t.throwsAsync(
    executeAssemblyBuildOperation(
      {
        action: "build-linked",
        directory: fixture.directory,
        manifest: fixture.manifest,
        selection: { file: selected.configurationFile!, sha256: selected.configurationSha256! },
      },
      {},
      host,
    ),
    { message: /selection configuration changed/ },
  );
  t.false(fs.existsSync(path.join(fixture.directory, "build/current.json")));
});

test("plugins without the additive link capability retain object assembly and fail linking clearly", async (t) => {
  const fixture = setup(t);
  const legacyPlugin: typeof snesPlugin = {
    ...snesPlugin,
    activate(context, options) {
      return snesPlugin.activate(
        {
          ...context,
          registerTarget(target) {
            const { createLinkTarget: _link, ...absoluteTarget } = target;
            context.registerTarget(absoluteTarget);
          },
        },
        options,
      );
    },
  };
  const legacyHost = {
    ...createAssemblyBuildHost([["@uttori/asm-plugin-snes", legacyPlugin]]),
    fingerprint: host.fingerprint,
  };
  const object = await executeAssemblyBuildOperation(
    {
      action: "assemble-object",
      directory: fixture.directory,
      source: "main.asm",
      output: "main.uobj",
      module: "main",
    },
    {},
    legacyHost,
  );
  t.is(object.kind, "object");
  await t.throwsAsync(
    executeAssemblyBuildOperation(
      { action: "build-linked", directory: fixture.directory, manifest: fixture.manifest },
      {},
      legacyHost,
    ),
    { message: /does not provide a link policy/ },
  );
  t.false(fs.existsSync(path.join(fixture.directory, "build/current.json")));
});
function setup(t: { teardown(callback: () => void): void }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-native-build-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = createLinkedBuildFixture(directory);
  return { directory, ...fixture };
}
function linked(
  value: Awaited<ReturnType<typeof executeAssemblyBuildOperation>>,
): AssemblyLinkedResult {
  if (value.kind !== "linked") {
    throw new Error("Expected linked result.");
  }
  return value;
}

test("composed builds match independent ROM bytes and reuse immutable artifact sets", async (t) => {
  const fixture = setup(t);
  const operation = {
    action: "build-linked",
    directory: fixture.directory,
    manifest: fixture.manifest,
  } as const;
  const first = linked(await executeAssemblyBuildOperation(operation, {}, host));
  t.deepEqual(fs.readFileSync(first.outputFile), Buffer.from(fixture.original));
  t.true(first.outputChanged);
  t.true(first.inputs.some((input) => input.path.endsWith("payload.bin")));
  t.true(first.inputs.some((input) => input.path.endsWith("recipe.json")));
  const second = linked(await executeAssemblyBuildOperation(operation, {}, host));
  t.is(second.outputFile, first.outputFile);
  t.false(second.outputChanged);
  t.false(second.debugMapChanged);
  const before = fs.readFileSync(path.join(fixture.directory, "build/current.json"));
  fs.writeFileSync(
    path.join(fixture.directory, "helper.asm"),
    'section "Code"\nexport Helper\nHelper: nop\n',
  );
  await t.throwsAsync(executeAssemblyBuildOperation(operation, {}, host), {
    message: /differs from the original/,
  });
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, "build/current.json")), before);
});

test("independent objects and indexed libraries link without their original source or assets", async (t) => {
  const fixture = setup(t);
  for (const module of ["main", "helper"]) {
    await executeAssemblyBuildOperation(
      {
        action: "assemble-object",
        directory: fixture.directory,
        source: `${module}.asm`,
        output: `${module}.uobj`,
        module,
      },
      {},
      host,
    );
  }
  t.is(decodeObject(fs.readFileSync(path.join(fixture.directory, "main.uobj"))).id, "main");
  await executeAssemblyBuildOperation(
    {
      action: "library",
      directory: fixture.directory,
      output: "helpers.ulib",
      objects: ["helper.uobj"],
    },
    {},
    host,
  );
  t.deepEqual(
    [...decodeLibrary(fs.readFileSync(path.join(fixture.directory, "helpers.ulib"))).index.keys()],
    ["Helper"],
  );
  for (const file of ["main.asm", "helper.asm", "payload.bin", "helper.uobj"]) {
    fs.unlinkSync(path.join(fixture.directory, file));
  }
  fs.writeFileSync(
    fixture.manifest,
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      recipe: "recipe.json",
      objects: ["main.uobj"],
      libraries: ["helpers.ulib"],
      original: "original.sfc",
    }),
  );
  const built = linked(
    await executeAssemblyBuildOperation(
      { action: "link", directory: fixture.directory, manifest: fixture.manifest },
      {},
      host,
    ),
  );
  t.deepEqual(fs.readFileSync(built.outputFile), Buffer.from(fixture.original));
  t.true(fs.existsSync(built.symbolsFile));
  t.true(fs.existsSync(built.allocationFile));
});

test("publication rechecks saved inputs after the editor check and respects cancellation", async (t) => {
  const fixture = setup(t);
  const operation = {
    action: "build-linked",
    directory: fixture.directory,
    manifest: fixture.manifest,
  } as const;
  await t.throwsAsync(
    executeAssemblyBuildOperation(
      operation,
      { beforePublish: () => fs.appendFileSync(fixture.manifest, " ") },
      host,
    ),
    { message: /changed during assembly/ },
  );
  t.false(fs.existsSync(path.join(fixture.directory, "build/current.json")));
  const cancellation = new AbortController();
  await t.throwsAsync(
    executeAssemblyBuildOperation(
      operation,
      { beforePublish: () => cancellation.abort(), signal: cancellation.signal },
      host,
    ),
    { name: "AbortError" },
  );
  t.false(fs.existsSync(path.join(fixture.directory, "build/current.json")));
});

test("object and library outputs cannot overwrite or alias consumed inputs", async (t) => {
  const fixture = setup(t);
  const source = path.join(fixture.directory, "main.asm");
  fs.linkSync(source, path.join(fixture.directory, "alias.uobj"));
  for (const output of ["main.asm", "alias.uobj"]) {
    await t.throwsAsync(
      executeAssemblyBuildOperation(
        { action: "assemble-object", directory: fixture.directory, source, output, module: "main" },
        {},
        host,
      ),
      { message: /overwrite|aliases/ },
    );
  }
  t.true(fs.readFileSync(source, "utf8").startsWith('section "Code"'));
});

test("strict host contracts reject unsupported versions, misspellings and implicit source linking", async (t) => {
  t.throws(() => readAssemblyBuildManifest({ format: "uttori-build", version: 2, recipe: {} }), {
    message: /version 1/,
  });
  t.throws(
    () => readAssemblyBuildManifest({ format: "uttori-build", version: 1, recipe: {}, module: [] }),
    { message: /Unknown.*module/ },
  );
  t.throws(
    () =>
      readAssemblyBuildManifest({
        format: "uttori-build",
        version: 1,
        recipe: {},
        modules: [
          { id: "main", source: "a.asm" },
          { id: "main", source: "b.asm" },
        ],
      }),
    { message: /Duplicate/ },
  );
  t.throws(
    () =>
      readAssemblyBuildOperation({
        action: "link",
        directory: ".",
        manifest: "build.json",
        source: "main.asm",
      }),
    { message: /does not accept source/ },
  );
  const fixture = setup(t);
  await t.throwsAsync(
    executeAssemblyBuildOperation(
      { action: "link", directory: fixture.directory, manifest: fixture.manifest },
      {},
      host,
    ),
    { message: /serialized.*only/ },
  );
});
