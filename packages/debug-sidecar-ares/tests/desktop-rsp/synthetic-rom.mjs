// Original redistributable homebrew fixture, under this repository's MIT license.
// SEI. CLD. LDX #$FF. TXS. Loop: INC $00. BRA loop.
// The reset vector is $008000; SRAM is present for storage-boundary tests.
export function syntheticRom({ quiescent = false } = {}) {
  const rom = Buffer.alloc(0x8000, 0xea);
  rom.set([0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xe6, 0x00, 0x80, 0xfc]);
  if (quiescent) {
    rom.set([0xcb, 0x80, 0xfd], 0x20);
    rom[0x30] = 0xdb;
  }
  rom.fill(0, 0x7fc0);
  rom.write("ARES DEBUG FIXTURE   ", 0x7fc0, "ascii");
  rom.set([0x20, 0x02, 0x05, 0x03, 0x01, 0x33, 0x00], 0x7fd5);
  for (const vector of [0x7fea, 0x7fee, 0x7ffa, 0x7ffc, 0x7ffe]) {
    rom.writeUInt16LE(0x8000, vector);
  }
  // Checksum and complement contribute 0x1fe regardless of the checksum value.
  const checksum = (rom.reduce((sum, byte) => sum + byte, 0) + 0x1fe) & 0xffff;
  rom.writeUInt16LE(checksum ^ 0xffff, 0x7fdc);
  rom.writeUInt16LE(checksum, 0x7fde);
  return rom;
}
