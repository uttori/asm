import { validateNesMapper } from "./capture-nes-mapper.js";

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

function irq(r: Buffer, at: number): NesMapperIRQ {
  if (
    r[at + 2] > 1 ||
    r[at + 3] > 1 ||
    r[at + 4] > 1 ||
    r[at + 5] > 6 ||
    r[at + 6] > 7 ||
    r[at + 7] > 1
  ) {
    throw new Error("Invalid NES mapper IRQ state.");
  }
  return {
    counter: r[at],
    latch: r[at + 1],
    enabled: !!r[at + 2],
    output: !!r[at + 3],
    a12: !!r[at + 4],
    delay: r[at + 5],
    pulse: r[at + 6],
    mcAcc: !!r[at + 7],
  };
}

/** Decode a fixed kind-5 body after its envelope and sequence have been checked. */
export function decodeNesTimeline(r: Buffer): CaptureNesTimelineV2 {
  const kind = r[56],
    space = r[59],
    address = r.readUInt16LE(50);
  if (
    kind > 3 ||
    (kind === 0 && (r[57] !== 1 || !space)) ||
    (kind === 1 && r[57] === 2) ||
    (kind === 2 && r[57] !== 0) ||
    (kind === 3 && (r[57] !== 2 || r[58] !== r[98])) ||
    r[57] > 2 ||
    space > 3 ||
    r[98] > 1 ||
    r.subarray(99).some(Boolean) ||
    r.readUInt16LE(52) > 340 ||
    r.readUInt16LE(54) > 311 ||
    (kind !== 0 && (space || r.readUInt32LE(60))) ||
    (kind <= 1 && address > 0x3fff) ||
    (kind === 1 && r[58]) ||
    (kind === 2 && address < 0xc000) ||
    (kind === 3 && (address || r[58] > 1))
  ) {
    throw new Error("Invalid NES PPU timeline record.");
  }
  const mapper = [...r.subarray(80, 98)];
  validateNesMapper(mapper);
  if (kind !== 0 && mapper[0] !== 4) {
    throw new Error("Mapper timing requires MMC3.");
  }
  const before = irq(r, 64),
    after = irq(r, 72);
  if (kind === 1 && (before.a12 === after.a12 || after.a12 !== !!(address & 0x1000))) {
    throw new Error("Invalid NES A12 transition.");
  }
  return {
    sequence: String(r.readBigUInt64LE(8)),
    cycle: String(r.readBigUInt64LE(24)),
    deviceCycle: String(r.readBigUInt64LE(32)),
    ordinal: String(r.readBigUInt64LE(40)),
    pc: r.readUInt16LE(48),
    address,
    dot: r.readUInt16LE(52),
    scanline: r.readUInt16LE(54),
    timeline: (["fetch", "a12", "mapper-write", "irq-pin"] as const)[kind],
    source: (["cpu", "ppu", "cartridge"] as const)[r[57]],
    value: r[58],
    mapping: space
      ? { space: (["chr-rom", "chr-ram", "ciram"] as const)[space - 1], offset: r.readUInt32LE(60) }
      : null,
    before,
    after,
    mapper,
    cpuIrq: !!r[98],
  };
}
