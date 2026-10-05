import type { RoomAsset } from "../../packages/assets/src/secret-of-mana/som-room-assets.js";

/** Independent native tables/bit writer and planar bytes; no production room encoder constructs this fixture. */
export function somRoomNativeFixture(): { rom: Uint8Array; room: RoomAsset } {
  const rom = new Uint8Array(0x200000);
  const u16 = (offset: number, value: number): void => {
    rom[offset] = value & 255;
    rom[offset + 1] = value >>> 8;
  };
  const u24 = (offset: number, value: number): void => {
    u16(offset, value & 65535);
    rom[offset + 2] = value >>> 16;
  };
  u16(0xce27e, 0x1000);
  u16(0xce280, 0x1009);
  u24(0xce270, 0xc10000);
  u24(0xce273, 0xc20000);
  u24(0xce276, 0xc30000);
  u16(0xc1000, 0);
  rom[0xc1002] = 2;
  u16(0xc1003, 5 << 13);
  rom[0xc1005] = 1;
  u16(0xc1006, 6 << 13);
  rom[0xc1008] = 1;
  rom[0x10010] = 0x80; // Only the second 2bpp tile's first pixel differs from independent blank owners.
  rom[0x20018] = 0x80;
  rom[0x20019] = 0x80;
  rom[0x20028] = 0x80;
  rom[0x30020] = 0x80;
  rom[0x30021] = 0x80;
  rom[0x30030] = 0x80;
  rom[0x30031] = 0x80;
  const bits: number[] = [];
  const put = (value: number, count: number): void => {
    for (let bit = count - 1; bit >= 0; bit--) {
      bits.push((value >>> bit) & 1);
    }
  };
  const words = [0x0400, 0x4400, 0x8400, 0x2400];
  for (const word of words) {
    put(15, 4);
    put(word, 16);
  }
  for (let index = 4; index < 1536; index++) {
    put(0, 2);
  }
  const stream = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, index) => {
    stream[index >>> 3] |= bit << (7 - (index & 7));
  });
  rom.set(stream, 0xb4100);
  u24(0xb4000, 0xcb4100);
  u24(0xb4003, 0xcb4100 + stream.length);
  u16(0xd0000, 1023);
  u16(0xd0002, 1023);
  u16(0xd0004, 1023);
  u16(0xd0006, 0x1000);
  u16(0xd0008, 0x1003);
  rom.set([0, 0, 0], 0xd1000);
  u16(0xc8000, 0x801f);
  u16(0xc8002, 0x03e0);
  u16(0xc8006, 4);
  return {
    rom,
    room: {
      format: "som.room",
      version: 1,
      id: 1,
      header: Array(8).fill(0),
      entities: [],
      triggers: [],
      previewStory: { 0: 0 },
      pieces: [{ variable: 0, minimum: 0, maximum: 15, layer: 1, layout: 1, x: 0, y: 0 }],
    },
  };
}
