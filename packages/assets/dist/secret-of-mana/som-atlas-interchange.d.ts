import { type AtlasChanges, type AtlasDocument, type AtlasEditPolicy } from "../atlas-interchange.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";
/** Export the actual stable atlas canvas; the SoM adapter supplies 4bpp ownership and palette policy. */
export declare function createSomAtlasExport(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, exportId: string): {
    document: AtlasDocument;
    policy: AtlasEditPolicy;
};
/**
 * Apply already-validated pixel/slot deltas to source values. Derived poses are rebuilt without
 * changing layout geometry; source PNG chunks and unknown layout/catalogue fields are retained.
 */
export declare function planSomAtlasImport(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, changes: AtlasChanges): {
    png: Uint8Array<ArrayBufferLike>;
    layout: import("./som-types.js").FrameLayout;
    catalog: SpritePaletteCatalog;
    palettes: string[];
    palette: [number, number, number, number][];
};
//# sourceMappingURL=som-atlas-interchange.d.ts.map