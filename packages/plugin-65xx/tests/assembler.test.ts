import { test } from "../../../tests/ava-helper.js";

import fs from "node:fs";

import { Assembler } from "@uttori/asm-core";
import plugin65xx, { create65xxAssemblerEnvironment, RAW_65XX_TARGET_ID } from "../src/index.js";
import { PluginManager } from "../../../packages/core/src/plugin/manager.js";

const environment = await create65xxAssemblerEnvironment();

interface DifferentialFixture {
  readonly oracle: { readonly release: string; readonly commit: string };
  readonly cases: ReadonlyArray<{
    readonly opcode: number;
    readonly mnemonic: string;
    readonly mode: string;
    readonly documented: boolean;
    readonly source: string;
    readonly bytes: readonly number[];
  }>;
}

const differentialFixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures/ca65-v2.19-nmos-differential.json", import.meta.url), "utf8"),
) as DifferentialFixture;

interface VariantDifferentialFixture {
  readonly oracle: {
    readonly release: string;
    readonly commit: string;
    readonly instructionTableSha256: string;
  };
  readonly variants: ReadonlyArray<{
    readonly cpu: string;
    readonly sha256: string;
    readonly cases: ReadonlyArray<{
      readonly mnemonic: string;
      readonly mode: string;
      readonly source: string;
      readonly bytes: readonly number[];
    }>;
  }>;
}

const variantDifferentialFixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/ca65-e11fb5c-phase4-5-differential.json", import.meta.url),
    "utf8",
  ),
) as VariantDifferentialFixture;

const phase6DifferentialFixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/ca65-e11fb5c-phase6-differential.json", import.meta.url),
    "utf8",
  ),
) as VariantDifferentialFixture;

function assemble(
  source: string,
  options: { architecture?: string; origin?: number; target?: string } = {},
): Uint8Array {
  const origin = options.origin ?? 0;
  const assembler = new Assembler({
    environment,
    target: options.target ?? RAW_65XX_TARGET_ID,
    architecture: options.architecture,
    targetOptions: { origin },
  });
  try {
    assembler.assembleSource(source, "fixture.asm");
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
}

test("raw target assembles a legal 6502 addressing-mode program", (t) => {
  const source = [
    "org $8000",
    "start:",
    "lda #$12",
    "sta $34",
    "lda $1234",
    "lda $34,x",
    "lda $1234,x",
    "lda $1234,y",
    "lda ($20,x)",
    "lda ($20),y",
    "asl",
    "asl a",
    "jmp ($1234)",
    "bne start",
    "brk #$42",
  ].join("\n");
  t.deepEqual(
    [...assemble(source, { origin: 0x8000 })],
    [
      0xa9, 0x12, 0x85, 0x34, 0xad, 0x34, 0x12, 0xb5, 0x34, 0xbd, 0x34, 0x12, 0xb9, 0x34, 0x12,
      0xa1, 0x20, 0xb1, 0x20, 0x0a, 0x0a, 0x6c, 0x34, 0x12, 0xd0, 0xe6, 0x00, 0x42,
    ],
  );
});

test("zero-page selection, absolute promotion, and explicit width forcing are deterministic", (t) => {
  t.deepEqual(
    [...assemble("lda $12\nlda.w $12\nlda.b $12\njmp $12")],
    [0xa5, 0x12, 0xad, 0x12, 0x00, 0xa5, 0x12, 0x4c, 0x12, 0x00],
  );
  t.throws(() => assemble("lda.b $1234"), { message: /outside the 8-bit range/i });
  t.throws(() => assemble("lda.w #$12"), { message: /width suffix.*not valid/i });
});

test("BRK signature source forms are cataloged and emit one optional byte", (t) => {
  t.deepEqual(
    [...assemble("brk\nbrk #$34\nbrk $56\nbrk $0078")],
    [0x00, 0x00, 0x34, 0x00, 0x56, 0x00, 0x78],
  );
  const brk = environment
    .getToolingCatalog(RAW_65XX_TARGET_ID)
    .getInstructions("6502")
    .find((instruction) => instruction.mnemonic === "BRK");
  t.deepEqual(
    brk?.modes.map((mode) => mode.mode),
    ["implied", "immediate", "zeroPage", "absolute"],
  );
});

test("relative branches support boundary distances, wrapping, and forward labels", (t) => {
  t.deepEqual([...assemble("bne $0081")], [0xd0, 0x7f]);
  t.deepEqual([...assemble("bne $ff82")], [0xd0, 0x80]);
  t.deepEqual([...assemble("bne next\nnop\nnext:\nnop")], [0xd0, 0x01, 0xea, 0xea]);
  t.throws(() => assemble("bne $0082"), { message: /out of range/i });
});

test("6502X owns undocumented ca65 names and common source aliases", (t) => {
  t.throws(() => assemble("slo $20"), { message: /requires architecture '65xx\.6502x'/i });
  t.deepEqual(
    [...assemble("slo $20\nisb $21\nkil", { architecture: "6502x" })],
    [0x07, 0x20, 0xe7, 0x21, 0x02],
  );
});

test("all canonical NMOS forms match the pinned ca65 V2.19 byte fixture", (t) => {
  t.is(differentialFixture.oracle.release, "V2.19");
  t.is(differentialFixture.oracle.commit, "555282497c3ecf8b313d87d5973093af19c35bd5");
  t.is(differentialFixture.cases.length, 221);
  for (const fixture of differentialFixture.cases) {
    const architecture = fixture.documented ? "6502" : "6502x";
    t.deepEqual(
      [...assemble(fixture.source, { architecture })],
      fixture.bytes,
      `${fixture.mnemonic} ${fixture.mode}`,
    );
    if (fixture.documented) {
      t.deepEqual(
        [...assemble(fixture.source, { architecture: "6502x" })],
        fixture.bytes,
        `6502X ${fixture.mnemonic} ${fixture.mode}`,
      );
    }
  }
});

test("NMOS encoding-equivalent chip names resolve as architecture aliases", (t) => {
  for (const alias of ["6502", "6510", "8502", "2A03", "2A07", "6507"]) {
    t.is(environment.resolveArchitectureId(RAW_65XX_TARGET_ID, alias), "65xx.6502", alias);
  }
  const catalog = environment.getToolingCatalog(RAW_65XX_TARGET_ID).getInstructions("6502x");
  t.true(catalog.some((instruction) => instruction.mnemonic === "SLO"));
  t.true(catalog.some((instruction) => instruction.mnemonic === "LDA"));
});

test("65xx package has a valid production plugin export", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: plugin65xx }]);
  t.true(manager.activatedPlugins.some((manifest) => manifest.id === "uttori.asm-plugin-65xx"));
  t.is(manager.freeze().resolveTargetId("6502-raw"), RAW_65XX_TARGET_ID);
  await manager.dispose();
});

