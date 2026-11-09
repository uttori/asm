import type { RuntimeBusAccess } from "../model/runtime-bus-types.js";
/** Port interpretation only: rendering restrictions and physical VRAM size are not in the stream. */
export type RuntimeGraphicsTarget = "vram" | "cgram" | "oam";
/**
 * A byte destination selected by the captured registers, before rendering-time redirection.
 * VRAM uses a 17-bit byte address before the physical 64/128 KiB mask. CGRAM and OAM
 * use byte offsets in their 512/544-byte arrays. Null data means an unobserved latch value.
 */
export interface RuntimeGraphicsByte {
    /** Byte offset within the selected graphics target array. */
    readonly address: number;
    /** Observed data byte, or null when only the address was latched. */
    readonly value: number | null;
    /** Data-supplying write, which can precede the completing write and belong to another actor. */
    readonly sourceSequence: string | null;
}
/** One observed data-port write. Addressed bytes are candidates, never proof of a memory update. */
export interface RuntimeGraphicsWrite {
    /** Ordered bus sequence id for the completing port write. */
    readonly sequence: string;
    /** Bus actor that issued the completing port write. */
    readonly actor: RuntimeBusAccess["actor"];
    /** DMA channel when the actor is DMA or HDMA; otherwise null. */
    readonly channel: number | null;
    /** Graphics memory target selected by the port write. */
    readonly target: RuntimeGraphicsTarget;
    /** CPU I/O port address for the completing write. */
    readonly port: number;
    /** Data byte written to the port. */
    readonly value: number;
    /** Last observed INIDISP bit 7, or null before any write to that register. */
    readonly forcedBlank: boolean | null;
    /** Whether byte destinations were resolved, only latched, or unknown. */
    readonly status: "addressed" | "latched" | "unknown";
    /** Missing register state explaining an unknown reconstruction, when applicable. */
    readonly reason?: "missing-vram-registers" | "missing-cgram-state" | "missing-oam-state";
    /** At most two bytes. Latch-only and unknown writes have no destinations. */
    readonly bytes: readonly RuntimeGraphicsByte[];
}
/** Counts completing port writes by actor/channel/target, not source reads or whole transfers. */
export interface RuntimeGraphicsActivity {
    /** Bus actor whose port writes are aggregated. */
    readonly actor: RuntimeBusAccess["actor"];
    /** DMA channel when applicable; otherwise null for CPU activity. */
    readonly channel: number | null;
    /** Graphics target whose port writes are aggregated. */
    readonly target: RuntimeGraphicsTarget;
    /** Completing data-port writes counted for the group. */
    portWrites: number;
    /** Writes that resolved at least one byte destination. */
    addressed: number;
    /** Writes that only advanced latch state without destinations. */
    latched: number;
    /** Writes whose destination could not be reconstructed from captured state. */
    unknown: number;
    /** Counts byte candidates, including a latched byte emitted by a later write. */
    byteTargets: number;
    /** Byte candidates whose data-supplying write was also captured. */
    knownValueTargets: number;
}
/** Bounded, recomputable view. Neither this summary nor its examples are persisted as bus facts. */
export interface RuntimeGraphicsSummary {
    /** Reconstruction model identifier for the port-tracking algorithm. */
    readonly model: "snes-ppu-ports-v1";
    /** At most 51 groups: CPU plus eight DMA and eight HDMA channels, each with three targets. */
    readonly activity: readonly RuntimeGraphicsActivity[];
    /** First 64 port writes in capture order. Every write still contributes to activity totals. */
    readonly writes: readonly RuntimeGraphicsWrite[];
    /** Additional port writes omitted from the example list after the cap. */
    readonly omittedWrites: number;
}
/**
 * Interpret a validated, complete ordered SNES bus stream without assuming power-on PPU state.
 * Reads advance the relevant port pointers/flip-flops but are not reported as writes. OAM
 * tracking requires observed forced blank and a subsequent address reset: rendering can reset
 * its pointer internally, and the two ares PPUs redirect active-display OAM differently.
 * @returns Session-local accumulator. The importer owns validation and publication.
 */
export declare const createRuntimeGraphicsAccumulator: () => {
    push: (access: RuntimeBusAccess) => void;
    finish: () => RuntimeGraphicsSummary;
};
//# sourceMappingURL=runtime-graphics.d.ts.map