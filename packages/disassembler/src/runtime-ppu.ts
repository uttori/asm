import type { RuntimeBusAccess, RuntimeBusFact } from "./runtime-bus-types.js";

/** Native PPU decision at one completing port write. Physical byte writes retain
 * order, including repeated destinations; no source instruction or A-bus read is inferred.
 * Raster positions stay in the ordered archive instead of multiplying SQL variants.
 */
export interface RuntimePPUEffect {
  readonly target: "vram" | "cgram" | "oam";
  readonly outcome: "written" | "blocked" | "latched";
  readonly forcedBlank: boolean;
  readonly renderingRestricted: boolean;
  readonly implementation: "accurate" | "performance";
  /** Physical capacity for VRAM; null for CGRAM/OAM. */
  readonly vramBytes: 65536 | 131072 | null;
  readonly bytes: readonly { readonly address: number; readonly value: number }[];
}

/** Validate a native effect independently of transport framing or stored JSON.
 * @param {RuntimePPUEffect} effect Claimed physical writes and decision flags.
 * @param {Pick<RuntimeBusFact, "address" | "direction" | "value">} access Completing bus operation.
 * @returns {RuntimePPUEffect} Fresh semantic value with canonical property order, excluding raster.
 */
export const normalizeRuntimePPUEffect = (
  effect: RuntimePPUEffect,
  access: Pick<RuntimeBusFact, "address" | "direction" | "value">,
): RuntimePPUEffect => {
  const port = access.address & 0xffff;
  let target = "vram";
  if (port === 0x2104) {
    target = "oam";
  }
  if (port === 0x2122) {
    target = "cgram";
  }
  if (
    !effect ||
    access.direction !== "write" ||
    access.address & 0x400000 ||
    ![0x2104, 0x2118, 0x2119, 0x2122].includes(port) ||
    effect.target !== target ||
    !["written", "blocked", "latched"].includes(effect.outcome) ||
    typeof effect.forcedBlank !== "boolean" ||
    typeof effect.renderingRestricted !== "boolean" ||
    (effect.forcedBlank && effect.renderingRestricted) ||
    !["accurate", "performance"].includes(effect.implementation) ||
    (target === "vram"
      ? ![65536, 131072].includes(effect.vramBytes ?? 0)
      : effect.vramBytes !== null) ||
    !Array.isArray(effect.bytes) ||
    effect.bytes.length > 2
  ) {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const count = effect.bytes.length;
  if (
    (effect.outcome === "written" &&
      (count === 0 || (target === "vram" && count !== 1) || (target === "cgram" && count !== 2))) ||
    (effect.outcome !== "written" && count !== 0) ||
    (effect.outcome === "blocked" && (target !== "vram" || !effect.renderingRestricted)) ||
    (effect.outcome === "latched" && (target === "vram" || effect.renderingRestricted))
  ) {
    throw new Error("Invalid native PPU outcome or write count.");
  }
  let bound = effect.vramBytes ?? 0;
  if (target === "cgram") {
    bound = 512;
  }
  if (target === "oam") {
    bound = 544;
  }
  const bytes = effect.bytes.map((byte: RuntimePPUEffect["bytes"][number], i) => {
    if (
      !byte ||
      !Number.isInteger(byte.address) ||
      byte.address < 0 ||
      byte.address >= bound ||
      !Number.isInteger(byte.value) ||
      byte.value < 0 ||
      byte.value > 255 ||
      (target === "vram" && ((byte.address & 1) !== (port & 1) || byte.value !== access.value)) ||
      (target === "cgram" &&
        (i === 0
          ? (byte.address & 1) !== 0
          : byte.address !== effect.bytes[0].address + 1 || byte.value !== (access.value & 127))) ||
      (target === "oam" && i === count - 1 && byte.value !== access.value)
    ) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    return { address: byte.address, value: byte.value };
  });
  return {
    target: effect.target,
    outcome: effect.outcome,
    forcedBlank: effect.forcedBlank,
    renderingRestricted: effect.renderingRestricted,
    implementation: effect.implementation,
    vramBytes: effect.vramBytes,
    bytes,
  };
};

/** Bounded examples supplement exact effect and byte-write counts; repeated offsets count twice. */
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
    readonly ppu: RuntimePPUEffect & { readonly hcounter: number; readonly vcounter: number };
  }[];
}

/** Count already validated effects with a fixed 64-example limit, regardless of archive length.
 * @returns {object} Single-pass accumulator; all effects contribute to the exact totals.
 */
export const createRuntimePPUAccumulator = (): {
  push: (access: RuntimeBusAccess) => void;
  finish: () => RuntimePPUSummary;
} => {
  let portWrites = 0,
    written = 0,
    blocked = 0,
    latched = 0,
    byteWrites = 0,
    renderingRestricted = 0;
  const writes: RuntimePPUSummary["writes"][number][] = [];
  return {
    push: (access) => {
      if (!access.ppu) {
        return;
      }
      const effect = access.ppu;
      portWrites++;
      if (effect.outcome === "written") {
        written++;
      }
      if (effect.outcome === "blocked") {
        blocked++;
      }
      if (effect.outcome === "latched") {
        latched++;
      }
      if (!Number.isSafeInteger(byteWrites + effect.bytes.length)) {
        throw new Error("PPU byte count exceeds safe integer range.");
      }
      byteWrites += effect.bytes.length;
      if (effect.renderingRestricted) {
        renderingRestricted++;
      }
      if (writes.length < 64) {
        writes.push({
          sequence: access.sequence,
          actor: access.actor,
          channel: access.channel,
          port: access.address & 0xffff,
          ppu: {
            ...normalizeRuntimePPUEffect(effect, access),
            hcounter: effect.hcounter,
            vcounter: effect.vcounter,
          },
        });
      }
    },
    finish: () => ({
      portWrites,
      written,
      blocked,
      latched,
      byteWrites,
      renderingRestricted,
      omittedWrites: portWrites - writes.length,
      writes,
    }),
  };
};
