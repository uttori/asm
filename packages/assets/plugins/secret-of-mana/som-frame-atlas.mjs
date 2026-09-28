import {
  extractIndexedRegion,
  pngImporter,
  renderIndexedPlacements,
} from "@uttori/asm-assets/image";
import { encodePlanarTiles } from "@uttori/asm-assets/snes";

import { validateFrameComposition } from "./som-frame-composition.mjs";
import { spritePaletteColors } from "./som-sprite-palettes.mjs";

/** Reject malformed editor rectangles only when their consuming scope requests them. */
function rectangle(bounds, width, height, label) {
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some((v) => !Number.isSafeInteger(v)) ||
    bounds[0] < 0 ||
    bounds[1] < 0 ||
    bounds[2] < 1 ||
    bounds[3] < 1 ||
    bounds[0] + bounds[2] > width ||
    bounds[1] + bounds[3] > height
  ) {
    throw new Error(`Invalid ${label} bounds.`);
  }
}

/** Validate one assembly segment, or all segments and editor metadata in whole-atlas mode. */
export function validateFrameLayout(layout, { segmentName, whole = false } = {}) {
  if (
    layout?.version !== 1 ||
    !layout.segments ||
    !Number.isInteger(layout.width) ||
    !Number.isInteger(layout.height)
  ) {
    throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
  }
  if (
    !Array.isArray(layout.paletteRefs) ||
    layout.paletteRefs.length < 1 ||
    layout.paletteRefs.length > 15
  ) {
    throw new Error("Frame atlas layout must reference one to fifteen ROM palettes.");
  }
  if (layout.guideIndex !== layout.paletteRefs.length * 16) {
    throw new Error("Frame atlas guide index must follow the source palette groups.");
  }
  for (const variant of layout.paletteVariants ?? []) {
    if (
      !Number.isInteger(variant.group) ||
      variant.group < 0 ||
      variant.group >= layout.paletteRefs.length
    ) {
      throw new Error("Frame atlas palette variant refers to an invalid source group.");
    }
  }
  if (layout.tileSources !== undefined && layout.tileSources !== "native-strip") {
    throw new Error("Unknown atlas tile source mode.");
  }
  const names = whole ? Object.keys(layout.segments) : [segmentName];
  for (const name of names) {
    const segment = layout.segments[name];
    if (!segment || !Array.isArray(segment.tiles) || segment.tiles.length === 0) {
      throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
    }
    if (
      !Number.isInteger(segment.palette) ||
      segment.palette < 0 ||
      segment.palette >= layout.paletteRefs.length
    ) {
      throw new Error(`Frame atlas segment ${name} has no source palette.`);
    }
    if (layout.tileSources === "native-strip" && !segment.tileAtlas) {
      throw new Error(`Missing stable tile storage: ${name}.`);
    }
    if (layout.tileSources === "native-strip") {
      rectangle(segment.tileAtlas.bounds, layout.width, layout.height, `${name} stable storage`);
    }
    for (const [index, tile] of segment.tiles.entries()) {
      if (layout.tileSources === "native-strip") {
        const strip = segment.tileAtlas;
        if (
          tile.x !== strip.bounds[0] + (index % strip.columns) * strip.step ||
          tile.y !== strip.bounds[1] + Math.floor(index / strip.columns) * strip.step ||
          tile.flipX ||
          tile.flipY
        ) {
          throw new Error(`Stable tile source moved into pose geometry: ${name}/${index}.`);
        }
      }
      rectangle(
        [tile.x, tile.y, 8, 8],
        layout.width,
        layout.height,
        `source rectangle for ${name} tile ${index}`,
      );
      if (
        (tile.flipX !== undefined && typeof tile.flipX !== "boolean") ||
        (tile.flipY !== undefined && typeof tile.flipY !== "boolean")
      ) {
        throw new Error(`Invalid source rectangle flips for ${name} tile ${index}.`);
      }
    }
    if ((whole || layout.tileSources === "native-strip") && segment.tileAtlas) {
      const strip = segment.tileAtlas;
      rectangle(strip.bounds, layout.width, layout.height, `${name} tile atlas`);
      if (
        !Number.isSafeInteger(strip.columns) ||
        strip.columns < 1 ||
        !Number.isSafeInteger(strip.step) ||
        strip.step < 8 ||
        !Array.isArray(strip.sourceOnly) ||
        new Set(strip.sourceOnly).size !== strip.sourceOnly.length
      ) {
        throw new Error(`Invalid tile atlas for ${name}.`);
      }
      for (const i of strip.sourceOnly) {
        if (!Number.isSafeInteger(i) || i < 0 || i >= segment.tiles.length) {
          throw new Error(`Invalid source-only tile ${name}:${i}.`);
        }
        const source = segment.tiles[i];
        if (
          source.x !== strip.bounds[0] + (i % strip.columns) * strip.step ||
          source.y !== strip.bounds[1] + Math.floor(i / strip.columns) * strip.step ||
          source.flipX ||
          source.flipY
        ) {
          throw new Error(`Source-only tile ${name}:${i} must use its native-order rectangle.`);
        }
      }
      if (
        Math.min(segment.tiles.length, strip.columns) * strip.step > strip.bounds[2] ||
        Math.ceil(segment.tiles.length / strip.columns) * strip.step > strip.bounds[3]
      ) {
        throw new Error(`Tile atlas ${name} is too small.`);
      }
    }
  }
  if (whole) {
    if (!Array.isArray(layout.frames)) {
      throw new Error("Frame atlas frames must be an array.");
    }
    const ids = new Set();
    const nativeRecords = new Map();
    for (const frame of layout.frames) {
      const validId =
        (typeof frame.id === "string" && frame.id.length > 0) || Number.isSafeInteger(frame.id);
      if (!validId || ids.has(frame.id)) {
        throw new Error(`Duplicate/empty frame ${frame.id}.`);
      }
      ids.add(frame.id);
      rectangle(frame.bounds, layout.width, layout.height, `frame ${frame.id}`);
      validateFrameComposition(layout, frame);
      const record = frame.nativeFrame;
      if (record?.bytes) {
        const previous = nativeRecords.get(record.address);
        if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
          throw new Error(`Shared native frame records disagree: ${frame.id}.`);
        }
        nativeRecords.set(record.address, record);
      }
    }
    const ordered = [...nativeRecords.values()].sort((a, b) => a.address - b.address);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].address < ordered[i - 1].end) {
        throw new Error("Overlapping native frame records.");
      }
    }
    if (layout.tileSources === "native-strip") {
      const strips = Object.entries(layout.segments).map(([name, segment]) => ({
        id: name,
        bounds: segment.tileAtlas.bounds,
      }));
      // Native storage must never share pixels with a movable pose or another segment.
      for (const [index, strip] of strips.entries()) {
        const [x, y, width, height] = strip.bounds;
        for (const other of [...layout.frames, ...strips.slice(index + 1)]) {
          const [ox, oy, ow, oh] = other.bounds;
          if (x < ox + ow && ox < x + width && y < oy + oh && oy < y + height) {
            throw new Error(`Stable storage overlaps ${other.id}: ${strip.id}.`);
          }
        }
      }
    }
  }
  return layout;
}

