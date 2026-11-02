import fs from "node:fs";

import { Assembler, type AssemblyLinkRecipe, type AssemblyModule } from "@uttori/asm-core";
import { encodeObject, linkObjects } from "@uttori/asm-core/linker";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { createSnesLinkTarget } from "../src/target/link-target.js";

const environment = await createSnesAssemblerEnvironment();

/** Compare both complete production pipelines without changing or rewriting the input source. */
function adapted(source: string): {
  original: Uint8Array;
  module: AssemblyModule;
  recipe: AssemblyLinkRecipe;
  linked: Uint8Array;
} {
  const absolute = new Assembler({
    environment,
    target: "snes.sfc",
    targetOptions: { checksumEnabled: false },
  });
  const assembler = new Assembler({
    environment,
    target: "snes.sfc",
    targetOptions: { checksumEnabled: false },
    module: { id: "compat", sourceAdapter: "asar" },
  });
  try {
    absolute.assembleSource(source, "source.asm");
    assembler.assembleSource(source, "source.asm");
    const module = assembler.getAssemblyModule();
    const recipe = assembler.getLinkRecipe()!;
    return {
      original: absolute.getBinaryOutput(),
      module,
      recipe,
      linked: linkObjects({
        objects: [encodeObject(module)],
        recipe,
        target: createSnesLinkTarget(),
      }).output,
    };
  } finally {
    absolute.dispose();
    assembler.dispose();
  }
}

test("Asar adapter preserves width choices, branches, padding and symbolic data bytes", (t) => {
  const result = adapted(
    "lorom\norg $008000\nStart:\nlda #Target\nlda Target\nlda Target,x\njsl Target\nbra Target\nTarget:\nrtl\npadbyte $FF\npad $008100\ndl Start\n",
  );
  t.deepEqual(result.linked, result.original);
  t.true(result.module.fixups.length >= 5);
  t.true(result.module.symbols.some((symbol) => symbol.value?.kind === "section"));
});

test("Asar adapter retains load/run separation and pushpc restoration with complete ROM equality", (t) => {
  const result = adapted(
    "lorom\norg $008000\nStart:\njsl Other\npushpc\norg $008020\nOther:\nrtl\npullpc\ndl Other\nbase $7E2000\nRam:\ndw Ram\npushbase\nbase $7E4000\ndb 0\npullbase\ndl Ram\nbase off\ndl Ram\n",
  );
  t.deepEqual(result.linked, result.original);
  const run = result.recipe.regions.find((region) => region.start === 0x7e2000);
  t.truthy(run);
  t.is(run?.outputOffset, undefined);
});

test("Asar adapter matches the native Asar immediate-width golden and implied repeat conventions", (t) => {
  const fixture = new URL(
    "../../../fixtures/asar/tests/65816-immediate-label-width.asm",
    import.meta.url,
  );
  const golden = new URL(
    "../../../fixtures/asar/expected/65816-immediate-label-width.asm.sfc",
    import.meta.url,
  );
  t.deepEqual(
    Buffer.from(adapted(fs.readFileSync(fixture, "utf8")).linked),
    fs.readFileSync(golden),
  );
  const repeated = adapted("lorom\norg $008000\nnop #$20\nasl #$20\nrtl\n");
  t.deepEqual(repeated.linked, repeated.original);
});

test("Asar-derived sections remain movable with repaired calls and pointer fields", (t) => {
  const result = adapted("lorom\norg $808000\nStart:\njsl Target\ndl Target\nTarget:\nrtl\n");
  const moved: AssemblyLinkRecipe = {
    ...result.recipe,
    regions: result.recipe.regions.map((region) => ({
      ...region,
      start: region.start + 0x100,
      outputOffset: (region.outputOffset ?? 0) + 0x100,
    })),
  };
  const linked = linkObjects({
    objects: [encodeObject(result.module)],
    recipe: moved,
    target: createSnesLinkTarget(),
  });
  t.deepEqual(
    Array.from(linked.output.slice(0x100, 0x108)),
    [0x22, 0x07, 0x81, 0x80, 0x07, 0x81, 0x80, 0x6b],
  );
  t.true(linked.debugMap.instructions!.some((instruction) => instruction.address === 0x808100));
});

test("source layout is opt-in and overlapping patches are rejected without changing absolute support", (t) => {
  const source = "lorom\norg $008000\ndb 1,2\norg $008000\ndb 3\n";
  const absolute = new Assembler({
    environment,
    target: "snes.sfc",
    targetOptions: { checksumEnabled: false },
  });
  const native = new Assembler({ environment, target: "snes.sfc", module: { id: "native" } });
  const adapter = new Assembler({
    environment,
    target: "snes.sfc",
    module: { id: "adapted", sourceAdapter: "asar" },
  });
  try {
    absolute.assembleSource(source, "patch.asm");
    t.deepEqual([...absolute.getBinaryOutput()], [3, 2]);
    t.throws(() => native.assembleSource(source, "patch.asm"), {
      message: /requires absolute placement/,
    });
    adapter.assembleSource(source, "patch.asm");
    t.throws(() => adapter.getLinkRecipe(), { message: /overlap/ });
  } finally {
    absolute.dispose();
    native.dispose();
    adapter.dispose();
  }
});
