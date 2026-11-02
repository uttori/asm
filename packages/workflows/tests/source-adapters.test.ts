import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler } from "@uttori/asm-core";
import {
  create65xxAssemblerEnvironment,
  createNes65xxTargetOptions,
} from "@uttori/asm-plugin-65xx";
import { createSnesAssemblerEnvironment } from "@uttori/asm-plugin-snes";

import { test } from "../../../tests/ava-helper.js";
import {
  createAssemblyBuildHost,
  executeAssemblyBuildOperation,
  readAssemblyBuildManifest,
  readAssemblyBuildOperation,
  readAssemblyBuildResult,
  type AssemblyLinkedResult,
} from "../src/build.js";

const host = { ...createAssemblyBuildHost(), fingerprint: () => ({ sha256: "a".repeat(64) }) };

function directory(t: { teardown(callback: () => void): void }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-adapter-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function linked(
  value: Awaited<ReturnType<typeof executeAssemblyBuildOperation>>,
): AssemblyLinkedResult {
  if (value.kind !== "linked") {
    throw new Error("Expected a linked build.");
  }
  return value;
}

test("Asar modules derive and publish a combined recipe, then relink after their sources are removed", async (t) => {
  const root = directory(t);
  const environment = await createSnesAssemblerEnvironment();
  const absolute = new Assembler({
    environment,
    target: "snes.sfc",
    targetOptions: { checksumEnabled: false },
  });
  const main = "lorom\norg $008000\nimport Helper\nStart:\njsl Helper\ndl Helper\n";
  const helper = "lorom\norg $008020\nexport Helper\nHelper:\nrtl\n";
  // The absolute oracle is one translation unit, so module interface declarations are removed.
  absolute.assembleSource(
    main.replace("import Helper\n", "") + helper.replace("export Helper\n", ""),
    path.join(root, "absolute.asm"),
  );
  const original = absolute.getBinaryOutput();
  absolute.dispose();
  fs.writeFileSync(path.join(root, "main.asm"), main);
  fs.writeFileSync(path.join(root, "helper.asm"), helper);
  fs.writeFileSync(
    path.join(root, "compiler.json"),
    JSON.stringify({
      plugins: [{ module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } }],
      target: "snes.sfc",
    }),
  );
  fs.writeFileSync(path.join(root, "original.sfc"), original);
  const manifest = {
    format: "uttori-build",
    version: 1,
    config: "compiler.json",
    modules: [
      { id: "main", source: "main.asm", sourceAdapter: "asar" },
      { id: "helper", source: "helper.asm", sourceAdapter: "asar" },
    ],
    recipe: { from: "modules", target: "snes.sfc" },
    original: "original.sfc",
    outputDirectory: "build",
  };
  fs.writeFileSync(path.join(root, "build.json"), JSON.stringify(manifest));
  const built = linked(
    await executeAssemblyBuildOperation(
      { action: "build-linked", directory: root, manifest: "build.json" },
      {},
      host,
    ),
  );
  t.deepEqual(fs.readFileSync(built.outputFile), Buffer.from(original));
  t.true(fs.existsSync(built.recipeFile!));
  for (const id of ["main", "helper"]) {
    const object = await executeAssemblyBuildOperation(
      {
        action: "assemble-object",
        directory: root,
        source: `${id}.asm`,
        output: `${id}.uobj`,
        module: id,
        sourceAdapter: "asar",
        config: "compiler.json",
      },
      {},
      host,
    );
    t.is(object.kind, "object");
    if (object.kind !== "linked") {
      t.truthy(object.linkRecipe);
    }
    fs.unlinkSync(path.join(root, `${id}.asm`));
  }
  fs.writeFileSync(
    path.join(root, "link.json"),
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      config: "compiler.json",
      objects: ["main.uobj", "helper.uobj"],
      recipe: built.recipeFile,
      original: "original.sfc",
    }),
  );
  const rebuilt = linked(
    await executeAssemblyBuildOperation(
      { action: "link", directory: root, manifest: "link.json" },
      {},
      host,
    ),
  );
  t.deepEqual(fs.readFileSync(rebuilt.outputFile), Buffer.from(original));
});

