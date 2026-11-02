import { ASSET_LIMITS, boundedSum } from "../limits.js";
import { decodePlanarTiles } from "../snes.js";
import { integer } from "../validation.js";
import { decodeMapPiece } from "./som-map-piece.js";
import type { RoomAsset, RoomPreview } from "./som-room-assets.js";

/** Read exact current bytes at CPU addresses. The host supplies mapper/mirror policy and source attribution. */
export type SomRoomNativeReader = (address: number, size: number) => Uint8Array;

/** One complete loader-owned tile. Low native planes are editable; descriptor-selected upper planes are fixed. */
export interface SomRoomNativeTile {
  /** CPU address of the loader transfer source. */
  readonly address: number;
  /** Planar bit depth of the transferred tile data. */
  readonly depth: 2 | 3 | 4;
  /** Descriptor constant selecting fixed upper planes. */
  readonly constant: number;
  /** VRAM destination word for the transfer. */
  readonly destination: number;
  /** Raw native bytes read from the transfer source. */
  readonly native: Uint8Array;
  /** Expanded four-plane index tile for editing and preview. */
  readonly indexes: Uint8Array;
}

/** Loader order and full transfer inventory, including overwritten/unused sources, remain separate from visible coverage. */
export interface SomRoomNativeState {
  /** Captured preview sidecar paired with native reads. */
  readonly preview: RoomPreview;
  /** Complete loader transfer inventory in dispatch order. */
  readonly inventory: readonly SomRoomNativeTile[];
  /** Physical tile slots indexed by VRAM tile number. */
  readonly physical: readonly (SomRoomNativeTile | undefined)[];
  /** CPU address of the room palette upload. */
  readonly paletteAddress: number;
}

/** Decode the fixed 384-metatile MSB stream. Short deltas wrap the low byte; signed deltas carry through the word. */
export function decodeSomRoomMetatiles(bytes: Uint8Array): Uint16Array {
  if (!bytes.length || bytes.length > 3840) {
    throw new Error("Invalid metatile stream extent.");
  }
  let bit = 0,
    word = 0;
  const take = (count: number): number => {
    if (bit + count > bytes.length * 8) {
      throw new Error("Truncated metatile bitstream.");
    }
    let value = 0;
    for (let index = 0; index < count; index++, bit++) {
      value = value * 2 + ((bytes[bit >>> 3] >>> (7 - (bit & 7))) & 1);
    }
    return value;
  };
  const words = new Uint16Array(1536);
  for (let index = 0; index < words.length; index++) {
    const prefix = take(2);
    if (prefix === 1) {
      word = (word & 0xff00) | ((word + 1) & 255);
    } else if (prefix === 2) {
      word = (word & 0xff00) | ((word - 1) & 255);
    } else if (prefix === 3) {
      if (take(1) === 0) {
        const delta = take(7);
        word = (word + (delta >= 64 ? delta - 128 : delta)) & 65535;
      } else {
        // Only the extended branch consumes this second discriminator bit.
        const changesFlags = take(1) === 0;
        if (changesFlags) {
          const flags = take(4);
          if (flags < 8) {
            word = (word & 0xe3ff) | (flags << 10);
          } else {
            word = (word & 0x1fff) | ((flags & 7) << 13);
          }
          const delta = take(6);
          word = (word + (delta >= 32 ? delta - 64 : delta)) & 65535;
        } else {
          word = take(16);
        }
      }
    }
    words[index] = word;
  }
  // Sub-byte padding is native state; an entire extra byte means the adjacent pointer bound is wrong.
  if (Math.ceil(bit / 8) !== bytes.length) {
    throw new Error("Whole trailing bytes before next metatile pointer.");
  }
  return words;
}

/** Hex encoding is only a compatibility envelope for the existing composition API, never native write authority. */
function hex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}

/**
 * Reconstruct the researched initial Mode-1 loader using current normal-build bytes.
 * Native format 7, partial tiles and unbounded pointers fail closed. Runtime animation,
 * capture-time overrides, actors and color math are outside this initial-state contract.
 */
