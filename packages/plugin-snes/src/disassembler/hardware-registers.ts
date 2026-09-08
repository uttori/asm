export interface SnesHardwareDefine {
  /** Conventional assembler symbol. */
  readonly symbol: string;
  /** 16-bit CPU I/O address. */
  readonly address: number;
  /** Human-readable hover documentation emitted as a trailing source comment. */
  readonly description: string;
}

/** Common SNES CPU-visible hardware registers used by source export and tooling. */
const FIXED_REGISTER_DEFINITIONS = [
  {
    symbol: "INIDISP",
    address: 0x2100,
    description: "Display control: forced blank and master brightness.",
  },
  {
    symbol: "OBJSEL",
    address: 0x2101,
    description: "Object size and character-data base addresses.",
  },
  { symbol: "OAMADDL", address: 0x2102, description: "OAM address, low byte." },
  {
    symbol: "OAMADDH",
    address: 0x2103,
    description: "OAM address high bit and priority rotation.",
  },
  { symbol: "OAMDATA", address: 0x2104, description: "OAM data write port." },
  { symbol: "BGMODE", address: 0x2105, description: "Background mode and BG character size." },
  { symbol: "MOSAIC", address: 0x2106, description: "Mosaic size and per-background enable." },
  { symbol: "BG1SC", address: 0x2107, description: "BG1 tilemap base address and screen size." },
  { symbol: "BG2SC", address: 0x2108, description: "BG2 tilemap base address and screen size." },
  { symbol: "BG3SC", address: 0x2109, description: "BG3 tilemap base address and screen size." },
  { symbol: "BG4SC", address: 0x210a, description: "BG4 tilemap base address and screen size." },
  { symbol: "BG12NBA", address: 0x210b, description: "BG1 and BG2 character-data base addresses." },
  { symbol: "BG34NBA", address: 0x210c, description: "BG3 and BG4 character-data base addresses." },
  {
    symbol: "BG1HOFS",
    address: 0x210d,
    description: "BG1 horizontal scroll, write twice; also Mode 7 horizontal offset.",
  },
  {
    symbol: "BG1VOFS",
    address: 0x210e,
    description: "BG1 vertical scroll, write twice; also Mode 7 vertical offset.",
  },
  { symbol: "BG2HOFS", address: 0x210f, description: "BG2 horizontal scroll, write twice." },
  { symbol: "BG2VOFS", address: 0x2110, description: "BG2 vertical scroll, write twice." },
  { symbol: "BG3HOFS", address: 0x2111, description: "BG3 horizontal scroll, write twice." },
  { symbol: "BG3VOFS", address: 0x2112, description: "BG3 vertical scroll, write twice." },
  { symbol: "BG4HOFS", address: 0x2113, description: "BG4 horizontal scroll, write twice." },
  { symbol: "BG4VOFS", address: 0x2114, description: "BG4 vertical scroll, write twice." },
  {
    symbol: "VMAIN",
    address: 0x2115,
    description: "VRAM address increment mode and word mapping.",
  },
  { symbol: "VMADDL", address: 0x2116, description: "VRAM address, low byte." },
  { symbol: "VMADDH", address: 0x2117, description: "VRAM address, high byte." },
  { symbol: "VMDATAL", address: 0x2118, description: "VRAM data write port, low byte." },
  { symbol: "VMDATAH", address: 0x2119, description: "VRAM data write port, high byte." },
  { symbol: "M7SEL", address: 0x211a, description: "Mode 7 screen-over and mirroring settings." },
  {
    symbol: "M7A",
    address: 0x211b,
    description: "Mode 7 matrix parameter A, write twice; multiplication operand.",
  },
  {
    symbol: "M7B",
    address: 0x211c,
    description: "Mode 7 matrix parameter B, write twice; multiplication operand.",
  },
  { symbol: "M7C", address: 0x211d, description: "Mode 7 matrix parameter C, write twice." },
  { symbol: "M7D", address: 0x211e, description: "Mode 7 matrix parameter D, write twice." },
  { symbol: "M7X", address: 0x211f, description: "Mode 7 center coordinate X, write twice." },
  { symbol: "M7Y", address: 0x2120, description: "Mode 7 center coordinate Y, write twice." },
  { symbol: "CGADD", address: 0x2121, description: "CGRAM palette address." },
  { symbol: "CGDATA", address: 0x2122, description: "CGRAM palette data write port, write twice." },
  { symbol: "W12SEL", address: 0x2123, description: "Window mask settings for BG1 and BG2." },
  { symbol: "W34SEL", address: 0x2124, description: "Window mask settings for BG3 and BG4." },
  {
    symbol: "WOBJSEL",
    address: 0x2125,
    description: "Window mask settings for objects and color math.",
  },
  { symbol: "WH0", address: 0x2126, description: "Window 1 left position." },
  { symbol: "WH1", address: 0x2127, description: "Window 1 right position." },
  { symbol: "WH2", address: 0x2128, description: "Window 2 left position." },
  { symbol: "WH3", address: 0x2129, description: "Window 2 right position." },
  { symbol: "WBGLOG", address: 0x212a, description: "Window mask logic for BG1 through BG4." },
  {
    symbol: "WOBJLOG",
    address: 0x212b,
    description: "Window mask logic for objects and color math.",
  },
  { symbol: "TM", address: 0x212c, description: "Main-screen layer designation." },
  { symbol: "TS", address: 0x212d, description: "Sub-screen layer designation." },
  { symbol: "TMW", address: 0x212e, description: "Window-mask designation for the main screen." },
  { symbol: "TSW", address: 0x212f, description: "Window-mask designation for the sub screen." },
  { symbol: "CGWSEL", address: 0x2130, description: "Color-math window and subscreen selection." },
  { symbol: "CGADSUB", address: 0x2131, description: "Color-math operation and per-layer enable." },
  { symbol: "COLDATA", address: 0x2132, description: "Fixed color data for color math." },
  {
    symbol: "SETINI",
    address: 0x2133,
    description: "Display mode settings including interlace, overscan, and pseudo-hires.",
  },
  {
    symbol: "MPYL",
    address: 0x2134,
    description: "PPU multiplication result, low byte; read only.",
  },
  {
    symbol: "MPYM",
    address: 0x2135,
    description: "PPU multiplication result, middle byte; read only.",
  },
  {
    symbol: "MPYH",
    address: 0x2136,
    description: "PPU multiplication result, high byte; read only.",
  },
  {
    symbol: "SLHV",
    address: 0x2137,
    description: "Software latch for the horizontal and vertical beam counters.",
  },
  { symbol: "OAMDATAREAD", address: 0x2138, description: "OAM data read port." },
  { symbol: "VMDATALREAD", address: 0x2139, description: "VRAM data read port, low byte." },
  { symbol: "VMDATAHREAD", address: 0x213a, description: "VRAM data read port, high byte." },
  { symbol: "CGDATAREAD", address: 0x213b, description: "CGRAM palette data read port." },
  {
    symbol: "OPHCT",
    address: 0x213c,
    description: "Latched horizontal beam-counter value, read twice.",
  },
  {
    symbol: "OPVCT",
    address: 0x213d,
    description: "Latched vertical beam-counter value, read twice.",
  },
  { symbol: "STAT77", address: 0x213e, description: "PPU1 status and version number; read only." },
  { symbol: "STAT78", address: 0x213f, description: "PPU2 status and version number; read only." },
  { symbol: "APUIO0", address: 0x2140, description: "Main CPU/APU communication port 0." },
  { symbol: "APUIO1", address: 0x2141, description: "Main CPU/APU communication port 1." },
  { symbol: "APUIO2", address: 0x2142, description: "Main CPU/APU communication port 2." },
  { symbol: "APUIO3", address: 0x2143, description: "Main CPU/APU communication port 3." },
  {
    symbol: "WMDATA",
    address: 0x2180,
    description: "WRAM data read/write port with automatic address increment.",
  },
  { symbol: "WMADDL", address: 0x2181, description: "WRAM address, low byte." },
  { symbol: "WMADDM", address: 0x2182, description: "WRAM address, middle byte." },
  { symbol: "WMADDH", address: 0x2183, description: "WRAM address, high bit." },
  {
    symbol: "JOYSER0",
    address: 0x4016,
    description: "Controller port 1 serial data and latch strobe.",
  },
  {
    symbol: "JOYSER1",
    address: 0x4017,
    description: "Controller port 2 serial data and external I/O.",
  },
  {
    symbol: "NMITIMEN",
    address: 0x4200,
    description: "NMI, H/V timer IRQ, and automatic joypad-read enable.",
  },
  { symbol: "WRIO", address: 0x4201, description: "Programmable I/O port output." },
  { symbol: "WRMPYA", address: 0x4202, description: "Unsigned 8-bit multiplicand." },
  {
    symbol: "WRMPYB",
    address: 0x4203,
    description: "Unsigned 8-bit multiplier and multiplication start.",
  },
  { symbol: "WRDIVL", address: 0x4204, description: "Unsigned 16-bit dividend, low byte." },
  { symbol: "WRDIVH", address: 0x4205, description: "Unsigned 16-bit dividend, high byte." },
  { symbol: "WRDIVB", address: 0x4206, description: "Unsigned 8-bit divisor and division start." },
  { symbol: "HTIMEL", address: 0x4207, description: "Horizontal IRQ timer position, low byte." },
  { symbol: "HTIMEH", address: 0x4208, description: "Horizontal IRQ timer position, high bit." },
  { symbol: "VTIMEL", address: 0x4209, description: "Vertical IRQ timer position, low byte." },
  { symbol: "VTIMEH", address: 0x420a, description: "Vertical IRQ timer position, high bit." },
  {
    symbol: "MDMAEN",
    address: 0x420b,
    description: "General-purpose DMA channel enable and transfer start.",
  },
  { symbol: "HDMAEN", address: 0x420c, description: "H-blank DMA channel enable." },
  { symbol: "MEMSEL", address: 0x420d, description: "ROM access-cycle speed selection." },
  {
    symbol: "RDNMI",
    address: 0x4210,
    description: "V-blank NMI flag and CPU version; read acknowledges the flag.",
  },
  {
    symbol: "TIMEUP",
    address: 0x4211,
    description: "H/V timer IRQ flag; read acknowledges the flag.",
  },
  {
    symbol: "HVBJOY",
    address: 0x4212,
    description: "H-blank, V-blank, and automatic joypad-read status.",
  },
  { symbol: "RDIO", address: 0x4213, description: "Programmable I/O port input." },
  {
    symbol: "RDDIVL",
    address: 0x4214,
    description: "Unsigned division quotient, low byte; read only.",
  },
  {
    symbol: "RDDIVH",
    address: 0x4215,
    description: "Unsigned division quotient, high byte; read only.",
  },
  {
    symbol: "RDMPYL",
    address: 0x4216,
    description: "Multiplication product or division remainder, low byte; read only.",
  },
  {
    symbol: "RDMPYH",
    address: 0x4217,
    description: "Multiplication product or division remainder, high byte; read only.",
  },
  {
    symbol: "JOY1L",
    address: 0x4218,
    description: "Automatic joypad result for controller 1, low byte; read only.",
  },
  {
    symbol: "JOY1H",
    address: 0x4219,
    description: "Automatic joypad result for controller 1, high byte; read only.",
  },
  {
    symbol: "JOY2L",
    address: 0x421a,
    description: "Automatic joypad result for controller 2, low byte; read only.",
  },
  {
    symbol: "JOY2H",
    address: 0x421b,
    description: "Automatic joypad result for controller 2, high byte; read only.",
  },
  {
    symbol: "JOY3L",
    address: 0x421c,
    description: "Automatic joypad result for controller 3, low byte; read only.",
  },
  {
    symbol: "JOY3H",
    address: 0x421d,
    description: "Automatic joypad result for controller 3, high byte; read only.",
  },
  {
    symbol: "JOY4L",
    address: 0x421e,
    description: "Automatic joypad result for controller 4, low byte; read only.",
  },
  {
    symbol: "JOY4H",
    address: 0x421f,
    description: "Automatic joypad result for controller 4, high byte; read only.",
  },
] as const satisfies readonly SnesHardwareDefine[];

