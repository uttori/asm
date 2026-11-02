import { ASSET_LIMITS, boundedProduct, rasterArea } from "./limits.js";
import { integer } from "./validation.js";

/** Inventory pages share native tilesets; page/frame boundaries never create native animation or storage owners. */
export interface IndexedPresentationLayout {
  /** Presentation frame width in pixels. */
  readonly width: number;
  /** Presentation frame height in pixels. */
  readonly height: number;
  /** Tile columns per presentation page. */
  readonly columns: number;
  /** Tile rows per presentation page. */
  readonly rows: number;
  /** Tiles shown on one page. */
  readonly capacity: number;
  /** Pages required to show every view tile. */
  readonly pages: number;
}

/**
 * Keep native preview geometry and fit complete tile inventory into separate presentation
 * frames. A full four-megapixel canvas needs no extra side gutter and is never downscaled.
 */
export function planIndexedPresentation(
  nativeWidth: number,
  nativeHeight: number,
  tileWidth: number,
  tileHeight: number,
  views: number,
): IndexedPresentationLayout {
  rasterArea(nativeWidth, nativeHeight, "Native presentation", ASSET_LIMITS.interchangeSide);
  rasterArea(tileWidth, tileHeight, "Inventory tile", ASSET_LIMITS.interchangeSide);
  integer(views, "Inventory views", 1, ASSET_LIMITS.owners);
  const pageTiles = Math.min(
    views,
    Math.floor(ASSET_LIMITS.rasterPixels / (tileWidth * tileHeight)),
  );
  const desiredColumns = Math.min(
    Math.floor(ASSET_LIMITS.interchangeSide / tileWidth),
    Math.ceil(Math.sqrt((pageTiles * tileHeight) / tileWidth)),
  );
  // Preserve a tall native preview's aspect ratio rather than widening its already bounded canvas.
  const maximumWidth = Math.min(
    ASSET_LIMITS.interchangeSide,
    Math.floor(ASSET_LIMITS.rasterPixels / Math.max(nativeHeight, tileHeight)),
  );
  const width = Math.max(nativeWidth, Math.min(desiredColumns * tileWidth, maximumWidth)),
    columns = Math.floor(width / tileWidth);
  const maximumHeight = Math.min(
    ASSET_LIMITS.interchangeSide,
    Math.floor(ASSET_LIMITS.rasterPixels / width),
  );
  const height = Math.max(
    nativeHeight,
    Math.min(Math.ceil(pageTiles / columns) * tileHeight, maximumHeight),
  );
  rasterArea(width, height, "Indexed presentation", ASSET_LIMITS.interchangeSide);
  const rows = Math.floor(height / tileHeight);
  const capacity = boundedProduct(columns, rows, ASSET_LIMITS.references, "Inventory page cells");
  if (!capacity) {
    throw new Error("Native presentation leaves no complete inventory tile capacity.");
  }
  const pages = Math.ceil(views / capacity);
  integer(pages, "Inventory pages", 1, ASSET_LIMITS.frames);
  return { width, height, columns, rows, capacity, pages };
}
