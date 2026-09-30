import type { RuntimeBusAccess } from "../model/runtime-bus-types.js";
import { normalizeRuntimePPUEffect, type RuntimePPUEffect } from "../model/runtime-ppu-effect.js";

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
    readonly ppu: RuntimePPUEffect & { readonly hcounter: number; readonly vcounter: number };
  }[];
}

/** Count already validated effects with a fixed 64-example limit, regardless of archive length.
 * @returns {object} Single-pass accumulator. All effects contribute to the exact totals.
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
