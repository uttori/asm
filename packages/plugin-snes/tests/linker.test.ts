import { Assembler, type AssemblyLinkRecipe } from "@uttori/asm-core";
import { debugMapRangesForSource, validateDebugMap } from "@uttori/asm-core/debug-map";
import { encodeLibrary, encodeObject, linkObjects } from "@uttori/asm-core/linker";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { createSnesLinkTarget } from "../src/target/link-target.js";

const environment = await createSnesAssemblerEnvironment();
function object(id: string, source: string, architecture = "snes.65816"): Uint8Array {
  const assembler = new Assembler({
    environment,
    target: "snes.sfc",
    architecture,
    module: { id },
  });
  try {
    assembler.assembleSource(source, `${id}.asm`);
    return encodeObject(assembler.getAssemblyModule());
  } finally {
    assembler.dispose();
  }
}
const target = createSnesLinkTarget();

test("SNES libraries resolve instruction/data/struct references and debug addresses after movement", (t) => {
  const main = object(
    "main",
    `import Draw,Data
section "Code"
Start:
jsl Draw
lda.l Data
lda.w Data
db bank(Data)
bra Start
struct Record 0
.pointer: dl
endstruct
section "Tables",data
dataStruct Record,{pointer=Data}
`,
  );
  const archive = encodeLibrary([
    {
      name: "draw.o",
      object: object("draw", 'export Draw\nimport Data\nsection "Code"\nDraw:\nrts\n'),
    },
    { name: "data.o", object: object("data", 'export Data\nsection "Data",data\nData:\ndb $42\n') },
  ]);
  const recipe: AssemblyLinkRecipe = {
    target: "snes.sfc",
    targetOptions: { mapper: "hirom" },
    regions: [
      {
        name: "ROM",
        start: 0xc00000,
        size: 0x10020,
        outputOffset: 0,
        addressSpace: "snes.cpu",
        fillByte: 0xff,
      },
    ],
    placements: [
      { section: "Code", load: "ROM", run: "ROM" },
      { section: "Tables", load: "ROM", run: "ROM", start: 0xc00040 },
      { section: "Data", load: "ROM", run: "ROM", start: 0xc10000 },
    ],
    assumptions: [{ section: "Code", dataBank: 0xc1 }],
  };
  const result = linkObjects({ objects: [main], libraries: [archive], recipe, target });
  t.deepEqual(
    [...result.output.subarray(0, 15)],
    [0x22, 14, 0, 0xc0, 0xaf, 0, 0, 0xc1, 0xad, 0, 0, 0xc1, 0x80, 0xf2, 0x60],
  );
  t.deepEqual([...result.output.subarray(0x40, 0x43)], [0, 0, 0xc1]);
  t.is(result.output[0x10000], 0x42);
  t.is(result.debugMap.fields?.[0].address, 0xc00040);
  t.deepEqual(result.debugMap.instructions?.[0].operands, [
    { expression: "Draw", value: 0xc0000e },
  ]);
  t.true(
    debugMapRangesForSource(result.debugMap, "main.asm", 4).some(
      (range) => range.start === 0xc00000,
    ),
  );
  t.deepEqual(validateDebugMap(result.debugMap, result.output), []);
  const moved = linkObjects({
    objects: [main],
    libraries: [archive],
    recipe: {
      ...recipe,
      regions: [{ ...recipe.regions[0], size: 0x20020 }],
      placements: recipe.placements.map((placement) =>
        placement.section === "Data"
          ? Object.assign({}, placement, { start: 0xc20000 })
          : placement,
      ),
      assumptions: [{ section: "Code", dataBank: 0xc2 }],
    },
    target,
  });
  t.is(moved.output[7], 0xc2);
  t.is(moved.output[11], 0xc2);
  t.is(moved.output[0x42], 0xc2);
});