/** Parse and validate the authored pixels once, keeping SoM palette/group policy in this adapter. */
export function inspectFrameAtlas(source, layout, catalog, options = {}) {
  validateFrameLayout(layout, options);
  const image = pngImporter.import(source).value;
  if (
    image.kind !== "indexed-image" ||
    image.width !== layout.width ||
    image.height !== layout.height
  ) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  const colors = layout.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id));
  if (!image.palette[layout.guideIndex]) {
    throw new Error("Frame atlas is missing its guide index.");
  }
  for (const variant of layout.paletteVariants ?? []) {
    spritePaletteColors(catalog, variant.palette);
  }
  for (let index = 0; index < colors.length; index++) {
    if (
      !image.palette[index] ||
      image.palette[index].some((component, channel) => component !== colors[index][channel])
    ) {
      throw new Error(`Frame atlas palette color ${index} no longer matches its layout.`);
    }
  }
  const tiles = new Map();
  const names = options.whole ? Object.keys(layout.segments) : [options.segmentName];
  for (const name of names) {
    const segment = layout.segments[name];
    const indexMap = Array(256).fill(null);
    for (let i = 0; i < 16; i++) {
      indexMap[segment.palette * 16 + i] = i;
    }
    // Global transparency and diagnostic guide pixels encode as native color zero.
    indexMap[0] = 0;
    indexMap[layout.guideIndex] = 0;
    tiles.set(
      name,
      segment.tiles.map((placement, index) => {
        try {
          return extractIndexedRegion(image, { ...placement, width: 8, height: 8, indexMap });
        } catch (cause) {
          throw new Error(`Frame atlas ${name} tile ${index}: ${cause.message}`, { cause });
        }
      }),
    );
  }
  return { image, layout, tiles };
}

/** Encode the already inspected native indexes with the game's 4bpp storage codec. */
export function encodeInspectedFrameSegment(inspected, segmentName) {
  const tiles = inspected.tiles.get(segmentName);
  if (!tiles) {
    throw new Error(`Segment ${segmentName} was not inspected.`);
  }
  return encodePlanarTiles(
    tiles.map((tile) =>
      Array.from({ length: 8 }, (_, y) => Array.from(tile.indexes.subarray(y * 8, y * 8 + 8))),
    ),
    4,
  );
}

/** Existing assembly entry point; inspection/extraction is also available without native encoding. */
export function encodeFrameAtlas(source, layout, segmentName, catalog) {
  return encodeInspectedFrameSegment(
    inspectFrameAtlas(source, layout, catalog, { segmentName }),
    segmentName,
  );
}

/**
 * Refresh every recorded occurrence and bottom strip from current authoritative pixels.
 * Composition is additive metadata from reviewed evidence; it cannot be inferred from RGB.
 * Returns owned indexes, retaining guides outside painted pixels and all source-only tiles.
 */
