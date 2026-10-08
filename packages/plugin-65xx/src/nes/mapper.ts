import type { NesCartridge } from "./cartridge.js";

/** Unknown register values are null. Mapper context is separate from CPU register state. */
export interface NesMapperState {
  readonly select: number | null;
  readonly prgMode: number | null;
  readonly chrMode: number | null;
  readonly banks: readonly (number | null)[];
  readonly ramEnabled: boolean | null;
  readonly ramWritable: boolean | null;
  readonly mirroring: number | null;
  readonly irqLatch: number | null;
  readonly irqEnabled: boolean | null;
}

/** Deterministic ares power-on profile; physical cartridge power-up is not inferred from the header. */
export function initialNesMapperState(): NesMapperState {
  return {
    select: 0,
    prgMode: 0,
    chrMode: 0,
    banks: [0, 0, 0, 0, 0, 0, 0, 0],
    ramEnabled: true,
    ramWritable: true,
    mirroring: 0,
    irqLatch: 0,
    irqEnabled: false,
  };
}

/** Reject unsupported boards before publishing analysis rather than treating them as NROM. */
export function validateNesMapper(rom: NesCartridge): void {
  if (rom.mapper !== 0 && rom.mapper !== 4)
    throw new Error(`NES mapper ${rom.mapper} is not supported; supported mappers are 0 and 4.`);
  if (rom.mapper === 0 && rom.prg.size !== 16384 && rom.prg.size !== 32768)
    throw new Error("NROM requires 16 or 32 KiB PRG ROM.");
  if (
    rom.mapper === 4 &&
    (rom.prg.size < 32768 || rom.prg.size > 524288 || (rom.prg.size & (rom.prg.size - 1)) !== 0)
  )
    throw new Error("MMC3 requires power-of-two PRG ROM from 32 through 512 KiB.");
}

/** CPU bus address to physical PRG offset. Unknown mappings return undefined, never a guessed bank. */
export function nesPrgOffset(
  rom: NesCartridge,
  address: number,
  state: NesMapperState,
): number | undefined {
  if (!Number.isInteger(address) || address < 0x8000 || address > 0xffff) return undefined;
  if (rom.mapper === 0) return (address - 0x8000) % rom.prg.size;
  if (rom.mapper !== 4) return undefined;
  const count = rom.prg.size / 8192;
  const window = (address >>> 13) & 3;
  let bank: number | null = null;
  if (window === 3) bank = count - 1;
  else if (window === 1) bank = state.banks[7];
  else if (state.prgMode !== null) {
    const fixed = (window === 2 && state.prgMode === 0) || (window === 0 && state.prgMode === 1);
    bank = fixed ? count - 2 : state.banks[6];
  }
  if (bank === null || bank === undefined) return undefined;
  return ((bank & 0x3f) % count) * 8192 + (address & 8191);
}

/** MMC3 register writes use the decoded bus alias. Unknown bank data invalidates only the affected selection. */
export function writeNesMapper(
  state: NesMapperState,
  address: number,
  value: number | null,
): NesMapperState {
  if (address < 0x8000) return state;
  const banks = [...state.banks];
  switch (address & 0xe001) {
    case 0x8000:
      if (value === null) return { ...state, select: null, prgMode: null, chrMode: null };
      return { ...state, select: value & 7, prgMode: (value >>> 6) & 1, chrMode: value >>> 7 };
    case 0x8001:
      if (state.select === null) banks.fill(null);
      else banks[state.select] = value;
      return { ...state, banks };
    case 0xa000:
      return { ...state, mirroring: value === null ? null : value & 1 };
    case 0xa001:
      if (value === null) return { ...state, ramEnabled: null, ramWritable: null };
      return { ...state, ramEnabled: Boolean(value & 128), ramWritable: !(value & 64) };
    case 0xc000:
      return { ...state, irqLatch: value };
    case 0xe000:
      return { ...state, irqEnabled: false };
    case 0xe001:
      return { ...state, irqEnabled: true };
    default:
      return state;
  }
}

/** Only PRG mapping participates in execution identity; CHR/IRQ changes do not multiply CPU nodes. */
export function nesExecutionContext(state: NesMapperState): string {
  return `${state.prgMode ?? "?"}:${state.banks[6] ?? "?"}:${state.banks[7] ?? "?"}`;
}
