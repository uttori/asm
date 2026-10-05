import {
  inspectAtlasChanges,
  type AtlasChanges,
  type AtlasDocument,
  type AtlasEditPolicy,
} from "../atlas-interchange.js";
import { rewriteIndexedPng } from "../png-edit.js";
import { inspectFrameAtlas, bindFrameAtlasPalette } from "./som-frame-atlas.js";
import { renderStableFrameAtlas } from "./som-frame-edit.js";
import { frameAtlasPreservedChunks, planSpritePaletteWords } from "./som-palette-edit.js";
import { spritePaletteColors, type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";

/** Stable identity of a declared native tile, independent of canvas position and visual equality. */
function ownerId(segment: string, tile: number): string {
  return JSON.stringify([segment, tile]);
}

/** Export the actual stable atlas canvas; the SoM adapter supplies 4bpp ownership and palette policy. */
export function createSomAtlasExport(
  atlas: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
  exportId: string,
) {
  if (atlas.layout.tileSources !== "native-strip") {
    throw new Error("Atlas interchange requires explicitly declared native-strip pixel ownership.");
  }
  const inspected = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const document: AtlasDocument = { ...inspected.image, transparentIndex: 0, exportId };
  const owners = Object.entries(atlas.layout.segments).flatMap(([name, segment]) => {
    const indexMap: (number | null)[] = Array.from({ length: 256 }, () => null);
    for (let slot = 0; slot < 16; slot++) {
      indexMap[segment.palette * 16 + slot] = slot;
    }
    indexMap[0] = 0;
    return segment.tiles.map((tile, index) => ({
      ...tile,
      id: ownerId(name, index),
      width: 8,
      height: 8,
      indexMap,
    }));
  });
  const editablePaletteSlots = atlas.layout.paletteRefs.flatMap((id, bank) => {
    const stored = catalog.palettes[id];
    return stored.words.flatMap((_, index) => {
      const slot = stored.firstIndex + index;
      // Transparent native words may contain hidden color/flag data. Never expose them as display edits.
      return slot > 0 && slot < 16 ? [bank * 16 + slot] : [];
    });
  });
  const policy: AtlasEditPolicy = { owners, editablePaletteSlots };
  inspectAtlasChanges(document, document, policy);
  return { document, policy };
}

/**
 * Apply already-validated pixel/slot deltas to source values. Derived poses are rebuilt without
 * changing layout geometry; source PNG chunks and unknown layout/catalogue fields are retained.
 */
export function planSomAtlasImport(
  atlas: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
  changes: AtlasChanges,
) {
  const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const definitions = createSomAtlasExport(atlas, catalog, "00000000-0000-0000-0000-000000000000");
  const tiles = new Map(
    [...before.tiles].map(([name, values]) => [
      name,
      values.map((tile) => ({ ...tile, indexes: tile.indexes.slice() })),
    ]),
  );
  const seen = new Set<string>();
  for (const change of changes.pixels) {
    if (seen.has(change.owner)) {
      throw new Error("Duplicate SoM tile delta.");
    }
    seen.add(change.owner);
    const owner = definitions.policy.owners.find((entry) => entry.id === change.owner);
    if (!owner || change.indexes.length !== 64 || change.indexes.some((index) => index > 15)) {
      throw new Error("Invalid SoM native tile delta.");
    }
    for (const [name, values] of tiles) {
      const tile = values.findIndex((_, index) => ownerId(name, index) === change.owner);
      if (tile !== -1) {
        values[tile] = { ...values[tile], indexes: change.indexes.slice() };
      }
    }
  }
  const palettePlan = planSpritePaletteWords(
    catalog,
    changes.colors.map(({ index, color }) => {
      if (!definitions.policy.editablePaletteSlots.includes(index)) {
        throw new Error("Unsupported SoM palette slot delta.");
      }
      return {
        palette: atlas.layout.paletteRefs[Math.floor(index / 16)],
        index: index % 16,
        rgb: color.slice(0, 3),
      };
    }),
  );
  const changed = changes.pixels.length > 0 || palettePlan.palettes.length > 0;
  let layout = structuredClone(atlas.layout);
  let png: Uint8Array = Uint8Array.from(atlas.source.bytes);
  if (changed) {
    layout = bindFrameAtlasPalette(atlas.source, atlas.layout, catalog);
  }
  if (changes.pixels.length) {
    const oldRender = renderStableFrameAtlas(before.tiles, layout);
    const newRender = renderStableFrameAtlas(tiles, layout);
    const indexes = before.image.indexes.slice();
    // Keep host-authored guides/annotations in unchanged pixels rather than flattening them away.
    for (let index = 0; index < indexes.length; index++) {
      if (oldRender.indexes[index] !== newRender.indexes[index]) {
        indexes[index] = newRender.indexes[index];
      }
    }
    png = rewriteIndexedPng(atlas.source.bytes, {
      indexes,
      preserveChunks: frameAtlasPreservedChunks(atlas, catalog),
    });
  }
  inspectFrameAtlas({ bytes: png, mediaType: "image/png" }, layout, palettePlan.catalog, {
    whole: true,
  });
  // Display colors are current catalogue values; the stored PNG binding intentionally remains independent.
  const palette = layout.paletteRefs.flatMap((id) => spritePaletteColors(palettePlan.catalog, id));
  return { png, layout, catalog: palettePlan.catalog, palettes: palettePlan.palettes, palette };
}
