import type { AssetSourceAdapter } from "../contracts.js";
/** Complete declared room consumer closure. Native initial-state data is read from the normal 2 MiB USA build. */
export interface SomRoomSelection {
    readonly room: string;
    readonly rooms: readonly string[];
    readonly story?: Readonly<Record<string, number>>;
}
interface SomRoomBindings {
    readonly owners: readonly string[];
    readonly paletteAddress: number;
}
/** Room source editing uses only fixed native low planes and palette words; map cells/conditional records remain unchanged. */
export declare const somRoomSourceAdapter: AssetSourceAdapter<SomRoomSelection, SomRoomBindings>;
export {};
//# sourceMappingURL=secret-of-mana-room.d.ts.map