/** Documented alternate names sharing a CPU-visible register address. */
const FIXED_REGISTER_ALIASES = [
  {
    symbol: "OBSEL",
    address: 0x2101,
    description: "Legacy alias for OBJSEL object size and character-data base addresses.",
  },
  {
    symbol: "M7HOFS",
    address: 0x210d,
    description: "Mode 7 horizontal scroll, write twice; shares BG1HOFS.",
  },
  {
    symbol: "M7VOFS",
    address: 0x210e,
    description: "Mode 7 vertical scroll, write twice; shares BG1VOFS.",
  },
  {
    symbol: "JOYOUT",
    address: 0x4016,
    description: "Joypad latch output; write view of the address shared with JOYSER0.",
  },
] as const satisfies readonly SnesHardwareDefine[];

const FIXED_REGISTERS: Readonly<Record<number, SnesHardwareDefine>> = Object.freeze(
  Object.fromEntries(
    FIXED_REGISTER_DEFINITIONS.map((definition) => [definition.address, definition]),
  ),
);

interface DmaRegisterDefinition {
  readonly offset: number;
  readonly symbol: (channel: number) => string;
  readonly legacySymbol?: (channel: number) => string;
  readonly description: string;
}

const DMA_REGISTER_DEFINITIONS: readonly DmaRegisterDefinition[] = [
  {
    offset: 0x0,
    symbol: (channel) => `DMAP${channel}`,
    description: "DMA/HDMA transfer parameters and direction/mode control.",
  },
  {
    offset: 0x1,
    symbol: (channel) => `BBAD${channel}`,
    description: "DMA/HDMA B-bus register address.",
  },
  {
    offset: 0x2,
    symbol: (channel) => `A1T${channel}L`,
    legacySymbol: (channel) => `A1TL${channel}`,
    description: "DMA source or HDMA table address, low byte.",
  },
  {
    offset: 0x3,
    symbol: (channel) => `A1T${channel}H`,
    legacySymbol: (channel) => `A1TH${channel}`,
    description: "DMA source or HDMA table address, high byte.",
  },
  {
    offset: 0x4,
    symbol: (channel) => `A1B${channel}`,
    description: "DMA source or HDMA table address bank.",
  },
  {
    offset: 0x5,
    symbol: (channel) => `DAS${channel}L`,
    legacySymbol: (channel) => `DASL${channel}`,
    description: "DMA byte count or indirect HDMA address, low byte.",
  },
  {
    offset: 0x6,
    symbol: (channel) => `DAS${channel}H`,
    legacySymbol: (channel) => `DASH${channel}`,
    description: "DMA byte count or indirect HDMA address, high byte.",
  },
  {
    offset: 0x7,
    symbol: (channel) => `DASB${channel}`,
    description: "Indirect HDMA address bank.",
  },
  {
    offset: 0x8,
    symbol: (channel) => `A2A${channel}L`,
    legacySymbol: (channel) => `A2AL${channel}`,
    description: "HDMA table current address, low byte.",
  },
  {
    offset: 0x9,
    symbol: (channel) => `A2A${channel}H`,
    legacySymbol: (channel) => `A2AH${channel}`,
    description: "HDMA table current address, high byte.",
  },
  {
    offset: 0x0a,
    symbol: (channel) => `NLTR${channel}`,
    legacySymbol: (channel) => `NTRL${channel}`,
    description: "HDMA line counter and repeat flag.",
  },
  {
    offset: 0x0b,
    symbol: (channel) => `UNUSED${channel}`,
    description: "Unused DMA/HDMA data byte; shared with the $43nF mirror.",
  },
  {
    offset: 0x0f,
    symbol: (channel) => `UNUSED${channel}_MIRROR`,
    description: "Mirror of the unused DMA/HDMA data byte at $43nB.",
  },
];