test("SPC700 packed bits and SuperFX scaled fields are checked against their original symbolic addresses", (t) => {
  const spc = object("spc", 'import Address\nsection "Code"\nMOV1 C,Address.2\n', "snes.spc700");
  const superfx = object(
    "sfx",
    'import Address\nsection "Code"\nLMS R4,(Address)\n',
    "snes.superfx",
  );
  const recipe: AssemblyLinkRecipe = {
    target: "snes.sfc",
    regions: [{ name: "RAMLOAD", start: 0, size: 8, outputOffset: 0 }],
    placements: [{ section: "Code", load: "RAMLOAD", run: "RAMLOAD" }],
    symbols: [{ name: "Address", expression: { kind: "constant", value: 0x100 } }],
  };
  t.deepEqual([...linkObjects({ objects: [spc], recipe }).output.subarray(0, 3)], [0xaa, 0, 0x41]);
  t.deepEqual(
    [...linkObjects({ objects: [superfx], recipe }).output.subarray(0, 3)],
    [0x3d, 0xa4, 0x80],
  );
  t.throws(
    () =>
      linkObjects({
        objects: [superfx],
        recipe: {
          ...recipe,
          symbols: [{ name: "Address", expression: { kind: "constant", value: 0x101 } }],
        },
      }),
    { message: /range\/alignment/ },
  );
});

test("indirect jumps use bank-zero pointers while unmasked near calls retain program-bank checks", (t) => {
  const recipe: AssemblyLinkRecipe = {
    target: "snes.sfc",
    targetOptions: { mapper: "hirom" },
    regions: [{ name: "ROM", start: 0xc00000, size: 16, outputOffset: 0 }],
    placements: [{ section: ".text", load: "ROM", run: "ROM" }],
    symbols: [{ name: "Pointer", expression: { kind: "constant", value: 0x1234 } }],
  };
  const indirect = linkObjects({
    objects: [object("indirect", "import Pointer\nJMP (Pointer)\nJML [Pointer]\n")],
    recipe,
    target,
  });
  t.deepEqual([...indirect.output.subarray(0, 6)], [0x6c, 0x34, 0x12, 0xdc, 0x34, 0x12]);
  t.throws(
    () =>
      linkObjects({ objects: [object("near", "import Pointer\nJSR Pointer\n")], recipe, target }),
    { message: /another program bank/ },
  );
});

test("SNES checksum finalization preserves container headers and runs only for explicit recomputation", (t) => {
  const header = Array.from({ length: 512 }, (_, index) => index & 255);
  const recipe: AssemblyLinkRecipe = {
    target: "snes.sfc",
    targetOptions: { mapper: "lorom", headerSize: 512 },
    checksumPolicy: "recompute",
    regions: [
      { name: "Container", start: 0, size: 512, outputOffset: 0, initialBytes: header },
      { name: "ROM", start: 0x808000, size: 0x8000, outputOffset: 512 },
    ],
    placements: [{ section: ".text", load: "ROM", run: "ROM" }],
  };
  const result = linkObjects({ objects: [object("checksum", "nop\n")], recipe, target });
  t.deepEqual([...result.output.subarray(0, 512)], header);
  const sum = result.output[512 + 0x7fde] + result.output[512 + 0x7fdf] * 256;
  const complement = result.output[512 + 0x7fdc] + result.output[512 + 0x7fdd] * 256;
  t.is(sum + complement, 65535);
  t.true(sum > 0);
  t.throws(() => linkObjects({ objects: [object("no-finalizer", "nop\n")], recipe }), {
    message: /explicit target finalizer/,
  });
});

test("SuperFX branches retain their 16-bit PC wrap at the end of a program bank", (t) => {
  const branch = object("sfx-edge", "import Target\nBRA Target\n", "snes.superfx");
  const recipe: AssemblyLinkRecipe = {
    target: "snes.sfc",
    regions: [{ name: "Code", start: 0xfffe, size: 2, outputOffset: 0 }],
    placements: [{ section: ".text", load: "Code", run: "Code" }],
    symbols: [{ name: "Target", expression: { kind: "constant", value: 0 } }],
  };
  t.deepEqual([...linkObjects({ objects: [branch], recipe }).output], [5, 0]);
});
