import { RomImage } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { exportMesenLabels, importMesenLabels } from "../src/index.js";

const rom = new RomImage(new Uint8Array(0x8000));
const context = {
  sourceName: "fixture.mlb",
  projectRomContentSha256: rom.identity.contentSha256,
  projectMapper: "lorom" as const,
};

test("MesenCE labels import modern and legacy memory names plus inclusive ranges", (t) => {
  const result = importMesenLabels(
    [
      "SnesPrgRom:0000-0002:Start:hello\\nworld",
      "WORK:0010:RamValue",
      "SPCRAM:0200::audio note",
      "UnsupportedMemory:0000:Ignored",
      "",
    ].join("\n"),
    rom,
    "lorom",
    context,
  );
  t.is(result.batch.labels?.length, 2);
  t.is(result.batch.comments?.length, 1);
  t.deepEqual(result.batch.labels?.[0].comment, "hello\nworld");
  t.deepEqual(result.batch.regions?.[0], {
    id: `mesence:region:${result.report.sourceSha256}:1`,
    addressSpace: "rom.file",
    start: 0,
    end: 3,
    name: "Start",
    attributes: { mesenMemoryType: "SnesPrgRom" },
    evidence: [`import:mesence-labels:${result.report.sourceSha256}`],
  });
  t.is(result.report.unsupported[0].count, 1);
});

test("native labels export deterministically to MesenCE physical address spaces", (t) => {
  const result = exportMesenLabels(
    [
      {
        id: "cpu",
        addressSpace: "snes.cpu",
        address: 0x808000,
        name: "CpuEntry",
        comment: "line one\nline two",
        evidence: [],
      },
      {
        id: "ram",
        addressSpace: "snes.wram",
        address: 0x10,
        name: "RamValue",
        evidence: [],
      },
      {
        id: "invalid",
        addressSpace: "rom.file",
        address: 4,
        name: "not valid",
        evidence: [],
      },
    ],
    [
      {
        id: "spc-comment",
        addressSpace: "snes.spc700.aram",
        address: 0x200,
        text: "audio note",
        evidence: [],
      },
    ],
    rom,
    "lorom",
  );
  t.is(
    result.text,
    "SnesPrgRom:0000:CpuEntry:line one\\nline two\nSnesWorkRam:0010:RamValue\nSpcRam:0200::audio note\n",
  );
  t.is(result.report.unsupported[0].field, "labels.name");
  t.is(exportMesenLabels([], [], rom, "lorom").text, "");
});
