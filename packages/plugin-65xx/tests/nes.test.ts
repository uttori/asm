import { Assembler, Uint8ArrayDecoderSource } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import {
  Cpu6502Decoder,
  formatCpu6502Instruction,
  ricoh2a03Cpu,
  NesCartridge,
  initialNesMapperState,
  nesPrgOffset,
  writeNesMapper,
  validateNesMapper,
  create65xxAssemblerEnvironment,
} from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

/** Synthetic MMC3 image with distinct physical bank bytes, independent of any private ROM. */
function cartridge(flags = 0x40): Uint8Array {
  const trainer = flags & 4 ? 512 : 0;
  const bytes = new Uint8Array(16 + trainer + 0x20000 + 0x2000);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 8, 1, flags, 0]);
  for (let bank = 0; bank < 16; bank++)
    bytes.fill(bank, 16 + trainer + bank * 8192, 16 + trainer + (bank + 1) * 8192);
  return bytes;
}

test("iNES sections preserve trainer and reserved header bytes and reject unsupported/truncated files", (t) => {
  const bytes = cartridge(0x47);
  bytes[15] = 0x83;
  const rom = new NesCartridge(bytes);
  bytes[16 + 512] = 255;
  t.is(rom.mapper, 4);
  t.is(rom.trainer.size, 512);
  t.is(rom.prg.offset, 528);
  t.is(rom.readPrg(0), 0);
  t.is(rom.header()[15], 0x83);
  t.true(rom.battery);
  t.is(rom.mirroring, "vertical");
  t.throws(() => new NesCartridge(bytes.subarray(0, bytes.length - 1)), {
    message: /sizes exceed/,
  });
  bytes[7] = 8;
  t.throws(() => new NesCartridge(bytes), { message: /NES 2.0/ });
});

test("MMC3 PRG bank writes distinguish the same PC and swapped fixed window", (t) => {
  const rom = new NesCartridge(cartridge());
  validateNesMapper(rom);
  let state = initialNesMapperState();
  t.is(nesPrgOffset(rom, 0xc000, state), 14 * 8192);
  t.is(nesPrgOffset(rom, 0xffff, state), 0x1ffff);
  state = writeNesMapper(state, 0x8000, 6);
  state = writeNesMapper(state, 0x8001, 5);
  t.is(nesPrgOffset(rom, 0x8000, state), 5 * 8192);
  state = writeNesMapper(state, 0x9ffe, 0x46);
  t.is(nesPrgOffset(rom, 0x8000, state), 14 * 8192);
  t.is(nesPrgOffset(rom, 0xc000, state), 5 * 8192);
  state = writeNesMapper(state, 0x8001, null);
  t.is(nesPrgOffset(rom, 0xc000, state), undefined);
  t.is(nesPrgOffset(rom, 0x6000, state), undefined);
});

test("all 256 Ricoh opcode encodings survive decode and exact rendering", (t) => {
  const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
  for (let opcode = 0; opcode < 256; opcode++) {
    const result = decoder.decode({
      source: new Uint8ArrayDecoderSource([opcode, 0x12, 0]),
      offset: 0,
      logicalAddress: 0x8000,
    });
    if (result.kind !== "instruction") throw new Error(`Decode failed: ${opcode}`);
    const assembler = new Assembler({
      environment,
      target: "65xx.ca65-raw",
      architecture: "65xx.2a03",
      targetOptions: { origin: 0x8000 },
    });
    try {
      assembler.assembleSource(formatCpu6502Instruction(result.instruction), "decode.asm");
      t.deepEqual(
        assembler.getBinaryOutput(),
        result.instruction.bytes,
        `opcode ${opcode.toString(16)}`,
      );
    } finally {
      assembler.dispose();
    }
  }
});

test("6502 branches wrap the CPU address and indirect JMP remains unresolved", (t) => {
  const decoder = new Cpu6502Decoder();
  const branch = decoder.decode({
    source: new Uint8ArrayDecoderSource([0xd0, 0xfd]),
    offset: 0,
    logicalAddress: 0,
  });
  t.is(branch.kind, "instruction");
  if (branch.kind === "instruction") t.is(branch.instruction.references[0].address, 0xffff);
  const jump = decoder.decode({
    source: new Uint8ArrayDecoderSource([0x6c, 0xff, 0x12]),
    offset: 0,
    logicalAddress: 0x8000,
  });
  if (jump.kind !== "instruction") throw new Error("JMP decode failed");
  t.true(jump.instruction.flow.indirect);
  t.is(jump.instruction.references[0].address, 0x12ff);
  t.is(
    decoder.decode({
      source: new Uint8ArrayDecoderSource([0x4c]),
      offset: 0,
      logicalAddress: 0x8000,
    }).kind,
    "error",
  );
});