const DMA_REGISTERS_BY_OFFSET = new Map(
  DMA_REGISTER_DEFINITIONS.map((definition) => [definition.offset, definition] as const),
);

export interface SnesHardwareRegister {
  /** 24-bit CPU address that was queried (bank is preserved). */
  readonly address: number;
  /** Official register name (`INIDISP`, `DMAP0`, …). */
  readonly symbol: string;
  /** Human-readable register purpose used by generated-source hover documentation. */
  readonly description: string;
  /** Always true; MMIO is never treated as ROM or a static effective address. */
  readonly volatile: true;
}

/**
 * Returns a hardware symbol only for CPU I/O banks `$00–$3F` / `$80–$BF`.
 * ROM mirrors of those banks are never classified as I/O. DMA/HDMA channels
 * Documented DMA/HDMA fields in `$4300–$437F` use the SNESdev `DMAPn`…`NLTRn`
 * spelling, including both addresses of the shared unused byte.
 * @param {number} address 24-bit SNES CPU bus address.
 * @returns {SnesHardwareRegister | undefined} Volatile register identity, or `undefined` if not MMIO.
 */
export const identifySnesHardwareRegister = (address: number): SnesHardwareRegister | undefined => {
  const bank = (address >>> 16) & 0xff;
  if (!(bank <= 0x3f || (bank >= 0x80 && bank <= 0xbf))) return undefined;
  const low = address & 0xffff;
  const fixed = FIXED_REGISTERS[low];
  if (fixed)
    return {
      address,
      symbol: fixed.symbol,
      description: fixed.description,
      volatile: true,
    };
  if (low >= 0x4300 && low <= 0x437f) {
    const channel = (low - 0x4300) >>> 4;
    const register = (low - 0x4300) & 0x0f;
    const definition = DMA_REGISTERS_BY_OFFSET.get(register);
    if (definition)
      return {
        address,
        symbol: definition.symbol(channel),
        description: `DMA/HDMA channel ${channel}: ${definition.description}`,
        volatile: true,
      };
  }
  return undefined;
};

