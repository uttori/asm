import {
  resolveAsepriteCels,
  validateAsepriteDocument,
  type AsepriteDocument,
  type AsepriteCel,
  type AsepriteTileset,
} from "./aseprite-document.js";
import {
  reconcileIndexedViews,
  validateIndexedOwnership,
  type IndexedOwnership,
  type IndexedOwnerChange,
  type IndexedViewCandidate,
} from "./indexed-ownership.js";
import { indexedPaletteChanges, type IndexedColor } from "./indexed-values.js";
import { ASSET_LIMITS, boundedSum } from "./limits.js";

const VIEW = "uttori-view:",
  ROLE = "uttori-role:",
  SET = "uttori-tileset:",
  TAG = "uttori-timeline:";

/** Advertised support is the intersection of codec, adapter and host policy, never imported metadata. */
export interface InterchangeCapabilities {
  readonly pixelEdits: boolean;
  readonly paletteEdits: boolean;
  readonly tileReferences: boolean;
  readonly previewTimeline: boolean;
}

/** Intersect all participating contracts so a file cannot advertise an unavailable native edit. */
export function interchangeCapabilities(
  ...profiles: readonly InterchangeCapabilities[]
): InterchangeCapabilities {
  if (!profiles.length) {
    throw new Error("Interchange requires explicit capability profiles.");
  }
  return {
    pixelEdits: profiles.every((profile) => profile.pixelEdits),
    paletteEdits: profiles.every((profile) => profile.paletteEdits),
    tileReferences: profiles.every((profile) => profile.tileReferences),
    previewTimeline: profiles.every((profile) => profile.previewTimeline),
  };
}

/** Trusted tilemap presentation and logical authority. Imported IDs only resolve into these fixed inventories. */
export interface TilemapInterchangeBaseline {
  readonly kind: "tilemap";
  readonly document: AsepriteDocument;
  readonly ownership: IndexedOwnership;
  readonly editablePaletteSlots: readonly number[];
  readonly capabilities: InterchangeCapabilities;
  /** Native cell transform vocabulary, supplied by the game adapter. */
  readonly nativeTransforms: readonly ("flipX" | "flipY" | "diagonal")[];
}

/** Pure native deltas. Occurrences, timing and file storage never become source edit authority. */
export interface InterchangeChanges {
  readonly pixels: readonly IndexedOwnerChange[];
  readonly colors: readonly { readonly index: number; readonly color: IndexedColor }[];
}

/** Attach stable identities when building presentations; names and numeric storage indexes remain arbitrary. */
export const interchangeIdentity = Object.freeze({
  view: (identity: string): string => VIEW + identity,
  role: (identity: string): string => ROLE + identity,
  tileset: (identity: string): string => SET + identity,
  timeline: (identity: string): string => TAG + identity,
});

/** Require an intact opaque ID; rendering equality cannot recover stripped or duplicated metadata. */
function id(value: string | undefined, prefix: string): string {
  if (
    !value?.startsWith(prefix) ||
    value.length <= prefix.length ||
    value.length > 1024 + prefix.length
  ) {
    throw new Error(`Missing or invalid interchange identity ${prefix}.`);
  }
  return value.slice(prefix.length);
}

/** Indexed tileset inventory resolved once. Tile zero may be empty in the container, never in native ownership. */
interface Inventory {
  readonly sets: ReadonlyMap<number, AsepriteTileset>;
  readonly setIds: ReadonlyMap<number, string>;
  readonly views: ReadonlyMap<string, IndexedViewCandidate>;
  readonly tileIds: ReadonlyMap<number, readonly (string | null)[]>;
}

