import type { IndexedDocument } from "../indexed-document.js";
import type { AssetInput } from "../registry.js";
import { type SourceResourceDependency } from "../source-binding.js";
import { type AssetSourceCodecRegistry } from "../source-codecs.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";
/** Discover adjacent reference/mapping resources from validated source bindings. No game state is mutated. */
export declare function somSourceDependencies(_source: AssetInput, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>, codecs?: AssetSourceCodecRegistry<IndexedDocument>): readonly SourceResourceDependency[];
/** Palette-only views follow the existing canvas/guide slots, retaining variant colors without allocating native pixels. */
export declare function somPngPaletteViews(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog): {
    document: {
        width: number;
        height: number;
        indexes: Uint8Array;
        transparentIndex: number;
        exportId?: string;
        palette: import("../indexed-values.ts").IndexedColor[];
    };
    policy: {
        owners: readonly import("../atlas-interchange.js").AtlasPixelOwner[];
        editablePaletteSlots: number[];
    };
    slots: ({
        palette: string;
        index: number;
    } | null)[];
};
/** Changed palette aliases vote by physical ROM word. Unchanged views retain the reference and never veto an edit. */
export declare function effectiveSomSourcePalette(catalog: SpritePaletteCatalog, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>, ownSource?: AssetInput, codecs?: AssetSourceCodecRegistry<IndexedDocument>): SpritePaletteCatalog;
/** Reconstruct the canonical PNG from native owner changes, retaining guides, composition and original compressed chunks. */
export declare function normalizeSomSource(source: AssetInput, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>, catalog: SpritePaletteCatalog, codecs?: AssetSourceCodecRegistry<IndexedDocument>): {
    source: AssetInput;
    layout: import("./som-types.js").FrameLayout;
    catalog: SpritePaletteCatalog;
};
//# sourceMappingURL=som-source.d.ts.map