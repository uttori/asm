import { type DebugMap } from "@uttori/asm-core/debug-map";
import type { ReplayScript } from "./replay-backend.js";
/**
 * Creates a deterministic mock timeline directly from a valid debug map.
 * @param map Fingerprinted debug map.
 * @param output Exact mapped binary.
 * @returns One snapshot per mapped source range.
 */
export declare const createDebugMapReplayScript: (map: DebugMap, output: Uint8Array) => ReplayScript;
//# sourceMappingURL=mock-script.d.ts.map