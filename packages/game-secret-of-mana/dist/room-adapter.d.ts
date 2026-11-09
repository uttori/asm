import type { AssetSourceAdapter } from "@uttori/asm-workflows/asset-interchange";
/** Complete declared room consumer closure. Native initial-state data is read from the normal 2 MiB USA build. */
export interface SomRoomSelection {
    /** Edited room asset path; must appear in rooms. */
    readonly room: string;
    /** Every declared som.room asset path, unique and complete; at most 511 entries. */
    readonly rooms: readonly string[];
    /** Story flag index (0-255) to state (0-255) used for composition; absent uses initial state. */
    readonly story?: Readonly<Record<string, number>>;
}
/** Private export state that pins tile ownership and the palette source to the exported baseline. */
interface SomRoomBindings {
    /** Interchange tile owner IDs in baseline order. */
    readonly owners: readonly string[];
    /** CPU address of the selected room's palette words. */
    readonly paletteAddress: number;
}
/** Room source editing uses only fixed native low planes and palette words; map cells/conditional records remain unchanged. */
export declare const somRoomSourceAdapter: AssetSourceAdapter<SomRoomSelection, SomRoomBindings>;
export {};
//# sourceMappingURL=room-adapter.d.ts.map