test("ca65 modules reuse configured segments, exports, imports, load/run overlays and BSS without a duplicate recipe", async (t) => {
  const root = directory(t);
  const linkerConfig =
    'MEMORY { RAM: start=$0200, size=$100, file=""; ROM: start=$8000, size=$8000, file=%O, fill=yes; } SEGMENTS { CODE: load=ROM, type=ro, define=yes; DATA: load=ROM, run=RAM, type=rw, define=yes; BSS: load=RAM, type=bss, define=yes; }';
  const main = '.import Helper,Data\n.segment "CODE"\nStart:\njsr Helper\n.addr Data\n';
  const helper =
    '.export Helper,Data\n.segment "CODE"\nHelper:\nrts\n.segment "DATA"\nData:\n.byte $AA,$55\n.segment "BSS"\nScratch:\n.res 8\n';
  const environment = await create65xxAssemblerEnvironment();
  const absolute = new Assembler({
    environment,
    target: "65xx.nes",
    targetOptions: createNes65xxTargetOptions({ linkerConfig }),
  });
  fs.writeFileSync(path.join(root, "main.asm"), main);
  fs.writeFileSync(path.join(root, "helper.asm"), helper);
  absolute.assembleSource('.include "main.asm"\n.include "helper.asm"', path.join(root, "all.asm"));
  const original = absolute.getBinaryOutput();
  absolute.dispose();
  fs.writeFileSync(
    path.join(root, "compiler.json"),
    JSON.stringify({
      plugins: [{ module: "@uttori/asm-plugin-65xx", options: { linkerConfig } }],
      target: "65xx.nes",
    }),
  );
  fs.writeFileSync(path.join(root, "original.nes"), original);
  fs.writeFileSync(
    path.join(root, "build.json"),
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      config: "compiler.json",
      modules: [
        { id: "main", source: "main.asm", sourceAdapter: "ca65" },
        { id: "helper", source: "helper.asm", sourceAdapter: "ca65" },
      ],
      recipe: { from: "modules", target: "65xx.nes" },
      original: "original.nes",
    }),
  );
  const built = linked(
    await executeAssemblyBuildOperation(
      { action: "build-linked", directory: root, manifest: "build.json" },
      {},
      host,
    ),
  );
  t.deepEqual(fs.readFileSync(built.outputFile), Buffer.from(original));
  const report = JSON.parse(fs.readFileSync(built.allocationFile, "utf8"));
  t.true(
    report.allocations.some(
      (allocation: { kind: string; size: number }) =>
        allocation.kind === "bss" && allocation.size === 8,
    ),
  );
});

test("adapter selection and derived recipe receipts fail closed across host boundaries", (t) => {
  const manifest = {
    format: "uttori-build",
    version: 1,
    modules: [{ id: "main", source: "main.asm", sourceAdapter: "asar" }],
    recipe: { from: "modules", target: "snes.sfc" },
  };
  t.deepEqual(readAssemblyBuildManifest(manifest), manifest);
  t.throws(() => readAssemblyBuildManifest({ ...manifest, modules: [] }), {
    message: /requires source modules/,
  });
  t.throws(
    () =>
      readAssemblyBuildManifest({
        ...manifest,
        modules: [{ id: "main", source: "main.asm", sourceAdapter: "guess" }],
      }),
    { message: /sourceAdapter/ },
  );
  t.throws(
    () =>
      readAssemblyBuildOperation({
        action: "assemble-object",
        directory: "/project",
        source: "main.asm",
        output: "main.uobj",
        module: "main",
        sourceAdapter: "guess",
      }),
    { message: /sourceAdapter/ },
  );
  t.throws(() =>
    readAssemblyBuildResult({
      kind: "object",
      outputFile: "main.uobj",
      sha256: "a".repeat(64),
      bytes: 1,
      linkRecipe: { from: "modules", target: "snes.sfc" },
    }),
  );
});
