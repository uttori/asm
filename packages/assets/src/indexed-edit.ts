import { ASSET_LIMITS, boundedSum, rasterArea } from "./limits.js";
import { integer } from "./validation.js";

/** Row-major palette indexes, independent of tile size, palette encoding or game. */
export interface IndexedPixels {
  /** Horizontal extent in pixels. */
  readonly width: number;
  /** Vertical extent in pixels. */
  readonly height: number;
  /** Row-major palette slots, length `width * height`. */
  readonly indexes: Uint8Array;
}

/** Pixel rectangle; coordinates may be negative when used as a render viewport. */
export interface PixelBounds {
  /** Signed left edge in the placement coordinate system. */
  readonly x: number;
  /** Signed top edge in the placement coordinate system. */
  readonly y: number;
  /** Positive horizontal span. */
  readonly width: number;
  /** Positive vertical span. */
  readonly height: number;
}

/** Orientation and optional source-index mapping. Null/missing map entries reject that color. */
export interface IndexedRegion extends PixelBounds {
  /** Mirror source columns when extracting or compositing. */
  readonly flipX?: boolean;
  /** Mirror source rows when extracting or compositing. */
  readonly flipY?: boolean;
  /** Optional per-slot remapping; null entries reject that source index. */
  readonly indexMap?: readonly (number | null)[];
}

/** Array order is back-to-front; identity is supplied by the caller, never inferred from pixels. */
export interface IndexedPlacement {
  /** Stable occurrence identity within one composition pass. */
  readonly id: string;
  /** Key into the caller-supplied source map. */
  readonly source: string;
  /** Left edge of the source image in viewport coordinates. */
  readonly x: number;
  /** Top edge of the source image in viewport coordinates. */
  readonly y: number;
  /** Mirror source columns when drawing. */
  readonly flipX?: boolean;
  /** Mirror source rows when drawing. */
  readonly flipY?: boolean;
  /** Optional per-slot remapping applied after transparency tests. */
  readonly indexMap?: readonly (number | null)[];
  /** Source index tested before mapping; defaults to zero. Null makes every index opaque. */
  readonly transparentIndex?: number | null;
}

/**
 * Validate dimensions before allocating buffers or entering pixel loops.
 * @param image Row-major index buffer whose dimensions must agree exactly.
 */
export function validateIndexedPixels(image: IndexedPixels): void {
  const pixels = rasterArea(image.width, image.height, "Indexed");
  if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== pixels) {
    throw new RangeError("Indexed pixels are missing or exceed the four-megapixel limit.");
  }
}

/**
 * Validate a viewport or extraction rectangle without assuming a console grid.
 * @param bounds Signed origin and positive dimensions, bounded before allocation.
 */
function validateBounds(bounds: PixelBounds): void {
  integer(bounds.x, "Rectangle x", -(1 << 20), 1 << 20);
  integer(bounds.y, "Rectangle y", -(1 << 20), 1 << 20);
  rasterArea(bounds.width, bounds.height, "Rectangle");
}

/**
 * Reject truthy non-booleans rather than silently mirroring malformed metadata.
 * @param value Optional orientation flags from a region or placement.
 */
function validateOrientation(value: { readonly flipX?: boolean; readonly flipY?: boolean }): void {
  for (const flag of [value.flipX, value.flipY]) {
    if (flag !== undefined && typeof flag !== "boolean") {
      throw new TypeError("Flip must be boolean.");
    }
  }
}

/**
 * Apply an explicit index permutation without merging equal-colored slots.
 * @param index Source palette slot.
 * @param map Optional mapping; missing/null entries reject encountered source indexes.
 * @returns Destination palette slot in the byte range.
 */
function mappedIndex(index: number, map?: readonly (number | null)[]): number {
  if (!map) {
    return index;
  }
  const mappedSlot =
    Number.isInteger(index) && index >= 0 && index < map.length ? map[index] : undefined;
  if (mappedSlot === undefined || mappedSlot === null) {
    throw new RangeError(`Unmapped palette index ${index}.`);
  }
  return integer(mappedSlot, "Mapped palette index", 0, 255);
}

/**
 * Extract an owned index buffer and undo display flips; never changes the source image.
 * @param image Current indexed pixels, independent of their display colors.
 * @param region In-bounds source rectangle with optional flips and index mapping.
 * @returns Owned pixels in the requested native orientation.
 */
export function extractIndexedRegion(image: IndexedPixels, region: IndexedRegion): IndexedPixels {
  validateIndexedPixels(image);
  validateBounds(region);
  validateOrientation(region);
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > image.width ||
    region.y + region.height > image.height
  ) {
    throw new RangeError("Source rectangle exceeds image.");
  }
  const indexes = new Uint8Array(region.width * region.height);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const sx = region.x + (region.flipX ? region.width - x - 1 : x);
      const sy = region.y + (region.flipY ? region.height - y - 1 : y);
      indexes[y * region.width + x] = mappedIndex(
        image.indexes[sy * image.width + sx],
        region.indexMap,
      );
    }
  }
  return { width: region.width, height: region.height, indexes };
}

/**
 * Compose identified sources in array order into an explicit viewport. Out-of-bounds
 * placements fail rather than clipping silently. Background, if supplied, is copied.
 * Source transparency is tested before palette mapping, independently of RGB/alpha.
 * @param sources Caller-supplied identities mapped to current indexed pixels.
 * @param placements Ordered draw occurrences; IDs must be unique.
 * @param viewport Canvas origin and dimensions in the placement coordinate system.
 * @param background Optional existing pixels; copied before composition.
 * @returns Owned composited pixels with the viewport dimensions.
 */
