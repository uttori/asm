import { type TilemapInterchangeBaseline } from "../interchange.js";
import type { SomRoomComposition } from "./som-room-composition.js";
import type { SomRoomNativeTile } from "./som-room-native.js";
/** Trusted source attribution supplied by the host; a physical destination is an occurrence rather than an owner ID. */
export interface SomRoomBoundTile extends SomRoomNativeTile {
    readonly owner: string;
    readonly editable: boolean;
}
/**
 * Present complete loader inventory and four Mode-1 passes using shared tilesets.
 * Native low-plane indexes map through fixed descriptor planes and palette banks;
 * native zero becomes transparent only when the expanded four-plane index is zero.
 */
export declare function createSomRoomInterchange(composition: SomRoomComposition, inventory: readonly SomRoomBoundTile[], physical: readonly (SomRoomBoundTile | undefined)[], editablePaletteSlots: readonly number[], exportId: string): TilemapInterchangeBaseline;
//# sourceMappingURL=som-room-interchange.d.ts.map