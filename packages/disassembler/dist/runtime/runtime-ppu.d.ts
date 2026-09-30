import type { RuntimeBusAccess } from "../model/runtime-bus-types.js";
import { type RuntimePPUEffect } from "../model/runtime-ppu-effect.js";
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