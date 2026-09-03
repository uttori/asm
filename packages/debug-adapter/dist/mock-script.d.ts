import { type DebugMap } from "@uttori/asm-core/debug-map";
import type { ReplayScript } from "./replay-backend.js";
/**
 * Creates a deterministic mock timeline directly from a valid debug map.
 * @param {DebugMap} map Fingerprinted debug map.
 * @param {Uint8Array} output Exact mapped binary.
 * @returns {ReplayScript} One snapshot per mapped source range.
 */
export declare const createDebugMapReplayScript: (map: DebugMap, output: Uint8Array) => ReplayScript;
//# sourceMappingURL=mock-script.d.ts.map