/** 16-bit PPU/CPU/APU/joypad register names keyed by `$2100`–`$421F` offsets. */
export const snesHardwareRegisterSymbols: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(FIXED_REGISTER_DEFINITIONS.map(({ address, symbol }) => [address, symbol])),
);

const hex = (value: number, width: number): string =>
  `$${value.toString(16).toUpperCase().padStart(width, "0")}`;

/** Stable source filename emitted beside every generated SNES disassembly. */
export const SNES_HARDWARE_DEFINES_SOURCE = "snes-defines.asm";

/**
 * Returns the complete documented set of CPU-visible register constants used by generated source.
 * DMA channel registers are expanded so repeated `$43x0` access patterns remain obvious and every
 * emitted symbol has its own hover annotation.
 * @returns {readonly SnesHardwareDefine[]} Register definitions in ascending address order.
 */
export const snesHardwareDefineRecords = (): readonly SnesHardwareDefine[] => {
  const values: SnesHardwareDefine[] = [...FIXED_REGISTER_DEFINITIONS, ...FIXED_REGISTER_ALIASES];
  for (let channel = 0; channel < 8; channel++) {
    for (const definition of DMA_REGISTER_DEFINITIONS) {
      const symbol = definition.symbol(channel);
      values.push({
        symbol,
        address: 0x4300 + channel * 0x10 + definition.offset,
        description: `DMA/HDMA channel ${channel}: ${definition.description}`,
      });
      if (definition.legacySymbol) {
        values.push({
          symbol: definition.legacySymbol(channel),
          address: 0x4300 + channel * 0x10 + definition.offset,
          description: `Legacy alias for ${symbol}. DMA/HDMA channel ${channel}: ${definition.description}`,
        });
      }
    }
  }
  return values.sort(
    (left, right) => left.address - right.address || left.symbol.localeCompare(right.symbol),
  );
};

