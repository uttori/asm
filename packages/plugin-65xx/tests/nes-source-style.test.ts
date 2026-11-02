import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readAssetPng, createIndexedPng } from "@uttori/asm-assets/image";
import type { DebugMap } from "@uttori/asm-core/debug-map";
import type { IntervalAnnotation, ProjectLabel } from "@uttori/asm-disassembler";
import { openAnalysisProjectStore } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { create65xxAssemblerEnvironment, NesCartridge } from "../src/index.js";
import { NES_TEXT_CODEC, encodeNesChrPng, nesChrPng, nesAssetFormats } from "../src/nes/assets.js";
import { analyzeNesProject, createNesAnalysisProject } from "../src/nes/project.js";
import { buildNesSource } from "../src/nes/source-build.js";
import { exportNesSource } from "../src/nes/source-export.js";

/** A named call, RAM operand, inline pointer and tile-coded text share one NROM image with real CHR bytes. */
function fixture(): Uint8Array {
  const bytes = new Uint8Array(16 + 32768 + 8192).fill(2);
  bytes.fill(0, 0, 16);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 2, 1]);
  bytes.set([0xa5, 0xb8, 0x20, 0x80, 0x80, 0x60], 16);
  bytes[16 + 0x80] = 0x60;
  bytes.set([0x80, 0x80], 16 + 0x100);
  bytes.set([0x16, 0x0e, 0x17, 0x1e], 16 + 0x110);
  bytes.set([0x16, 0x0e, 0x17, 0x1e], 16 + 0x2110);
  bytes.set([0x96, 0x8e, 0x97, 0x9e], 16 + 0x2120);
  for (const vector of [0x7ffa, 0x7ffc, 0x7ffe]) {
    bytes.set([0, 0x80], 16 + vector);
  }
  for (let index = 0; index < 8192; index++) {
    bytes[16 + 32768 + index] = index & 255;
  }
  return bytes;
}

