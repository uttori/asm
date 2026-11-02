import { Assembler } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
  NES_65XX_TARGET_ID,
} from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

test("65xx module forms retain compound, prefixed, and relative fields across CPU variants", (t) => {
  const cases = [
    ["65xx.6502", "LDA.w External\nBNE External", [0xad, 0, 0, 0xd0, 0], [2, 1]],
    ["65xx.huc6280", "TII External,External+2,4", [0x73, 0, 0, 0, 0, 4, 0], [2, 2]],
    ["65xx.45gs02", "LDQ External", [0x42, 0x42, 0xad, 0, 0], [2]],
    ["65xx.m740", "LDM $12,#<External", [0x3c, 0x12, 0], [1]],
  ] as const;
  for (const [architecture, body, bytes, widths] of cases) {
    const assembler = new Assembler({
      environment,
      target: RAW_65XX_TARGET_ID,
      architecture,
      module: { id: architecture },
    });
    try {
      assembler.assembleSource(`import External\n${body}`, "module.asm");
      const module = assembler.getAssemblyModule();
      t.deepEqual([...module.sections[0].bytes], [...bytes], architecture);
      t.deepEqual(
        module.fixups.map((fixup) => fixup.encoding.width),
        [...widths],
        architecture,
      );
      t.true(module.fixups.every((fixup) => fixup.source.file === "module.asm"));
    } finally {
      assembler.dispose();
    }
  }
});

test("NES ca65 module directives preserve mapped data and lower target layout without filling a ROM", (t) => {
  const assembler = new Assembler({
    environment,
    target: NES_65XX_TARGET_ID,
    module: { id: "nes-unit" },
  });
  try {
    assembler.assembleSource(
      '.import External\n.segment "CODE"\nStart:\nLDA #<External\n.addr External\n.hibytes External\n.dbyt External\n.align 16\n.export Start\n',
      "nes.asm",
    );
    const module = assembler.getAssemblyModule();
    t.is(module.sections[0].name, "CODE");
    t.is(module.sections[0].alignment, 16);
    t.is(module.sections[0].size, 16);
    t.is(module.fixups.length, 4);
    t.is(module.fixups[3].encoding.endianness, "big");
    t.deepEqual(module.fixups[2].expression, {
      kind: "unary",
      operator: "high",
      argument: { kind: "symbol", name: "External" },
    });
    t.is(module.symbols.find((symbol) => symbol.name === "Start")?.visibility, "export");
    const recipe = assembler.getLinkRecipe()!;
    t.deepEqual(recipe.regions[0].initialBytes?.slice(0, 4), [0x4e, 0x45, 0x53, 0x1a]);
    t.is(recipe.regions[1].outputOffset, 16);
    t.deepEqual(recipe.placements, [{ section: "CODE", load: "ROM", run: "ROM" }]);
    t.is(assembler.outputBytes.length, 0);
  } finally {
    assembler.dispose();
  }
});