/**
 * Returns the complete set of CPU-visible register symbol/address pairs used by generated source.
 * @returns {readonly [string, number][]} Symbol/address pairs in ascending address order.
 */
export const snesHardwareDefines = (): readonly (readonly [string, number])[] =>
  snesHardwareDefineRecords().map(({ symbol, address }) => [symbol, address] as const);

interface SnesBuiltInConstant {
  readonly symbol: string;
  readonly value: number;
  readonly description: string;
}

const CONTROLLER_MASKS: readonly SnesBuiltInConstant[] = [
  { symbol: "JOY_B", value: 0x8000, description: "Controller B-button bit." },
  { symbol: "JOY_Y", value: 0x4000, description: "Controller Y-button bit." },
  { symbol: "JOY_SELECT", value: 0x2000, description: "Controller Select-button bit." },
  { symbol: "JOY_START", value: 0x1000, description: "Controller Start-button bit." },
  { symbol: "JOY_UP", value: 0x0800, description: "Controller D-pad Up bit." },
  { symbol: "JOY_DOWN", value: 0x0400, description: "Controller D-pad Down bit." },
  { symbol: "JOY_LEFT", value: 0x0200, description: "Controller D-pad Left bit." },
  { symbol: "JOY_RIGHT", value: 0x0100, description: "Controller D-pad Right bit." },
  { symbol: "JOY_A", value: 0x0080, description: "Controller A-button bit." },
  { symbol: "JOY_X", value: 0x0040, description: "Controller X-button bit." },
  { symbol: "JOY_L", value: 0x0020, description: "Controller left-shoulder-button bit." },
  { symbol: "JOY_R", value: 0x0010, description: "Controller right-shoulder-button bit." },
];