/** Extract exact storage values with one owned buffer per identified view, retaining unused tiles. */
function inventory(document: AsepriteDocument): Inventory {
  const sets = new Map<number, AsepriteTileset>(),
    setIds = new Map<number, string>(),
    views = new Map<string, IndexedViewCandidate>(),
    tileIds = new Map<number, (string | null)[]>();
  const seenSets = new Set<string>();
  let bytes = 0;
  for (const set of document.tilesets) {
    const setId = id(set.userData, SET);
    if (seenSets.has(setId)) {
      throw new Error(`Duplicate tileset identity ${setId}.`);
    }
    seenSets.add(setId);
    sets.set(set.id, set);
    setIds.set(set.id, setId);
    const ids: (string | null)[] = [],
      area = set.tileWidth * set.tileHeight;
    for (let tile = 0; tile < set.tileCount; tile++) {
      if (set.flags & 4 && tile === 0) {
        // The empty sentinel is reference state; it cannot impersonate a blank native owner.
        if (
          set.tileData[tile]?.startsWith(VIEW) ||
          set.indexes.subarray(0, area).some((slot) => slot !== document.transparentIndex)
        ) {
          throw new Error("Interchange empty tile acquired native identity or artwork.");
        }
        ids.push(null);
        continue;
      }
      const viewId = id(set.tileData[tile], VIEW);
      if (views.has(viewId)) {
        throw new Error(`Duplicate view identity ${viewId}.`);
      }
      ids.push(viewId);
      bytes = boundedSum(bytes, area, ASSET_LIMITS.decodedBytes, "Interchange view pixels");
      views.set(viewId, {
        id: viewId,
        width: set.tileWidth,
        height: set.tileHeight,
        indexes: set.indexes.slice(tile * area, (tile + 1) * area),
      });
    }
    tileIds.set(set.id, ids);
  }
  return { sets, setIds, views, tileIds };
}

/** Resolve roles independently of layer names/locks/UUIDs while preserving their rendering semantics. */
function roles(document: AsepriteDocument): Map<string, number> {
  const result = new Map<string, number>();
  document.layers.forEach((layer, index) => {
    const role = id(layer.userData, ROLE);
    if (result.has(role)) {
      throw new Error(`Duplicate role identity ${role}.`);
    }
    result.set(role, index);
  });
  return result;
}

type Payload = Exclude<AsepriteCel, { kind: "linked" }>;

/** Cell semantics are view ID plus orientation; numeric storage IDs may be bijectively reordered. */
function cellValue(
  payload: Extract<Payload, { kind: "tilemap" }>,
  set: AsepriteTileset,
  ids: readonly (string | null)[],
  offset: number,
  transforms: TilemapInterchangeBaseline["nativeTransforms"],
): string | null {
  const word = payload.cells[offset];
  if (!(set.flags & 4) && word === 0xffffffff) {
    return null;
  }
  // An encoded tile ID can exceed the private inventory even when its bit mask is valid.
  const view = ids.at((word & payload.idMask) >>> 0);
  if (view === null) {
    return null;
  }
  if (view === undefined) {
    throw new Error("Interchange occurrence has no known view.");
  }
  for (const [name, mask] of [
    ["flipX", payload.flipXMask],
    ["flipY", payload.flipYMask],
    ["diagonal", payload.diagonalMask],
  ] as const) {
    if (word & mask && !transforms.includes(name)) {
      throw new Error(`View ${view}: unsupported native transform ${name}.`);
    }
  }
  return JSON.stringify([
    view,
    !!(word & payload.flipXMask),
    !!(word & payload.flipYMask),
    !!(word & payload.diagonalMask),
  ]);
}

/** Compare sparse resolved cell occurrences in pixel units, permitting empty-border trimming and copied links. */
function compareTilemap(
  beforeCel: AsepriteCel | undefined,
  before: Payload | undefined,
  oldSet: AsepriteTileset,
  oldIds: readonly (string | null)[],
  afterCel: AsepriteCel | undefined,
  after: Payload | undefined,
  newSet: AsepriteTileset,
  newIds: readonly (string | null)[],
  transforms: TilemapInterchangeBaseline["nativeTransforms"],
): void {
  if (
    oldSet.tileWidth !== newSet.tileWidth ||
    oldSet.tileHeight !== newSet.tileHeight ||
    (before && before.kind !== "tilemap") ||
    (after && after.kind !== "tilemap")
  ) {
    throw new Error("Interchange tile dimensions or occurrence kind changed.");
  }
  const oldMap = before?.kind === "tilemap" ? before : undefined,
    newMap = after?.kind === "tilemap" ? after : undefined;
  const at = (
    cel: AsepriteCel | undefined,
    map: typeof oldMap,
    set: AsepriteTileset,
    ids: readonly (string | null)[],
    x: number,
    y: number,
  ): string | null => {
    if (!cel || !map) {
      return null;
    }
    const column = (x - cel.x) / set.tileWidth,
      row = (y - cel.y) / set.tileHeight;
    if (
      !Number.isInteger(column) ||
      !Number.isInteger(row) ||
      column < 0 ||
      row < 0 ||
      column >= map.columns ||
      row >= map.rows
    ) {
      return null;
    }
    return cellValue(map, set, ids, row * map.columns + column, transforms);
  };
  const compare = (
    cel: AsepriteCel | undefined,
    map: typeof oldMap,
    set: AsepriteTileset,
    ids: readonly (string | null)[],
    otherCel: AsepriteCel | undefined,
    otherMap: typeof oldMap,
    otherSet: AsepriteTileset,
    otherIds: readonly (string | null)[],
  ): void => {
    if (!cel || !map) {
      return;
    }
    for (let offset = 0; offset < map.cells.length; offset++) {
      const value = cellValue(map, set, ids, offset, transforms);
      if (value === null) {
        continue;
      }
      const x = cel.x + (offset % map.columns) * set.tileWidth,
        y = cel.y + Math.floor(offset / map.columns) * set.tileHeight;
      if (value !== at(otherCel, otherMap, otherSet, otherIds, x, y)) {
        throw new Error("Read-only interchange tile references, offsets or flips changed.");
      }
    }
  };
  // Both directions detect additions as well as missing occurrences, even when saved cels trim empty borders.
  compare(beforeCel, oldMap, oldSet, oldIds, afterCel, newMap, newSet, newIds);
  compare(afterCel, newMap, newSet, newIds, beforeCel, oldMap, oldSet, oldIds);
}

