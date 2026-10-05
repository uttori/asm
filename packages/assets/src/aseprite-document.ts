import { Cursor, Fields, chunk, rasterZlib } from "./aseprite-binary.js";
import { validateIndexedPixels } from "./indexed-edit.js";
import { indexedPalette, type IndexedColor } from "./indexed-values.js";
import { ASSET_LIMITS, boundedProduct, boundedSum, rasterArea } from "./limits.js";
import { integer } from "./validation.js";

const ID_PREFIX = "uttori-atlas-export:";

/** Format metadata is descriptive. Import authority belongs exclusively to the host's private baseline. */
export interface AsepriteMetadata {
  userData?: string;
}

/** Flat normal/tilemap layers. Names, visibility and edit locks do not establish native authority. */
export type AsepriteLayer = AsepriteMetadata & {
  readonly name: string;
  readonly flags: number;
  readonly uuid?: string;
} & ({ readonly kind: "raster" } | { readonly kind: "tilemap"; readonly tileset: number });

/** Embedded indexed storage in vertical tile order. Base index only changes the editor's numbering. */
export interface AsepriteTileset extends AsepriteMetadata {
  readonly id: number;
  readonly name: string;
  readonly flags: number;
  readonly baseIndex: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly tileCount: number;
  readonly indexes: Uint8Array;
  readonly tileData: readonly (string | undefined)[];
}

/** Pixel offsets and z-index belong to the occurrence, including when its payload is linked. */
interface CelPosition extends AsepriteMetadata {
  readonly layer: number;
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
}

/** Linked cels share one decoded payload; they never allocate a copied image for each timeline frame. */
export type AsepriteCel = CelPosition &
  (
    | {
        readonly kind: "raster";
        readonly width: number;
        readonly height: number;
        readonly indexes: Uint8Array;
      }
    | { readonly kind: "linked"; readonly frame: number }
    | {
        readonly kind: "tilemap";
        readonly columns: number;
        readonly rows: number;
        readonly bits: 8 | 16 | 32;
        readonly idMask: number;
        readonly flipXMask: number;
        readonly flipYMask: number;
        readonly diagonalMask: number;
        readonly cells: Uint32Array;
      }
  );

/** One global duration in milliseconds. Separate layer clocks are not part of this file profile. */
export interface AsepriteFrame {
  readonly durationMs: number;
  readonly cels: readonly AsepriteCel[];
}

/** Inclusive timeline range with native Aseprite playback direction and repeat count. */
export interface AsepriteTag extends AsepriteMetadata {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly direction: number;
  readonly repeat: number;
}

/** Indexed file structure, independent of game grammar, native tile IDs and editable ownership. */
export interface AsepriteDocument extends AsepriteMetadata {
  readonly width: number;
  readonly height: number;
  readonly palette: readonly IndexedColor[];
  readonly transparentIndex: number;
  readonly exportId?: string;
  readonly layers: readonly AsepriteLayer[];
  readonly tilesets: readonly AsepriteTileset[];
  readonly frames: readonly AsepriteFrame[];
  readonly tags: readonly AsepriteTag[];
}

type CelPayload = Exclude<AsepriteCel, { kind: "linked" }>;

/** Resolve links once with a bounded iterative walk. Forward links, missing targets and cycles are explicit. */
export function resolveAsepriteCels(
  document: AsepriteDocument,
): ReadonlyMap<AsepriteCel, CelPayload> {
  integer(document.frames.length, "Aseprite frames", 1, ASSET_LIMITS.frames);
  integer(document.layers.length, "Aseprite layers", 1, ASSET_LIMITS.layers);
  let references = 0;
  const byFrame = document.frames.map((frame) => {
    references = boundedSum(
      references,
      frame.cels.length,
      ASSET_LIMITS.references,
      "Aseprite cel references",
    );
    const layers = new Map<number, AsepriteCel>();
    for (const cel of frame.cels) {
      integer(cel.layer, "Cel layer", 0, document.layers.length - 1);
      if (layers.has(cel.layer)) {
        throw new Error("Duplicate Aseprite cel on one frame/layer.");
      }
      if (cel.kind === "linked") {
        integer(cel.frame, "Linked frame", 0, document.frames.length - 1);
      } else {
        // JavaScript callers can supply an unknown kind; reject it before resolving payload links.
        // oxlint-disable-next-line typescript/no-unnecessary-condition
        if (cel.kind !== "raster" && cel.kind !== "tilemap") {
          throw new Error("Unsupported Aseprite cel kind.");
        }
      }
      layers.set(cel.layer, cel);
    }
    return layers;
  });
  const resolved = new Map<AsepriteCel, CelPayload>();
  for (const frame of document.frames) {
    for (const initial of frame.cels) {
      let cel = initial;
      const chain: AsepriteCel[] = [];
      const visited = new Set<AsepriteCel>();
      while (!resolved.has(cel) && cel.kind === "linked") {
        if (visited.has(cel) || chain.length >= ASSET_LIMITS.frames) {
          throw new Error("Aseprite linked cel cycle or traversal limit.");
        }
        visited.add(cel);
        chain.push(cel);
        const target = byFrame[cel.frame]?.get(cel.layer);
        if (!target) {
          throw new Error("Aseprite linked cel has no target on its layer.");
        }
        cel = target;
      }
      const payload = resolved.get(cel);
      let result: CelPayload;
      if (payload) {
        result = payload;
      } else if (cel.kind !== "linked") {
        result = cel;
      } else {
        throw new Error("Unresolved Aseprite linked cel.");
      }
      resolved.set(cel, result);
      for (const link of chain) {
        resolved.set(link, result);
      }
    }
  }
  return resolved;
}