for (const module of [undefined, { id: "nes-export" }] as const) {
  test(`named NES source, RAM definitions, typed pointers, text and PNG assets rebuild exactly (${module ? "linked" : "absolute"})`, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-style-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const bytes = fixture();
    const original = path.join(directory, "original.nes");
    const evidence = path.join(directory, "evidence");
    const source = path.join(directory, "source");
    fs.writeFileSync(original, bytes);
    createNesAnalysisProject(evidence, original);
    analyzeNesProject({ projectDirectory: evidence, romFile: original });
    const labels: ProjectLabel[] = [
      {
        id: "routine",
        addressSpace: "nes.cpu",
        address: 0x8080,
        name: "MenuHandler",
        comment: "Runs the selected menu.",
      },
      {
        id: "ram",
        addressSpace: "nes.cpu",
        address: 0xb8,
        name: "RAM_SCREEN_STATE",
        comment: "Selects the active screen.",
      },
      {
        id: "text",
        addressSpace: "nes.file",
        address: 0x110,
        name: "Text_Menu",
        comment: "Menu title tile codes.",
      },
    ].map((label) =>
      Object.assign(label, { sourceName: label.name, analysisEntryPoint: false, evidence: [] }),
    );
    const characters = { M: 0x16, E: 0x0e, N: 0x17, U: 0x1e };
    const annotations: IntervalAnnotation[] = [
      {
        id: "pointer",
        addressSpace: "nes.file",
        start: 0x100,
        end: 0x102,
        classification: "pointer16",
        architecture: "65xx.2a03",
        evidence: [],
      },
      {
        id: "text-copy",
        addressSpace: "nes.file",
        start: 0x2110,
        end: 0x2114,
        classification: "text",
        architecture: "65xx.2a03",
        asset: {
          codecId: NES_TEXT_CODEC,
          codecVersion: "1.0.0",
          options: { characters: { U: 0x1e, N: 0x17, E: 0x0e, M: 0x16 } },
        },
        evidence: [],
      },
      {
        id: "text-alternate",
        addressSpace: "nes.file",
        start: 0x2120,
        end: 0x2124,
        classification: "text",
        architecture: "65xx.2a03",
        asset: {
          codecId: NES_TEXT_CODEC,
          codecVersion: "1.0.0",
          options: { characters: { M: 0x96, E: 0x8e, N: 0x97, U: 0x9e } },
        },
        evidence: [],
      },
      {
        id: "text",
        addressSpace: "nes.file",
        start: 0x110,
        end: 0x114,
        classification: "text",
        architecture: "65xx.2a03",
        asset: { codecId: NES_TEXT_CODEC, codecVersion: "1.0.0", options: { characters } },
        evidence: [],
      },
    ];
    const store = openAnalysisProjectStore(evidence);
    try {
      const nodes = store.analysisByKinds(["cfg-node"]).filter((node) => node.kind === "cfg-node");
      const exported = exportNesSource(
        new NesCartridge(bytes),
        nodes,
        store.manifest().rom.contentSha256,
        { labels, annotations },
        { module },
      );
      for (const file of exported.files) {
        const target = path.join(source, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.bytes);
      }
      const text = (file: string) => fs.readFileSync(path.join(source, file), "utf8");
      const tables = exported.files.filter((file) => file.path.endsWith(".tbl"));
      t.is(tables.length, 2);
      const firstTable = /^  table "([^"]+)"$/m.exec(text("banks/prg_00.asm"))?.[1];
      const otherTables = [...text("banks/prg_01.asm").matchAll(/^  table "([^"]+)"$/gm)];
      // Identical complete alphabets share a file across banks; the same text with different tile codes must not.
      t.is(otherTables[0]?.[1], firstTable);
      t.not(otherTables[1]?.[1], firstTable);
      t.is(otherTables.length, 2);
      t.regex(text("main.asm"), /incsrc "defines.asm"\nincsrc "ram-defines.asm"/);
      t.false(fs.existsSync(path.join(source, "research.asm")));
      t.regex(
        text("ram-defines.asm"),
        /; Selects the active screen\.\nRAM_SCREEN_STATE = \$00B8\n\n/,
      );
      t.regex(text("defines.asm"), /; [^\n]+\nPPUCTRL = \$2000\n\n/);
      t.regex(text("banks/prg_00.asm"), /^MenuHandler:$/m);
      t.regex(text("banks/prg_00.asm"), /^  JSR\.w MenuHandler$/m);
      t.regex(text("banks/prg_00.asm"), /^  dw MenuHandler$/m);
      t.regex(text("banks/prg_00.asm"), /\n\n; Runs the selected menu\.\nMenuHandler:\n  RTS/);
      t.regex(
        text("banks/prg_00.asm"),
        /\n\n; Menu title tile codes\.\nText_Menu:\n  pushtable\n  table .*\n  db "MENU"\n  pulltable\n\nincbin "\.\.\/assets\/raw\/000000.bin":\$0114\.\.\$1000/,
      );
      if (!module) {
        t.regex(
          text("banks/chr_00.asm"),
          /org \$008000\nbase \$0000\n\nCHR_00_start:\n  includeAsset\([^\n]+\n\nCHR_00_end:/,
        );
      }
      for (const file of exported.files.filter((entry) => entry.path.endsWith(".asm"))) {
        t.notRegex(Buffer.from(file.bytes).toString(), /\$[\dA-F]*[a-f]/);
        t.notRegex(Buffer.from(file.bytes).toString(), /^[\t ]+incbin\b/m);
        t.notRegex(Buffer.from(file.bytes).toString(), /^incbin [^\n]+\n[^\n]/m);
        t.notRegex(
          Buffer.from(file.bytes).toString(),
          /^\s*\.(?:segment|export|incbin|byte|word|assert)\b/m,
        );
      }
      const configuration = JSON.parse(text("uttori-asm.config.json"));
      const build = buildNesSource({
        root: source,
        ...(module && exported.relocatable
          ? { link: { module, recipe: exported.relocatable.linkRecipe } }
          : {}),
        entrySource: "main.asm",
        environment: await create65xxAssemblerEnvironment(),
        includePaths: [source],
        targetOptions: configuration.plugins[0].options,
        expectedSize: bytes.length,
        expectedHeader: bytes.subarray(0, 16),
        originalContent: bytes,
        outputDirectory: path.join(directory, "build"),
        toolchainSha256: createHash("sha256").update("nes-style-test-toolchain").digest("hex"),
        configurationSha256: createHash("sha256")
          .update(text("uttori-asm.config.json"))
          .digest("hex"),
      });
      t.deepEqual(fs.readFileSync(build.outputFile), Buffer.from(bytes));
      // Shared logical addresses must not collapse distinct PRG/CHR locations in previews or debugging.
      const map: DebugMap = JSON.parse(fs.readFileSync(build.debugMapFile, "utf8"));
      const routine = map.instructions?.find((instruction) => instruction.address === 0x8080);
      t.is(routine?.outputOffset, 16 + 0x80);
      const graphics = map.assets?.find((asset) => asset.format === "nes.chr.2bpp");
      t.is(graphics?.address, 0);
      t.is(graphics?.outputOffset, 16 + 32768);
      const raw = map.assets?.find((asset) => asset.format === "raw");
      t.is(raw?.outputOffset, 16 + 6);
    } finally {
      store.close();
    }
  });
}

test("NES CHR editing preserves row-major tiles, separate bitplanes and duplicate palette slots", (t) => {
  const native = Uint8Array.from({ length: 32 }, (_, index) => (index * 7) & 255);
  const png = nesChrPng(native, 2);
  t.deepEqual(encodeNesChrPng(png), native);
  const image = readAssetPng(png).toIndexed({ copy: false });
  const indexes = image.indexes.slice();
  indexes[8] ^= 3;
  // A pixel in the second tile changes only its corresponding low/high bitplane rows.
  const edited = createIndexedPng({
    width: image.width,
    height: image.height,
    indexes,
    palette: [
      [0, 0, 0, 255],
      [0, 0, 0, 255],
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ],
  });
  const expected = native.slice();
  expected[16] ^= 0x80;
  expected[24] ^= 0x80;
  t.deepEqual(encodeNesChrPng(edited), expected);
  t.throws(() => nesChrPng(native, 3), { message: /complete atlas rows/ });
});

test("explicit NES text alphabets reject unknown glyphs and ambiguous reverse maps", (t) => {
  const format = nesAssetFormats.find((entry) => entry.id === NES_TEXT_CODEC)!;
  const source = { mediaType: "text/plain", bytes: Buffer.from("MENU") };
  t.deepEqual(
    format.convert(source, { characters: { M: 0x16, E: 0x0e, N: 0x17, U: 0x1e } }, {}).outputs.text
      .bytes,
    Uint8Array.from([0x16, 0x0e, 0x17, 0x1e]),
  );
  t.throws(() => format.convert(source, { characters: { M: 1, E: 1 } }, {}), { message: /unique/ });
  t.throws(() => format.convert(source, { characters: { M: 1 } }, {}), { message: /Unmapped/ });
});
