/** Common SNES CPU-visible hardware registers used in effective-address explanations. */
const FIXED_REGISTERS: Readonly<Record<number, string>> = Object.freeze({
  0x2100: "INIDISP",
  0x2101: "OBSEL",
  0x2102: "OAMADDL",
  0x2103: "OAMADDH",
  0x2104: "OAMDATA",
  0x2105: "BGMODE",
  0x2106: "MOSAIC",
  0x2107: "BG1SC",
  0x2108: "BG2SC",
  0x2109: "BG3SC",
  0x210a: "BG4SC",
  0x210b: "BG12NBA",
  0x210c: "BG34NBA",
  0x210d: "BG1HOFS",
  0x210e: "BG1VOFS",
  0x2115: "VMAIN",
  0x2116: "VMADDL",
  0x2117: "VMADDH",
  0x2118: "VMDATAL",
  0x2119: "VMDATAH",
  0x2121: "CGADD",
  0x2122: "CGDATA",
  0x2134: "MPYL",
  0x2137: "SLHV",
  0x2138: "OAMDATAREAD",
  0x2139: "VMDATALREAD",
  0x213a: "VMDATAHREAD",
  0x213b: "CGDATAREAD",
  0x213c: "OPHCT",
  0x213d: "OPVCT",
  0x213e: "STAT77",
  0x213f: "STAT78",
  0x2140: "APUIO0",
  0x2141: "APUIO1",
  0x2142: "APUIO2",
  0x2143: "APUIO3",
  0x2180: "WMDATA",
  0x2181: "WMADDL",
  0x2182: "WMADDM",
  0x2183: "WMADDH",
  0x4016: "JOYSER0",
  0x4017: "JOYSER1",
  0x4200: "NMITIMEN",
  0x4201: "WRIO",
  0x4202: "WRMPYA",
  0x4203: "WRMPYB",
  0x4204: "WRDIVL",
  0x4205: "WRDIVH",
  0x4206: "WRDIVB",
  0x4207: "HTIMEL",
  0x4208: "HTIMEH",
  0x4209: "VTIMEL",
  0x420a: "VTIMEH",
  0x420b: "MDMAEN",
  0x420c: "HDMAEN",
  0x420d: "MEMSEL",
  0x4210: "RDNMI",
  0x4211: "TIMEUP",
  0x4212: "HVBJOY",
  0x4213: "RDIO",
  0x4214: "RDDIVL",
  0x4215: "RDDIVH",
  0x4216: "RDMPYL",
  0x4217: "RDMPYH",
  0x4218: "JOY1L",
  0x4219: "JOY1H",
  0x421a: "JOY2L",
  0x421b: "JOY2H",
  0x421c: "JOY3L",
  0x421d: "JOY3H",
  0x421e: "JOY4L",
  0x421f: "JOY4H",
});

const DMA_REGISTER_NAMES = [
  "DMAP",
  "BBAD",
  "A1TL",
  "A1TH",
  "A1B",
  "DASL",
  "DASH",
  "DASB",
  "A2AL",
  "A2AH",
  "NTRL",
] as const;

export interface SnesHardwareRegister {
  /** 24-bit CPU address that was queried (bank is preserved). */
  readonly address: number;
  /** Official register name (`INIDISP`, `DMAP0`, …). */
  readonly symbol: string;
  /** Always true; MMIO is never treated as ROM or a static effective address. */
  readonly volatile: true;
}

/**
 * Returns a hardware symbol only for CPU I/O banks `$00–$3F` / `$80–$BF`.
 * ROM mirrors of those banks are never classified as I/O. DMA/HDMA channels
 * `$4300–$437F` become `DMAP0`…`NTRL7`.
 * @param {number} address 24-bit SNES CPU bus address.
 * @returns {SnesHardwareRegister | undefined} Volatile register identity, or `undefined` if not MMIO.
 */
export const identifySnesHardwareRegister = (address: number): SnesHardwareRegister | undefined => {
  const bank = (address >>> 16) & 0xff;
  if (!(bank <= 0x3f || (bank >= 0x80 && bank <= 0xbf))) return undefined;
  const low = address & 0xffff;
  const fixed = FIXED_REGISTERS[low];
  if (fixed) return { address, symbol: fixed, volatile: true };
  if (low >= 0x4300 && low <= 0x437f) {
    const channel = (low - 0x4300) >>> 4;
    const register = (low - 0x4300) & 0x0f;
    const name = DMA_REGISTER_NAMES[register];
    if (name) return { address, symbol: `${name}${channel}`, volatile: true };
  }
  return undefined;
};

/** 16-bit PPU/CPU/APU/joypad register names keyed by `$2100`–`$421F` offsets. */
export const snesHardwareRegisterSymbols = Object.freeze({ ...FIXED_REGISTERS });
