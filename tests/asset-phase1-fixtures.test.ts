import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { decodeBrrPcm } from "@uttori/asm-assets/audio";

import { test } from "./ava-helper.js";
import { Assembler } from "./test-assembler.js";

const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../packages/assets/tests/fixtures",
);

test("synthetic WRAM images resolve cross-image symbols at their CPU bases", (t) => {
  const expected = {
    program: [0x22, 0x00, 0x50, 0x7e, 0xa5, 0x5a],
    scene: [0x00, 0x80, 0x7e, 0xc2, 0x20, 0xa9, 0x34, 0x12, 0x6b],
  } as const;
  for (const name of ["program", "scene"] as const) {
    const file = path.join(fixtures, `wram-${name}.asm`);
    const assembler = new Assembler(undefined, { collectSourceMetadata: false });
    assembler.assembleSource(readFileSync(file, "utf8"), file);
    t.deepEqual([...assembler.getBinaryOutput()], expected[name]);
  }
});

test("synthetic BRR reference vectors have independently specified PCM samples", (t) => {
  const silence = decodeBrrPcm(readFileSync(path.join(fixtures, "brr-silence.bin")));
  t.deepEqual(
    [...silence],
    Array.from({ length: 16 }, () => 0),
  );
  const transient = decodeBrrPcm(readFileSync(path.join(fixtures, "brr-transient.bin")));
  t.deepEqual([...transient], [28672, -32768, ...Array.from({ length: 14 }, () => 0)]);
});
