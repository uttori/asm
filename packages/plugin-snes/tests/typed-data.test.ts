import { Assembler } from "@uttori/asm-core";
import type { IntervalAnnotation } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  indexSnesTypedData,
  renderSnesTypedData,
  snesTypedDataAt,
} from "../src/disassembler/typed-data.js";
import { createSnesAssemblerEnvironment } from "../src/index.js";

test("typed data emits exact little-endian words, long values, dwords, and split-element bytes", async (t) => {
  const bytes = Uint8Array.from([
    0x6b, 0xe2, 0x80, 0xff, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
  ]);
  for (const width of [1, 2, 3, 4]) {
    const declaration = { start: 0, end: bytes.length, width, priority: 1 };
    for (const split of [0, 1, 5]) {
      const source = [
        ...renderSnesTypedData(bytes.subarray(0, split), 0, declaration),
        "Interior:",
        ...renderSnesTypedData(bytes.subarray(split), split, declaration),
      ].join("\n");
      const assembler = new Assembler({
        environment: await createSnesAssemblerEnvironment(),
        target: "snes.sfc",
        architecture: "snes.65816",
        targetOptions: { checksumEnabled: false },
      });
      try {
        assembler.assembleProgram(
          assembler.buildProgramModel(`hirom\norg $C00000\n${source}`, "table.asm", 0),
        );
        t.deepEqual(Uint8Array.from(assembler.getBinaryOutput()), bytes);
        t.is(assembler.labelTable.get("Interior")!.value, 0xc00000 + split);
      } finally {
        assembler.dispose();
      }
    }
  }
  t.deepEqual(
    renderSnesTypedData(bytes.subarray(0, 4), 0, { start: 0, end: 4, width: 2, priority: 1 }),
    ["  dw $E26B, $FF80"],
  );
});

test("manual widths supersede imported coverage, while ambiguous widths are rejected", (t) => {
  const word: IntervalAnnotation = {
    id: "word",
    start: 0,
    end: 12,
    addressSpace: "rom.file",
    architecture: "snes.65816",
    classification: "data16",
    evidence: ["manual"],
  };
  const byte: IntervalAnnotation = { ...word, id: "byte", classification: "data8", evidence: [] };
  const evidence = [
    {
      id: "manual",
      source: "manual" as const,
      sourceId: "fixture",
      confidence: "certain" as const,
    },
  ];
  t.is(snesTypedDataAt(indexSnesTypedData([byte, word], evidence), 0, 12)!.width, 2);
  t.throws(
    () =>
      snesTypedDataAt(
        indexSnesTypedData([word, { ...word, id: "long", classification: "data24" }], evidence),
        0,
        12,
      ),
    { message: /Conflicting typed data/ },
  );
  t.throws(
    () =>
      snesTypedDataAt(
        indexSnesTypedData([word, { ...word, id: "odd", start: 1 }], evidence),
        1,
        12,
      ),
    { message: /alignment/ },
  );
});
