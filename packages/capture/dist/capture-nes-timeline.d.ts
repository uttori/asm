/** A renderer fetch or MMC3 timing event. `cycle` orders observations on the CPU
 * coroutine; `deviceCycle` is the exact source-device master tick in that epoch.
 * Auxiliary devices can run ahead, so these two clocks must not be conflated.
 */
export interface CaptureNesTimelineV2 {
    readonly sequence: string;
    readonly cycle: string;
    readonly deviceCycle: string;
    /** CPU instruction active when observed, not a claim that it caused a render fetch. */
    readonly ordinal: string;
    readonly pc: number;
    readonly address: number;
    readonly dot: number;
    readonly scanline: number;
    readonly timeline: "fetch" | "a12" | "mapper-write" | "irq-pin";
    readonly source: "cpu" | "ppu" | "cartridge";
    readonly value: number;
    readonly mapping: {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
    } | null;
    readonly before: NesMapperIRQ;
    readonly after: NesMapperIRQ;
    readonly mapper: readonly number[];
    readonly cpuIrq: boolean;
}
/** Native MMC3 filter state, rather than a reconstructed scanline counter. */
export interface NesMapperIRQ {
    readonly counter: number;
    readonly latch: number;
    readonly enabled: boolean;
    readonly output: boolean;
    readonly a12: boolean;
    /** Remaining cartridge cycles in the native A12 filter (0–6). */
    readonly delay: number;
    /** MC-ACC three-bit divider, 0–7; zero for ordinary MMC3 boards. */
    readonly pulse: number;
    readonly mcAcc: boolean;
}
/** Decode a fixed kind-5 body after its envelope and sequence have been checked. */
export declare function decodeNesTimeline(r: Buffer): CaptureNesTimelineV2;
//# sourceMappingURL=capture-nes-timeline.d.ts.map