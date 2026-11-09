export { validateNesMapper } from "./capture-nes-mapper.js";
import { type CaptureNesTimelineV2 } from "./capture-nes-timeline.js";
/**
 * NES PPU registers observed without reading emulated I/O. Control is effective state:
 * its low two bits follow the temporary scroll register, not the last PPUCTRL byte.
 */
export interface NesPPUState {
    /** Current 15-bit PPU v register after the access. */
    readonly v: number;
    /** Temporary 15-bit PPU t register after the access. */
    readonly t: number;
    /** Address currently driven on the PPU address bus. */
    readonly busAddress: number;
    /** Fine-X scroll (0–7) after the access. */
    readonly fineX: number;
    /** PPU write toggle (w); 0 or 1. */
    readonly writeLatch: number;
    /** Buffered PPUDATA read value. */
    readonly readBuffer: number;
    /** OAMADDR after the access. */
    readonly oamAddress: number;
}
/**
 * One actual CPU-bus operation. DMA dummy reads are distinct from payload reads.
 * Physical PRG offsets are relative to PRG-ROM, excluding the header and trainer.
 */
export interface CaptureNesBusAccessV2 {
    /** Monotonic capture sequence id for this observation. */
    readonly sequence: string;
    /** CPU instruction ordinal active at the observation. */
    readonly ordinal: string;
    /** CPU-coroutine cycle count for ordering, as a decimal string. */
    readonly cycle: string;
    /** Program counter at the observation boundary. */
    readonly pc: number;
    /** Logical bus or device address for the observation. */
    readonly address: number;
    /** Data byte or register value observed on the bus. */
    readonly value: number;
    /** Bus operation kind for this access. */
    readonly direction: "read" | "write";
    /** Hardware actor that issued the access. */
    readonly actor: "cpu" | "oam-dma" | "dmc-dma" | "dma-dummy";
    /** Whether the access is attributed to an instruction, interrupt, or neither. */
    readonly context: "unattributed" | "instruction" | "interrupt";
    /** Pre-access read-window translation, including mapper-register writes; not a ROM write destination. */
    readonly prgOffset: number | null;
    /** Physical PRG-ROM offset of PC, excluding header and trainer; null when unmapped. */
    readonly pcPrgOffset: number | null;
    /** After-access native mapper dictionary, shared with NES instruction state. */
    readonly mapper: readonly number[];
    /** PPU dots (0–340), not CPU or master clocks. */
    readonly dot: number;
    /** PPU scanline at the observation. */
    readonly scanline: number;
    /** Device state immediately before the observation. */
    readonly before: NesPPUState;
    /** Device state immediately after the observation. */
    readonly after: NesPPUState;
    /** Effective PPUCTRL, with nametable bits taken from t rather than the last $2000 write. */
    readonly control: number;
    /** PPUMASK after the access. */
    readonly mask: number;
    /** PPUSTATUS after the access. */
    readonly status: number;
    /** After-access lines: bit 0 cartridge IRQ, bit 1 NMI, bit 2 APU IRQ. */
    readonly lines: number;
    /** Translation of the pre-access PPU address bus, not proof of a PPU read. */
    readonly ppuMapping: {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
    } | null;
    /** Physical write reconstruction when the access targeted PPU memory; null otherwise. */
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