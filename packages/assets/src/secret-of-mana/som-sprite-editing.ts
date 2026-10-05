import {
  extractIndexedRegion,
  renderIndexedPlacements,
  type IndexedPixels,
} from "../indexed-edit.js";
import { rewriteIndexedPng } from "../png-edit.js";
import type {
  SpriteEditorBundle,
  SpriteEditorChanges,
  SpriteEditorImage,
} from "../sprite-editing.js";
import { validateSpriteEditorBundle } from "../sprite-editing.js";
import { decodeBodyFrame } from "./som-body-frame.js";
import { bindFrameAtlasPalette, inspectFrameAtlas } from "./som-frame-atlas.js";
import {
  planBodyFrameEdits,
  layoutStableFrameAtlas,
  renderStableFrameAtlas,
} from "./som-frame-edit.js";
import { planSpritePaletteWords } from "./som-palette-edit.js";
import { spritePaletteColors, type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameRecord, SpriteAtlasSource } from "./som-types.js";

const tileId = (name: string): string => `tiles:${name}`;
const poseId = (frame: FrameRecord): string => `pose:${JSON.stringify(frame.id)}`;
const blockId = (frame: FrameRecord, block: string): string =>
  `block:${JSON.stringify([frame.id, block])}`;
const ORIGIN = 128;

/** Export one uncompressed ordinary-body atlas. Unsupported codecs fail before opening the editor. */
export function createSomSpriteEditorBundle(
  atlas: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
  session: string,
): SpriteEditorBundle {
  const inspected = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const frames = atlas.layout.frames;
  if (
    atlas.layout.paletteRefs.length !== 1 ||
    !frames?.length ||
    Object.keys(atlas.nativeOptions ?? {}).length ||
    frames.some((f) => !f.nativeFrame?.bytes || !f.blocks)
  ) {
    throw new Error("The body spike requires one palette context and uncompressed body records.");
  }
  const images: SpriteEditorImage[] = [];
  let stripY = 8;
  const allowedIndexes = Array.from({ length: 16 }, (_, i) => i);
  for (const [name, tiles] of inspected.tiles) {
    const columns = Math.min(16, tiles.length);
    const width = columns * 8;
    const height = Math.ceil(tiles.length / columns) * 8;
    const indexes = new Uint8Array(width * height);
    tiles.forEach((tile, index) => {
      for (let y = 0; y < 8; y++) {
        indexes.set(
          tile.indexes.subarray(y * 8, y * 8 + 8),
          (Math.floor(index / columns) * 8 + y) * width + (index % columns) * 8,
        );
      }
    });
    images.push({
      id: tileId(name),
      owner: tileId(name),
      frame: "native",
      role: "pixels",
      width,
      height,
      x: 8,
      y: stripY,
      indexes: [...indexes],
      allowedIndexes,
    });
    stripY += height + 8;
  }
  const sources = new Map(
    [...inspected.tiles].flatMap(([name, tiles]) =>
      tiles.map((tile, index) => [JSON.stringify([name, index]), tile] as const),
    ),
  );
  for (const frame of frames) {
    for (const [index, block] of frame.blocks!.entries()) {
      const placements = (frame.placements ?? []).filter(
        (v) => v.block === block.id && !v.external,
      );
      const pixels = renderIndexedPlacements(
        sources,
        placements.map((v) => ({
          id: v.id,
          source: JSON.stringify([v.segment, v.tile]),
          x: v.x - block.x,
          y: v.y - block.y,
          flipX: v.flipX,
          flipY: v.flipY,
        })),
        { x: 0, y: 0, width: block.size, height: block.size },
      );
      images.push({
        id: blockId(frame, block.id),
        owner: `body:${frame.nativeFrame!.address}:${index}`,
        frame: poseId(frame),
        role: "placement",
        width: block.size,
        height: block.size,
        x: ORIGIN + block.x,
        y: ORIGIN + block.y,
        indexes: [...pixels.indexes],
        allowedIndexes,
        moveBounds: [ORIGIN - 64, ORIGIN - 64, ORIGIN + 63, ORIGIN + 63],
      });
    }
  }
  const paletteId = atlas.layout.paletteRefs[0];
  const stored = catalog.palettes[paletteId];
  const bundle: SpriteEditorBundle = {
    format: "uttori-sprite-editor",
    version: 1,
    session,
    adapter: "som.body-atlas:1",
    width: 256,
    height: Math.max(256, stripY),
    transparentIndex: 0,
    palette: spritePaletteColors(catalog, paletteId).map(([r, g, b, a]) => [r, g, b, a]),
    // Color zero can contain hidden native data, even when firstIndex is zero.
    editablePaletteIndexes: Array.from(
      { length: Math.min(stored.words.length, 15) },
      (_, i) => i + 1,
    ).filter((i) => i >= stored.firstIndex && i < stored.firstIndex + stored.words.length),
    frames: ["native", ...frames.map(poseId)],
    images,
  };
  validateSpriteEditorBundle(bundle);
  return bundle;
}

