import { deflateSync } from "node:zlib";

/** Independent container fixture builder. It intentionally does not use the production file writer. */
export function asepriteFile(options: {
  width?: number;
  height?: number;
  transparent?: number;
  colors?: number;
  frames?: number;
  depth?: number;
  chunks: readonly { readonly type: number; readonly data: Uint8Array }[];
}): Uint8Array {
  const chunks = options.chunks.map(({ type, data }) => {
    const header = Buffer.alloc(6);
    header.writeUInt32LE(data.length + 6, 0);
    header.writeUInt16LE(type, 4);
    return Buffer.concat([header, data]);
  });
  const payload = Buffer.concat(chunks);
  const header = Buffer.alloc(144);
  header.writeUInt32LE(header.length + payload.length, 0);
  header.writeUInt16LE(0xa5e0, 4);
  header.writeUInt16LE(options.frames ?? 1, 6);
  header.writeUInt16LE(options.width ?? 3, 8);
  header.writeUInt16LE(options.height ?? 5, 10);
  header.writeUInt16LE(options.depth ?? 8, 12);
  header.writeUInt32LE(1, 14);
  header[28] = options.transparent ?? 2;
  header.writeUInt16LE(options.colors ?? 3, 32);
  header[34] = 1;
  header[35] = 1;
  header.writeUInt32LE(payload.length + 16, 128);
  header.writeUInt16LE(0xf1fa, 132);
  header.writeUInt16LE(chunks.length, 134);
  header.writeUInt16LE(100, 136);
  return Buffer.concat([header, payload]);
}

/** Manually declared palette/layer chunks, with duplicate colors and a nonzero transparent index. */
export function rasterHeaders() {
  const palette = Buffer.alloc(20 + 3 * 6);
  palette.writeUInt32LE(3, 0);
  palette.writeUInt32LE(2, 8);
  palette.set([0, 0, 8, 16, 24, 255, 0, 0, 8, 16, 24, 255, 0, 0, 0, 0, 0, 0], 20);
  const layer = Buffer.alloc(19);
  layer.writeUInt16LE(3, 0);
  layer[12] = 255;
  layer.writeUInt16LE(1, 16);
  layer[18] = 65;
  return [
    { type: 0x2019, data: palette },
    { type: 0x2004, data: layer },
  ];
}

/** Cropped raster fixture, optionally compressed by Node's independent zlib implementation. */
export function rasterCel(indexes: readonly number[], compressed = false, width = 2, height = 1) {
  const header = Buffer.alloc(20);
  header.writeInt16LE(1, 2);
  header.writeInt16LE(2, 4);
  header[6] = 255;
  header.writeUInt16LE(compressed ? 2 : 0, 7);
  header.writeUInt16LE(width, 16);
  header.writeUInt16LE(height, 18);
  const data = compressed ? deflateSync(Uint8Array.from(indexes)) : Uint8Array.from(indexes);
  return { type: 0x2005, data: Buffer.concat([header, data]) };
}