const INTERRUPT_STATUS_MASKS: readonly SnesBuiltInConstant[] = [
  { symbol: "NMITIMEN_NMI", value: 0x80, description: "Enable V-blank NMI." },
  { symbol: "NMITIMEN_VIRQ", value: 0x20, description: "Enable vertical timer IRQ." },
  { symbol: "NMITIMEN_HIRQ", value: 0x10, description: "Enable horizontal timer IRQ." },
  { symbol: "NMITIMEN_AUTO_JOYPAD", value: 0x01, description: "Enable automatic joypad reads." },
  { symbol: "HVBJOY_VBLANK", value: 0x80, description: "V-blank status bit." },
  { symbol: "HVBJOY_HBLANK", value: 0x40, description: "H-blank status bit." },
  {
    symbol: "HVBJOY_AUTO_JOYPAD_BUSY",
    value: 0x01,
    description: "Automatic joypad read is in progress.",
  },
];

const renderConstants = (constants: readonly SnesBuiltInConstant[], width: number): string[] =>
  constants.map(
    ({ symbol, value, description }) => `${symbol} = ${hex(value, width)} ; ${description}`,
  );

/**
 * Renders the built-in SNES register and bit-mask vocabulary included by generated source.
 * These are ordinary symbols, not assembler magic, so projects may add their own aliases.
 * @returns {string} Deterministic native assembly source.
 */
export const renderSnesHardwareDefines = (): string => {
  const lines = [
    "; Built-in SNES hardware vocabulary generated by Uttori ASM.",
    "; Width state in generated banks is expressed with .a8/.a16 and .i8/.i16 directives.",
    "",
    "; PPU, APU, WRAM, controller, and CPU registers.",
    ...snesHardwareDefineRecords().map(
      ({ symbol, address, description }) => `${symbol} = ${hex(address, 4)} ; ${description}`,
    ),
    "",
    "; Common controller masks (16-bit auto-joypad result).",
    ...renderConstants(CONTROLLER_MASKS, 4),
    "",
    "; Common interrupt/status masks.",
    ...renderConstants(INTERRUPT_STATUS_MASKS, 2),
    "",
    "; MDMAEN/HDMAEN channel masks.",
    ...Array.from(
      { length: 8 },
      (_, channel) =>
        `DMA_CHANNEL_${channel} = ${hex(1 << channel, 2)} ; Select DMA/HDMA channel ${channel}.`,
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
};
