import type { AssetEncoder } from "./registry.js";
import { type BgMapEntry } from "./snes.js";
/**
 * Encode logical BG cells in hardware's 32×32 screen-block storage order.
 * @param logical Logical row-major entries; indexes may repeat.
 * @param width Width in map cells, 32 or 64.
 * @param height Height in map cells, 32 or 64.
 * @returns Owned native BG map words.
 */
export declare function encodeBgScreenMap(logical: readonly BgMapEntry[], width: number, height: number): Uint8Array;
/**
 * Reverse native screen-block storage into logical row-major BG cells.
 * @param bytes Native BG map words.
 * @param width Width in map cells, 32 or 64.
 * @param height Height in map cells, 32 or 64.
 * @returns Owned logical entries.
 */
export declare function decodeBgScreenMap(bytes: Uint8Array, width: number, height: number): BgMapEntry[];
/**
 * Validate a complete 128×128 Mode 7 map or an explicit partial upload rectangle.
 * @param indexes Row-major tile indexes.
 * @param width Width in cells.
 * @param height Height in cells.
 * @param layout `"full"` for the hardware map, or `"partial"` for an upload rectangle.
 * @returns Owned native map bytes.
 */
export declare function encodeMode7MapLayout(indexes: readonly number[], width: number, height: number, layout: string): Uint8Array;
/**
 * Compose PNG-aware tile encoders with native JSON encoders under the same IDs.
 * @param native Existing exact native model encoders.
 * @returns Combined format registrations.
 */
export declare function withImageEncoders(native: readonly AssetEncoder[]): readonly AssetEncoder[];
//# sourceMappingURL=image-conversion.d.ts.map