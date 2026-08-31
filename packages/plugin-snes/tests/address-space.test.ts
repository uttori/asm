import { test } from "../../../tests/ava-helper.js";

import { snesRomAddressSpace, type AddressSpaceContext } from "../src/target/address-space.js";

const banks = [0, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000];

const ctx = (
  mapper: string,
  bankCrossCheckMode?: AddressSpaceContext["bankCrossCheckMode"],
): AddressSpaceContext => ({
  mapper,
  sa1banks: banks,
  ...(bankCrossCheckMode ? { bankCrossCheckMode } : {}),
});

test("hirom-family bankcross off wraps $00FFFF into the next LoROM window", (t) => {
  for (const mapper of ["hirom", "exhirom", "sfxrom", "sa1rom"]) {
    t.is(
      snesRomAddressSpace.advance(0x00ffff, 1, ctx(mapper, "off")),
      0x018000,
      mapper,
    );
    t.is(
      snesRomAddressSpace.advance(0x40ffff, 1, ctx(mapper, "off")),
      0x410000,
      `${mapper} $40xxxx stays linear`,
    );
  }
});

test("exlorom and bigsa1rom bankcross off map through file offsets", (t) => {
  t.is(snesRomAddressSpace.advance(0x80ffff, 1, ctx("exlorom", "off")), 0x818000);
  t.is(snesRomAddressSpace.advance(0x00ffff, 1, ctx("bigsa1rom", "off")), 0x018000);

  t.is(snesRomAddressSpace.advance(0x70ffff, 1, ctx("exlorom", "off")), -1);
  t.is(snesRomAddressSpace.advance(0x40ffff, 1, ctx("bigsa1rom", "off")), -1);
});

test("sa1rom fromOutputOffset is unmapped when no bank slot matches", (t) => {
  t.is(snesRomAddressSpace.fromOutputOffset(0x80000, ctx("sa1rom")), 0x108000);
  t.is(
    snesRomAddressSpace.fromOutputOffset(0x80000, { mapper: "sa1rom", sa1banks: [] }),
    -1,
  );
});