export function refreshFrameAtlas(inspected) {
  const { image, layout, tiles } = inspected;
  validateFrameLayout(layout, { whole: true });
  const sources = new Map();
  const placements = [];
  for (const [name, segment] of Object.entries(layout.segments)) {
    const native = tiles.get(name);
    if (!native || !segment.tileAtlas) {
      throw new Error(`Refresh requires whole-atlas inspection and native strip for ${name}.`);
    }
    native.forEach((tile, index) => sources.set(`${name}:${index}`, tile));
  }
  for (const frame of layout.frames) {
    validateFrameComposition(layout, frame);
    if (
      !Array.isArray(frame.origin) ||
      frame.origin.length !== 2 ||
      frame.origin.some((v) => !Number.isSafeInteger(v)) ||
      !Array.isArray(frame.placements)
    ) {
      throw new Error(
        `Frame ${frame.id} lacks retained composition; enrich it from evidence first.`,
      );
    }
    const ids = new Set();
    for (const occurrence of frame.placements) {
      if (typeof occurrence.id !== "string" || !occurrence.id || ids.has(occurrence.id)) {
        throw new Error(`Invalid occurrence identity in ${frame.id}.`);
      }
      ids.add(occurrence.id);
      if (!Number.isSafeInteger(occurrence.x) || !Number.isSafeInteger(occurrence.y)) {
        throw new Error(`Invalid occurrence coordinates in ${frame.id}.`);
      }
      let source;
      let palette = 0;
      if (occurrence.external) {
        // External references are retained read-only. Only independently verified blank
        // tiles are supported here; a missing nonblank reference must not disappear.
        if (
          !/^[0-9A-F]{6}$/.test(occurrence.external.romAddress) ||
          occurrence.external.indexes?.length !== 64 ||
          occurrence.external.indexes.some((v) => v !== 0)
        ) {
          throw new Error(`Unresolved external tile in ${frame.id}.`);
        }
        source = `external:${occurrence.external.romAddress}`;
        sources.set(source, { width: 8, height: 8, indexes: new Uint8Array(64) });
      } else {
        const segment = layout.segments[occurrence.segment];
        if (
          !segment ||
          !Number.isSafeInteger(occurrence.tile) ||
          occurrence.tile < 0 ||
          occurrence.tile >= segment.tiles.length
        ) {
          throw new Error(`Unknown tile reference in ${frame.id}:${occurrence.id}.`);
        }
        source = `${occurrence.segment}:${occurrence.tile}`;
        palette = segment.palette;
      }
      const x = frame.origin[0] + occurrence.x;
      const y = frame.origin[1] + occurrence.y;
      if (
        x < frame.bounds[0] ||
        y < frame.bounds[1] ||
        x + 8 > frame.bounds[0] + frame.bounds[2] ||
        y + 8 > frame.bounds[1] + frame.bounds[3]
      ) {
        throw new Error(`Occurrence exceeds frame ${frame.id}.`);
      }
      placements.push({
        ...occurrence,
        id: `${frame.id}:${occurrence.id}`,
        source,
        x,
        y,
        indexMap: Array.from({ length: 16 }, (_, i) => palette * 16 + i),
      });
    }
  }
  for (const [name, segment] of Object.entries(layout.segments)) {
    const strip = segment.tileAtlas;
    segment.tiles.forEach((_, index) =>
      placements.push({
        id: `strip:${name}:${index}`,
        source: `${name}:${index}`,
        x: strip.bounds[0] + (index % strip.columns) * strip.step,
        y: strip.bounds[1] + Math.floor(index / strip.columns) * strip.step,
        indexMap: Array.from({ length: 16 }, (_, i) => segment.palette * 16 + i),
      }),
    );
  }
  const background = image.indexes.slice();
  // Clear all covered rectangles before compositing, so transparency edits reveal
  // lower layers rather than stale painted pixels. Existing guide dots survive.
  for (const p of placements) {
    for (let y = p.y; y < p.y + 8; y++) {
      for (let x = p.x; x < p.x + 8; x++) {
        const i = y * image.width + x;
        if (background[i] !== layout.guideIndex) {
          background[i] = 0;
        }
      }
    }
  }
  return renderIndexedPlacements(
    sources,
    placements,
    { x: 0, y: 0, width: image.width, height: image.height },
    background,
  );
}

/** Parse the declared layout resource. Validation occurs at the consumer's selected scope. */
export function readFrameLayout(options, resources) {
  if (typeof options.layout !== "string" || !options.layout.endsWith(".json")) {
    throw new Error("Frame atlas layout must name a JSON sidecar.");
  }
  const resource = resources[options.layout];
  if (!resource) {
    throw new Error(`Missing frame atlas layout: ${options.layout}.`);
  }
  let layout;
  try {
    layout = JSON.parse(new TextDecoder().decode(resource.bytes));
  } catch (error) {
    throw new Error(`Invalid frame atlas layout: ${options.layout}.`, { cause: error });
  }
  return layout;
}
