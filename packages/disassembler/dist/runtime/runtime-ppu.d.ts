import type { RuntimeBusAccess } from "../model/runtime-bus-types.js";
import { type RuntimePPUEffect } from "../model/runtime-ppu-effect.js";
/** Bounded examples supplement exact effect and byte-write counts. Repeated offsets count twice. */
export interface RuntimePPUSummary {
    /** Count of completing PPU port writes that carried a normalized effect. */
    readonly portWrites: number;
    /** Port writes whose outcome was a physical byte landing. */
    readonly written: number;
    /** Port writes blocked by blanking or rendering restrictions. */
    readonly blocked: number;
    /** Port writes that only latched a pending transfer without landing bytes. */
    readonly latched: number;
    /** Total physical byte writes across all written outcomes. */
    readonly byteWrites: number;
    /** Port writes where rendering rules restricted the update. */
    readonly renderingRestricted: number;
    /** Port writes beyond the fixed example cap that still contribute to exact totals. */
    readonly omittedWrites: number;
    /** First retained example port writes with raster positions attached. */
    readonly writes: readonly {
        /** Ordered bus sequence id for the example write. */
        readonly sequence: string;
        /** Bus actor that completed the example port write. */
        readonly actor: RuntimeBusAccess["actor"];
        /** DMA channel when applicable; otherwise null. */
        readonly channel: number | null;
        /** CPU I/O port address for the example write. */
        readonly port: number;
        /** Normalized PPU effect plus raster coordinates at completion. */
        readonly ppu: RuntimePPUEffect & {
            readonly hcounter: number;
            readonly vcounter: number;
        };
    }[];
}
/**
 * Count already validated effects with a fixed 64-example limit, regardless of archive length.
 * @returns Single-pass accumulator. All effects contribute to the exact totals.
 */
export declare const createRuntimePPUAccumulator: () => {
    push: (access: RuntimeBusAccess) => void;
    finish: () => RuntimePPUSummary;
};
//# sourceMappingURL=runtime-ppu.d.ts.map