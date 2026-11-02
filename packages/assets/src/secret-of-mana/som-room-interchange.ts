import type { AsepriteCel } from "../aseprite-document.js";
import type { IndexedOwner, IndexedOwnerView } from "../indexed-ownership.js";
import {
  interchangeIdentity,
  inspectTilemapInterchange,
  type TilemapInterchangeBaseline,
} from "../interchange.js";
import { ASSET_LIMITS, boundedSum, rasterArea } from "../limits.js";
import { createTilemapInventory, tilemapPresentationCel } from "../tilemap-presentation.js";
import { integer } from "../validation.js";
import type { SomRoomComposition } from "./som-room-composition.js";
import type { SomRoomNativeTile } from "./som-room-native.js";

/** Trusted source attribution supplied by the host; a physical destination is an occurrence rather than an owner ID. */
export interface SomRoomBoundTile extends SomRoomNativeTile {
  /** Native owner identity assigned by the host baseline. */
  readonly owner: string;
  /** Whether low-plane index edits may apply to this tile. */
  readonly editable: boolean;
}

/**
 * Present complete loader inventory and four Mode-1 passes using shared tilesets.
 * Native low-plane indexes map through fixed descriptor planes and palette banks;
 * native zero becomes transparent only when the expanded four-plane index is zero.
 */
export function createSomRoomInterchange(
  composition: SomRoomComposition,
  inventory: readonly SomRoomBoundTile[],
  physical: readonly (SomRoomBoundTile | undefined)[],
  editablePaletteSlots: readonly number[],
  exportId: string,
): TilemapInterchangeBaseline {
  rasterArea(
    composition.width,
    composition.height,
    "Room presentation",
    ASSET_LIMITS.interchangeSide,
  );
  integer(inventory.length, "Room transfer inventory", 1, 1056);
  integer(physical.length, "Room physical tile slots", 1, 1024);
  integer(composition.passes.length, "Room presentation passes", 1, 4);
  let referencesCount = 0;
  for (const pass of composition.passes) {
    referencesCount = boundedSum(
      referencesCount,
      pass.cells.length,
      ASSET_LIMITS.references,
      "Room cell references",
    );
  }
  const owners = new Map<string, IndexedOwner>(),
    views: IndexedOwnerView[] = [],
    references = new Map<string, number>(),
    maps = new Map<string, readonly (number | null)[]>();
  const add = (tile: SomRoomBoundTile, bank: number): number => {
    integer(bank, "Room view palette bank", 0, 7);
    if (
      ![2, 3, 4].includes(tile.depth) ||
      !(tile.indexes instanceof Uint8Array) ||
      tile.indexes.length !== 64 ||
      tile.native.length !== tile.depth * 8 ||
      ![0, 4, 8, 12].includes(tile.constant) ||
      tile.constant & (2 ** tile.depth - 1)
    ) {
      throw new Error("Invalid native room view encoding.");
    }
    const previous = owners.get(tile.owner);
    if (
      previous &&
      (previous.allowedIndexes.length !== 2 ** tile.depth ||
        previous.editable !== tile.editable ||
        previous.indexes.some((slot, index) => slot !== tile.indexes[index]))
    ) {
      throw new Error("Inconsistent room source alias attribution.");
    }
    if (!previous) {
      owners.set(tile.owner, {
        id: tile.owner,
        width: 8,
        height: 8,
        indexes: tile.indexes.slice(),
        editable: tile.editable,
        allowedIndexes: Array.from({ length: 2 ** tile.depth }, (_, index) => index),
      });
    }
    const id = JSON.stringify([tile.owner, tile.constant, bank]),
      cached = references.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const key = `${tile.depth}:${tile.constant}:${bank}`;
    let indexMap = maps.get(key);
    if (!indexMap) {
      const slots: (number | null)[] = Array<number | null>(256).fill(null);
      for (let slot = 0; slot < 2 ** tile.depth; slot++) {
        // Authored low planes and fixed high planes are disjoint, so addition preserves both.
        const expanded = slot + tile.constant;
        const display = expanded === 0 ? 0 : bank * 16 + expanded;
        slots[display] = slot;
      }
      indexMap = slots;
      maps.set(key, slots);
    }
    views.push({
      id,
      owner: tile.owner,
      width: 8,
      height: 8,
      indexMap,
      indexes: Uint8Array.from(tile.indexes, (slot) => {
        const expanded = slot + tile.constant;
        return expanded === 0 ? 0 : bank * 16 + expanded;
      }),
    });
    references.set(id, views.length);
    return views.length;
  };
  // A visible default view retains every declared source, even if a later transfer overwrote its VRAM destination.
  for (const tile of inventory) {
    add(tile, 1);
  }
  const columns = composition.width / 8,
    rows = composition.height / 8,
    passes = composition.passes.map((pass) => {
      const cells = new Uint32Array(columns * rows);
      for (const cell of pass.cells) {
        const tile = physical[cell.tile];
        if (
          !tile ||
          tile.indexes.some(
            (slot, index) => slot + tile.constant !== composition.tiles[cell.tile][index],
          )
        ) {
          throw new Error("Room cell has no complete current native tile binding.");
        }
        cells[(cell.y / 8) * columns + cell.x / 8] =
          (add(tile, cell.palette) |
            (cell.flipX ? 0x80000000 : 0) |
            (cell.flipY ? 0x40000000 : 0)) >>>
          0;
      }
      return { pass, cells };
    });
  const ownership = { owners: [...owners.values()], views },
    presentation = createTilemapInventory(
      ownership,
      composition.width,
      composition.height,
      "Room native tile/palette views",
    ),
    layers = presentation.layers,
    frames = presentation.frames,
    tags = presentation.tags;
  const backdrop = layers.length;
  layers.push({
    kind: "raster",
    flags: 1,
    name: "Background (preview only)",
    userData: interchangeIdentity.role("backdrop"),
  });
  const cels: AsepriteCel[] = [
    {
      kind: "raster",
      layer: backdrop,
      x: 0,
      y: 0,
      zIndex: 0,
      width: presentation.width,
      height: presentation.height,
      indexes: new Uint8Array(presentation.width * presentation.height).fill(128),
    },
  ];
  for (const { pass, cells } of passes) {
    const layer = layers.length;
    layers.push({
      kind: "tilemap",
      flags: 3,
      tileset: 0,
      name: `BG${pass.layer} ${pass.priority ? "high" : "low"} (fixed cells)`,
      userData: interchangeIdentity.role(`bg${pass.layer}:${pass.priority}`),
    });
    cels.push(tilemapPresentationCel(layer, 0, 0, columns, rows, cells));
  }
  const frame = frames.length;
  frames.push({ durationMs: 100, cels });
  tags.push({
    name: "Room (initial background presentation)",
    from: frame,
    to: frame,
    direction: 0,
    repeat: 1,
    userData: interchangeIdentity.timeline("room-initial-state"),
  });
  const baseline: TilemapInterchangeBaseline = {
    kind: "tilemap",
    ownership,
    editablePaletteSlots,
    nativeTransforms: ["flipX", "flipY"],
    capabilities: {
      pixelEdits: true,
      paletteEdits: true,
      tileReferences: true,
      previewTimeline: true,
    },
    document: {
      width: presentation.width,
      height: presentation.height,
      transparentIndex: 0,
      exportId,
      palette: [...composition.palette, [10, 14, 22, 255]],
      layers,
      frames,
      tags,
      tilesets: [presentation.tileset],
    },
  };
  inspectTilemapInterchange(baseline, baseline.document);
  return baseline;
}
