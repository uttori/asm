import { Assembler } from "@uttori/asm-core";
import { encodeObject, linkObjects } from "@uttori/asm-core/linker";

import { test } from "../../../tests/ava-helper.js";
import { create65xxAssemblerEnvironment, createNesLinkTarget } from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

test("NES Asar adapter preserves physical ORG, logical BASE, zero-page choices and the complete iNES container", (t) => {
  const targetOptions = { sourceStyle: "asar", fillByte: 0x7b };
  const absolute = new Assembler({ environment, target: "65xx.nes", targetOptions });
  const module = new Assembler({
    environment,
    target: "65xx.nes",
    targetOptions,
    module: { id: "nes-asar", sourceAdapter: "asar" },
  });
  try {
    const source =
      "org 0\nbase $8000\nStart:\njsr Routine\ndw Routine\nRoutine:\nrts\norg $100\nbase $20\nZero:\ndb 0\norg $200\nbase $8100\nlda Zero\nlda Zero,x\nbne Here\nHere:\nrts\n";
    absolute.assembleSource(source, "nes-asar.asm");
    module.assembleSource(source, "nes-asar.asm");
    const recipe = module.getLinkRecipe()!;
    const linked = linkObjects({
      objects: [encodeObject(module.getAssemblyModule())],
      recipe,
      target: createNesLinkTarget(),
    });
    t.deepEqual(linked.output, absolute.getBinaryOutput());
    t.is(linked.output[0x210], 0xa5);
    t.is(linked.output.at(-1), 0x7b);
    t.is(recipe.regions[0].initialBytes?.length, 16);
  } finally {
    absolute.dispose();
    module.dispose();
  }
});
