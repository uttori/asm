import type { RuntimeBusAccess } from "./runtime-bus-types.js";
/** Port interpretation only: rendering restrictions and physical VRAM size are not in the stream. */
export type RuntimeGraphicsTarget = "vram" | "cgram" | "oam";
/** A byte destination selected by the captured registers, before rendering-time redirection.
 * VRAM uses a 17-bit byte address before the physical 64/128 KiB mask; CGRAM and OAM
 * use byte offsets in their 512/544-byte arrays. Null data means an unobserved latch value.
 */
export interface RuntimeGraphicsByte {
    readonly address: number;
    readonly value: number | null;
    /** Data-supplying write, which can precede the completing write and belong to another actor. */
    readonly sourceSequence: string | null;
}
/** One observed data-port write; addressed bytes are candidates, never proof of a memory update. */
export interface RuntimeGraphicsWrite {
    readonly sequence: string;
    readonly actor: RuntimeBusAccess["actor"];
    readonly channel: number | null;
    readonly target: RuntimeGraphicsTarget;
    readonly port: number;
    readonly value: number;
    /** Last observed INIDISP bit 7, or null before any write to that register. */
    readonly forcedBlank: boolean | null;
    readonly status: "addressed" | "latched" | "unknown";
    readonly reason?: "missing-vram-registers" | "missing-cgram-state" | "missing-oam-state";
    /** At most two bytes; latch-only and unknown writes have no destinations. */
    readonly bytes: readonly RuntimeGraphicsByte[];
}
/** Counts completing port writes by actor/channel/target, not source reads or whole transfers. */
export interface RuntimeGraphicsActivity {
    readonly actor: RuntimeBusAccess["actor"];
    readonly channel: number | null;
    readonly target: RuntimeGraphicsTarget;
    portWrites: number;
    addressed: number;
    latched: number;
    unknown: number;
    /** Counts byte candidates, including a latched byte emitted by a later write. */
    byteTargets: number;
    /** Byte candidates whose data-supplying write was also captured. */
    knownValueTargets: number;
}
/** Bounded, recomputable view; neither this summary nor its examples are persisted as bus facts. */
export interface RuntimeGraphicsSummary {
    readonly model: "snes-ppu-ports-v1";
    /** At most 51 groups: CPU plus eight DMA and eight HDMA channels, each with three targets. */
    readonly activity: readonly RuntimeGraphicsActivity[];
    /** First 64 port writes in capture order; every write still contributes to activity totals. */
    readonly writes: readonly RuntimeGraphicsWrite[];
    readonly omittedWrites: number;
}
/** Interpret a validated, complete ordered SNES bus stream without assuming power-on PPU state.
 * Reads advance the relevant port pointers/flip-flops but are not reported as writes. OAM
 * tracking requires observed forced blank and a subsequent address reset: rendering can reset
 * its pointer internally, and the two ares PPUs redirect active-display OAM differently.
 * @returns {object} Session-local accumulator; the importer owns validation and publication.
 */
export declare const createRuntimeGraphicsAccumulator: () => {
    push: (access: RuntimeBusAccess) => void;
    finish: () => RuntimeGraphicsSummary;
};
//# sourceMappingURL=runtime-graphics.d.ts.map