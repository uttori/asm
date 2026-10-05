import { extractIndexedRegion, validateIndexedPixels, type IndexedRegion } from "./indexed-edit.js";
import { indexedPalette, indexedPaletteChanges, type IndexedColor } from "./indexed-values.js";
import { ASSET_LIMITS, rasterArea } from "./limits.js";
import { integer } from "./validation.js";

/** Ordered RGBA8 slot. Equal colors remain different identities. */
export type AtlasColor = IndexedColor;

/** Normalized indexed canvas, independent of an editor's layers/cels or a game's tile grammar. */
export interface AtlasDocument {
  readonly width: number;
  readonly height: number;
  readonly indexes: Uint8Array;
  readonly palette: readonly AtlasColor[];
  readonly transparentIndex: number;
  /** Optional durable export locator; authority resides in the selected project's baseline. */
  readonly exportId?: string;
}

/** File conversion only: implementations own returned buffers and never access paths or processes. */
export interface AtlasFileCodec {
  readonly id: string;
  readonly version: number;
  readonly extension: string;
  readonly capabilities: {
    readonly paletteEdits: boolean;
    readonly embeddedIdentity: boolean;
  };
  encode(document: AtlasDocument): Promise<Uint8Array>;
  decode(bytes: Uint8Array): Promise<AtlasDocument>;
}

/** One fixed source rectangle; index mapping and orientation are supplied by the game adapter. */
export interface AtlasPixelOwner extends IndexedRegion {
  readonly id: string;
}

/** Host/adapter-owned capabilities, never inferred from artwork or imported metadata. */
export interface AtlasEditPolicy {
  readonly owners: readonly AtlasPixelOwner[];
  readonly editablePaletteSlots: readonly number[];
}

/** Exact accepted native-index and same-slot color deltas; all escaping arrays are owned copies. */
export interface AtlasChanges {
  readonly pixels: readonly { readonly owner: string; readonly indexes: Uint8Array }[];
  readonly colors: readonly { readonly index: number; readonly color: AtlasColor }[];
}

/** Portable locator and advertised capabilities; source paths and native addresses stay in the host. */
export interface AtlasExportManifest {
  readonly format: "uttori-atlas-export";
  readonly version: 1;
  readonly id: string;
  readonly project: string;
  readonly asset: string;
  readonly adapter: string;
  readonly codec: string;
  readonly codecVersion: number;
  readonly width: number;
  readonly height: number;
  readonly transparentIndex: number;
  readonly owners: readonly string[];
  readonly editablePaletteSlots: readonly number[];
}

/** Shared container limits are deliberately smaller than arbitrary editor document limits. */
export const ATLAS_FILE_LIMIT = ASSET_LIMITS.asepriteBytes;

/** Validate before allocation/conversion; indexes and palette slot order must agree exactly. */
export function validateAtlasDocument(document: AtlasDocument): void {
  validateIndexedPixels(document);
  rasterArea(document.width, document.height, "Atlas", ASSET_LIMITS.interchangeSide);
  indexedPalette(document.palette);
  integer(document.transparentIndex, "Atlas transparent slot", 0, document.palette.length - 1);
  if (document.indexes.some((index) => index >= document.palette.length)) {
    throw new Error("Atlas pixel references a missing palette slot.");
  }
  if (document.exportId !== undefined && !/^[\da-f-]{36}$/.test(document.exportId)) {
    throw new Error("Invalid atlas export identity.");
  }
}

/** Read a decoded PNG without converting to RGB or merging duplicate slots. */
export function indexedAtlasDocument(value: unknown, transparentIndex: number): AtlasDocument {
  if (!value || typeof value !== "object" || !("kind" in value) || value.kind !== "indexed-image") {
    throw new Error("Atlas interchange requires indexed artwork; RGB mapping is not supported.");
  }
  if (
    !("width" in value) ||
    typeof value.width !== "number" ||
    !("height" in value) ||
    typeof value.height !== "number" ||
    !("indexes" in value) ||
    !(value.indexes instanceof Uint8Array) ||
    !("palette" in value) ||
    !Array.isArray(value.palette)
  ) {
    throw new Error("Invalid indexed atlas value.");
  }
  const palette = indexedPalette(value.palette);
  const document = {
    width: value.width,
    height: value.height,
    indexes: Uint8Array.from(value.indexes),
    palette,
    transparentIndex,
  };
  validateAtlasDocument(document);
  return document;
}

/**
 * Compare normalized file content against the exported canvas. No changed padding/preview pixels,
 * palette remapping, geometry or alpha is silently discarded. Overlapping authorities reject.
 */
export function inspectAtlasChanges(
  before: AtlasDocument,
  after: AtlasDocument,
  policy: AtlasEditPolicy,
): AtlasChanges {
  validateAtlasDocument(before);
  validateAtlasDocument(after);
  if (
    before.width !== after.width ||
    before.height !== after.height ||
    before.transparentIndex !== after.transparentIndex ||
    before.palette.length !== after.palette.length
  ) {
    throw new Error("Atlas canvas, transparency or palette inventory changed.");
  }
  if (
    before.exportId !== undefined &&
    after.exportId !== undefined &&
    before.exportId !== after.exportId
  ) {
    throw new Error("Atlas document belongs to a different export.");
  }
  const colors = indexedPaletteChanges(before.palette, after.palette, policy.editablePaletteSlots);
  const claimed = new Uint8Array(before.indexes.length);
  const ids = new Set<string>();
  const pixels: AtlasChanges["pixels"][number][] = [];
  for (const owner of policy.owners) {
    if (!owner.id || ids.has(owner.id)) {
      throw new Error("Missing or duplicate atlas owner.");
    }
    ids.add(owner.id);
    const oldPixels = extractIndexedRegion(before, owner);
    const newPixels = extractIndexedRegion(after, owner);
    for (let y = owner.y; y < owner.y + owner.height; y++) {
      for (let x = owner.x; x < owner.x + owner.width; x++) {
        const offset = y * before.width + x;
        if (claimed[offset]) {
          throw new Error("Overlapping atlas pixel authorities require reconciliation.");
        }
        // Two display slots can map to one native value. A changed alias must not become a false no-op.
        if (
          before.indexes[offset] !== after.indexes[offset] &&
          owner.indexMap &&
          owner.indexMap[before.indexes[offset]] === owner.indexMap[after.indexes[offset]]
        ) {
          throw new Error("Changed atlas slot aliases require an explicit canonical mapping.");
        }
        claimed[offset] = 1;
      }
    }
    if (newPixels.indexes.some((index, i) => index !== oldPixels.indexes[i])) {
      pixels.push({ owner: owner.id, indexes: newPixels.indexes });
    }
  }
  // Comparing raw slots also catches edits whose native mapping would otherwise hide a visual change.
  if (after.indexes.some((index, i) => index !== before.indexes[i] && !claimed[i])) {
    throw new Error("Atlas padding or derived preview pixels changed.");
  }
  return { pixels, colors };
}
