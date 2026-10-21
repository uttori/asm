import { type SomInterchangePaletteSlot } from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import type { AssetSourceAdapter } from "@uttori/asm-workflows/asset-interchange";
/** Explicit complete catalogue consumer closure. Paths are portable relative to the selected source project. */
export interface SomSpriteSelection {
    readonly atlasId: string;
    readonly image: string;
    readonly layout: string;
    readonly catalog: string;
    /** Optional source-owned observation selection and retained proof; container codecs never resolve capture paths. */
    readonly observations?: {
        readonly declaration: string;
        readonly proof: string;
    };
    readonly atlases: readonly {
        readonly id: string;
        readonly image: string;
        readonly layout: string;
    }[];
}
interface SomSpriteBindings {
    readonly paletteSlots: readonly SomInterchangePaletteSlot[];
}
/** SoM native interpretation is injected into the common host; it never publishes source or trusts imported bindings. */
export declare const somSpriteSourceAdapter: AssetSourceAdapter<SomSpriteSelection, SomSpriteBindings>;
export {};
//# sourceMappingURL=sprite-adapter.d.ts.map