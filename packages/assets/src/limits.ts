import { integer } from "./validation.js";

/** Host-independent ceilings. Smaller host budgets may restrict these; files cannot enlarge them.
 * Pixel area, decoded bytes, rendering work and metadata counts have different units.
 */
export const ASSET_LIMITS = Object.freeze({
  rasterPixels: 4 * 1024 * 1024,
  interchangeSide: 4096,
  pngBytes: 32 * 1024 * 1024,
  pngInflatedBytes: 20 * 1024 * 1024,
  asepriteBytes: 16 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024,
  renderPixels: 64 * 1024 * 1024,
  frames: 1024,
  layers: 4096,
  tilesets: 1024,
  owners: 4 * 1024 * 1024,
  references: 4 * 1024 * 1024,
  chunks: 1024 * 1024,
  metadataBytes: 16 * 1024 * 1024,
  baselineMetadataBytes: 64 * 1024 * 1024,
  metadataNodes: 1024 * 1024,
  // Baselines include owner and view declarations as well as the file model; pixels stay in binary blobs.
  baselineMetadataNodes: 4 * 1024 * 1024,
  thumbnailEdge: 1024,
});

/** Check a nonnegative product before allocating or iterating. Division avoids unsafe multiplication. */
export function boundedProduct(a: number, b: number, maximum: number, label: string): number {
  integer(maximum, `${label} limit`, 0, Number.MAX_SAFE_INTEGER);
  integer(a, label, 0, Number.MAX_SAFE_INTEGER);
  integer(b, label, 0, Number.MAX_SAFE_INTEGER);
  if (a !== 0 && b > Math.floor(maximum / a)) {
    throw new RangeError(`${label} exceeds limit ${maximum}.`);
  }
  return a * b;
}

/** Accumulate independently validated sizes without allowing an overflowing sum. */
export function boundedSum(total: number, next: number, maximum: number, label: string): number {
  integer(maximum, `${label} limit`, 0, Number.MAX_SAFE_INTEGER);
  integer(total, label, 0, maximum);
  integer(next, label, 0, maximum - total);
  return total + next;
}

/** Positive raster dimensions; generic pixel buffers permit skinny shapes, interchange canvases do not. */
export function rasterArea(
  width: number,
  height: number,
  label = "Raster",
  side = ASSET_LIMITS.rasterPixels,
): number {
  integer(width, `${label} width`, 1, side);
  integer(height, `${label} height`, 1, side);
  return boundedProduct(width, height, ASSET_LIMITS.rasterPixels, `${label} pixels`);
}

/** JSON hot-exit backup contains the PNG and both saved/draft index buffers as base64, plus metadata. */
export const PNG_EDITOR_BACKUP_BYTES =
  Math.ceil((ASSET_LIMITS.pngBytes + 2 * ASSET_LIMITS.rasterPixels) / 3) * 4 + 1024 * 1024;
