import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler } from "@uttori/asm-core";
import { encodeLibrary, encodeObject, linkObjects } from "@uttori/asm-core/linker";

import { test } from "../../../tests/ava-helper.js";
import { create65xxAssemblerEnvironment, createNesLinkTarget } from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

test("independently assembled NES objects and indexed libraries reproduce the absolute iNES ROM in a fresh process", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nes-library-link-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const absolute = new Assembler({ environment, target: "65xx.nes" });
  const main = new Assembler({ environment, target: "65xx.nes", module: { id: "main" } });
  const routine = new Assembler({ environment, target: "65xx.nes", module: { id: "routine" } });
  t.teardown(() => {
    absolute.dispose();
    main.dispose();
    routine.dispose();
  });
  absolute.assembleSource(
    '.segment "CODE"\njsr Routine\nrts\nRoutine:\nlda #$42\nrts\n',
    "absolute.asm",
  );
  main.assembleSource('.import Routine\n.segment "CODE"\njsr Routine\nrts\n', "main.asm");
  routine.assembleSource(
    '.export Routine\n.segment "CODE"\nRoutine:\nlda #$42\nrts\n',
    "routine.asm",
  );
  const object = encodeObject(main.getAssemblyModule());
  const archive = encodeLibrary([
    { name: "routine.o", object: encodeObject(routine.getAssemblyModule()) },
  ]);
  const recipe = main.getLinkRecipe()!;
  const original = absolute.getBinaryOutput();
  const linked = linkObjects({
    objects: [object],
    libraries: [archive],
    recipe,
    target: createNesLinkTarget(),
  });
  t.deepEqual(linked.output, original);
  fs.writeFileSync(path.join(root, "main.uobj"), object);
  fs.writeFileSync(path.join(root, "routines.ulib"), archive);
  fs.writeFileSync(
    path.join(root, "link-input.json"),
    JSON.stringify({ objects: ["main.uobj"], libraries: ["routines.ulib"], recipe }),
  );
  const child = spawnSync(
    process.execPath,
    [
      "--conditions=uttori-source",
      "--import=tsx",
      path.resolve("packages/plugin-snes/tests/fixtures/link-objects.mjs"),
      root,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  t.is(child.status, 0, child.stderr);
  const receipt = JSON.parse(child.stdout);
  t.deepEqual(fs.readFileSync(receipt.outputFile), Buffer.from(original));
});

for (const fillByte of [0xff, 0x7b]) {
  test(`NES link recipes preserve the target fallback fill without MEMORY fill=yes ($${fillByte.toString(16)})`, (t) => {
    const targetOptions = {
      fillByte,
      linkerConfig:
        "MEMORY { ROM: start=$8000,size=$8000,file=%O; } SEGMENTS { CODE: load=ROM,type=ro; }",
    };
    const absolute = new Assembler({ environment, target: "65xx.nes", targetOptions });
    const module = new Assembler({
      environment,
      target: "65xx.nes",
      targetOptions,
      module: { id: "fill" },
    });
    t.teardown(() => {
      absolute.dispose();
      module.dispose();
    });
    absolute.assembleSource('.segment "CODE"\nnop', "absolute.asm");
    module.assembleSource('.segment "CODE"\nnop', "module.asm");
    const linked = linkObjects({
      objects: [encodeObject(module.getAssemblyModule())],
      recipe: module.getLinkRecipe()!,
      target: createNesLinkTarget(),
    });
    t.deepEqual(linked.output, absolute.getBinaryOutput());
    t.is(linked.output[17], fillByte);
    t.is(linked.output.at(-1), fillByte);
  });
}
