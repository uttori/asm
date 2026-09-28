import { renderIndexedPlacements, rewriteIndexedPng } from "@uttori/asm-assets/image";

import { decodeBodyFrame, patchBodyFrameCoordinates } from "./som-body-frame.mjs";
import { inspectFrameAtlas, encodeInspectedFrameSegment } from "./som-frame-atlas.mjs";
import { deriveFramePlacements, validateFrameComposition } from "./som-frame-composition.mjs";
import { frameAtlasPreservedChunks } from "./som-palette-edit.mjs";

/**
 * Lay out poses independently of native tile storage. One common cell size keeps origins
 * explicit; the native strip is always the authoritative source, including occluded tiles.
 * This adapter owns SNES tile dimensions; portable rendering knows only pixel rectangles.
 */
export function layoutStableFrameAtlas(layout) {
  const next = structuredClone(layout);
  const extents = next.frames.map((frame) => {
    const placements = validateFrameComposition(next, frame);
    if (!placements?.length) {
      throw new Error(`Retained composition required: ${frame.id}.`);
    }
    const x = Math.min(...placements.map((p) => p.x));
    const y = Math.min(...placements.map((p) => p.y));
    return {
      x,
      y,
      width: Math.max(...placements.map((p) => p.x + 8)) - x,
      height: Math.max(...placements.map((p) => p.y + 8)) - y,
    };
  });
  const columns = Math.min(4, next.frames.length);
  if (!columns) {
    throw new Error("Stable atlas requires at least one pose.");
  }
  const cellWidth = Math.max(...extents.map((e) => e.width)) + 16;
  const cellHeight = Math.max(...extents.map((e) => e.height)) + 16;
  next.width = Math.max(170, columns * cellWidth);
  next.frames.forEach((frame, index) => {
    const x = (index % columns) * cellWidth,
      y = Math.floor(index / columns) * cellHeight;
    frame.bounds = [x, y, cellWidth, cellHeight];
    frame.origin = [x + 8 - extents[index].x, y + 8 - extents[index].y];
  });
  let y = Math.ceil(next.frames.length / columns) * cellHeight + 4;
  for (const [name, segment] of Object.entries(next.segments)) {
    const height = Math.ceil(segment.tiles.length / 16) * 10;
    segment.tileAtlas = {
      bounds: [4, y, 160, height],
      columns: 16,
      step: 10,
      // In stable mode this is an inventory of tiles absent from every pose; all tiles own strip pixels.
      sourceOnly: segment.tiles.flatMap((_, index) =>
        next.frames.some((f) => f.placements.some((p) => p.segment === name && p.tile === index))
          ? []
          : [index],
      ),
    };
    segment.tiles = segment.tiles.map((_, index) => ({
      x: 4 + (index % 16) * 10,
      y: y + Math.floor(index / 16) * 10,
    }));
    y += height + 6;
  }
  next.height = y + 2;
  next.tileSources = "native-strip";
  return next;
}

/** Render derived poses and independent native strip pixels from previously extracted tiles. */
export function renderStableFrameAtlas(tiles, layout) {
  const sources = new Map();
  const placements = [];
  for (const [name, segment] of Object.entries(layout.segments)) {
    const native = tiles.get(name);
    if (native?.length !== segment.tiles.length) {
      throw new Error(`Missing native tiles: ${name}.`);
    }
    native.forEach((tile, index) => {
      const source = JSON.stringify([name, index]);
      sources.set(source, tile);
      placements.push({
        id: `strip:${source}`,
        source,
        ...segment.tiles[index],
        transparentIndex: null,
        indexMap: Array.from({ length: 16 }, (_, i) => (i === 0 ? 0 : segment.palette * 16 + i)),
      });
    });
  }
  for (const frame of layout.frames) {
    const native = validateFrameComposition(layout, frame);
    for (const p of native) {
      if (p.external) {
        continue;
      } // Only validated blank references are read-only outside owned storage.
      const segment = layout.segments[p.segment];
      placements.push({
        id: JSON.stringify([frame.id, p.id]),
        source: JSON.stringify([p.segment, p.tile]),
        x: frame.origin[0] + p.x,
        y: frame.origin[1] + p.y,
        flipX: p.flipX,
        flipY: p.flipY,
        indexMap: Array.from({ length: 16 }, (_, i) => segment.palette * 16 + i),
      });
    }
  }
  return renderIndexedPlacements(sources, placements, {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
  });
}

/**
 * Plan body geometry changes as one owned layout/PNG result. Raw native bytes and derived
 * occurrences update together, while native tile bytes must remain exact. No filesystem writes.
 * Frame-record ROM publication still requires a declared include at each record's owned span.
 */
export function planBodyFrameEdits(atlas, catalog, edits) {
  const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const layout = structuredClone(atlas.layout);
  const seen = new Set();
  for (const edit of edits) {
    if (Object.keys(edit).some((k) => !["frame", "block", "x", "y"].includes(k))) {
      throw new Error("Unsupported frame edit.");
    }
    const frame = layout.frames.find((f) => f.id === edit.frame);
    if (!frame?.nativeFrame?.bytes) {
      throw new Error(`No editable body record: ${edit.frame}.`);
    }
    const index = frame.blocks.findIndex((b) => b.id === edit.block);
    const key = JSON.stringify([frame.nativeFrame.address, index]);
    if (seen.has(key)) {
      throw new Error("Duplicate shared native block edit.");
    }
    seen.add(key);
    const bytes = patchBodyFrameCoordinates(frame.nativeFrame.bytes, [
      { block: index, x: edit.x, y: edit.y },
    ]);
    const decoded = decodeBodyFrame(bytes);
    // Several editor poses may reference one native record. They share an owner, not copies.
    for (const alias of layout.frames.filter(
      (f) => f.nativeFrame?.address === frame.nativeFrame.address,
    )) {
      alias.nativeFrame.bytes = [...bytes];
      alias.blocks = alias.blocks.map((block, i) => ({ ...block, ...decoded.blocks[i] }));
      alias.placements = deriveFramePlacements(layout, alias);
    }
  }
  // A no-op must not silently move the authoritative rectangles of an existing authored image.
  if (JSON.stringify(layout) === JSON.stringify(atlas.layout)) {
    return { layout, bytes: Uint8Array.from(atlas.source.bytes) };
  }
  const stable = layoutStableFrameAtlas(layout);
  const rendered = renderStableFrameAtlas(before.tiles, stable);
  const bytes = rewriteIndexedPng(atlas.source.bytes, {
    indexes: rendered.indexes,
    dimensions: { width: stable.width, height: stable.height },
    preserveChunks: frameAtlasPreservedChunks(atlas, catalog),
  });
  const after = inspectFrameAtlas({ bytes, mediaType: "image/png" }, stable, catalog, {
    whole: true,
  });
  for (const name of before.tiles.keys()) {
    const original = encodeInspectedFrameSegment(before, name);
    const rebuilt = encodeInspectedFrameSegment(after, name);
    if (original.length !== rebuilt.length || original.some((v, i) => v !== rebuilt[i])) {
      throw new Error(`Frame edit changed native tiles: ${name}.`);
    }
  }
  return { layout: stable, bytes };
}
