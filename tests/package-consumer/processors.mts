import assert from "node:assert/strict";
import fs from "node:fs";

import { Assembler, type AssemblerOptions } from "@uttori/asm-core";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
  NES_65XX_TARGET_ID,
} from "@uttori/asm-plugin-65xx";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

/** Assemble through installed exports and release each mutable session even on rejection. */
const assemble = (source: string, options: AssemblerOptions): Uint8Array => {
  const assembler = new Assembler(options);
  try {
    assembler.assembleSource(source, "installed-example.asm");
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
};

const environment = await create65xxAssemblerEnvironment();
const raw = (source: string, architecture: string): Uint8Array =>
  assemble(source, { environment, target: RAW_65XX_TARGET_ID, architecture });

/** Pinned ca65-generated vectors, copied into the consumer by the archive checker. */
interface Vector {
  readonly source: string;
  readonly bytes: readonly number[];
  readonly documented?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isVector(value: unknown): value is Vector {
  if (!isRecord(value) || typeof value.source !== "string" || !Array.isArray(value.bytes)) {
    return false;
  }
  if (value.documented !== undefined && typeof value.documented !== "boolean") {
    return false;
  }
  return value.bytes.every((byte) => typeof byte === "number");
}

function readCases(value: unknown, label: string): Vector[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} cases must be an array.`);
  }
  return value.map((entry, index) => {
    if (!isVector(entry)) {
      throw new Error(`${label} case ${index} is missing source bytes.`);
    }
    return entry;
  });
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

let vectors = 0;
const nmos = readJson("ca65-v2.19-nmos-differential.json");
if (!isRecord(nmos)) {
  throw new Error("NMOS differential fixture must be an object.");
}
const nmosCases = readCases(nmos.cases, "NMOS");
for (const entry of nmosCases) {
  assert.deepEqual([...raw(entry.source, entry.documented ? "6502" : "6502x")], entry.bytes);
  vectors++;
}
for (const file of [
  "ca65-e11fb5c-cmos-vendor-differential.json",
  "ca65-e11fb5c-huc6280-m740-differential.json",
]) {
  const fixture = readJson(file);
  if (!isRecord(fixture) || !Array.isArray(fixture.variants)) {
    throw new Error(`${file} is missing variants.`);
  }
  for (const variant of fixture.variants) {
    if (!isRecord(variant) || typeof variant.cpu !== "string") {
      throw new Error(`${file} variant is missing a CPU.`);
    }
    const cases = readCases(variant.cases, variant.cpu);
    for (const entry of cases) {
      assert.deepEqual(
        [...raw(entry.source, variant.cpu)],
        entry.bytes,
        variant.cpu + entry.source,
      );
      vectors++;
    }
  }
}
assert.throws(() => raw("slo $20", "6502"), /requires architecture/);
assert.throws(
  () =>
    assemble(".importzp External", {
      environment,
      target: "65xx.ca65-raw",
    }),
  /importzp/,
);

const nes = assemble('.segment "CODE"\nlda #$12\n.byte $34', {
  environment,
  target: NES_65XX_TARGET_ID,
  targetOptions: {
    linkerConfig:
      "MEMORY { ROM: start = $8000, size = $100, file = %O, fill = yes; }\nSEGMENTS { CODE: load = ROM, type = ro; }",
    header: [0x4e, 0x45, 0x53, 0x1a, ...Array.from({ length: 12 }, () => 0)],
    fillByte: 0xff,
  },
});
assert.equal(nes.length, 272);
assert.deepEqual([...nes.subarray(0, 4)], [0x4e, 0x45, 0x53, 0x1a]);
assert.deepEqual([...nes.subarray(16, 19)], [0xa9, 0x12, 0x34]);

const snesEnvironment = await createSnesAssemblerEnvironment();
const snes = (source: string): Uint8Array =>
  assemble(source, {
    environment: snesEnvironment,
    target: SNES_TARGET_ID,
  });
assert.deepEqual([...snes("lorom\norg $008000\n.a16\nlda #$1234\nrtl")], [0xa9, 0x34, 0x12, 0x6b]);
assert.deepEqual([...snes("lorom\norg $008000\narch spc700\nmov a,#$12\nret")], [0xe8, 0x12, 0x6f]);
assert.deepEqual([...snes("lorom\norg $008000\narch superfx\nnop\nstop")], [0x01, 0x00]);
assert.deepEqual(
  [
    ...snes(`lorom
struct Stats $008000
  .hp: dw
  .flags: db[2]
endstruct count 2
org $008000
dataStructs Stats
  [0] = { hp = $1234, flags = [$AB, $CD] }
  [1] = { hp = $5678, flags = [$EF, $01] }
endDataStructs`),
  ],
  [0x34, 0x12, 0xab, 0xcd, 0x78, 0x56, 0xef, 0x01],
);

console.log(
  `Installed processors: ${vectors} pinned 65xx vectors, NES output, SNES CPUs, and typed records passed`,
);