/** Bound text bytes separately from the number of records that contain them. */
function textSize(value: string): number {
  if (typeof value !== "string") {
    throw new TypeError("Aseprite metadata must be text.");
  }
  return integer(new TextEncoder().encode(value).length, "Aseprite text bytes", 0, 65535);
}

/** Masks must be disjoint, within the storage word and unambiguous; no console transform policy is imposed. */
function validateMasks(cel: Extract<AsepriteCel, { kind: "tilemap" }>): void {
  if (![8, 16, 32].includes(cel.bits)) {
    throw new Error("Unsupported Aseprite tile word width.");
  }
  const maximum = 2 ** cel.bits - 1;
  integer(cel.idMask, "Tile ID mask", 1, maximum);
  if ((cel.idMask & (cel.idMask + 1)) !== 0) {
    throw new Error("Aseprite tile ID mask must use contiguous low bits.");
  }
  let claimed = cel.idMask;
  for (const mask of [cel.flipXMask, cel.flipYMask, cel.diagonalMask]) {
    integer(mask, "Tile transform mask", 0, maximum);
    if ((mask & (mask - 1)) !== 0 || (mask & claimed) !== 0) {
      throw new Error("Aseprite tile masks overlap or have multiple transform bits.");
    }
    claimed = (claimed | mask) >>> 0;
  }
}

