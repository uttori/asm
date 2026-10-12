import type { DecodedInstruction } from "@uttori/asm-core";

/** CPU register definition. Read/write aliases can have different meanings at the same address. */
export interface NesHardwareSymbol {
  readonly name: string;
  readonly address: number;
  readonly access: "read" | "write" | "read-write";
  readonly description: string;
  readonly mapper?: number;
}

/** Conventional 2A03/2C02 names and the supported MMC3 register interface. */
export const NES_HARDWARE_SYMBOLS: readonly NesHardwareSymbol[] = [
  {
    name: "PPUCTRL",
    address: 0x2000,
    access: "write",
    description: "NMI, pattern tables, sprite size and VRAM increment.",
  },
  {
    name: "PPUMASK",
    address: 0x2001,
    access: "write",
    description: "Rendering, clipping and color emphasis.",
  },
  {
    name: "PPUSTATUS",
    address: 0x2002,
    access: "read",
    description: "Vblank/sprite flags; reading clears vblank and the scroll/address write latch.",
  },
  { name: "OAMADDR", address: 0x2003, access: "write", description: "Sprite memory address." },
  {
    name: "OAMDATA",
    address: 0x2004,
    access: "read-write",
    description: "Sprite memory data port; rendering affects access.",
  },
  {
    name: "PPUSCROLL",
    address: 0x2005,
    access: "write",
    description: "Horizontal then vertical scroll; shares the address write latch.",
  },
  {
    name: "PPUADDR",
    address: 0x2006,
    access: "write",
    description: "VRAM address high then low; shares the scroll write latch.",
  },
  {
    name: "PPUDATA",
    address: 0x2007,
    access: "read-write",
    description: "PPU memory data port; buffered reads and automatic address increment.",
  },
  ...[0, 1].flatMap((channel) =>
    ["CTRL", "SWEEP", "TIMER_LO", "TIMER_HI"].map((part, index) => ({
      name: `APU_PULSE${channel + 1}_${part}`,
      address: 0x4000 + channel * 4 + index,
      access: "write" as const,
      description: `Pulse ${channel + 1} ${part.toLowerCase().replaceAll("_", " ")}.`,
    })),
  ),
  ...[
    [0x4008, "APU_TRIANGLE_CTRL", "Triangle linear counter."],
    [0x400a, "APU_TRIANGLE_TIMER_LO", "Triangle timer low."],
    [0x400b, "APU_TRIANGLE_TIMER_HI", "Triangle timer high and length counter."],
    [0x400c, "APU_NOISE_CTRL", "Noise envelope."],
    [0x400e, "APU_NOISE_PERIOD", "Noise mode and period."],
    [0x400f, "APU_NOISE_LENGTH", "Noise length counter."],
    [0x4010, "APU_DMC_CTRL", "DMC IRQ, loop and rate."],
    [0x4011, "APU_DMC_DAC", "DMC direct output level."],
    [0x4012, "APU_DMC_ADDRESS", "DMC sample start address."],
    [0x4013, "APU_DMC_LENGTH", "DMC sample length."],
    [0x4014, "OAMDMA", "CPU page supplying the 256-byte sprite DMA transfer."],
    [0x4016, "JOY_STROBE", "Controller latch strobe."],
    [0x4017, "APU_FRAME", "APU frame counter mode and IRQ inhibit."],
  ].map(([address, name, description]) => ({
    address: Number(address),
    name: String(name),
    description: String(description),
    access: "write" as const,
  })),
  {
    name: "APU_STATUS",
    address: 0x4015,
    access: "read-write",
    description: "Read channel/IRQ status; write channel enables.",
  },
  {
    name: "JOY1",
    address: 0x4016,
    access: "read",
    description: "Controller 1 serial input and microphone.",
  },
  { name: "JOY2", address: 0x4017, access: "read", description: "Controller 2 serial input." },
  ...[
    [0x8000, "MMC3_SELECT", "Bank register selection and PRG/CHR modes."],
    [0x8001, "MMC3_DATA", "Selected PRG/CHR bank register data."],
    [0xa000, "MMC3_MIRROR", "Nametable mirroring."],
    [0xa001, "MMC3_RAM", "PRG RAM enable and write protection."],
    [0xc000, "MMC3_IRQ_LATCH", "IRQ reload latch."],
    [0xc001, "MMC3_IRQ_RELOAD", "Request IRQ counter reload on a qualified A12 edge."],
    [0xe000, "MMC3_IRQ_DISABLE", "Disable and acknowledge mapper IRQ."],
    [0xe001, "MMC3_IRQ_ENABLE", "Enable mapper IRQ."],
  ].map(([address, name, description]) => ({
    address: Number(address),
    name: String(name),
    description: String(description),
    access: "write" as const,
    mapper: 4,
  })),
];

/** Resolve direct data operands only. Mirror expressions retain the exact encoded address.
 * Indexed/pointer operands and RMW accesses remain numeric when their direction/port is ambiguous.
 * Reading PRG ROM must never acquire a write-only mapper-register name.
 */
export function nesHardwareOperand(
  instruction: DecodedInstruction,
  mapper: number,
): string | undefined {
  if (instruction.mode !== "absolute") {
    return undefined;
  }
  const address = instruction.operands[0]?.value;
  if (address === undefined) {
    return undefined;
  }
  let access: "read" | "write";
  if (["STA", "STX", "STY", "SAX"].includes(instruction.mnemonic)) {
    access = "write";
  } else if (
    [
      "LDA",
      "LDX",
      "LDY",
      "LAX",
      "ADC",
      "SBC",
      "AND",
      "ORA",
      "EOR",
      "CMP",
      "CPX",
      "CPY",
      "BIT",
    ].includes(instruction.mnemonic)
  ) {
    access = "read";
  } else {
    return undefined;
  }
  let canonical = address;
  if (address >= 0x2000 && address < 0x4000) {
    canonical = 0x2000 + (address & 7);
  }
  if (mapper === 4 && address >= 0x8000 && access === "write") {
    canonical = address & 0xe001;
  }
  const symbol = NES_HARDWARE_SYMBOLS.find(
    (entry) =>
      entry.address === canonical &&
      (entry.mapper === undefined || entry.mapper === mapper) &&
      (entry.access === access || entry.access === "read-write"),
  );
  if (!symbol) {
    return undefined;
  }
  const delta = address - canonical;
  return delta ? `${symbol.name} + $${delta.toString(16).toUpperCase()}` : symbol.name;
}

/** Shared Asar equates remain visible through incsrc; descriptions support hover/navigation. */
export function nesHardwareSource(mapper: number): string {
  const selected = NES_HARDWARE_SYMBOLS.filter(
    (entry) => entry.mapper === undefined || entry.mapper === mapper,
  );
  return (
    "; Built-in NES hardware vocabulary generated by Uttori ASM.\n" +
    "; Explicit .b/.w instruction suffixes preserve encoded operand widths.\n\n" +
    selected
      .map(
        (entry) =>
          `; ${entry.description}\n${entry.name} = $${entry.address.toString(16).toUpperCase().padStart(4, "0")}`,
      )
      .join("\n\n") +
    "\n"
  );
}
