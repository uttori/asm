import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import type { IndexedImage } from "@uttori/asm-assets/image";
import { validateFrameLayout } from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";

/** Canonical pixel rectangle consumed by a native tile recipe; other atlas pixels are presentation. */
export interface PngEditRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** First of sixteen native palette slots. Global slot zero also represents transparency. */
  readonly paletteStart: number;
  /** Number of composed poses using this native tile, including flipped occurrences. */
  readonly uses: number;
}

/** Sidecar identity is pinned for a document lifetime so stale geometry cannot silently redirect paint. */
export interface PngGuidance {
  readonly file: string;
  readonly sha256: string;
  readonly regions: readonly PngEditRegion[];
}

const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Bound sidecar reads independently of the PNG's decoded-pixel budget. */
async function read(file: string): Promise<Buffer> {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
    throw new Error("PNG layout must be a regular file of at most 2 MiB.");
  }
  return fs.readFile(file);
}

/** Recognize the existing frame-atlas contract; ordinary indexed PNGs remain freely editable. */
export async function readPngGuidance(
  file: string,
  image: IndexedImage,
): Promise<PngGuidance | undefined> {
  const sidecar = file.replace(/\.png$/i, ".layout.json");
  let bytes: Buffer;
  try {
    bytes = await read(sidecar);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || !("segments" in value) || !("paletteRefs" in value)) {
    return undefined;
  }
  const layout = validateFrameLayout(value as Parameters<typeof validateFrameLayout>[0], {
    whole: true,
  });
  if (layout.width !== image.width || layout.height !== image.height) {
    throw new Error("PNG dimensions differ from its frame-atlas layout.");
  }
  const uses = new Map<string, number>();
  for (const frame of layout.frames ?? []) {
    for (const placement of frame.placements ?? []) {
      if (placement.segment !== undefined && placement.tile !== undefined) {
        const key = `${placement.segment}:${placement.tile}`;
        uses.set(key, (uses.get(key) ?? 0) + 1);
      }
    }
  }
  const regions = Object.entries(layout.segments).flatMap(([name, segment]) =>
    segment.tiles.map((tile, index): PngEditRegion => ({
      x: tile.x,
      y: tile.y,
      width: 8,
      height: 8,
      label: `${name} · tile ${index}`,
      paletteStart: segment.palette * 16,
      uses: uses.get(`${name}:${index}`) ?? 0,
    })),
  );
  return { file: sidecar, sha256: hash(bytes), regions };
}

/** Reject no-op presentation edits and wrong palette groups before changing the native document. */
export function validatePngRegionStroke(
  guidance: PngGuidance | undefined,
  width: number,
  pixels: readonly number[],
  index: number,
): void {
  if (!guidance) {
    return;
  }
  for (const pixel of pixels) {
    const x = pixel % width,
      y = Math.floor(pixel / width);
    const regions = guidance.regions.filter(
      (region) =>
        x >= region.x &&
        x < region.x + region.width &&
        y >= region.y &&
        y < region.y + region.height,
    );
    if (!regions.length) {
      throw new Error(
        "This pixel is atlas padding or a preview. Paint inside an outlined source tile; only those pixels are encoded into the ROM.",
      );
    }
    // Every overlapping consumer must accept the slot. Choosing one would hide a broken shared tile.
    if (
      index !== 0 &&
      regions.some((region) => index < region.paletteStart || index >= region.paletteStart + 16)
    ) {
      throw new Error(
        "This tile uses a different palette group. Select one of its sixteen slots or global transparency (slot 0).",
      );
    }
  }
}

/** A layout edit requires reopening the PNG; native Save must never commit against stale region ownership. */
export async function assertPngGuidanceCurrent(guidance: PngGuidance | undefined): Promise<void> {
  if (guidance && hash(await read(guidance.file)) !== guidance.sha256) {
    throw new Error(
      "The frame-atlas layout changed. Reopen the PNG before painting or saving; Save As can preserve an existing draft.",
    );
  }
}
