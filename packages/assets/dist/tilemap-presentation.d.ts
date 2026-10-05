import type { AsepriteCel, AsepriteFrame, AsepriteLayer, AsepriteTag, AsepriteTileset } from "./aseprite-document.js";
import { type IndexedOwnership } from "./indexed-ownership.js";
/** Pixel-positioned type-3 cel; adapters keep cell units and native transform meaning outside this storage helper. */
export declare function tilemapPresentationCel(layer: number, x: number, y: number, columns: number, rows: number, cells: Uint32Array): AsepriteCel;
/**
 * Build a visible, complete shared inventory on separate presentation frames.
 * Read-only views use a labeled layer. Container tile zero remains empty and never absorbs a blank native owner.
 */
export declare function createTilemapInventory(ownership: IndexedOwnership, nativeWidth: number, nativeHeight: number, name: string): {
    readonly width: number;
    readonly height: number;
    readonly layers: AsepriteLayer[];
    readonly frames: AsepriteFrame[];
    readonly tags: AsepriteTag[];
    readonly tileset: AsepriteTileset;
};
//# sourceMappingURL=tilemap-presentation.d.ts.map