export { validateNesMapper } from "./capture-nes-mapper.js";
import { type CaptureNesTimelineV2 } from "./capture-nes-timeline.js";
/** NES PPU registers observed without reading emulated I/O. Control is effective state:
 * its low two bits follow the temporary scroll register, not the last PPUCTRL byte.
 */
export interface NesPPUState {
    readonly v: number;
    readonly t: number;
    readonly busAddress: number;
    readonly fineX: number;
    readonly writeLatch: number;
    readonly readBuffer: number;
    readonly oamAddress: number;
}
/** One actual CPU-bus operation. DMA dummy reads are distinct from payload reads.
 * Physical PRG offsets are relative to PRG-ROM, excluding the header and trainer.
 */
export interface CaptureNesBusAccessV2 {
    readonly sequence: string;
    readonly ordinal: string;
    readonly cycle: string;
    readonly pc: number;
    readonly address: number;
    readonly value: number;
    readonly direction: "read" | "write";
    readonly actor: "cpu" | "oam-dma" | "dmc-dma" | "dma-dummy";
    readonly context: "unattributed" | "instruction" | "interrupt";
    /** Pre-access read-window translation, including mapper-register writes; not a ROM write destination. */
    readonly prgOffset: number | null;
    readonly pcPrgOffset: number | null;
    /** After-access native mapper dictionary, shared with NES instruction state. */
    readonly mapper: readonly number[];
    /** PPU dots (0–340), not CPU or master clocks. */
    readonly dot: number;
    readonly scanline: number;
    readonly before: NesPPUState;
    readonly after: NesPPUState;
    readonly control: number;
    readonly mask: number;
    readonly status: number;
    /** After-access lines: bit 0 cartridge IRQ, bit 1 NMI, bit 2 APU IRQ. */
    readonly lines: number;
    /** Translation of the pre-access PPU address bus, not proof of a PPU read. */
    readonly ppuMapping: {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
    } | null;
    readonly effect: {
        readonly target: "chr-ram" | "ciram" | "palette" | "oam" | "chr-rom";
        readonly outcome: "written" | "blocked";
        /** Physical destinations in execution order; palette alias writes are both retained. */
        readonly bytes: readonly {
            readonly offset: number;
            readonly value: number;
        }[];
    } | null;
}
/** Decode the ten-byte PPU address/latch tuple shared by NPP1 and ACT2. */
export declare function decodeNesPPUState(bytes: Buffer, offset: number): NesPPUState;
/** Decode kind-4 bus and kind-5 timeline records only after the common envelope/session/CRC has been validated. */
export declare function decodeNesBusRecords(b: Buffer, first: bigint, count: number): readonly (CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
//# sourceMappingURL=capture-nes-ppu.d.ts.map