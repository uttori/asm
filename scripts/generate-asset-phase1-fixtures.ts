import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "../packages/assets/tests/fixtures");
mkdirSync(root, { recursive: true });
const write = (name: string, bytes: Uint8Array | string): void =>
  writeFileSync(join(root, name), bytes);

const u32be = (value: number): Buffer => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
};
const u32le = (value: number): Buffer => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
};
const chunk = (name: string, payload: Uint8Array): Buffer => {
  const body = Buffer.concat([Buffer.from(name), payload]);
  return Buffer.concat([u32be(payload.length), body, u32be(crc32(body))]);
};

// PNG rows use filter 0. Adam7 passes are emitted independently so indexed identity is testable.
const passes = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];
const packedRow = (samples: readonly number[], depth: number): Buffer => {
  const bytes = Buffer.alloc(Math.ceil((samples.length * depth) / 8));
  samples.forEach((sample, index) => {
    bytes[Math.floor((index * depth) / 8)] |= sample << (8 - depth - ((index * depth) % 8));
  });
  return bytes;
};
interface PngFixtureOptions {
  width: number;
  height: number;
  depth: number;
  colorType: number;
  palette?: readonly (readonly number[])[];
  transparency?: readonly number[];
  interlaced?: boolean;
  pixel: (x: number, y: number) => number[];
}

/**
 * Emit small deterministic PNGs, retaining palette indexes even for duplicate RGB entries.
 * @param name Output filename in the fixture directory.
 * @param options Dimensions, color model, and source pixel callback.
 */
const png = (name: string, options: PngFixtureOptions): void => {
  const {
    width,
    height,
    depth,
    colorType,
    palette,
    transparency,
    interlaced = false,
    pixel,
  } = options;
  const header = Buffer.concat([
    u32be(width),
    u32be(height),
    Buffer.from([depth, colorType, 0, 0, Number(interlaced)]),
  ]);
  const rows: Buffer[] = [];
  const activePasses = interlaced ? passes : [[0, 0, 1, 1]];
  for (const [startX, startY, stepX, stepY] of activePasses) {
    for (let y = startY; y < height; y += stepY) {
      const samples: number[] = [];
      for (let x = startX; x < width; x += stepX) {
        samples.push(...pixel(x, y));
      }
      if (samples.length > 0) {
        rows.push(Buffer.from([0]), depth < 8 ? packedRow(samples, depth) : Buffer.from(samples));
      }
    }
  }
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header)];
  if (palette) {
    parts.push(chunk("PLTE", Buffer.from(palette.flat())));
  }
  if (transparency) {
    parts.push(chunk("tRNS", Buffer.from(transparency)));
  }
  parts.push(chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0)));
  write(name, Buffer.concat(parts));
};

// Every channel lies on the exact bit-replicate BGR555 table.
const colors = Array.from({ length: 16 }, (_, index) => {
  const channel = (index << 3) | (index >> 2);
  return [channel, channel, channel];
});
colors[2] = [...colors[1]]; // Duplicate entries must remain distinct indexes.
for (const depth of [1, 2, 4, 8]) {
  const count = Math.min(2 ** depth, 16);
  png(`indexed-${depth}bpp.png`, {
    width: 16,
    height: 16,
    depth,
    colorType: 3,
    palette: colors.slice(0, count),
    transparency: [0, ...Array.from({ length: count - 1 }, () => 255)],
    pixel: (x, y) => [(x + 3 * y) % count],
  });
}
png("indexed-4bpp-adam7.png", {
  width: 16,
  height: 16,
  depth: 4,
  colorType: 3,
  palette: colors,
  transparency: [0, ...Array.from({ length: 15 }, () => 255)],
  interlaced: true,
  pixel: (x, y) => [(x + 3 * y) % 16],
});
/** Replicate a channel to 5 bits by bit-replicating and scaling to 8 bits. */
const replicate = (channel: number): number => (channel << 3) | (channel >> 2);
/** Generate a 4-bit indexed palette with replicated channels. */
const coloredPalette = Array.from({ length: 16 }, (_, index) => {
  return [replicate(index * 2), replicate((15 - index) * 2), replicate(index)];
});
png("colored-4bpp.png", {
  width: 16,
  height: 16,
  depth: 4,
  colorType: 3,
  palette: coloredPalette,
  transparency: [0, ...Array.from({ length: 15 }, () => 255)],
  pixel: (x, y) => [(x + 3 * y) % 16],
});
png("rgb-exact.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 2,
  pixel: (x) => (x % 2 ? [255, 0, 0] : [0, 0, 0]),
});
png("rgba-partial-alpha.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 6,
  pixel: (x) => (x === 0 ? [255, 0, 0, 128] : [0, 0, 0, 255]),
});
png("rgba-transparent.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 6,
  pixel: (x) => (x === 0 ? [255, 0, 0, 0] : [0, 0, 0, 255]),
});
png("gray8-exact.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 0,
  pixel: (x) => [x === 0 ? 0 : 33],
});
png("gray2-exact.png", {
  width: 8,
  height: 8,
  depth: 2,
  colorType: 0,
  pixel: (x) => [x % 2 ? 3 : 0],
});
png("gray-alpha8-exact.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 4,
  pixel: (x) => (x === 0 ? [0, 0] : [33, 255]),
});
png("rgb-transparency.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 2,
  transparency: [0, 0, 0, 0, 0, 0],
  pixel: (x) => (x === 0 ? [0, 0, 0] : [255, 0, 0]),
});
png("scale-floor-exact.png", {
  width: 8,
  height: 8,
  depth: 8,
  colorType: 2,
  pixel: (x) => (x === 0 ? [0, 0, 0] : [32, 0, 0]),
});
png("indexed-opaque-zero.png", {
  width: 8,
  height: 8,
  depth: 4,
  colorType: 3,
  palette: colors,
  pixel: (x) => [x % 2],
});
png("indexed-partial-alpha.png", {
  width: 8,
  height: 8,
  depth: 4,
  colorType: 3,
  palette: colors,
  transparency: [128, ...Array.from({ length: 15 }, () => 255)],
  pixel: (x) => [x % 2],
});
png("bad-dimensions.png", {
  width: 9,
  height: 8,
  depth: 8,
  colorType: 2,
  pixel: (x) => (x === 0 ? [0, 0, 0] : [255, 0, 0]),
});
png("rgb16-unsupported.png", {
  width: 8,
  height: 8,
  depth: 16,
  colorType: 2,
  pixel: () => [0, 0, 0, 0, 0, 0],
});
write(
  "malformed-truncated.png",
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72]),
);
const badCrc = readFileSync(join(root, "indexed-4bpp.png"));
badCrc[8 + 4 + 4 + 13] ^= 1; // Corrupt IHDR CRC without changing the image structure.
write("malformed-crc.png", badCrc);
const hugeDimensions = readFileSync(join(root, "indexed-4bpp.png"));
hugeDimensions.writeUInt32BE(2_097_152, 16);
hugeDimensions.writeUInt32BE(crc32(hugeDimensions.subarray(12, 29)), 29);
write("malformed-huge-dimensions.png", hugeDimensions);

