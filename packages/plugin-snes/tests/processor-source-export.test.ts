import { RomImage } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import {
  renderSpc700AramSource,
  renderSpc700UploadSource,
  renderSuperFxRomSource,
} from "../src/disassembler/processor-source-export.js";
import { Spc700AramImage } from "../src/disassembler/spc700-address-space.js";
import { parseSpc700UploadStream } from "../src/disassembler/spc700-upload.js";
import { SuperFxRomImage } from "../src/disassembler/superfx-address-space.js";

const assemble = (source: string): Uint8Array => {
  const assembler = new Assembler(undefined, { collectSourceMetadata: false });
  assembler.setCurrentFile("generated.asm");
  const lines = source.split("\n");
  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    for (const [lineNumber, line] of lines.entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.processCommand(line);
    }
    assembler.finishPass();
  }
  return assembler.getBinaryOutput();
};

test("generated standalone SPC700 native source is byte-identical", (t) => {
  const bytes = Uint8Array.from([
    0x40, 0xe8, 0x7f, 0x8f, 0x44, 0x20, 0x2f, 0xf8, 0xaa, 0x34, 0x72, 0xff,
  ]);
  const image = new Spc700AramImage(bytes, 0x6000);
  const source = renderSpc700AramSource(image);
  t.true(source.includes("arch spc700-raw"));
  t.true(source.includes("base $6000"));
  t.deepEqual(assemble(source), bytes);
});

test("generated embedded SPC700 block source preserves headers, payloads, and execute trailer", (t) => {
  const bytes = Uint8Array.from([
    0x03, 0x00, 0x00, 0x60, 0x8f, 0x44, 0x33, 0x06, 0x00, 0x00, 0x50, 0x5f, 0x03, 0x50, 0x8f, 0x22,
    0x11, 0x00, 0x00, 0x00, 0x50,
  ]);
  const rom = new RomImage(bytes, { headerSize: 0 });
  const stream = parseSpc700UploadStream(rom, 0);
  const source = renderSpc700UploadSource(rom, stream);
  t.true(source.includes("spcblock $6000 nspc"));
  t.true(source.includes("endspcblock execute $5000"));
  t.deepEqual(assemble(source), bytes);
});

test("generated SuperFX native source round-trips base, fused ALT, branch, and trailing data", (t) => {
  const bytes = Uint8Array.from([
    0x01, 0x3d, 0x50, 0x3e, 0xa2, 0x20, 0x05, 0x00, 0xff, 0x0c, 0x80, 0xf0,
  ]);
  const image = new SuperFxRomImage(bytes, 0x088000);
  const source = renderSuperFxRomSource(image);
  t.true(source.includes("ADC R0"));
  t.true(source.includes("SMS ($0040),R2"));
  t.true(source.includes("db $F0"));
  t.deepEqual(assemble(source), bytes);
});

test("maximum-size SPC700 upload retains every instruction and round-trips as linear bytes", (t) => {
  // One-byte NOPs maximize rendered line count within the upload format's 16-bit length.
  const bytes = new Uint8Array(4 + 0xffff + 4);
  bytes.set([0xff, 0xff, 0x00, 0x00]);
  const rom = new RomImage(bytes, { headerSize: 0 });
  const source = renderSpc700UploadSource(rom, parseSpc700UploadStream(rom, 0));
  t.is(source.split("\n").filter((line) => line === "NOP").length, 0xffff);
  // This fixture is an upload stream, not a cartridge: linear output avoids LoROM bank
  // aliases and automatic cartridge checksums modifying bytes inside the large payload.
  const linearSource = source.replace("lorom\norg $008000", "norom\norg $000000");
  t.true(Buffer.from(assemble(linearSource)).equals(bytes));
});