/** Raster previews contribute no deltas; trimmed transparent borders and shared/copy storage are harmless. */
function compareRaster(
  beforeCel: AsepriteCel | undefined,
  before: Payload | undefined,
  afterCel: AsepriteCel | undefined,
  after: Payload | undefined,
  transparent: number,
): void {
  if ((before && before.kind !== "raster") || (after && after.kind !== "raster")) {
    throw new Error("Read-only raster occurrence kind changed.");
  }
  const oldRaster = before?.kind === "raster" ? before : undefined,
    newRaster = after?.kind === "raster" ? after : undefined;
  const compare = (
    cel: AsepriteCel | undefined,
    image: typeof oldRaster,
    otherCel: AsepriteCel | undefined,
    other: typeof oldRaster,
  ): void => {
    if (!cel || !image) {
      return;
    }
    for (let offset = 0; offset < image.indexes.length; offset++) {
      const slot = image.indexes[offset];
      if (slot === transparent) {
        continue;
      }
      const x = cel.x + (offset % image.width),
        y = cel.y + Math.floor(offset / image.width);
      const ox = x - (otherCel?.x ?? 0),
        oy = y - (otherCel?.y ?? 0);
      if (
        !other ||
        !otherCel ||
        ox < 0 ||
        oy < 0 ||
        ox >= other.width ||
        oy >= other.height ||
        other.indexes[oy * other.width + ox] !== slot
      ) {
        throw new Error("Read-only derived raster preview pixels or geometry changed.");
      }
    }
  };
  compare(beforeCel, oldRaster, afterCel, newRaster);
  compare(afterCel, newRaster, beforeCel, oldRaster);
}

/** Compare native timeline identities independently of editor tag ordering and names. */
const timelineTags = (document: AsepriteDocument): string[] =>
  document.tags
    .map((tag) =>
      JSON.stringify([id(tag.userData, TAG), tag.from, tag.to, tag.direction, tag.repeat]),
    )
    .toSorted();

