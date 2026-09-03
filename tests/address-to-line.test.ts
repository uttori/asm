import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AddressToLineMapping,
  canonicalDebugMapJson,
  createDebugMap,
  debugMapRangesForAddress,
  debugMapRangesForSource,
  validateDebugMap,
} from "@uttori/asm-core";

import { test } from "./ava-helper.js";
import { Assembler } from "./test-assembler.js";

const fixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-map-"));
  const source = path.join(directory, "main.asm");
  fs.writeFileSync(source, "org $808000\nlda #$01\nsta $00\n");
  return { directory, source };
};

test("AddressToLineMapping coalesces emitted bytes and resolves both directions", (t) => {
  const { directory, source } = fixture();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source, 2, "snes.65816", "snes.address-space", 0x808000, 0);
  mapping.includeByte(source, 2, "snes.65816", "snes.address-space", 0x808001, 1);
  mapping.includeByte(source, 3, "snes.65816", "snes.address-space", 0x808002, 2);
  mapping.includeByte(source, 3, "snes.spc700", "spc.aram", 0x200, -1);

  t.is(mapping.ranges.length, 3);
  t.deepEqual(mapping.findSourceRanges("snes.address-space", 0x808001, "snes.65816"), [
    {
      source,
      line: 2,
      architecture: "snes.65816",
      addressSpace: "snes.address-space",
      start: 0x808000,
      end: 0x808002,
      outputStart: 0,
      outputEnd: 2,
    },
  ]);
  t.is(mapping.findAddressRanges(source, 3).length, 2);

  mapping.reset();
  t.deepEqual(mapping.fileList, []);
  t.deepEqual(mapping.ranges, []);
});

test("debug maps are deterministic, fingerprinted, architecture-aware, and mirror-resolvable", (t) => {
  const { directory, source } = fixture();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source, 2, "snes.65816", "snes.address-space", 0x808000, 0);
  mapping.includeByte(source, 2, "snes.spc700", "spc.aram", 0x200, -1);
  const output = Uint8Array.from([0xa9, 0x01]);
  const map = createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: directory });

  t.is(map.sources[0]?.path, "main.asm");
  t.is(map.ranges.length, 2);
  t.deepEqual(createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: directory }), map);
  t.deepEqual(validateDebugMap(map, output), []);
  t.deepEqual(validateDebugMap(map, Uint8Array.from([0xea, 0xea])), [
    "Debug-map output SHA-256 mismatch.",
  ]);
  t.is(
    debugMapRangesForAddress(map, "snes.address-space", 0x008000, { outputOffset: 0 }).length,
    1,
  );
  t.is(debugMapRangesForAddress(map, "spc.aram", 0x200, { architecture: "snes.spc700" }).length, 1);
  t.is(debugMapRangesForSource(map, source, 2, "snes.65816").length, 1);

  const tampered = JSON.parse(canonicalDebugMapJson(map));
  tampered.target = "other";
  t.deepEqual(validateDebugMap(tampered), ["Debug-map fingerprint mismatch."]);
});

test("Assembler records only emitted bytes as source ranges", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-build-"));
  const source = path.join(directory, "main.asm");
  const text = "lorom\norg $808000\nlda #$01\nsta $00\n";
  fs.writeFileSync(source, text);
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));

  const assembler = new Assembler(undefined, { collectSourceMetadata: true });
  t.teardown(() => assembler.dispose());
  assembler.setCurrentFile(source);
  assembler.assembleProgram(assembler.buildProgramModel(text, source, 0));

  t.deepEqual(
    assembler.addressToLineMapping.ranges.map((range) => ({
      line: range.line,
      start: range.start,
      end: range.end,
      outputStart: range.outputStart,
      outputEnd: range.outputEnd,
    })),
    [
      { line: 3, start: 0x808000, end: 0x808002, outputStart: 0, outputEnd: 2 },
      { line: 4, start: 0x808002, end: 0x808004, outputStart: 2, outputEnd: 4 },
    ],
  );
});