test("CMOS identities keep 65SC02, Rockwell, and WDC availability distinct", (t) => {
  t.deepEqual(
    [...assemble("bra next\nlda ($12)\ninc a\nnext:\njmp ($1234,x)", { architecture: "65sc02" })],
    [0x80, 0x03, 0xb2, 0x12, 0x1a, 0x7c, 0x34, 0x12],
  );
  t.throws(() => assemble("rmb0 $12", { architecture: "65sc02" }), {
    message: /instruction.*rmb0/i,
  });
  t.deepEqual(
    [...assemble("bbr0 $12,next\nnop\nnext:\nsmb7 $34", { architecture: "65c02" })],
    [0x0f, 0x12, 0x01, 0xea, 0xf7, 0x34],
  );
  t.throws(() => assemble("wai", { architecture: "65c02" }), { message: /instruction.*wai/i });
  t.deepEqual([...assemble("wai\nstp", { architecture: "w65c02" })], [0xcb, 0xdb]);
});

test("C64DTV owns its documented extensions and supported illegal subset", (t) => {
  t.deepEqual(
    [...assemble("bra next\nsac #$12\nsir #$34\nnext:\nrla $20", { architecture: "6502dtv" })],
    [0x12, 0x04, 0x32, 0x12, 0x42, 0x34, 0x27, 0x20],
  );
});

test("65CE02 and 4510 encode Z, stack, and long-relative forms without leaking into SNES", (t) => {
  t.deepEqual(
    [
      ...assemble("asr $12\nlda ($12),z\nlda ($12,s),y\nldz $1234\nbsr next\nnop\nnext:\naug", {
        architecture: "65ce02",
      }),
    ],
    [0x44, 0x12, 0xb2, 0x12, 0xe2, 0x12, 0xab, 0x34, 0x12, 0x63, 0x02, 0x00, 0xea, 0x5c],
  );
  t.throws(() => assemble("map", { architecture: "65ce02" }), { message: /instruction.*map/i });
  t.deepEqual([...assemble("map", { architecture: "4510" })], [0x5c]);
  t.throws(() => assemble("aug", { architecture: "4510" }), { message: /instruction.*aug/i });
});