/** One whole fixed record; the host turns only changed coordinate scalars into source edits. */
export interface SomBodySourceChange {
  readonly address: number;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Combine all deltas against current native pixels before rendering new derived views. No filesystem access. */
export function planSomSpriteEditorChanges(
  atlas: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
  changes: SpriteEditorChanges,
) {
  const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const bundle = createSomSpriteEditorBundle(atlas, catalog, "planning");
  const palettePlan = planSpritePaletteWords(
    catalog,
    changes.colors.map((v) => ({
      palette: atlas.layout.paletteRefs[0],
      index: v.index,
      rgb: v.color.slice(0, 3),
    })),
  );
  const coordinates: { frame: string | number; block: string; x: number; y: number }[] = [];
  const nativeOwners = new Set<string>();
  for (const edit of changes.positions) {
    const frame = atlas.layout.frames!.find((f) =>
      f.blocks?.some((b) => blockId(f, b.id) === edit.id),
    );
    const block = frame?.blocks?.find((b) => blockId(frame, b.id) === edit.id);
    if (!frame || !block) {
      throw new Error("Unknown body position owner.");
    }
    const key = JSON.stringify([frame.nativeFrame!.address, frame.blocks!.indexOf(block)]);
    if (nativeOwners.has(key)) {
      continue;
    } // Generic reconciliation already requires every alias to agree.
    nativeOwners.add(key);
    coordinates.push({ frame: frame.id, block: block.id, x: edit.x - ORIGIN, y: edit.y - ORIGIN });
  }
  let layout = structuredClone(atlas.layout);
  if (coordinates.length) {
    layout = planBodyFrameEdits(atlas, catalog, coordinates).layout;
  }
  const tiles: Map<string, IndexedPixels[]> = new Map(
    [...before.tiles].map(([name, values]) => [
      name,
      values.map((v) => ({ ...v, indexes: v.indexes.slice() })),
    ]),
  );
  for (const edit of changes.pixels) {
    const image = bundle.images.find((v) => v.id === edit.id && v.role === "pixels");
    const segment = Object.keys(layout.segments).find((name) => tileId(name) === edit.id);
    if (!image || !segment || edit.indexes.length !== image.width * image.height) {
      throw new Error("Unknown native pixel owner.");
    }
    const columns = image.width / 8;
    const count = tiles.get(segment)!.length;
    // The last strip row can contain padding. Painting it must never produce a false successful import.
    for (let i = 0; i < edit.indexes.length; i++) {
      const tile =
        Math.floor(Math.floor(i / image.width) / 8) * columns + Math.floor((i % image.width) / 8);
      if (tile >= count && edit.indexes[i] !== image.indexes[i]) {
        throw new Error("Native strip padding changed.");
      }
    }
    const strip = {
      width: image.width,
      height: image.height,
      indexes: Uint8Array.from(edit.indexes),
    };
    tiles.set(
      segment,
      Array.from({ length: count }, (_, index) =>
        extractIndexedRegion(strip, {
          x: (index % columns) * 8,
          y: Math.floor(index / columns) * 8,
          width: 8,
          height: 8,
        }),
      ),
    );
  }
  const changed = changes.pixels.length || coordinates.length || changes.colors.length;
  if (!changed) {
    return {
      layout,
      catalog: palettePlan.catalog,
      png: Uint8Array.from(atlas.source.bytes),
      bodies: [] as SomBodySourceChange[],
      palettes: [] as string[],
    };
  }
  const binding = bindFrameAtlasPalette(atlas.source, atlas.layout, catalog);
  layout.indexPalette = binding.indexPalette;
  let png: Uint8Array = Uint8Array.from(atlas.source.bytes);
  if (changes.pixels.length || coordinates.length) {
    layout = layoutStableFrameAtlas(layout);
    const rendered = renderStableFrameAtlas(tiles, layout);
    png = rewriteIndexedPng(atlas.source.bytes, {
      indexes: rendered.indexes,
      dimensions: { width: layout.width, height: layout.height },
    });
  }
  inspectFrameAtlas({ bytes: png, mediaType: "image/png" }, layout, palettePlan.catalog, {
    whole: true,
  });
  const bodies: SomBodySourceChange[] = [];
  const emitted = new Set<number>();
  for (const frame of layout.frames!) {
    const original = atlas.layout.frames!.find((f) => f.id === frame.id)!.nativeFrame!;
    const native = frame.nativeFrame!;
    const bytes = Uint8Array.from(native.bytes!);
    if (emitted.has(native.address) || bytes.every((v, i) => original.bytes![i] === v)) {
      continue;
    }
    emitted.add(native.address);
    // Decode both bounded records so a malformed retained copy never becomes source authority.
    decodeBodyFrame(original.bytes!);
    decodeBodyFrame(bytes);
    bodies.push({
      address: native.address,
      before: Uint8Array.from(original.bytes!),
      after: bytes,
    });
  }
  return { layout, catalog: palettePlan.catalog, png, bodies, palettes: palettePlan.palettes };
}