/** Validate structure and all allocation/work counts. Equal copied payloads count separately; links count once. */
export function validateAsepriteDocument(document: AsepriteDocument): void {
  rasterArea(document.width, document.height, "Aseprite", ASSET_LIMITS.interchangeSide);
  indexedPalette(document.palette);
  integer(document.transparentIndex, "Aseprite transparent slot", 0, document.palette.length - 1);
  if (document.exportId !== undefined && !/^[\da-f-]{36}$/.test(document.exportId)) {
    throw new Error("Invalid Aseprite export identity.");
  }
  integer(document.frames.length, "Aseprite frames", 1, ASSET_LIMITS.frames);
  integer(document.layers.length, "Aseprite layers", 1, ASSET_LIMITS.layers);
  integer(document.tilesets.length, "Aseprite tilesets", 0, ASSET_LIMITS.tilesets);
  integer(document.tags.length, "Aseprite tags", 0, ASSET_LIMITS.frames);
  let bytes = 0,
    metadata = 0,
    references = 0;
  const addText = (value: string | undefined): void => {
    if (value !== undefined) {
      metadata = boundedSum(
        metadata,
        textSize(value),
        ASSET_LIMITS.metadataBytes,
        "Aseprite metadata",
      );
    }
  };
  addText(document.userData);
  const tilesets = new Map<number, AsepriteTileset>();
  for (const set of document.tilesets) {
    integer(set.id, "Tileset ID", 0, 0xffffffff);
    integer(set.flags, "Tileset flags", 0, 62);
    if (tilesets.has(set.id) || set.flags & ~62 || !(set.flags & 2)) {
      throw new Error("Duplicate, external or unsupported Aseprite tileset.");
    }
    integer(set.baseIndex, "Tileset base index", -32768, 32767);
    const area = rasterArea(
      set.tileWidth,
      set.tileHeight,
      "Aseprite tile",
      ASSET_LIMITS.interchangeSide,
    );
    integer(set.tileCount, "Aseprite tiles", 1, ASSET_LIMITS.owners);
    // A serialized tileset is a vertical storage strip, not a display canvas with a 4096-pixel height.
    const length = boundedProduct(area, set.tileCount, ASSET_LIMITS.decodedBytes, "Tileset pixels");
    if (
      !(set.indexes instanceof Uint8Array) ||
      set.indexes.length !== length ||
      set.tileData.length !== set.tileCount
    ) {
      throw new Error("Aseprite tileset pixel or metadata inventory mismatch.");
    }
    if (set.indexes.some((slot) => slot >= document.palette.length)) {
      throw new Error("Aseprite tileset references a missing palette slot.");
    }
    bytes = boundedSum(bytes, length, ASSET_LIMITS.decodedBytes, "Aseprite decoded payload");
    addText(set.name);
    addText(set.userData);
    for (const value of set.tileData) {
      addText(value);
    }
    tilesets.set(set.id, set);
  }
  for (const layer of document.layers) {
    integer(layer.flags, "Layer flags", 0, 127);
    // Public JavaScript callers can supply unsupported layer kinds despite the TypeScript union.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (layer.flags & (8 | 64) || (layer.kind !== "raster" && layer.kind !== "tilemap")) {
      throw new Error("Unsupported Aseprite background/reference/group layer.");
    }
    if (layer.uuid !== undefined && !/^[\da-f]{32}$/i.test(layer.uuid)) {
      throw new Error("Invalid Aseprite layer UUID.");
    }
    if (layer.kind === "tilemap" && !tilesets.has(layer.tileset)) {
      throw new Error("Aseprite layer references a missing embedded tileset.");
    }
    addText(layer.name);
    addText(layer.userData);
  }
  for (const frame of document.frames) {
    integer(frame.durationMs, "Frame duration milliseconds", 1, 65535);
    references = boundedSum(
      references,
      frame.cels.length,
      ASSET_LIMITS.references,
      "Aseprite cel references",
    );
    const layers = new Set<number>();
    for (const cel of frame.cels) {
      integer(cel.layer, "Cel layer", 0, document.layers.length - 1);
      if (layers.has(cel.layer)) {
        throw new Error("Duplicate Aseprite cel on one frame/layer.");
      }
      layers.add(cel.layer);
      integer(cel.x, "Cel x", -32768, 32767);
      integer(cel.y, "Cel y", -32768, 32767);
      integer(cel.zIndex, "Cel z-index", -32768, 32767);
      addText(cel.userData);
      // Links share their target's storage; only concrete cels consume the aggregate decoded-byte budget.
      if (cel.kind === "linked") {
        integer(cel.frame, "Linked frame", 0, document.frames.length - 1);
      } else if (cel.kind === "raster") {
        validateIndexedPixels(cel);
        if (
          document.layers[cel.layer].kind !== "raster" ||
          cel.indexes.some((slot) => slot >= document.palette.length)
        ) {
          throw new Error("Aseprite raster layer or palette slot mismatch.");
        }
        bytes = boundedSum(
          bytes,
          cel.indexes.length,
          ASSET_LIMITS.decodedBytes,
          "Aseprite decoded payload",
        );
        // Keep the explicit kind boundary for JavaScript callers; the final else rejects unknown payloads.
        // oxlint-disable-next-line typescript/no-unnecessary-condition
      } else if (cel.kind === "tilemap") {
        validateMasks(cel);
        integer(cel.columns, "Tilemap columns", 1, 65535);
        integer(cel.rows, "Tilemap rows", 1, 65535);
        const count = boundedProduct(
          cel.columns,
          cel.rows,
          ASSET_LIMITS.references,
          "Tilemap cells",
        );
        if (
          !(cel.cells instanceof Uint32Array) ||
          cel.cells.length !== count ||
          document.layers[cel.layer].kind !== "tilemap"
        ) {
          throw new Error("Aseprite tilemap layer or cell inventory mismatch.");
        }
        bytes = boundedSum(
          bytes,
          boundedProduct(count, 4, ASSET_LIMITS.decodedBytes, "Tilemap bytes"),
          ASSET_LIMITS.decodedBytes,
          "Aseprite decoded payload",
        );
      } else {
        throw new Error("Unsupported Aseprite cel kind.");
      }
    }
  }
  for (const tag of document.tags) {
    integer(tag.from, "Tag first frame", 0, document.frames.length - 1);
    integer(tag.to, "Tag final frame", tag.from, document.frames.length - 1);
    integer(tag.direction, "Tag direction", 0, 3);
    integer(tag.repeat, "Tag repeat", 0, 65535);
    addText(tag.name);
    addText(tag.userData);
  }
  const resolved = resolveAsepriteCels(document);
  const checkedPayloads = new Set<CelPayload>();
  for (const [cel, payload] of resolved) {
    const layer = document.layers[cel.layer];
    if (payload.kind !== layer.kind) {
      throw new Error("Linked payload does not match its layer.");
    }
    if (payload.kind === "tilemap" && layer.kind === "tilemap") {
      // Linked occurrences retain their own geometry but cannot multiply validation of shared cell storage.
      if (checkedPayloads.has(payload)) {
        continue;
      }
      checkedPayloads.add(payload);
      const set = tilesets.get(layer.tileset)!;
      for (const word of payload.cells) {
        if (!(set.flags & 4) && word === 0xffffffff) {
          continue;
        }
        const id = (word & payload.idMask) >>> 0;
        const usedMask =
          (payload.idMask | payload.flipXMask | payload.flipYMask | payload.diagonalMask) >>> 0;
        if ((word & ~usedMask) !== 0 || word > 2 ** payload.bits - 1 || id >= set.tileCount) {
          throw new Error("Aseprite tilemap references unknown tile bits or an absent tile.");
        }
      }
    }
  }
}

