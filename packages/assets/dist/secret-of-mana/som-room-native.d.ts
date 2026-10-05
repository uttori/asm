import type { RoomAsset, RoomPreview } from "./som-room-assets.js";
/** Read exact current bytes at CPU addresses. The host supplies mapper/mirror policy and source attribution. */
export type SomRoomNativeReader = (address: number, size: number) => Uint8Array;
/** One complete loader-owned tile. Low native planes are editable; descriptor-selected upper planes are fixed. */
export interface SomRoomNativeTile {
    readonly address: number;
    readonly depth: 2 | 3 | 4;
    readonly constant: number;
    readonly destination: number;
    readonly native: Uint8Array;
    readonly indexes: Uint8Array;
}
/** Loader order and full transfer inventory, including overwritten/unused sources, remain separate from visible coverage. */
export interface SomRoomNativeState {
    readonly preview: RoomPreview;
    readonly inventory: readonly SomRoomNativeTile[];
    readonly physical: readonly (SomRoomNativeTile | undefined)[];
    readonly paletteAddress: number;
}
/** Decode the fixed 384-metatile MSB stream. Short deltas wrap the low byte; signed deltas carry through the word. */
export declare function decodeSomRoomMetatiles(bytes: Uint8Array): Uint16Array;
/**
 * Reconstruct the researched initial Mode-1 loader using current normal-build bytes.
 * Native format 7, partial tiles and unbounded pointers fail closed. Runtime animation,
 * capture-time overrides, actors and color math are outside this initial-state contract.
 */
export declare function loadSomRoomNative(room: RoomAsset, reader: SomRoomNativeReader): SomRoomNativeState;
//# sourceMappingURL=som-room-native.d.ts.map