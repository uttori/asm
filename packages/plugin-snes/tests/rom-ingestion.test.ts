import { test } from "../../../tests/ava-helper.js";
import { RomImage } from "../../disassembler/src/index.js";
import {
  SNES_MAPPERS,
  createSnesAddressContext,
  detectSnesRom,
  identifySnesCpuAddress,
  identifySnesFileOffset,
  parseSnesInternalRomHeader,
  SNES_CPU_VECTOR_DEFINITIONS,
} from "../src/index.js";

const syntheticLoRom = (expanded = false): RomImage => {
  const bytes = new Uint8Array(0x10000).fill(0xea);
  const header = 0x7fc0;
  bytes.fill(0x20, header, header + 21);
  bytes.set(new TextEncoder().encode("HEADER TEST"), header);
  bytes[header + 0x15] = 0x20;
  bytes[header + 0x16] = 0x02;
  bytes[header + 0x17] = 0x06;
  bytes[header + 0x18] = 0x05;
  bytes[header + 0x19] = 0x01;
  bytes[header + 0x1a] = expanded ? 0x33 : 0x01;
  bytes[header + 0x1b] = 0x02;
  bytes[header + 0x1c] = 0xcb;
  bytes[header + 0x1d] = 0xed;
  bytes[header + 0x1e] = 0x34;
  bytes[header + 0x1f] = 0x12;
  bytes[header + 0x3c] = 0x00;
  bytes[header + 0x3d] = 0x80;
  bytes[header + 0x2a] = 0x34;
  bytes[header + 0x2b] = 0x81;
  if (expanded) {
    bytes.set(new TextEncoder().encode("01TEST"), header - 0x10);
    bytes.fill(0, header - 0x0a, header - 0x04);
    bytes[header - 0x04] = 0x03;
    bytes[header - 0x03] = 0x05;
    bytes[header - 0x02] = 0x01;
    bytes[header - 0x01] = 0x02;
  }
  bytes[0] = 0x78;
  return new RomImage(bytes);
};

test("SNES header scoring detects a plausible LoROM and exposes its evidence", (t) => {
  const detection = detectSnesRom(syntheticLoRom());
  t.is(detection.status, "detected");
  t.is(detection.mapper, "lorom");
  t.is(detection.speed, "slow");
  t.is(detection.headerOffset, 0x7fc0);
  t.true(detection.candidates[0].evidence.some((item) => item.kind === "reset-code"));
  t.is(detection.header?.title, "HEADER TEST");
  t.is(detection.header?.region, "North America");
  t.is(detection.header?.ramSizeBytes, 32 * 1024);
  t.is(detection.header?.vectors.length, 16);
});

test("SNES internal header parser exposes expanded fields and every vector word", (t) => {
  const rom = syntheticLoRom(true);
  const header = parseSnesInternalRomHeader(rom, "lorom");
  t.truthy(header);
  t.is(header?.expanded?.makerCode, "01");
  t.is(header?.expanded?.gameCode, "TEST");
  t.is(header?.expanded?.expansionRamSizeCode, 0x05);
  t.is(header?.vectors.length, SNES_CPU_VECTOR_DEFINITIONS.length);
  t.deepEqual(
    header?.vectors.map(({ pointer }) => pointer),
    Array.from({ length: 16 }, (_, index) => 0x00ffe0 + index * 2),
  );
  t.is(
    header?.vectors.find(({ symbol }) => symbol === "SNES_VECTOR_NATIVE_NMI")?.targetAddress,
    0x8134,
  );
  t.is(
    header?.vectors.find(({ symbol }) => symbol === "SNES_VECTOR_EMULATION_RESET")?.targetAddress,
    0x8000,
  );
});

test("SNES detection reports ambiguity and accepts every explicit mapper", (t) => {
  const ambiguous = detectSnesRom(new RomImage(new Uint8Array(0x10000)));
  t.is(ambiguous.status, "ambiguous");
  t.regex(ambiguous.message ?? "", /--mapper/);
  for (const mapper of SNES_MAPPERS) {
    const detection = detectSnesRom(new RomImage(new Uint8Array(0x10000)), { mapper });
    t.is(detection.status, "override");
    t.is(detection.mapper, mapper);
  }
});

test("all mapper families produce named canonical file/CPU identities", (t) => {
  for (const mapper of SNES_MAPPERS) {
    const context = createSnesAddressContext(mapper);
    const identity = identifySnesFileOffset(0, context, 0x800000);
    t.truthy(identity, mapper);
    t.is(identity?.fileAddressSpace, "rom.file");
    t.is(identity?.addressSpace, "snes.cpu");
  }
  const context = createSnesAddressContext("lorom");
  const mirror = identifySnesCpuAddress(0x008000, context, 0x8000);
  t.true(mirror?.mirrored);
  t.is(mirror?.canonicalCpuAddress, 0x808000);
  t.true(mirror?.mirrors.includes(0x008000));
});