/** Parse indexed structure without consulting native ownership. Runtime cancellation is checked between chunks. */
export async function decodeAsepriteDocument(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<AsepriteDocument> {
  integer(bytes.length, "Aseprite input bytes", 144, ASSET_LIMITS.asepriteBytes);
  signal?.throwIfAborted();
  const file = new Cursor(Uint8Array.from(bytes));
  const header = new Cursor(file.take(128));
  if (header.u32() !== bytes.length || header.u16() !== 0xa5e0) {
    throw new Error("Invalid Aseprite header/length.");
  }
  const frameCount = integer(header.u16(), "Aseprite frames", 1, ASSET_LIMITS.frames);
  const width = header.u16(),
    height = header.u16();
  rasterArea(width, height, "Aseprite", ASSET_LIMITS.interchangeSide);
  if (header.u16() !== 8) {
    throw new Error("Aseprite interchange requires indexed color mode.");
  }
  const flags = header.u32();
  if (flags & ~7) {
    throw new Error("Unsupported Aseprite header flags.");
  }
  const speed = header.u16();
  header.take(8);
  const transparentIndex = header.u8();
  header.take(3);
  let paletteSize = header.u16() || 256;
  integer(paletteSize, "Palette size", 1, 256);
  const ratioX = header.u8(),
    ratioY = header.u8();
  if (ratioX && ratioY && ratioX !== ratioY) {
    throw new Error("Unsupported Aseprite pixel aspect ratio.");
  }
  const layers: AsepriteLayer[] = [],
    tilesets: AsepriteTileset[] = [],
    frames: AsepriteFrame[] = [],
    tags: AsepriteTag[] = [];
  const paletteState: (IndexedColor | undefined)[] = [];
  let palette: IndexedColor[] = [],
    modern = false,
    decoded = 0,
    metadata = 0,
    chunks = 0,
    references = 0;
  let exportId: string | undefined, userData: string | undefined;
  const reserve = (length: number): number => {
    decoded = boundedSum(decoded, length, ASSET_LIMITS.decodedBytes, "Aseprite decoded payload");
    return length;
  };
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    signal?.throwIfAborted();
    const frameSize = integer(
      file.u32(),
      "Frame extent",
      16,
      file.bytes.length - file.position + 4,
    );
    const frame = new Cursor(file.take(frameSize - 4));
    if (frame.u16() !== 0xf1fa) {
      throw new Error("Invalid Aseprite frame header.");
    }
    const oldCount = frame.u16(),
      durationMs = frame.u16() || speed;
    frame.take(2);
    const count = frame.u32() || oldCount;
    chunks = boundedSum(chunks, count, ASSET_LIMITS.chunks, "Aseprite chunks");
    if (count > Math.floor((frame.bytes.length - frame.position) / 6)) {
      throw new Error("Aseprite chunk count exceeds frame extent.");
    }
    modern = false;
    const cels: AsepriteCel[] = [];
    let attachment: ((text: string | undefined) => void) | undefined;
    let documentAttachment = false;
    let lastCel: AsepriteCel | undefined;
    for (let i = 0; i < count; i++) {
      signal?.throwIfAborted();
      const size = integer(frame.u32(), "Chunk extent", 6, frame.bytes.length - frame.position + 4);
      const type = frame.u16(),
        data = new Cursor(frame.take(size - 6));
      if (type !== 0x2020 && type !== 0x2006) {
        attachment = undefined;
        documentAttachment = false;
      }
      if ([0x2019, 0x0004, 0x0011].includes(type)) {
        if (type === 0x2019) {
          paletteSize = integer(data.u32(), "Palette size", 1, 256);
          const first = data.u32(),
            last = data.u32();
          data.take(8);
          if (first > last || last >= paletteSize) {
            throw new Error("Invalid Aseprite palette range.");
          }
          paletteState.length = paletteSize;
          for (let slot = first; slot <= last; slot++) {
            const entryFlags = data.u16();
            if (entryFlags & ~1) {
              throw new Error("Unsupported palette entry flags.");
            }
            paletteState[slot] = [data.u8(), data.u8(), data.u8(), data.u8()];
            if (entryFlags & 1) {
              data.text();
            }
          }
          modern = true;
        } else {
          const packets = integer(data.u16(), "Palette packets", 0, 256);
          let start = 0;
          for (let packet = 0; packet < packets; packet++) {
            // Legacy skips accumulate from packet starts, matching native editor normalization.
            start += data.u8();
            const length = data.u8() || 256;
            if (start + length > 256) {
              throw new Error("Invalid legacy palette range.");
            }
            for (let slot = start; slot < start + length; slot++) {
              const rgb = [data.u8(), data.u8(), data.u8()];
              if (type === 0x0011) {
                for (let channel = 0; channel < 3; channel++) {
                  integer(rgb[channel], "Legacy palette channel", 0, 63);
                  rgb[channel] = (rgb[channel] << 2) | (rgb[channel] >> 4);
                }
              }
              if (!modern) {
                paletteState[slot] = [rgb[0], rgb[1], rgb[2], 255];
              }
            }
          }
        }
        documentAttachment = true;
        attachment = (text) => {
          if (text?.startsWith(ID_PREFIX)) {
            if (exportId !== undefined) {
              throw new Error("Conflicting Aseprite export identity.");
            }
            exportId = text.slice(ID_PREFIX.length);
          } else {
            userData = text;
          }
          attachment = undefined;
          documentAttachment = false;
        };
      } else if (type === 0x2004) {
        if (frameIndex !== 0 || layers.length >= ASSET_LIMITS.layers) {
          throw new Error("Aseprite layer declaration limit/order.");
        }
        const layerFlags = data.u16(),
          kind = data.u16(),
          level = data.u16();
        data.take(4);
        const blend = data.u16(),
          opacity = data.u8();
        data.take(3);
        const name = data.text();
        if (![0, 2].includes(kind) || level || blend || (flags & 1 && opacity !== 255)) {
          throw new Error("Unsupported Aseprite layer hierarchy/blend/opacity.");
        }
        let layer: AsepriteLayer;
        if (kind === 2) {
          layer = { name, flags: layerFlags, kind: "tilemap", tileset: data.u32() };
        } else {
          layer = { name, flags: layerFlags, kind: "raster" };
        }
        if (flags & 4) {
          const uuid = [...data.take(16)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          layer = { ...layer, uuid };
        }
        layers.push(layer);
        attachment = (text) => {
          layer.userData = text;
          attachment = undefined;
        };
      } else if (type === 0x2005) {
        references = boundedSum(references, 1, ASSET_LIMITS.references, "Aseprite cel references");
        const position = { layer: data.u16(), x: data.i16(), y: data.i16() };
        const opacity = data.u8(),
          celType = data.u16(),
          zIndex = data.i16();
        data.take(5);
        if (opacity !== 255) {
          throw new Error("Unsupported Aseprite cel opacity.");
        }
        let cel: AsepriteCel;
        if (celType === 1) {
          cel = { ...position, zIndex, kind: "linked", frame: data.u16() };
        } else if (celType === 0 || celType === 2) {
          const celWidth = data.u16(),
            celHeight = data.u16();
          const length = reserve(rasterArea(celWidth, celHeight, "Aseprite cel"));
          const indexes =
            celType === 0
              ? data.take(length).slice()
              : await rasterZlib(data.take(data.bytes.length - data.position), length, signal);
          cel = {
            ...position,
            zIndex,
            kind: "raster",
            width: celWidth,
            height: celHeight,
            indexes,
          };
        } else if (celType === 3) {
          const columns = data.u16(),
            rows = data.u16(),
            bits = data.u16();
          if (bits !== 8 && bits !== 16 && bits !== 32) {
            throw new Error("Unsupported Aseprite tile word width.");
          }
          const masks = {
            idMask: data.u32(),
            flipXMask: data.u32(),
            flipYMask: data.u32(),
            diagonalMask: data.u32(),
          };
          data.take(10);
          const cellCount = boundedProduct(columns, rows, ASSET_LIMITS.references, "Tilemap cells");
          reserve(boundedProduct(cellCount, 4, ASSET_LIMITS.decodedBytes, "Tilemap payload"));
          const raw = await rasterZlib(
            data.take(data.bytes.length - data.position),
            boundedProduct(cellCount, bits / 8, ASSET_LIMITS.decodedBytes, "Tilemap storage"),
            signal,
          );
          const cells = new Uint32Array(cellCount),
            words = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
          // Widen native words into one canonical buffer; DataView keeps decoding independent of host byte order.
          for (let cell = 0; cell < cellCount; cell++) {
            if (bits === 8) {
              cells[cell] = raw[cell];
            } else if (bits === 16) {
              cells[cell] = words.getUint16(cell * 2, true);
            } else {
              cells[cell] = words.getUint32(cell * 4, true);
            }
          }
          cel = { ...position, zIndex, kind: "tilemap", columns, rows, bits, ...masks, cells };
        } else {
          throw new Error("Unsupported Aseprite cel type.");
        }
        cels.push(cel);
        lastCel = cel;
        attachment = (text) => {
          cel.userData = text;
          attachment = undefined;
        };
      } else if (type === 0x2023) {
        if (frameIndex !== 0 || tilesets.length >= ASSET_LIMITS.tilesets) {
          throw new Error("Aseprite tileset declaration limit/order.");
        }
        const id = data.u32(),
          tilesetFlags = data.u32(),
          tileCount = data.u32(),
          tileWidth = data.u16(),
          tileHeight = data.u16(),
          baseIndex = data.i16();
        data.take(14);
        const name = data.text();
        // Only embedded storage has a bounded payload here; external tileset references cannot authorize pixels.
        if (tilesetFlags & ~62 || !(tilesetFlags & 2)) {
          throw new Error("External or unsupported Aseprite tileset.");
        }
        integer(tileCount, "Tileset tiles", 1, ASSET_LIMITS.owners);
        const length = reserve(
          boundedProduct(
            rasterArea(tileWidth, tileHeight, "Aseprite tile"),
            tileCount,
            ASSET_LIMITS.decodedBytes,
            "Tileset pixels",
          ),
        );
        const compressed = data.take(data.u32());
        const indexes = await rasterZlib(compressed, length, signal);
        const tileData: (string | undefined)[] = Array.from({ length: tileCount }, () => undefined);
        const set: AsepriteTileset = {
          id,
          flags: tilesetFlags,
          tileCount,
          tileWidth,
          tileHeight,
          baseIndex,
          name,
          indexes,
          tileData,
        };
        tilesets.push(set);
        // Format attachment order is tileset first, then one record per tile, including empty user data.
        let tile = -1;
        attachment = (text) => {
          if (tile < 0) {
            set.userData = text;
          } else {
            tileData[tile] = text;
          }
          tile++;
          if (tile === tileCount) {
            attachment = undefined;
          }
        };
      } else if (type === 0x2018) {
        const length = integer(data.u16(), "Tag count", 0, ASSET_LIMITS.frames - tags.length);
        data.take(8);
        const firstTag = tags.length;
        for (let tagIndex = 0; tagIndex < length; tagIndex++) {
          const from = data.u16(),
            to = data.u16(),
            direction = data.u8(),
            repeat = data.u16();
          data.take(10);
          const tag: AsepriteTag = { from, to, direction, repeat, name: data.text() };
          tags.push(tag);
        }
        let tag = firstTag;
        attachment = (text) => {
          if (tag >= tags.length) {
            throw new Error("Extra Aseprite tag metadata.");
          }
          if (text !== undefined) {
            tags[tag].userData = text;
          }
          tag++;
          if (tag === tags.length) {
            attachment = undefined;
          }
        };
      } else if (type === 0x2020) {
        metadata = boundedSum(metadata, size - 6, ASSET_LIMITS.metadataBytes, "Aseprite metadata");
        const userFlags = data.u32();
        if (userFlags & ~7) {
          throw new Error("Unsupported Aseprite user data flags.");
        }
        const text = userFlags & 1 ? data.text() : undefined;
        if (userFlags & 2) {
          data.take(4);
        }
        if (userFlags & 4) {
          const length = integer(
            data.u32(),
            "Property extent",
            8,
            data.bytes.length - data.position + 4,
          );
          // Properties are opaque editor annotations; they cannot supply any native bindings.
          data.take(length - 4);
        }
        if (text?.startsWith(ID_PREFIX) && !documentAttachment) {
          throw new Error("Conflicting Aseprite export identity attachment.");
        }
        attachment?.(text);
      } else if (type === 0x2006) {
        const extraFlags = data.u32(),
          bounds = [data.i32(), data.i32(), data.i32(), data.i32()];
        data.take(16);
        if (extraFlags & ~1 || (extraFlags & 1 && (!lastCel || lastCel.kind !== "raster"))) {
          throw new Error("Unsupported Aseprite precise cel bounds.");
        }
        if (extraFlags & 1 && lastCel?.kind === "raster") {
          const expected = [lastCel.x, lastCel.y, lastCel.width, lastCel.height];
          // Extra bounds use fixed-point coordinates; native inverses require the original integer geometry.
          if (bounds.some((value, bound) => value !== expected[bound] * 65536)) {
            throw new Error("Scaled or fractional Aseprite cel bounds are unsupported.");
          }
        }
      } else if (type === 0x2007) {
        const profile = data.u16(),
          profileFlags = data.u16();
        data.take(12);
        if (profile > 1 || profileFlags) {
          throw new Error("Unsupported Aseprite color profile/gamma.");
        }
        attachment = undefined;
      } else if ([0x2016, 0x2017, 0x2022].includes(type)) {
        // Selection masks, unused paths and slice annotations do not change indexed rendering.
        metadata = boundedSum(
          metadata,
          size - 6,
          ASSET_LIMITS.metadataBytes,
          "Aseprite annotations",
        );
        data.take(data.bytes.length);
        attachment = undefined;
      } else {
        throw new Error(`Unsupported Aseprite chunk 0x${type.toString(16)}.`);
      }
      data.finish();
    }
    frame.finish();
    const current: IndexedColor[] = [];
    for (let slot = 0; slot < paletteSize; slot++) {
      const color = paletteState[slot];
      if (!color) {
        throw new Error("Aseprite palette does not define every slot.");
      }
      current.push(color);
    }
    if (frameIndex === 0) {
      palette = current;
    } else if (
      palette.length !== current.length ||
      current.some((color, slot) => color.some((channel, i) => channel !== palette[slot][i]))
    ) {
      throw new Error("Animated palette changes are outside the indexed interchange profile.");
    }
    frames.push({ durationMs, cels });
  }
  file.finish();
  signal?.throwIfAborted();
  const document = {
    width,
    height,
    palette,
    transparentIndex,
    exportId,
    userData,
    layers,
    tilesets,
    frames,
    tags,
  };
  validateAsepriteDocument(document);
  return document;
}

/** Portable compression uses the same browser web-stream contract as bounded decompression. */
async function compress(
  bytes: Uint8Array,
  limit: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream("deflate")).getReader();
  const abort = (): void => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const next = await reader.read();
      signal?.throwIfAborted();
      if (next.done) {
        break;
      }
      size = boundedSum(size, next.value.length, limit, "Aseprite compressed output");
      parts.push(next.value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => {});
    throw cause;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Reserve every fixed field and metadata chunk before compression or per-record byte allocation. */
function encodedStructureBytes(document: AsepriteDocument): number {
  let size = boundedSum(
      128,
      document.frames.length * 16,
      ASSET_LIMITS.asepriteBytes,
      "Aseprite output size",
    ),
    chunks = 0;
  const reserve = (bytes: number): void => {
    chunks = boundedSum(chunks, 1, ASSET_LIMITS.chunks, "Aseprite chunks");
    size = boundedSum(size, bytes, ASSET_LIMITS.asepriteBytes, "Aseprite output size");
  };
  const user = (value: string | undefined): void =>
    reserve(10 + (value === undefined ? 0 : 2 + textSize(value)));
  reserve(26 + document.palette.length * 6);
  if (document.exportId) {
    user(ID_PREFIX + document.exportId);
  } else if (document.userData !== undefined) {
    user(document.userData);
  }
  for (const set of document.tilesets) {
    reserve(44 + textSize(set.name));
    if (set.userData !== undefined || set.tileData.some((value) => value !== undefined)) {
      user(set.userData);
      let last = set.tileData.length - 1;
      while (last >= 0 && set.tileData[last] === undefined) {
        last--;
      }
      for (let tile = 0; tile <= last; tile++) {
        user(set.tileData[tile]);
      }
    }
  }
  for (const layer of document.layers) {
    reserve(24 + textSize(layer.name) + (layer.kind === "tilemap" ? 4 : 0) + (layer.uuid ? 16 : 0));
    if (layer.userData !== undefined) {
      user(layer.userData);
    }
  }
  if (document.tags.length) {
    reserve(16 + document.tags.reduce((total, tag) => total + 19 + textSize(tag.name), 0));
    if (document.tags.some((tag) => tag.userData !== undefined)) {
      for (const tag of document.tags) {
        user(tag.userData);
      }
    }
  }
  for (const frame of document.frames) {
    for (const cel of frame.cels) {
      let extent = 26;
      if (cel.kind === "linked") {
        extent = 24;
      } else if (cel.kind === "tilemap") {
        extent = 54;
      }
      reserve(extent);
      if (cel.userData !== undefined) {
        user(cel.userData);
      }
    }
  }
  return size;
}

/** Empty user-data records retain attachment positions even when their text is absent. */
const userDataChunk = (text: string | undefined): Uint8Array =>
  chunk(
    0x2020,
    text === undefined ? new Fields().u32(0).build() : new Fields().u32(1).text(text).build(),
  );

/** Encode deterministic structure with embedded tile storage and stable metadata attachment order. */
export async function encodeAsepriteDocument(
  document: AsepriteDocument,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  validateAsepriteDocument(document);
  let available = ASSET_LIMITS.asepriteBytes - encodedStructureBytes(document);
  const compressPayload = async (bytes: Uint8Array): Promise<Uint8Array> => {
    const output = await compress(bytes, available, signal);
    available -= output.length;
    return output;
  };
  const hasUuid = document.layers.some((layer) => layer.uuid !== undefined);
  if (hasUuid && document.layers.some((layer) => !layer.uuid)) {
    throw new Error("All Aseprite layers require UUIDs when UUID storage is enabled.");
  }
  const allFrames: Uint8Array[] = [];
  for (let frameIndex = 0; frameIndex < document.frames.length; frameIndex++) {
    signal?.throwIfAborted();
    const frame = document.frames[frameIndex],
      chunks: Uint8Array[] = [];
    if (frameIndex === 0) {
      const palette = new Fields()
        .u32(document.palette.length)
        .u32(0)
        .u32(document.palette.length - 1)
        .raw(new Uint8Array(8));
      for (const color of document.palette) {
        palette.u16(0).raw(Uint8Array.from(color));
      }
      chunks.push(chunk(0x2019, palette.build()));
      if (document.exportId) {
        chunks.push(userDataChunk(ID_PREFIX + document.exportId));
      } else if (document.userData !== undefined) {
        chunks.push(userDataChunk(document.userData));
      }
      for (const set of document.tilesets) {
        const fields = new Fields()
          .u32(set.id)
          .u32(set.flags)
          .u32(set.tileCount)
          .u16(set.tileWidth)
          .u16(set.tileHeight)
          .u16(set.baseIndex)
          .raw(new Uint8Array(14))
          .text(set.name);
        const compressed = await compressPayload(set.indexes);
        fields.u32(compressed.length).raw(compressed);
        chunks.push(chunk(0x2023, fields.build()));
        if (set.userData !== undefined || set.tileData.some((text) => text !== undefined)) {
          chunks.push(userDataChunk(set.userData));
          // Empty entries retain per-tile attachment positions; only trailing absent records may be omitted.
          let last = set.tileData.length - 1;
          while (last >= 0 && set.tileData[last] === undefined) {
            last--;
          }
          for (let tile = 0; tile <= last; tile++) {
            chunks.push(userDataChunk(set.tileData[tile]));
          }
        }
      }
      for (const layer of document.layers) {
        const fields = new Fields()
          .u16(layer.flags)
          .u16(layer.kind === "raster" ? 0 : 2)
          .u16(0)
          .u16(0)
          .u16(0)
          .u16(0)
          .u8(255)
          .raw(new Uint8Array(3))
          .text(layer.name);
        if (layer.kind === "tilemap") {
          fields.u32(layer.tileset);
        }
        if (layer.uuid) {
          fields.raw(Uint8Array.from(layer.uuid.match(/../g)!, (hex) => Number.parseInt(hex, 16)));
        }
        chunks.push(chunk(0x2004, fields.build()));
        if (layer.userData !== undefined) {
          chunks.push(userDataChunk(layer.userData));
        }
      }
      if (document.tags.length) {
        const fields = new Fields().u16(document.tags.length).raw(new Uint8Array(8));
        for (const tag of document.tags) {
          fields
            .u16(tag.from)
            .u16(tag.to)
            .u8(tag.direction)
            .u16(tag.repeat)
            .raw(new Uint8Array(10))
            .text(tag.name);
        }
        chunks.push(chunk(0x2018, fields.build()));
        if (document.tags.some((tag) => tag.userData !== undefined)) {
          for (const tag of document.tags) {
            chunks.push(userDataChunk(tag.userData));
          }
        }
      }
    }
    for (const cel of frame.cels) {
      const fields = new Fields().u16(cel.layer).u16(cel.x).u16(cel.y).u8(255);
      let kind = 2;
      if (cel.kind === "linked") {
        kind = 1;
      } else if (cel.kind === "tilemap") {
        kind = 3;
      }
      fields.u16(kind).u16(cel.zIndex).raw(new Uint8Array(5));
      if (cel.kind === "linked") {
        fields.u16(cel.frame);
      } else if (cel.kind === "raster") {
        fields
          .u16(cel.width)
          .u16(cel.height)
          .raw(await compressPayload(cel.indexes));
      } else {
        fields
          .u16(cel.columns)
          .u16(cel.rows)
          .u16(cel.bits)
          .u32(cel.idMask)
          .u32(cel.flipXMask)
          .u32(cel.flipYMask)
          .u32(cel.diagonalMask)
          .raw(new Uint8Array(10));
        const bytes = new Uint8Array(cel.cells.length * (cel.bits / 8)),
          words = new DataView(bytes.buffer);
        for (let cell = 0; cell < cel.cells.length; cell++) {
          if (cel.bits === 8) {
            bytes[cell] = cel.cells[cell];
          } else if (cel.bits === 16) {
            words.setUint16(cell * 2, cel.cells[cell], true);
          } else {
            words.setUint32(cell * 4, cel.cells[cell], true);
          }
        }
        fields.raw(await compressPayload(bytes));
      }
      chunks.push(chunk(0x2005, fields.build()));
      if (cel.userData !== undefined) {
        chunks.push(userDataChunk(cel.userData));
      }
    }
    integer(chunks.length, "Frame chunks", 0, ASSET_LIMITS.chunks);
    const payload = new Fields();
    for (const bytes of chunks) {
      payload.raw(bytes);
    }
    const bytes = payload.build();
    allFrames.push(
      new Fields()
        .u32(bytes.length + 16)
        .u16(0xf1fa)
        .u16(Math.min(chunks.length, 65535))
        .u16(frame.durationMs)
        .u16(0)
        .u32(chunks.length)
        .raw(bytes)
        .build(),
    );
  }
  const frames = new Fields();
  for (const bytes of allFrames) {
    frames.raw(bytes);
  }
  const framePayload = frames.build(),
    header = new Uint8Array(128),
    view = new DataView(header.buffer);
  view.setUint32(0, framePayload.length + 128, true);
  view.setUint16(4, 0xa5e0, true);
  view.setUint16(6, document.frames.length, true);
  view.setUint16(8, document.width, true);
  view.setUint16(10, document.height, true);
  view.setUint16(12, 8, true);
  view.setUint32(14, hasUuid ? 5 : 1, true);
  view.setUint16(18, document.frames[0].durationMs, true);
  header[28] = document.transparentIndex;
  view.setUint16(32, document.palette.length, true);
  header[34] = 1;
  header[35] = 1;
  return new Fields().raw(header).raw(framePayload).build();
}
