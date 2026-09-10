import { test } from "../../../../tests/ava-helper.js";
import {
  SUPERFX_ROM_ADDRESS_SPACE,
  SuperFxRomImage,
} from "../../src/disassembler/superfx-address-space.js";

test("SuperFX program images own their bytes and preserve identity at the 24-bit boundary", (t) => {
  const bytes = new Uint8Array([0, 255]);
  const image = new SuperFxRomImage(bytes, 0xfffffe);
  bytes[0] = 1;
  image.bytes()[1] = 2;
  t.deepEqual(image.bytes(), new Uint8Array([0, 255]));
  t.is(image.length, 2);
  t.is(image.readByte(0xffffff), 255);
  t.deepEqual(image.identifyOffset(1), {
    addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
    address: 0xffffff,
    imageOffset: 1,
  });
  t.deepEqual(image.identifyAddress(0xfffffe), {
    addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
    address: 0xfffffe,
    imageOffset: 0,
  });
  t.is(image.contentSha256, new SuperFxRomImage([0, 255]).contentSha256);
});

test("SuperFX addresses and offsets outside the contiguous image remain unmapped", (t) => {
  const image = new SuperFxRomImage([1], 0x100);
  for (const address of [-1, 0xff, 0x101, 0x1000000, 0x100 + 0.5, NaN]) {
    t.is(image.identifyAddress(address), undefined);
    t.is(image.readByte(address), undefined);
  }
  for (const offset of [-1, 1, 0.5, NaN]) t.is(image.identifyOffset(offset), undefined);
  t.is(new SuperFxRomImage([]).identifyAddress(0), undefined);
});

test("SuperFX images reject invalid load addresses and bank-space overflow before copying", (t) => {
  for (const address of [-1, 0.5, 0x1000000, NaN]) {
    t.throws(() => new SuperFxRomImage([], address), { message: /24-bit unsigned integer/ });
  }
  t.throws(() => new SuperFxRomImage([0, 1], 0xffffff), { message: /fit contiguously/ });
  // An array-like length exercises the allocation guard without allocating a 16 MiB fixture.
  t.throws(() => new SuperFxRomImage({ length: 0x1000001 }), { message: /fit contiguously/ });
});