test("45GS02 emits Q and 32-bit base-page compound prefixes declaratively", (t) => {
  t.deepEqual(
    [
      ...assemble("ldq $1234\naslq q\nlda [$12],z\nldq [$34],z", {
        architecture: "45gs02",
      }),
    ],
    [
      0x42, 0x42, 0xad, 0x34, 0x12, 0x42, 0x42, 0x0a, 0xea, 0xb2, 0x12, 0x42, 0x42, 0xea, 0xb2,
      0x34,
    ],
  );
});

test("HuC6280 encodes memory-register, test, and block-transfer forms", (t) => {
  t.deepEqual(
    [
      ...assemble("tma #$10\ntam3\ntma3\ntst #$12,$34\ntst #$12,$3456,x\ntii $1000,$2000,$0030", {
        architecture: "huc6280",
      }),
    ],
    [
      0x43, 0x10, 0x53, 0x08, 0x43, 0x08, 0x83, 0x12, 0x34, 0xb3, 0x12, 0x56, 0x34, 0x73, 0x00,
      0x10, 0x00, 0x20, 0x30, 0x00,
    ],
  );
  t.throws(() => assemble("tma #$03", { architecture: "huc6280" }), {
    message: /power of two/i,
  });
  t.throws(() => assemble("tii $1000,$2000", { architecture: "huc6280" }), {
    message: /blockTransfer/i,
  });
});

test("M740 keeps accumulator bits, zero-page bits, LDM, and special-page JSR distinct", (t) => {
  t.deepEqual(
    [
      ...assemble(
        [
          "bbs0 a,next_a",
          "nop",
          "next_a:",
          "bbc0 $12,next_zp",
          "nop",
          "next_zp:",
          "ldm $12,#$34",
          "jsr ($12)",
          "jsr $ff34",
          "jsr $1234",
        ].join("\n"),
        { architecture: "m740" },
      ),
    ],
    [
      0x03, 0x00, 0xea, 0x17, 0x12, 0x01, 0xea, 0x3c, 0x12, 0x34, 0x02, 0x12, 0x22, 0x34, 0x20,
      0x34, 0x12,
    ],
  );
  t.throws(() => assemble("wai", { architecture: "m740" }), {
    message: /instruction.*wai/i,
  });
});

test("every Phase 4 and 5 form matches the pinned ca65 byte fixture", (t) => {
  t.is(variantDifferentialFixture.oracle.release, "V2.19");
  t.is(variantDifferentialFixture.oracle.commit, "e11fb5c39371046ebe25485f984f644c5a0d65d3");
  t.is(
    variantDifferentialFixture.oracle.instructionTableSha256,
    "bcd36f022a3534355285346d6a4149563a21f17c72b614d91e381d19d68e5a9d",
  );
  t.is(
    variantDifferentialFixture.variants.reduce((count, variant) => count + variant.cases.length, 0),
    1680,
  );
  for (const variant of variantDifferentialFixture.variants) {
    for (const fixture of variant.cases) {
      let actual: number[];
      try {
        actual = [...assemble(fixture.source, { architecture: variant.cpu })];
      } catch (error) {
        throw new Error(
          `${variant.cpu} ${fixture.mnemonic} ${fixture.mode} (${JSON.stringify(fixture.source)}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      t.deepEqual(actual, fixture.bytes, `${variant.cpu} ${fixture.mnemonic} ${fixture.mode}`);
    }
  }
});

test("every Phase 6 form matches the pinned ca65 byte fixture", (t) => {
  t.is(phase6DifferentialFixture.oracle.release, "V2.19");
  t.is(phase6DifferentialFixture.oracle.commit, "e11fb5c39371046ebe25485f984f644c5a0d65d3");
  t.is(
    phase6DifferentialFixture.oracle.instructionTableSha256,
    "bcd36f022a3534355285346d6a4149563a21f17c72b614d91e381d19d68e5a9d",
  );
  t.is(
    phase6DifferentialFixture.variants.reduce((count, variant) => count + variant.cases.length, 0),
    500,
  );
  for (const variant of phase6DifferentialFixture.variants) {
    for (const fixture of variant.cases) {
      t.deepEqual(
        [...assemble(fixture.source, { architecture: variant.cpu })],
        fixture.bytes,
        `${variant.cpu} ${fixture.mnemonic} ${fixture.mode}`,
      );
    }
  }
});
