import { test } from "../../../tests/ava-helper.js";
import {
  identifySnesHardwareRegister,
  renderSnesHardwareDefines,
  snesHardwareDefineRecords,
} from "../src/index.js";

test("SNESdev PPU/MMIO register names and documented aliases are complete", (t) => {
  const records = snesHardwareDefineRecords();
  const bySymbol = new Map(records.map((record) => [record.symbol, record]));

  for (let address = 0x2100; address <= 0x213f; address++) {
    t.true(
      records.some((record) => record.address === address),
      `$${address.toString(16)}`,
    );
  }
  for (const symbol of ["OBJSEL", "OBSEL", "M7HOFS", "M7VOFS", "JOYOUT", "JOYSER0"]) {
    t.truthy(bySymbol.get(symbol), symbol);
  }
  t.is(identifySnesHardwareRegister(0x002101)?.symbol, "OBJSEL");
  t.is(identifySnesHardwareRegister(0x802101)?.symbol, "OBJSEL");
  t.is(identifySnesHardwareRegister(0x402101), undefined, "bank $40 is not an MMIO mirror");

  t.is(new Set(records.map((record) => record.symbol)).size, records.length);
  t.true(records.every((record) => record.description.length > 0));
});

test("all eight documented DMA/HDMA channel register addresses have standard names", (t) => {
  const records = snesHardwareDefineRecords();
  const bySymbol = new Map(records.map((record) => [record.symbol, record]));
  const documentedOffsets = [0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0x0a, 0x0b, 0x0f];

  for (let channel = 0; channel < 8; channel++) {
    for (const offset of documentedOffsets) {
      t.truthy(identifySnesHardwareRegister(0x004300 + channel * 0x10 + offset));
    }
    t.is(identifySnesHardwareRegister(0x004302 + channel * 0x10)?.symbol, `A1T${channel}L`);
    t.is(identifySnesHardwareRegister(0x004306 + channel * 0x10)?.symbol, `DAS${channel}H`);
    t.is(identifySnesHardwareRegister(0x00430a + channel * 0x10)?.symbol, `NLTR${channel}`);
    t.is(identifySnesHardwareRegister(0x00430b + channel * 0x10)?.symbol, `UNUSED${channel}`);
    t.is(
      identifySnesHardwareRegister(0x00430f + channel * 0x10)?.symbol,
      `UNUSED${channel}_MIRROR`,
    );
    for (const symbol of [
      `A1T${channel}L`,
      `A1TL${channel}`,
      `DAS${channel}H`,
      `DASH${channel}`,
      `A2A${channel}L`,
      `A2AL${channel}`,
      `NLTR${channel}`,
      `NTRL${channel}`,
    ]) {
      t.truthy(bySymbol.get(symbol), symbol);
    }
  }

  const source = renderSnesHardwareDefines();
  t.regex(source, /^OBJSEL = \$2101 ; /m);
  t.regex(source, /^JOYOUT = \$4016 ; /m);
  t.regex(source, /^A1T0L = \$4302 ; /m);
  t.regex(source, /^UNUSED7_MIRROR = \$437F ; /m);
});