const wavChunk = (name: string, payload: Uint8Array): Buffer =>
  Buffer.concat([
    Buffer.from(name),
    u32le(payload.length),
    payload,
    Buffer.alloc(payload.length & 1),
  ]);
/**
 * Emit mono PCM WAVE fixtures with an optional RIFF sampler loop in sample frames.
 * @param name Output filename in the fixture directory.
 * @param samples PCM sample values.
 * @param bits Sample width in bits.
 * @param loop Optional inclusive loop bounds in sample frames.
 */
const wave = (
  name: string,
  samples: readonly number[],
  bits: 8 | 16,
  loop?: { start: number; endInclusive: number },
): void => {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(32000, 4);
  fmt.writeUInt32LE((32000 * bits) / 8, 8);
  fmt.writeUInt16LE(bits / 8, 12);
  fmt.writeUInt16LE(bits, 14);
  const pcm = Buffer.alloc((samples.length * bits) / 8);
  samples.forEach((sample, index) => {
    if (bits === 8) {
      pcm.writeUInt8(sample, index);
    } else {
      pcm.writeInt16LE(sample, index * 2);
    }
  });
  const chunks = [wavChunk("fmt ", fmt), wavChunk("JUNK", Buffer.from([7])), wavChunk("data", pcm)];
  if (loop) {
    const smpl = Buffer.alloc(60);
    smpl.writeUInt32LE(1, 28);
    smpl.writeUInt32LE(loop.start, 44);
    smpl.writeUInt32LE(loop.endInclusive, 48);
    chunks.push(wavChunk("smpl", smpl));
  }
  const body = Buffer.concat([Buffer.from("WAVE"), ...chunks]);
  write(name, Buffer.concat([Buffer.from("RIFF"), u32le(body.length), body]));
};
wave(
  "pcm8-silence.wav",
  Array.from({ length: 16 }, () => 128),
  8,
);
wave("pcm16-transient.wav", [32767, -32768, ...Array.from({ length: 30 }, () => 0)], 16);
wave(
  "pcm16-short.wav",
  Array.from({ length: 15 }, () => 0),
  16,
);
wave(
  "pcm16-loop.wav",
  Array.from({ length: 512 }, (_, index) => (index % 32) * 512 - 8192),
  16,
  { start: 256, endInclusive: 511 },
);

write("brr-silence.bin", Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 0]));
write("brr-transient.bin", Buffer.from([0xc1, 0x78, 0, 0, 0, 0, 0, 0, 0]));

write(
  "palette-exact.json",
  `{
  "version": 1,
  "colors": [
    [0, 0, 0],
    [255, 0, 0]
  ],
  "transparentIndex": 0
}\n`,
);
write(
  "palette-reject.json",
  `{
  "version": 1,
  "colors": [
    [0, 0, 0],
    [254, 0, 0]
  ],
  "transparentIndex": 0
}\n`,
);
// Five-bit channel 4 expands to 33 by replication and 32 by scale-floor.
write(
  "palette-bit-replicate.json",
  `{
  "version": 1,
  "colors": [
    [0, 0, 0],
    [33, 0, 0]
  ],
  "transparentIndex": 0
}\n`,
);
write(
  "palette-scale-floor.json",
  `{
  "version": 1,
  "colors": [
    [0, 0, 0],
    [32, 0, 0]
  ],
  "transparentIndex": 0
}\n`,
);