export function renderIndexedPlacements(
  sources: ReadonlyMap<string, IndexedPixels>,
  placements: readonly IndexedPlacement[],
  viewport: PixelBounds,
  background?: Uint8Array,
): IndexedPixels {
  validateBounds(viewport);
  if (background && background.length !== viewport.width * viewport.height) {
    throw new RangeError("Background dimensions do not match the viewport.");
  }
  if (placements.length > 65536) {
    throw new RangeError("Too many indexed placements.");
  }
  const ids = new Set<string>();
  let work = 0;
  // Validate every placement first; malformed late entries cannot leave a partial result.
  for (const placement of placements) {
    if (!placement.id || ids.has(placement.id)) {
      throw new Error(`Duplicate/empty placement ${placement.id}.`);
    }
    ids.add(placement.id);
    const source = sources.get(placement.source);
    if (!source) {
      throw new Error(`Placement ${placement.id}: missing source ${placement.source}.`);
    }
    validateIndexedPixels(source);
    validateOrientation(placement);
    integer(placement.x, "Placement x", -(1 << 20), 1 << 20);
    integer(placement.y, "Placement y", -(1 << 20), 1 << 20);
    if (placement.transparentIndex !== undefined && placement.transparentIndex !== null) {
      integer(placement.transparentIndex, "Transparent index", 0, 255);
    }
    if (
      placement.x < viewport.x ||
      placement.y < viewport.y ||
      placement.x + source.width > viewport.x + viewport.width ||
      placement.y + source.height > viewport.y + viewport.height
    ) {
      throw new RangeError(`Placement ${placement.id} exceeds the viewport.`);
    }
    work = boundedSum(
      work,
      source.indexes.length,
      ASSET_LIMITS.renderPixels,
      "Placement rendering work",
    );
  }
  const indexes = background
    ? Uint8Array.from(background)
    : new Uint8Array(viewport.width * viewport.height);
  for (const placement of placements) {
    const source = sources.get(placement.source)!;
    const transparent = placement.transparentIndex === undefined ? 0 : placement.transparentIndex;
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const sx = placement.flipX ? source.width - x - 1 : x;
        const sy = placement.flipY ? source.height - y - 1 : y;
        const index = source.indexes[sy * source.width + sx];
        if (index === transparent) {
          continue;
        }
        const target =
          (placement.y - viewport.y + y) * viewport.width + placement.x - viewport.x + x;
        indexes[target] = mappedIndex(index, placement.indexMap);
      }
    }
  }
  return { width: viewport.width, height: viewport.height, indexes };
}

/** A cell names its source independently of image equality and carries its palette policy. */
export interface IndexedGridCell {
  /** Key into the caller-supplied source map for this cell. */
  readonly source: string;
  /** Optional per-slot remapping for this cell only. */
  readonly indexMap?: readonly (number | null)[];
  /** Source index skipped when compositing; defaults to zero when omitted. */
  readonly transparentIndex?: number | null;
}

/** A rectangular native block; rows follow from the complete row-major cell list. */
export interface IndexedGridBlock {
  /** Stable block identity echoed in generated placement IDs. */
  readonly id: string;
  /** Left edge of column zero in viewport coordinates. */
  readonly x: number;
  /** Top edge of row zero in viewport coordinates. */
  readonly y: number;
  /** Cells per row; must divide `cells.length`. */
  readonly columns: number;
  /** Horizontal stride between adjacent cells in pixels. */
  readonly cellWidth: number;
  /** Vertical stride between adjacent rows in pixels. */
  readonly cellHeight: number;
  /** Row-major cell list, length a multiple of `columns`. */
  readonly cells: readonly IndexedGridCell[];
  /** Reverse column order when expanding placements. */
  readonly flipX?: boolean;
  /** Reverse row order when expanding placements. */
  readonly flipY?: boolean;
}

/**
 * Expand a native grid into placements, reversing cell order and pixels together on flips.
 * Does not encode game frame bytes or infer grid size from the source image.
 * @param block Ordered cells with explicit dimensions in pixels.
 * @returns Owned occurrences in native cell order, with stable block/cell IDs.
 */
export function expandIndexedGrid(block: IndexedGridBlock): IndexedPlacement[] {
  integer(block.columns, "Grid columns", 1, 65536);
  integer(block.cellWidth, "Grid cell width", 1, 1 << 20);
  integer(block.cellHeight, "Grid cell height", 1, 1 << 20);
  integer(block.x, "Grid x", -(1 << 20), 1 << 20);
  integer(block.y, "Grid y", -(1 << 20), 1 << 20);
  validateOrientation(block);
  if (
    typeof block.id !== "string" ||
    !block.id ||
    block.cells.length < 1 ||
    block.cells.length > 65536 ||
    block.cells.length % block.columns !== 0
  ) {
    throw new Error("Grid requires an identity and complete bounded rows.");
  }
  const rows = block.cells.length / block.columns;
  return block.cells.map((cell, index) => {
    const column = index % block.columns;
    const row = Math.floor(index / block.columns);
    return {
      ...cell,
      id: JSON.stringify([block.id, index]),
      x: block.x + (block.flipX ? block.columns - column - 1 : column) * block.cellWidth,
      y: block.y + (block.flipY ? rows - row - 1 : row) * block.cellHeight,
      flipX: block.flipX ?? false,
      flipY: block.flipY ?? false,
    };
  });
}