/** Normalize structure and reconcile deltas against the exported private authority without any source writes. */
export function inspectTilemapInterchange(
  baseline: TilemapInterchangeBaseline,
  after: AsepriteDocument,
): InterchangeChanges {
  const before = baseline.document;
  validateAsepriteDocument(before);
  validateAsepriteDocument(after);
  validateIndexedOwnership(baseline.ownership);
  if (
    before.width !== after.width ||
    before.height !== after.height ||
    before.transparentIndex !== after.transparentIndex ||
    before.frames.length !== after.frames.length ||
    before.exportId !== after.exportId
  ) {
    throw new Error("Interchange canvas, transparency, timeline or export identity changed.");
  }
  const oldInventory = inventory(before),
    newInventory = inventory(after),
    oldRoles = roles(before),
    newRoles = roles(after);
  if (
    oldInventory.views.size !== baseline.ownership.views.length ||
    newInventory.views.size !== oldInventory.views.size ||
    newInventory.sets.size !== oldInventory.sets.size ||
    oldRoles.size !== newRoles.size
  ) {
    throw new Error("Interchange owner, view, tileset or role inventory changed.");
  }
  for (const view of baseline.ownership.views) {
    const exported = oldInventory.views.get(view.id);
    if (
      !exported ||
      exported.width !== view.width ||
      exported.height !== view.height ||
      exported.indexes.some((slot, i) => slot !== view.indexes[i]) ||
      !newInventory.views.has(view.id)
    ) {
      throw new Error(`Inconsistent private export or missing view ${view.id}.`);
    }
  }
  const oldResolved = resolveAsepriteCels(before),
    newResolved = resolveAsepriteCels(after);
  for (let frame = 0; frame < before.frames.length; frame++) {
    if (before.frames[frame].durationMs !== after.frames[frame].durationMs) {
      throw new Error("Read-only preview timing changed.");
    }
    const oldCels = new Map(before.frames[frame].cels.map((cel) => [cel.layer, cel])),
      newCels = new Map(after.frames[frame].cels.map((cel) => [cel.layer, cel]));
    for (const [role, oldIndex] of oldRoles) {
      const newIndex = newRoles.get(role);
      if (newIndex === undefined) {
        throw new Error(`Missing interchange role ${role}.`);
      }
      const oldLayer = before.layers[oldIndex],
        newLayer = after.layers[newIndex];
      const oldCel = oldCels.get(oldIndex),
        newCel = newCels.get(newIndex);
      if (oldLayer.kind !== newLayer.kind) {
        throw new Error(`Read-only role ${role} kind changed.`);
      }
      if (oldLayer.kind === "tilemap" && newLayer.kind === "tilemap") {
        if (
          oldInventory.setIds.get(oldLayer.tileset) !== newInventory.setIds.get(newLayer.tileset)
        ) {
          throw new Error(`Role ${role}: tileset binding changed.`);
        }
        compareTilemap(
          oldCel,
          oldCel && oldResolved.get(oldCel),
          oldInventory.sets.get(oldLayer.tileset)!,
          oldInventory.tileIds.get(oldLayer.tileset)!,
          newCel,
          newCel && newResolved.get(newCel),
          newInventory.sets.get(newLayer.tileset)!,
          newInventory.tileIds.get(newLayer.tileset)!,
          baseline.nativeTransforms,
        );
      } else {
        compareRaster(
          oldCel,
          oldCel && oldResolved.get(oldCel),
          newCel,
          newCel && newResolved.get(newCel),
          before.transparentIndex,
        );
      }
    }
    const order = (
      document: AsepriteDocument,
      resolved: ReadonlyMap<AsepriteCel, Payload>,
    ): string[] =>
      document.frames[frame].cels
        .filter((cel) => {
          const payload = resolved.get(cel)!;
          if (payload.kind === "raster") {
            return payload.indexes.some((slot) => slot !== document.transparentIndex);
          }
          const layer = document.layers[cel.layer];
          if (layer.kind !== "tilemap") {
            throw new Error("Invalid tilemap layer binding.");
          }
          const source = document === before ? oldInventory : newInventory;
          const set = source.sets.get(layer.tileset)!,
            ids = source.tileIds.get(layer.tileset)!;
          // Legacy containers use 0xffffffff for empty, while native tile zero can contain artwork.
          return payload.cells.some(
            (_, offset) => cellValue(payload, set, ids, offset, baseline.nativeTransforms) !== null,
          );
        })
        .toSorted((a, b) => a.layer + a.zIndex - (b.layer + b.zIndex) || a.zIndex - b.zIndex)
        .map((cel) => id(document.layers[cel.layer].userData, ROLE));
    if (JSON.stringify(order(before, oldResolved)) !== JSON.stringify(order(after, newResolved))) {
      throw new Error("Read-only interchange stacking changed.");
    }
  }
  if (JSON.stringify(timelineTags(before)) !== JSON.stringify(timelineTags(after))) {
    throw new Error("Read-only interchange timeline membership changed.");
  }
  const pixels = reconcileIndexedViews(baseline.ownership, [...newInventory.views.values()]);
  const colors = indexedPaletteChanges(
    before.palette,
    after.palette,
    baseline.editablePaletteSlots,
  );
  if (
    (!baseline.capabilities.pixelEdits && pixels.length) ||
    (!baseline.capabilities.paletteEdits && colors.length)
  ) {
    throw new Error("Interchange edit exceeds exported capabilities.");
  }
  return { pixels, colors };
}
