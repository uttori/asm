/**
 * A renderer fetch or MMC3 timing event. `cycle` orders observations on the CPU
 * coroutine; `deviceCycle` is the exact source-device master tick in that epoch.
 * Auxiliary devices can run ahead, so these two clocks must not be conflated.
 */
export interface CaptureNesTimelineV2 {
    /** Monotonic capture sequence id for this observation. */
    readonly sequence: string;
    /** CPU-coroutine cycle count for ordering, as a decimal string. */
    readonly cycle: string;
    /** Exact source-device master tick in the same epoch as `cycle`. */
    readonly deviceCycle: string;
    /** CPU instruction active when observed, not a claim that it caused a render fetch. */
    readonly ordinal: string;
    /** Program counter at the observation boundary. */
    readonly pc: number;
    /** Logical bus or device address for the observation. */
    readonly address: number;
    /** PPU dot (0–340) at the observation. */
    readonly dot: number;
    /** PPU scanline at the observation. */
    readonly scanline: number;
    /** Kind of renderer fetch or MMC3 timing event. */
    readonly timeline: "fetch" | "a12" | "mapper-write" | "irq-pin";
    /** Current native or authoring source path being converted. */
    readonly source: "cpu" | "ppu" | "cartridge";
    /** Data byte or register value observed on the bus. */
    readonly value: number;
    /** Physical CHR/CIRAM translation of the PPU address, or null when unknown. */
    readonly mapping: {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
    } | null;
    /** Device state immediately before the observation. */
    readonly before: NesMapperIRQ;
    /** Device state immediately after the observation. */
    readonly after: NesMapperIRQ;
    /** Mapper number or register snapshot. */
    readonly mapper: readonly number[];
    /** Whether the CPU IRQ pin is asserted after the event. */
    readonly cpuIrq: boolean;
}
/** Native MMC3 filter state, rather than a reconstructed scanline counter. */
export interface NesMapperIRQ {
    /** Native MMC3 IRQ counter. */
    readonly counter: number;
    /** Native MMC3 IRQ reload latch. */
    readonly latch: number;
    /** Whether the MMC3 IRQ is enabled. */
    readonly enabled: boolean;
    /** Whether the MMC3 IRQ output is asserted. */
    readonly output: boolean;
    /** Filtered A12 level at the observation. */
    readonly a12: boolean;
    /** Remaining cartridge cycles in the native A12 filter (0–6). */
    readonly delay: number;
    /** MC-ACC three-bit divider, 0–7; zero for ordinary MMC3 boards. */
    readonly pulse: number;
    /** True when the board uses the MC-ACC A12 filter variant. */
    readonly mcAcc: boolean;
}
/** Decode a fixed kind-5 body after its envelope and sequence have been checked. */
export declare function decodeNesTimeline(r: Buffer): CaptureNesTimelineV2;
//# sourceMappingURL=capture-nes-timeline.d.ts.map