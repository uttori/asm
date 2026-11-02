import type { ProjectAssetCodecAnnotation } from "./project-types.js";

/** IDs of the retired ROM-range codecs and their equivalent native binary formats. */
const legacyNativeIds = new Map<string, string>([
  ["snes.asset.tile.2bpp", "snes.tile.2bpp"],
  ["snes.asset.tile.3bpp", "snes.tile.3bpp"],
  ["snes.asset.tile.4bpp", "snes.tile.4bpp"],
  ["snes.asset.tile.8bpp", "snes.tile.8bpp"],
  ["snes.asset.tile.mode7", "snes.tile.mode7"],
  ["snes.asset.palette.bgr555", "snes.palette.bgr555"],
  ["snes.asset.tilemap.bg", "snes.tilemap.bg"],
  ["snes.asset.tilemap.mode7", "snes.tilemap.mode7"],
  ["snes.asset.brr", "snes.brr"],
]);

/**
 * Resolve a known v1 SNES declaration for analysis display without editing its stored provenance.
 * A different codec version or an unknown ID may have different byte semantics and stays unresolved.
 * @param declaration Persisted project record.
 * @returns Equivalent native format ID when semantics are known.
 */
export function resolveProjectNativeAssetId(
  declaration: ProjectAssetCodecAnnotation,
): string | undefined {
  if (declaration.codecVersion !== "1.0.0") {
    return undefined;
  }
  return legacyNativeIds.get(declaration.codecId);
}
