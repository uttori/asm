import { type SomInterchangePaletteSlot } from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import type { AssetSourceAdapter } from "@uttori/asm-workflows/asset-interchange";
/** Explicit complete catalogue consumer closure. Paths are portable relative to the selected source project. */
export interface SomSpriteSelection {
    /** Edited atlas ID; must match one atlases entry with the same image and layout. */
    readonly atlasId: string;
    /** Edited atlas PNG path. */
    readonly image: string;
    /** Edited atlas frame layout JSON path. */
    readonly layout: string;
    /** Shared sprite palette catalogue JSON path. */
    readonly catalog: string;
    /** Optional source-owned observation selection and retained proof; container codecs never resolve capture paths. */
    readonly observations?: {
        readonly declaration: string;
        readonly proof: string;
    };
    /** Every atlas sharing the catalogue, with unique IDs; palette edits are audited against all of them. */
    readonly atlases: readonly {
        readonly id: string;
        readonly image: string;
        readonly layout: string;
    }[];
}
/** Private export state that maps interchange palette indexes back to catalogue palette words. */
interface SomSpriteBindings {
    /** Interchange palette index to catalogue palette and 0-15 color index; at most 256 entries. */
    readonly paletteSlots: readonly SomInterchangePaletteSlot[];
}
/** SoM native interpretation is injected into the common host; it never publishes source or trusts imported bindings. */
export declare const somSpriteSourceAdapter: AssetSourceAdapter<SomSpriteSelection, SomSpriteBindings>;
export {};
//# sourceMappingURL=sprite-adapter.d.ts.map