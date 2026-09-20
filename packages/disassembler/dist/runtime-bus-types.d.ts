import { type RuntimePPUEffect } from "./runtime-ppu.js";
/** The capture distinguishes bus ownership from the instruction that happened to be interrupted. */
export type RuntimeBusContext = "unattributed" | "instruction" | "interrupt" | "wait" | "stop";
/** One byte-access variant. Timing, raster position and instruction ordinals remain in the raw archive. */
export interface RuntimeBusFact {
    /** Physical PPU writes/outcomes, only when explicitly supplied by the producer. */
    readonly ppu?: RuntimePPUEffect;
    readonly addressSpace: "snes.cpu";
    readonly address: number;
    /** Instruction start only in instruction context. Otherwise the observed CPU program counter. */
    readonly pc: number;
    readonly value: number;
    readonly direction: "read" | "write";
    readonly actor: "cpu" | "dma" | "hdma";
    /** CPU accesses have no channel. DMA and HDMA use channels 0–7. */
    readonly channel: number | null;
    readonly phase: "cpu" | "dma" | "hdma-table" | "hdma-indirect" | "hdma-transfer";
    readonly context: RuntimeBusContext;
}
/** Ordered producer event. Decimal strings preserve the full unsigned 64-bit wire values. */
export interface RuntimeBusAccess extends Omit<RuntimeBusFact, "addressSpace" | "ppu"> {
    readonly ppu?: RuntimePPUEffect & {
        readonly hcounter: number;
        readonly vcounter: number;
    };
    readonly sequence: string;
    /** Zero means no owning instruction is available. */
    readonly ordinal: string;
    readonly cycle: string;
    /** Master-clock position within the scanline, in [0, 1368). */
    readonly hcounter: number;
    /** Scanline within the frame, in [0, 313). */
    readonly vcounter: number;
}
/** Validate semantic facts independently of their transport or storage representation.
 * Return the normalization result so importers need not normalize twice. This
 * still checks untrusted PPU fields. The bus importer uses the returned canonical
 * effect for fact identity, keeping transport-only raster fields on the raw event.
 * @param {RuntimeBusFact} fact Byte-access coordinates and attribution.
 * @returns {RuntimePPUEffect | undefined} Canonical PPU effect when present, for reuse by the importer.
 * Throws on inconsistent actor, channel, phase, effect or out-of-range values. Never mutates the input.
 */
export declare const validateRuntimeBusFact: (fact: RuntimeBusFact) => RuntimePPUEffect | undefined;
//# sourceMappingURL=runtime-bus-types.d.ts.map