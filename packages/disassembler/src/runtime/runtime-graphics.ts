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
 * Permute the low VRAM word-address bit groups selected by VMAIN's full-graphic mapping.
 * @param address Sixteen-bit VMADD word address.
 * @param mapping Two-bit VMAIN mapping selector.
 * @returns Mapped word address, before the emulator's physical VRAM mask.
 */
const mapVram = (address: number, mapping: number): number => {
  if (mapping === 0) {
    return address;
  }
  const bits = mapping + 4;
  const lowMask = (1 << bits) - 1;
  const blockMask = (1 << (bits + 3)) - 1;
  return (address & ~blockMask) | ((address & lowMask) << 3) | ((address >> bits) & 7);
};

/**
 * Interpret a validated, complete ordered SNES bus stream without assuming power-on PPU state.
 * Reads advance the relevant port pointers/flip-flops but are not reported as writes. OAM
 * tracking requires observed forced blank and a subsequent address reset: rendering can reset
 * its pointer internally, and the two ares PPUs redirect active-display OAM differently.
 * @returns Session-local accumulator. The importer owns validation and publication.
 */
export const createRuntimeGraphicsAccumulator = (): {
  push: (access: RuntimeBusAccess) => void;
  finish: () => RuntimeGraphicsSummary;
} => {
  let forcedBlank: boolean | null = null;
  let vmain: number | null = null;
  let vramAddress = 0;
  let vramKnown = 0;
  let cgramAddress: number | null = null;
  let cgramHigh: boolean | null = null;
  let cgramLatch: Pick<RuntimeGraphicsByte, "value" | "sourceSequence"> = {
    value: null,
    sourceSequence: null,
  };
  // Bit zero of OAM's base address is always zero. The remaining bits need both address registers.
  let oamBase = 0;
  let oamKnown = 1;
  let oamAddress: number | null = null;
  let oamLatch: Pick<RuntimeGraphicsByte, "value" | "sourceSequence"> = {
    value: null,
    sourceSequence: null,
  };
  const activity = new Map<string, RuntimeGraphicsActivity>();
  const writes: RuntimeGraphicsWrite[] = [];
  let omittedWrites = 0;

  /**
   * Advance after the selected low/high port, including reads and rendering-suppressed writes.
   * @param byte Low port zero or high port one.
   * @returns Invalidates partial address knowledge when an unknown carry/increment is possible.
   */
  const advanceVram = (byte: number): void => {
    if (vmain === null) {
      vramKnown = 0;
    } else if (byte === vmain >> 7) {
      if (vramKnown === 0xffff) {
        vramAddress = (vramAddress + [1, 32, 128, 128][vmain & 3]) & 0xffff;
      } else {
        vramKnown = 0;
      }
    }
  };

  /**
   * CGRAM reads and writes share a flip-flop. Only the high phase increments the color index.
   * @returns Preserves unknown phase/address instead of guessing alignment.
   */
  const advanceCgram = (): void => {
    if (cgramHigh === null) {
      cgramAddress = null;
    } else {
      if (cgramHigh && cgramAddress !== null) {
        cgramAddress = (cgramAddress + 1) & 0xff;
      }
      cgramHigh = !cgramHigh;
    }
  };

  /**
   * Accumulate all writes while retaining only a bounded example list.
   * @param write Fresh interpretation with at most two candidate bytes.
   * @returns Updates fixed actor/channel/target groups.
   */
  const record = (write: RuntimeGraphicsWrite): void => {
    const key = `${write.actor}:${write.channel}:${write.target}`;
    let group = activity.get(key);
    if (!group) {
      group = {
        actor: write.actor,
        channel: write.channel,
        target: write.target,
        portWrites: 0,
        addressed: 0,
        latched: 0,
        unknown: 0,
        byteTargets: 0,
        knownValueTargets: 0,
      };
      activity.set(key, group);
    }
    group.portWrites++;
    group[write.status]++;
    group.byteTargets += write.bytes.length;
    group.knownValueTargets += write.bytes.filter((byte) => byte.value !== null).length;
    // Each validated stream count fits a safe integer, but a paired write emits two candidates.
    if (!Number.isSafeInteger(group.byteTargets)) {
      throw new Error("Graphics byte count exceeds the safe range.");
    }
    if (writes.length < 64) {
      writes.push(write);
    } else {
      omittedWrites++;
    }
  };

  /**
   * Consume actual bus operations, recognizing PPU mirrors only in banks 00–3f and 80–bf.
   * @param access Validated access in global capture order.
   * @returns Mutates bounded PPU state and reports only writes to graphics data ports.
   */
  const push = (access: RuntimeBusAccess): void => {
    if ((access.address & 0x400000) !== 0) {
      return;
    }
    const port = access.address & 0xffff;
    if (port < 0x2100 || port > 0x213f) {
      return;
    }
    const { value } = access;
    if (access.direction === "read") {
      if (port === 0x2139 || port === 0x213a) {
        advanceVram(port - 0x2139);
      } else if (port === 0x213b) {
        advanceCgram();
      } else if (port === 0x2138 && oamAddress !== null) {
        oamAddress = (oamAddress + 1) & 0x3ff;
      }
      return;
    }
    switch (port) {
      case 0x2100:
        // INIDISP can reset OAM on the first vblank line, even when bit 7 stays set.
        // Bus timestamps alone do not pin the accurate PPU's synchronization phase.
        forcedBlank = (value & 0x80) !== 0;
        oamAddress = null;
        return;
      case 0x2102:
      case 0x2103:
        if (port === 0x2102) {
          oamBase = (oamBase & 0x200) | (value << 1);
          oamKnown |= 0x1fe;
        } else {
          oamBase = (oamBase & 0x1ff) | ((value & 1) << 9);
          oamKnown |= 0x200;
        }
        oamAddress = forcedBlank === true && oamKnown === 0x3ff ? oamBase : null;
        return;
      case 0x2115:
        vmain = value;
        return;
      case 0x2116:
        vramAddress = (vramAddress & 0xff00) | value;
        vramKnown |= 0xff;
        return;
      case 0x2117:
        vramAddress = (vramAddress & 0xff) | (value << 8);
        vramKnown |= 0xff00;
        return;
      case 0x2121:
        cgramAddress = value;
        cgramHigh = false;
        return;
    }
    if (port !== 0x2118 && port !== 0x2119 && port !== 0x2122 && port !== 0x2104) {
      return;
    }
    const data = { value, sourceSequence: access.sequence };
    const base = {
      sequence: access.sequence,
      actor: access.actor,
      channel: access.channel,
      port,
      value,
      forcedBlank,
    };
    if (port === 0x2118 || port === 0x2119) {
      const byte = port - 0x2118;
      if (vmain !== null && vramKnown === 0xffff) {
        const address = mapVram(vramAddress, (vmain >> 2) & 3) * 2 + byte;
        record({ ...base, target: "vram", status: "addressed", bytes: [{ address, ...data }] });
      } else {
        record({
          ...base,
          target: "vram",
          status: "unknown",
          reason: "missing-vram-registers",
          bytes: [],
        });
      }
      advanceVram(byte);
    } else if (port === 0x2122) {
      if (cgramHigh === false) {
        cgramLatch = data;
        record({ ...base, target: "cgram", status: "latched", bytes: [] });
      } else if (cgramHigh === true && cgramAddress !== null) {
        record({
          ...base,
          target: "cgram",
          status: "addressed",
          bytes: [
            { address: cgramAddress * 2, ...cgramLatch },
            { address: cgramAddress * 2 + 1, ...data, value: value & 0x7f },
          ],
        });
      } else {
        // An unknown phase might have replaced the low-byte latch with this write.
        cgramLatch = { value: null, sourceSequence: null };
        record({
          ...base,
          target: "cgram",
          status: "unknown",
          reason: "missing-cgram-state",
          bytes: [],
        });
      }
      advanceCgram();
    } else if (oamAddress === null) {
      // Rendering/unknown alignment may have replaced the write latch. Address-register
      // writes do not reset that latch, so invalidate its data independently of the pointer.
      oamLatch = { value: null, sourceSequence: null };
      record({ ...base, target: "oam", status: "unknown", reason: "missing-oam-state", bytes: [] });
    } else {
      const address = oamAddress;
      oamAddress = (address + 1) & 0x3ff;
      if ((address & 1) === 0) {
        oamLatch = data;
      }
      if (address & 0x200) {
        // The high table writes immediately and mirrors every 32 bytes. Even high-table
        // writes also replace the latch later consumed by an odd low-table write.
        record({
          ...base,
          target: "oam",
          status: "addressed",
          bytes: [{ address: 0x200 | (address & 0x1f), ...data }],
        });
      } else if (address & 1) {
        record({
          ...base,
          target: "oam",
          status: "addressed",
          bytes: [
            { address: address - 1, ...oamLatch },
            { address, ...data },
          ],
        });
      } else {
        record({ ...base, target: "oam", status: "latched", bytes: [] });
      }
    }
  };

  return {
    push,
    finish: () => ({
      model: "snes-ppu-ports-v1",
      activity: [...activity.entries()]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([, group]) => group),
      writes,
      omittedWrites,
    }),
  };
};
