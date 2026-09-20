import type { RuntimeBusAccess, RuntimeBusFact } from "./runtime-bus-types.js";
/** Native PPU decision at one completing port write. Physical byte writes retain
 * order, including repeated destinations. No source instruction or A-bus read is inferred.
 * Raster positions stay in the ordered archive instead of multiplying SQL variants.
 */
export interface RuntimePPUEffect {
    readonly target: "vram" | "cgram" | "oam";
    readonly outcome: "written" | "blocked" | "latched";
    readonly forcedBlank: boolean;
    readonly renderingRestricted: boolean;
    readonly implementation: "accurate" | "performance";
    /** Physical capacity for VRAM. Null for CGRAM/OAM. */
    readonly vramBytes: 65536 | 131072 | null;
    readonly bytes: readonly {
        readonly address: number;
        readonly value: number;
    }[];
}
/** Validate a native effect independently of transport framing or stored JSON.
 * @param {RuntimePPUEffect} effect Claimed physical writes and decision flags.
 * @param {Pick<RuntimeBusFact, "address" | "direction" | "value">} access Completing bus operation.
 * @returns {RuntimePPUEffect} Fresh semantic value with canonical property order, excluding raster.
 */
export declare const normalizeRuntimePPUEffect: (effect: RuntimePPUEffect, access: Pick<RuntimeBusFact, "address" | "direction" | "value">) => RuntimePPUEffect;
/** Bounded examples supplement exact effect and byte-write counts. Repeated offsets count twice. */
export interface RuntimePPUSummary {
    readonly portWrites: number;
    readonly written: number;
    readonly blocked: number;
    readonly latched: number;
    readonly byteWrites: number;
    readonly renderingRestricted: number;
    readonly omittedWrites: number;
    readonly writes: readonly {
        readonly sequence: string;
        readonly actor: RuntimeBusAccess["actor"];
        readonly channel: number | null;
        readonly port: number;
        readonly ppu: RuntimePPUEffect & {
            readonly hcounter: number;
            readonly vcounter: number;
        };
    }[];
}
/** Count already validated effects with a fixed 64-example limit, regardless of archive length.
 * @returns {object} Single-pass accumulator. All effects contribute to the exact totals.
 */
export declare const createRuntimePPUAccumulator: () => {
    push: (access: RuntimeBusAccess) => void;
    finish: () => RuntimePPUSummary;
};
//# sourceMappingURL=runtime-ppu.d.ts.map