import { normalizeRuntimePPUEffect, type RuntimePPUEffect } from "./runtime-ppu-effect.js";

/** The capture distinguishes bus ownership from the instruction that happened to be interrupted. */
export type RuntimeBusContext = "unattributed" | "instruction" | "interrupt" | "wait" | "stop";

/** One byte-access variant. Timing, raster position and instruction ordinals remain in the raw archive. */
export interface RuntimeBusFact {
  /** Physical PPU writes/outcomes, only when explicitly supplied by the producer. */
  readonly ppu?: RuntimePPUEffect;
  /** Only the SNES CPU bus is captured. */
  readonly addressSpace: "snes.cpu";
  /** 24-bit CPU bus address. */
  readonly address: number;
  /** Instruction start only in instruction context. Otherwise the observed CPU program counter. */
  readonly pc: number;
  /** Byte transferred on the bus (0-255). */
  readonly value: number;
  /** Bus direction; HDMA table and indirect phases are always reads. */
  readonly direction: "read" | "write";
  /** Bus master that performed the access. */
  readonly actor: "cpu" | "dma" | "hdma";
  /** CPU accesses have no channel. DMA and HDMA use channels 0–7. */
  readonly channel: number | null;
  /** Transfer phase; must agree with actor (cpu, dma, or one of the hdma phases). */
  readonly phase: "cpu" | "dma" | "hdma-table" | "hdma-indirect" | "hdma-transfer";
  /** CPU execution state that owned the bus when the access occurred. */
  readonly context: RuntimeBusContext;
}

/** Ordered producer event. Decimal strings preserve the full unsigned 64-bit wire values. */
export interface RuntimeBusAccess extends Omit<RuntimeBusFact, "addressSpace" | "ppu"> {
  /** PPU effect with the raster position at which it was applied. */
  readonly ppu?: RuntimePPUEffect & { readonly hcounter: number; readonly vcounter: number };
  /** Producer event sequence number, unsigned 64-bit decimal. */
  readonly sequence: string;
  /** Zero means no owning instruction is available. */
  readonly ordinal: string;
  /** Producer clock cycle of the access, unsigned 64-bit decimal. */
  readonly cycle: string;
  /** Master-clock position within the scanline, in [0, 1368). */
  readonly hcounter: number;
  /** Scanline within the frame, in [0, 313). */
  readonly vcounter: number;
}

/**
 * Accept any integral number.
 * @param value Candidate value.
 * @returns Whether value is an integer.
 */
function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Validate semantic facts independently of their transport or storage representation.
 * Return the normalization result so importers need not normalize twice. This
 * still checks untrusted PPU fields. The bus importer uses the returned canonical
 * effect for fact identity, keeping transport-only raster fields on the raw event.
 * @param fact Byte-access coordinates and attribution.
 * @returns Canonical PPU effect when present, for reuse by the importer.
 * Throws on inconsistent actor, channel, phase, effect or out-of-range values. Never mutates the input.
 */
export const validateRuntimeBusFact = (fact: {
  addressSpace: unknown;
  address: unknown;
  pc: unknown;
  value: unknown;
  direction: unknown;
  actor: unknown;
  channel: unknown;
  phase: unknown;
  context: unknown;
  ppu?: unknown;
}): RuntimePPUEffect | undefined => {
  const address = fact.address;
  const pc = fact.pc;
  const value = fact.value;
  const direction = fact.direction;
  const context = fact.context;
  if (
    fact.addressSpace !== "snes.cpu" ||
    !(isInteger(address) && address >= 0 && address <= 0xffffff) ||
    !(isInteger(pc) && pc >= 0 && pc <= 0xffffff) ||
    !(isInteger(value) && value >= 0 && value <= 0xff) ||
    (direction !== "read" && direction !== "write") ||
    (context !== "unattributed" &&
      context !== "instruction" &&
      context !== "interrupt" &&
      context !== "wait" &&
      context !== "stop")
  ) {
    throw new Error("Invalid bus access coordinates, value, direction or context.");
  }
  const actor = fact.actor;
  const channel = fact.channel;
  const phase = fact.phase;
  if (actor === "cpu") {
    if (channel !== null || phase !== "cpu") {
      throw new Error("CPU bus accesses require a null channel and CPU phase.");
    }
  } else {
    if (!(isInteger(channel) && channel >= 0 && channel <= 7)) {
      throw new Error("DMA/HDMA bus accesses require a channel in [0, 7].");
    }
    if (actor === "dma") {
      if (phase !== "dma") {
        throw new Error("DMA bus access has an invalid phase.");
      }
    } else if (actor === "hdma") {
      if (phase !== "hdma-table" && phase !== "hdma-indirect" && phase !== "hdma-transfer") {
        throw new Error("HDMA bus access has an invalid phase.");
      }
      // Table and indirect-pointer fetches are metadata reads, never transfer writes.
      if (phase !== "hdma-transfer" && direction !== "read") {
        throw new Error("HDMA table and indirect phases must be reads.");
      }
    } else {
      throw new Error("Unknown bus access actor.");
    }
  }
  if (fact.ppu !== undefined) {
    return normalizeRuntimePPUEffect(fact.ppu, { address, direction, value });
  }
  return undefined;
};
