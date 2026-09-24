import { pngImporter } from "@uttori/asm-assets/image";
import { encodePlanarTiles } from "@uttori/asm-assets/snes";

import { spritePaletteColors } from "./som-sprite-palettes.mjs";

/**
 * Encode one native 4bpp segment from an indexed, frame-arranged sprite atlas.
 * Layout coordinates are pixel coordinates in the PNG; each tile has exactly one
 * authoritative 8×8 source, even when a pose repeats it elsewhere.
 */
export function encodeFrameAtlas(source, layout, segmentName, catalog) {
  if (layout?.version !== 1 || !layout.segments || !Number.isInteger(layout.width) || !Number.isInteger(layout.height)) {
    throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
  }
  const segment = layout.segments[segmentName];
  if (!segment || !Array.isArray(segment.tiles) || segment.tiles.length === 0) {
    throw new Error(`Unknown or empty frame atlas segment: ${segmentName}.`);
  }
  const image = pngImporter.import(source).value;
  if (image.kind !== "indexed-image" || image.width !== layout.width || image.height !== layout.height) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  if (!Array.isArray(layout.paletteRefs) || layout.paletteRefs.length < 1 || layout.paletteRefs.length > 15) {
    throw new Error("Frame atlas layout must reference one to fifteen ROM palettes.");
  }
  const colors = layout.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id));
  if (layout.guideIndex !== colors.length || !image.palette[layout.guideIndex]) {
    throw new Error("Frame atlas guide index must follow the source palette groups.");
  }
  for (const variant of layout.paletteVariants ?? []) {
    if (!Number.isInteger(variant.group) || variant.group < 0 || variant.group >= layout.paletteRefs.length) {
      throw new Error("Frame atlas palette variant refers to an invalid source group.");
    }
    spritePaletteColors(catalog, variant.palette);
  }
  for (let index = 0; index < colors.length; index++) {
    if (!image.palette[index] || image.palette[index].some((component, channel) => component !== colors[index][channel])) {
      throw new Error(`Frame atlas palette color ${index} no longer matches its layout.`);
    }
  }
  if (!Number.isInteger(segment.palette) || segment.palette < 0 || segment.palette >= layout.paletteRefs.length) {
    throw new Error(`Frame atlas segment ${segmentName} has no source palette.`);
  }
  const baseColor = segment.palette * 16;
  const guideColor = colors.length;
  const tiles = segment.tiles.map((placement, tileIndex) => {
    const { x, y, flipX = false, flipY = false } = placement;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + 8 > image.width || y + 8 > image.height ||
        typeof flipX !== "boolean" || typeof flipY !== "boolean") {
      throw new Error(`Invalid source rectangle for ${segmentName} tile ${tileIndex}.`);
    }
    return Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_, column) => {
        const sourceX = x + (flipX ? 7 - column : column);
        const sourceY = y + (flipY ? 7 - row : row);
        const index = image.indexes[sourceY * image.width + sourceX];
        // The one guide index may cover a transparent source pixel within a pose.
        if (index === 0 || index === guideColor) return 0;
        if (index < baseColor || index >= baseColor + 16) {
          throw new Error(`Frame atlas ${segmentName} tile ${tileIndex} uses another palette's color ${index}.`);
        }
        return index - baseColor;
      }),
    );
  });
  return encodePlanarTiles(tiles, 4);
}

/** Read and validate the layout sidecar supplied by includeAsset resourcePaths. */
export function readFrameLayout(options, resources) {
  if (typeof options.layout !== "string" || !options.layout.endsWith(".json")) {
    throw new Error("Frame atlas layout must name a JSON sidecar.");
  }
  const resource = resources[options.layout];
  if (!resource) throw new Error(`Missing frame atlas layout: ${options.layout}.`);
  let layout;
  try {
    layout = JSON.parse(new TextDecoder().decode(resource.bytes));
  } catch (error) {
    throw new Error(`Invalid frame atlas layout: ${options.layout}.`, { cause: error });
  }
  return layout;
}