export function loadSomRoomNative(
  room: RoomAsset,
  reader: SomRoomNativeReader,
): SomRoomNativeState {
  if (!Array.isArray(room.header) || room.header.length !== 8) {
    throw new Error("Room header requires eight bytes.");
  }
  room.header.forEach((byte) => integer(byte, "Room header", 0, 255));
  const read = (address: number, size: number): Uint8Array => {
    integer(address, "Room native address", 0xc00000, 0xffffff);
    integer(size, "Room native extent", 1, 32768);
    if (address + size > 0x1000000) {
      throw new Error("Room native extent crosses address space.");
    }
    const bytes = reader(address, size);
    if (!(bytes instanceof Uint8Array) || bytes.length !== size) {
      throw new Error("Incomplete room native source extent.");
    }
    return Uint8Array.from(bytes);
  };
  const u16 = (address: number): number => {
    const bytes = read(address, 2);
    return bytes[0] | (bytes[1] << 8);
  };
  const u24 = (address: number): number => {
    const bytes = read(address, 3);
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | 0xc00000;
  };
  const inventory: SomRoomNativeTile[] = [],
    physical: (SomRoomNativeTile | undefined)[] = Array.from({ length: 1024 }, () => undefined),
    graphics = new Uint8Array(32768),
    known = new Uint8Array(32768);
  const transfer = (
    address: number,
    count: number,
    depth: 2 | 3 | 4,
    constant: number,
    destination: number,
  ): void => {
    if (destination % 32 || destination < 0 || destination + count * 32 > graphics.length) {
      throw new Error("Room graphics exceed the native background tile workspace.");
    }
    const native = read(address, count * depth * 8),
      tiles = decodePlanarTiles(native, depth);
    tiles.forEach((tile, index) => {
      const indexes = Uint8Array.from(tile.flat()),
        at = destination + index * 32,
        entry = {
          address: address + index * depth * 8,
          depth,
          constant,
          destination: at / 32,
          native: native.slice(index * depth * 8, (index + 1) * depth * 8),
          indexes,
        };
      inventory.push(entry);
      physical[entry.destination] = entry;
      graphics.set(entry.native.subarray(0, 16), at);
      // Ordinary 3bpp's third plane is planar, whereas the expanded workspace interleaves planes 2/3.
      for (let row = 0; row < 8; row++) {
        let plane2 = constant & 4 ? 255 : 0;
        if (depth === 3) {
          plane2 = entry.native[16 + row];
        } else if (depth === 4) {
          plane2 = entry.native[16 + row * 2];
        }
        let plane3 = constant & 8 ? 255 : 0;
        if (depth === 4) {
          plane3 = entry.native[17 + row * 2];
        }
        graphics[at + 16 + row * 2] = plane2;
        graphics[at + 17 + row * 2] = plane3;
      }
      known.fill(1, at, at + 32);
    });
  };
  const configuration = read(0xc80400 + room.header[0], 1)[0],
    animated = [];
  // Animated slots initialize first. Packed runs may subsequently overwrite them; both retain declared ownership.
  for (let slot = 0; slot < 8; slot++) {
    const descriptor = 0xc80441 + configuration * 2 + slot,
      source = 0xdc8000 + (read(descriptor, 1)[0] & 63) * 512,
      destination = 0x6c00 + slot * 128;
    transfer(source, 4, 4, 0, destination);
    animated.push({ descriptor, source, bytes: 128, destination });
  }
  const id = room.header[0] & 63,
    start = 0xcc0000 + u16(0xcce27e + id * 2),
    end = 0xcc0000 + u16(0xcce280 + id * 2);
  if (end <= start || (end - start) % 3 || end - start > 3072) {
    throw new Error("Graphics list requires bounded whole triplets.");
  }
  const list = read(start, end - start),
    runs = [];
  let destination = 0;
  for (let offset = 0; offset < list.length; offset += 3) {
    const packed = list[offset] | (list[offset + 1] << 8),
      count = list[offset + 2] + 1,
      kind = packed >>> 13;
    if (kind === 7) {
      throw new Error("Paired-4bpp room graphics format 7 has no verified inverse.");
    }
    let depth: 2 | 3 | 4 = 4,
      baseIndex = 2,
      constant = 0;
    if (kind < 4) {
      depth = 2;
      baseIndex = 0;
      constant = (kind & 2 ? 4 : 0) | (kind & 1 ? 8 : 0);
    } else if (kind < 6) {
      depth = 3;
      baseIndex = 1;
      constant = kind & 1 ? 8 : 0;
    }
    const source = u24(0xcce270 + baseIndex * 3) + (packed & 0x1fff) * depth * 8;
    transfer(source, count, depth, constant, destination);
    runs.push({
      address: start + offset,
      packed,
      count,
      kind,
      bytesPerTile: depth * 8,
      source,
      destination,
    });
    destination += count * 32;
  }
  const paletteAddress = 0xcc8000 + (room.header[1] & 127) * 210;
  if (paletteAddress + 210 > 0xcce270) {
    throw new Error("Room palette crosses its native directory.");
  }
  const palette = read(paletteAddress, 210),
    colors = Array<number>(128).fill(0);
  for (let bank = 1; bank < 8; bank++) {
    for (let slot = 1; slot < 16; slot++) {
      const offset = ((bank - 1) * 15 + slot - 1) * 2;
      colors[bank * 16 + slot] = palette[offset] | (palette[offset + 1] << 8);
    }
  }
  const metatileId = room.header[2] & 63;
  integer(metatileId, "Metatile set", 0, 62);
  const address = u24(0xcb4000 + metatileId * 3),
    metatileEnd = u24(0xcb4003 + metatileId * 3);
  if (metatileEnd <= address || metatileEnd > 0xe00000 || metatileEnd - address > 3840) {
    throw new Error("Invalid adjacent metatile pointers.");
  }
  const words = decodeSomRoomMetatiles(read(address, metatileEnd - address));
  const layerWords = [0, 1].map((layer) => {
    const half = (room.header[2] >>> (6 + layer)) & 1;
    return Array.from(words.subarray(half * 768, (half + 1) * 768));
  });
  const thresholds = [u16(0xcd0000), u16(0xcd0002), u16(0xcd0004)];
  const bankFor = (value: number): number => {
    for (let index = 0; index < thresholds.length; index++) {
      if (value < thresholds[index]) {
        return 0xcd + index;
      }
    }
    return 0xcc;
  };
  integer(room.pieces.length, "Room pieces", 0, 65536);
  const layouts: RoomPreview["layouts"] = {};
  let layoutPixels = 0;
  for (const layoutId of new Set(room.pieces.map((piece) => piece.layout))) {
    integer(layoutId, "Native map piece", 1, 1022);
    const layoutAddress = bankFor(layoutId) * 65536 + u16(0xcd0004 + layoutId * 2),
      layoutEnd = bankFor(layoutId + 1) * 65536 + u16(0xcd0006 + layoutId * 2);
    if (layoutEnd <= layoutAddress || layoutEnd > 0xe00000 || layoutEnd - layoutAddress > 32768) {
      throw new Error("Map piece requires a monotone adjacent-address bound.");
    }
    const bytes = read(layoutAddress, layoutEnd - layoutAddress);
    // Native dimensions are in the first two bytes; reject aggregate layout expansion before allocating another decoded array.
    layoutPixels = boundedSum(
      layoutPixels,
      ((bytes[0] >>> 1) + 1) * ((bytes[1] >>> 1) + 1),
      ASSET_LIMITS.references,
      "Room layout cells",
    );
    const decoded = decodeMapPiece(bytes);
    layouts[layoutId] = { width: decoded.width, height: decoded.height, tiles: decoded.tiles };
  }
  return {
    inventory,
    physical,
    paletteAddress,
    preview: {
      format: "som.room.preview",
      version: 1,
      layouts,
      provenance: {
        kind: "native-room-loader-initial-state",
        animated,
        graphicsRuns: { id, address: start, end, runs },
        paletteAddress,
        metatiles: { address, end: metatileEnd },
      },
      tilesets: {
        [`${id}:${room.header[2]}:${room.header[1] & 127}`]: {
          graphics: hex(graphics),
          graphicsKnown: hex(known),
          colors,
          layerWords,
        },
      },
    },
  };
}
