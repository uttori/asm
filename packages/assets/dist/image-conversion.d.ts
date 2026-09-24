import type { AssetEncoder } from "./registry.js";
import { type BgMapEntry } from "./snes.js";
/** Encode logical BG cells in hardware's 32×32 screen-block storage order.
 * @param {readonly BgMapEntry[]} logical Logical row-major entries; indexes may repeat.
 * @param {number} width Width in map cells, 32 or 64.
 * @param {number} height Height in map cells, 32 or 64.
 * @returns {Uint8Array} Owned native BG map words.
 */
export declare function encodeBgScreenMap(logical: readonly BgMapEntry[], width: number, height: number): Uint8Array;
/** Reverse native screen-block storage into logical row-major BG cells.
 * @param {Uint8Array} bytes Native BG map words.
 * @param {number} width Width in map cells, 32 or 64.
 * @param {number} height Height in map cells, 32 or 64.
 * @returns {BgMapEntry[]} Owned logical entries.
 */
export declare function decodeBgScreenMap(bytes: Uint8Array, width: number, height: number): BgMapEntry[];
/** Validate a complete 128×128 Mode 7 map or an explicit partial upload rectangle.
 * @param {readonly number[]} indexes Row-major tile indexes.
 * @param {number} width Width in cells.
 * @param {number} height Height in cells.
 * @param {"full" | "partial"} layout Hardware map or partial upload contract.
 * @returns {Uint8Array} Owned native map bytes.
 */
export declare function encodeMode7MapLayout(indexes: readonly number[], width: number, height: number, layout: "full" | "partial"): Uint8Array;
/** Compose PNG-aware tile encoders with native JSON encoders under the same IDs.
 * @param {readonly AssetEncoder[]} native Existing exact native model encoders.
 * @returns {readonly AssetEncoder[]} Combined format registrations.
 */
export declare function withImageEncoders(native: readonly AssetEncoder[]): readonly AssetEncoder[];
//# sourceMappingURL=image-conversion.d.ts.map