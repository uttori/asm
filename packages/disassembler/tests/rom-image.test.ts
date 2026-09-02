import { createHash } from "node:crypto";

import { test } from "../../../tests/ava-helper.js";
import { RomImage, detectCopierHeaderSize } from "../src/index.js";

test("ROM loading is immutable, hash-addressed, and strips a copier header", (t) => {
  const source = new Uint8Array(0x8000 + 512);
  source.fill(0xaa, 0, 512);
  source.fill(0x42, 512);
  const rom = new RomImage(source);
  source.fill(0);

  t.is(rom.identity.headerSize, 512);
  t.is(rom.identity.fileSize, 0x8200);
  t.is(rom.identity.contentSize, 0x8000);
  t.is(rom.readByte(0), 0x42);
  t.is(rom.readByte(-1), undefined);
  t.is(rom.readByte(rom.length), undefined);
  t.is(
    rom.identity.contentSha256,
    createHash("sha256").update(new Uint8Array(0x8000).fill(0x42)).digest("hex"),
  );

  const copy = rom.bytes();
  copy[0] = 0;
  t.is(rom.readByte(0), 0x42);
  const header = rom.copierHeaderBytes();
  const file = rom.fileBytes();
  header[0] = 0;
  file[512] = 0;
  t.is(rom.copierHeaderBytes()[0], 0xaa);
  t.is(rom.fileBytes()[512], 0x42);
});

test("copier header detection requires alignment or an explicit override", (t) => {
  t.is(detectCopierHeaderSize(0x8000), 0);
  t.is(detectCopierHeaderSize(0x8200), 512);
  t.throws(() => detectCopierHeaderSize(123), { message: /explicit header override/ });
  t.is(new RomImage(new Uint8Array(123), { headerSize: 0 }).length, 123);
});
