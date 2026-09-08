import type { MappingCandidate } from "@uttori/asm-disassembler";
import { RomImage } from "@uttori/asm-disassembler";

import { snesRomAddressSpace, type AddressSpaceContext } from "../target/address-space.js";

/** Supported SNES cartridge mappers, including `norom` for unmapped linear dumps. */
export const SNES_MAPPERS = [
  "lorom",
  "hirom",
  "exlorom",
  "exhirom",
  "sfxrom",
  "sa1rom",
  "bigsa1rom",
  "norom",
] as const;

/** Cartridge mapper id matching `SNES_MAPPERS`. */
export type SnesMapper = (typeof SNES_MAPPERS)[number];

/** One 16-bit vector slot in the bank-$00 SNES CPU vector table. */
export interface SnesCpuVectorDefinition {
  /** Stable analysis/evidence id. */
  readonly id: string;
  /** Stable generated-source label. */
  readonly symbol: string;
  /** Human-readable vector purpose. */
  readonly name: string;
  /** CPU address of the little-endian vector word. */
  readonly pointer: number;
  /** CPU execution mode selecting this half of the table. */
  readonly mode: "native" | "emulation";
  /** Abstract-state preset for vectors that can seed code analysis. */
  readonly state?: "native" | "emulation" | "reset";
}

/**
 * Complete 32-byte 65C816 vector layout at `$FFE0–$FFFF`.
 * Reserved words are retained so source export accounts for every byte while
 * analysis seeds only architecturally meaningful handler slots.
 */
export const SNES_CPU_VECTOR_DEFINITIONS: readonly SnesCpuVectorDefinition[] = [
  {
    id: "native-reserved-0",
    symbol: "SNES_VECTOR_NATIVE_RESERVED_0",
    name: "Reserved",
    pointer: 0x00ffe0,
    mode: "native",
  },
  {
    id: "native-reserved-1",
    symbol: "SNES_VECTOR_NATIVE_RESERVED_1",
    name: "Reserved",
    pointer: 0x00ffe2,
    mode: "native",
  },
  {
    id: "native-cop",
    symbol: "SNES_VECTOR_NATIVE_COP",
    name: "COP",
    pointer: 0x00ffe4,
    mode: "native",
    state: "native",
  },
  {
    id: "native-brk",
    symbol: "SNES_VECTOR_NATIVE_BRK",
    name: "BRK",
    pointer: 0x00ffe6,
    mode: "native",
    state: "native",
  },
  {
    id: "native-abort",
    symbol: "SNES_VECTOR_NATIVE_ABORT",
    name: "ABORT",
    pointer: 0x00ffe8,
    mode: "native",
    state: "native",
  },
  {
    id: "native-nmi",
    symbol: "SNES_VECTOR_NATIVE_NMI",
    name: "NMI",
    pointer: 0x00ffea,
    mode: "native",
    state: "native",
  },
  {
    id: "native-reserved-2",
    symbol: "SNES_VECTOR_NATIVE_RESERVED_2",
    name: "Reserved",
    pointer: 0x00ffec,
    mode: "native",
  },
  {
    id: "native-irq",
    symbol: "SNES_VECTOR_NATIVE_IRQ",
    name: "IRQ",
    pointer: 0x00ffee,
    mode: "native",
    state: "native",
  },
  {
    id: "emulation-reserved-0",
    symbol: "SNES_VECTOR_EMULATION_RESERVED_0",
    name: "Reserved",
    pointer: 0x00fff0,
    mode: "emulation",
  },
  {
    id: "emulation-reserved-1",
    symbol: "SNES_VECTOR_EMULATION_RESERVED_1",
    name: "Reserved",
    pointer: 0x00fff2,
    mode: "emulation",
  },
  {
    id: "emulation-cop",
    symbol: "SNES_VECTOR_EMULATION_COP",
    name: "COP",
    pointer: 0x00fff4,
    mode: "emulation",
    state: "emulation",
  },
  {
    id: "emulation-reserved-2",
    symbol: "SNES_VECTOR_EMULATION_RESERVED_2",
    name: "Reserved",
    pointer: 0x00fff6,
    mode: "emulation",
  },
  {
    id: "emulation-abort",
    symbol: "SNES_VECTOR_EMULATION_ABORT",
    name: "ABORT",
    pointer: 0x00fff8,
    mode: "emulation",
    state: "emulation",
  },
  {
    id: "emulation-nmi",
    symbol: "SNES_VECTOR_EMULATION_NMI",
    name: "NMI",
    pointer: 0x00fffa,
    mode: "emulation",
    state: "emulation",
  },
  {
    id: "reset",
    symbol: "SNES_VECTOR_EMULATION_RESET",
    name: "RESET",
    pointer: 0x00fffc,
    mode: "emulation",
    state: "reset",
  },
  {
    id: "emulation-irq-brk",
    symbol: "SNES_VECTOR_EMULATION_IRQ_BRK",
    name: "IRQ/BRK",
    pointer: 0x00fffe,
    mode: "emulation",
    state: "emulation",
  },
];

/** Parsed optional 16-byte expanded cartridge header at `$FFB0–$FFBF`. */
export interface SnesExpandedRomHeader {
  readonly offset: number;
  readonly makerCode: string;
  readonly gameCode: string;
  readonly reserved: Uint8Array;
  readonly expansionFlashSizeCode: number;
  readonly expansionRamSizeCode: number;
  readonly specialVersion: number;
  readonly chipsetSubtype: number;
}

/** One parsed vector word and its optional executable target in bank `$00`. */
export interface SnesCpuVector extends SnesCpuVectorDefinition {
  readonly fileOffset: number;
  readonly value: number;
  readonly targetAddress?: number;
}

/** Fully decoded SNES internal cartridge header and vector table. */
export interface SnesInternalRomHeader {
  readonly offset: number;
  readonly title: string;
  readonly titleBytes: Uint8Array;
  readonly mapMode: number;
  readonly mapModeName: string;
  readonly speed: "slow" | "fast";
  readonly chipset: number;
  readonly chipsetDescription: string;
  readonly romSizeCode: number;
  readonly romSizeBytes?: number;
  readonly ramSizeCode: number;
  readonly ramSizeBytes?: number;
  readonly regionCode: number;
  readonly region: string;
  readonly developerId: number;
  readonly version: number;
  readonly checksumComplement: number;
  readonly checksum: number;
  readonly checksumValid: boolean;
  readonly expanded?: SnesExpandedRomHeader;
  readonly vectors: readonly SnesCpuVector[];
}

const HEADER_OFFSETS: Readonly<Partial<Record<SnesMapper, number>>> = {
  lorom: 0x7fc0,
  sfxrom: 0x7fc0,
  sa1rom: 0x7fc0,
  bigsa1rom: 0x7fc0,
  hirom: 0xffc0,
  exlorom: 0x407fc0,
  exhirom: 0x40ffc0,
};

/**
 * Returns the standard headerless-ROM offset for one mapper.
 * @param {SnesMapper} mapper Cartridge mapping family.
 * @returns {number | undefined} Header offset, or undefined for an unmapped image.
 */
export const snesInternalHeaderOffset = (mapper: SnesMapper): number | undefined =>
  HEADER_OFFSETS[mapper];

const asciiField = (bytes: Uint8Array): string =>
  [...bytes]
    .map((byte) =>
      byte >= 0x20 && byte <= 0x7e
        ? String.fromCharCode(byte)
        : `\\x${byte.toString(16).toUpperCase().padStart(2, "0")}`,
    )
    .join("")
    .replaceAll(/(?: |\\x00)+$/g, "");

const sizeBytes = (code: number, zeroMeansNone: boolean): number | undefined => {
  if (zeroMeansNone && code === 0) return 0;
  return code < 0x20 ? 1024 * 2 ** code : undefined;
};

const mapModeName = (value: number): string =>
  ({ 0x0: "LoROM", 0x1: "HiROM", 0x2: "S-DD1", 0x3: "SA-1", 0x5: "ExHiROM", 0xa: "SPC7110" })[
    value & 0x0f
  ] ?? "Unknown";

const regionName = (code: number): string =>
  ({
    0x00: "Japan",
    0x01: "North America",
    0x02: "Europe",
    0x03: "Scandinavia",
    0x04: "Finland",
    0x05: "Denmark",
    0x06: "Europe (French)",
    0x07: "Netherlands",
    0x08: "Spain",
    0x09: "Germany/Austria/Switzerland",
    0x0a: "Italy",
    0x0b: "China/Hong Kong",
    0x0c: "Indonesia",
    0x0d: "South Korea",
    0x0e: "Common",
    0x0f: "Canada",
    0x10: "Brazil/Nintendo Gateway",
    0x11: "Australia",
    0x12: "Other variation X",
    0x13: "Other variation Y",
    0x14: "Other variation Z",
  })[code] ?? "Unknown";

const chipsetDescription = (value: number): string => {
  const contents =
    {
      0x0: "ROM only",
      0x1: "ROM + RAM",
      0x2: "ROM + RAM + battery",
      0x3: "ROM + coprocessor",
      0x4: "ROM + coprocessor + RAM",
      0x5: "ROM + coprocessor + RAM + battery",
      0x6: "ROM + coprocessor + battery",
    }[value & 0x0f] ?? "Unknown cartridge contents";
  if ((value & 0x0f) < 3) return contents;
  const coprocessor =
    {
      0x0: "DSP",
      0x1: "GSU/Super FX",
      0x2: "OBC1",
      0x3: "SA-1",
      0x4: "S-DD1",
      0x5: "S-RTC",
      0xe: "Other",
      0xf: "Custom",
    }[value >>> 4] ?? "Unknown coprocessor";
  return `${contents} (${coprocessor})`;
};

/**
 * Parses the mapper-selected internal header, optional expanded header, and all
 * 16 vector words. The ROM view must already exclude a 512-byte copier header.
 * @param {RomImage} rom Immutable headerless ROM view.
 * @param {SnesMapper} mapper Selected cartridge mapping family.
 * @returns {SnesInternalRomHeader | undefined} Parsed structure when in range.
 */
export const parseSnesInternalRomHeader = (
  rom: RomImage,
  mapper: SnesMapper,
): SnesInternalRomHeader | undefined => {
  const offset = snesInternalHeaderOffset(mapper);
  if (offset === undefined) return undefined;
  const bytes = rom.read(offset, 0x40);
  if (!bytes) return undefined;
  const developerId = bytes[0x1a];
  const expandedBytes =
    developerId === 0x33 && offset >= 0x10 ? rom.read(offset - 0x10, 0x10) : undefined;
  const checksumComplement = bytes[0x1c] | (bytes[0x1d] << 8);
  const checksum = bytes[0x1e] | (bytes[0x1f] << 8);
  const vectors = SNES_CPU_VECTOR_DEFINITIONS.map((definition): SnesCpuVector => {
    const fileOffset = offset + definition.pointer - 0x00ffc0;
    const value = rom.readByte(fileOffset)! | (rom.readByte(fileOffset + 1)! << 8);
    return {
      ...definition,
      fileOffset,
      value,
      ...(definition.state && value !== 0 && value !== 0xffff ? { targetAddress: value } : {}),
    };
  });
  return {
    offset,
    title: asciiField(bytes.slice(0, 0x15)),
    titleBytes: bytes.slice(0, 0x15),
    mapMode: bytes[0x15],
    mapModeName: mapModeName(bytes[0x15]),
    speed: (bytes[0x15] & 0x10) === 0 ? "slow" : "fast",
    chipset: bytes[0x16],
    chipsetDescription: chipsetDescription(bytes[0x16]),
    romSizeCode: bytes[0x17],
    romSizeBytes: sizeBytes(bytes[0x17], false),
    ramSizeCode: bytes[0x18],
    ramSizeBytes: sizeBytes(bytes[0x18], true),
    regionCode: bytes[0x19],
    region: regionName(bytes[0x19]),
    developerId,
    version: bytes[0x1b],
    checksumComplement,
    checksum,
    checksumValid: (checksum ^ checksumComplement) === 0xffff && checksum !== 0,
    ...(expandedBytes
      ? {
          expanded: {
            offset: offset - 0x10,
            makerCode: asciiField(expandedBytes.slice(0, 2)),
            gameCode: asciiField(expandedBytes.slice(2, 6)),
            reserved: expandedBytes.slice(6, 12),
            expansionFlashSizeCode: expandedBytes[0x0c],
            expansionRamSizeCode: expandedBytes[0x0d],
            specialVersion: expandedBytes[0x0e],
            chipsetSubtype: expandedBytes[0x0f],
          },
        }
      : {}),
    vectors,
  };
};

/** Optional detection overrides. `headerSize` must already match the loaded `RomImage`. */
export interface SnesRomDetectionOptions {
  /** Force this mapper instead of scoring internal headers. */
  readonly mapper?: SnesMapper;
  /** Must equal `rom.identity.headerSize` when set; used as a consistency check. */
  readonly headerSize?: 0 | 512;
}

/**
 * Result of scoring LoROM/HiROM/ExLoROM/ExHiROM/SFX/SA-1 header candidates.
 * `ambiguous` means the caller must pass `--mapper` before creating a project.
 */
export interface SnesRomDetection {
  /** `detected` when one candidate wins; `override` when `options.mapper` is set; else `ambiguous`. */
  readonly status: "detected" | "override" | "ambiguous";
  /** Winning or forced mapper; omitted when `status` is `ambiguous`. */
  readonly mapper?: SnesMapper;
  /** From map-mode bit 4 at the selected header (`$30` FastROM vs `$20` SlowROM). */
  readonly speed?: "slow" | "fast";
  /** File offset of the 64-byte internal cartridge header. */
  readonly headerOffset?: number;
  /** Fully parsed selected header and vector table when a standard header is available. */
  readonly header?: SnesInternalRomHeader;
  /** All in-range candidates, highest score first. */
  readonly candidates: readonly MappingCandidate[];
  /** Human-readable reason when detection is ambiguous or the override has no header. */
  readonly message?: string;
}

const HEADER_SPECS: ReadonlyArray<{
  readonly mapper: Exclude<SnesMapper, "bigsa1rom" | "norom">;
  readonly offset: number;
  readonly mode: number;
}> = [
  { mapper: "lorom", offset: 0x7fc0, mode: 0x0 },
  { mapper: "hirom", offset: 0xffc0, mode: 0x1 },
  { mapper: "exlorom", offset: 0x407fc0, mode: 0x2 },
  { mapper: "exhirom", offset: 0x40ffc0, mode: 0x5 },
  { mapper: "sfxrom", offset: 0x7fc0, mode: 0x0 },
  { mapper: "sa1rom", offset: 0x7fc0, mode: 0x3 },
];

const defaultAddressContext = (mapper: SnesMapper): AddressSpaceContext => ({
  mapper,
  sa1banks: [0x000000, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000],
});

const scoreCandidate = (
  rom: RomImage,
  spec: (typeof HEADER_SPECS)[number],
): MappingCandidate | undefined => {
  const header = rom.read(spec.offset, 0x40);
  if (!header) return undefined;
  const evidence: Array<{ kind: string; score: number; detail: string }> = [];
  const add = (kind: string, score: number, detail: string): void => {
    evidence.push({ kind, score, detail });
  };

  const mapMode = header[0x15];
  const mapNibble = mapMode & 0x0f;
  add(
    "map-mode",
    mapNibble === spec.mode ? 8 : -6,
    `header map-mode $${mapMode.toString(16).padStart(2, "0")} ${mapNibble === spec.mode ? "matches" : "does not match"} ${spec.mapper}`,
  );

  const cartridgeType = header[0x16];
  if (spec.mapper === "sa1rom") {
    add(
      "enhancement-chip",
      cartridgeType === 0x34 || cartridgeType === 0x35 ? 5 : -3,
      `cartridge type $${cartridgeType.toString(16).padStart(2, "0")}`,
    );
  } else if (spec.mapper === "sfxrom") {
    const isSuperFx = [0x13, 0x14, 0x15, 0x1a].includes(cartridgeType);
    add(
      "enhancement-chip",
      isSuperFx ? 5 : -3,
      `cartridge type $${cartridgeType.toString(16).padStart(2, "0")}`,
    );
  }

  const checksumComplement = header[0x1c] | (header[0x1d] << 8);
  const checksum = header[0x1e] | (header[0x1f] << 8);
  const checksumValid = (checksum ^ checksumComplement) === 0xffff && checksum !== 0;
  add(
    "checksum-complement",
    checksumValid ? 4 : -1,
    checksumValid ? "checksum and complement agree" : "checksum and complement do not agree",
  );

  const sizeCode = header[0x17];
  const declaredSize = sizeCode < 0x20 ? 1_024 * 2 ** sizeCode : 0;
  const sizePlausible =
    declaredSize > 0 &&
    rom.length <= declaredSize &&
    declaredSize <= Math.max(rom.length * 2, rom.length);
  add(
    "declared-size",
    sizePlausible ? 3 : -1,
    `declared ${declaredSize || "invalid"} bytes; loaded ${rom.length} bytes`,
  );

  const title = header.slice(0, 21);
  const printable = [...title].filter(
    (byte) => byte === 0 || byte === 0x20 || (byte >= 0x21 && byte <= 0x7e),
  ).length;
  add("title", printable >= 18 ? 1 : -1, `${printable}/21 title bytes are printable`);

  const resetVector = header[0x3c] | (header[0x3d] << 8);
  add(
    "reset-vector",
    resetVector >= 0x8000 && resetVector !== 0xffff ? 3 : -4,
    `emulation RESET vector is $${resetVector.toString(16).padStart(4, "0")}`,
  );
  if (resetVector >= 0x8000 && resetVector !== 0xffff) {
    const resetOffset = snesRomAddressSpace.toOutputOffset(
      resetVector,
      defaultAddressContext(spec.mapper),
    );
    const opcode = rom.readByte(resetOffset);
    const plausible = opcode !== undefined && opcode !== 0x00 && opcode !== 0xff;
    add(
      "reset-code",
      plausible ? 2 : -2,
      opcode === undefined
        ? "RESET target is not mapped into the loaded ROM"
        : `RESET target begins with opcode $${opcode.toString(16).padStart(2, "0")}`,
    );
  }
  return {
    mapper: spec.mapper,
    headerOffset: spec.offset,
    score: evidence.reduce((sum, item) => sum + item.score, 0),
    evidence,
  };
};

/**
 * Scores standard internal-header locations and either picks a mapper or asks
 * for an override. Map-mode nibble, checksum complement, printable title, and
 * RESET vector plausibility are the main signals. `bigsa1rom` and `norom` are
 * never auto-detected.
 * @param {RomImage} rom Headerless immutable ROM view.
 * @param {SnesRomDetectionOptions} [options] Explicit mapper and header-size check.
 * @returns {SnesRomDetection} `detected`, `override`, or `ambiguous` with candidates.
 */
export const detectSnesRom = (
  rom: RomImage,
  options: SnesRomDetectionOptions = {},
): SnesRomDetection => {
  if (options.headerSize !== undefined && options.headerSize !== rom.identity.headerSize) {
    throw new Error(
      `Header override ${options.headerSize} does not match the loaded ROM view (${rom.identity.headerSize}).`,
    );
  }
  const candidates = HEADER_SPECS.map((spec) => scoreCandidate(rom, spec))
    .filter((candidate): candidate is MappingCandidate => candidate !== undefined)
    .sort((left, right) => right.score - left.score || left.mapper.localeCompare(right.mapper));

  if (options.mapper) {
    const selected = candidates.find((candidate) => candidate.mapper === options.mapper);
    const parsed = parseSnesInternalRomHeader(rom, options.mapper);
    return {
      status: "override",
      mapper: options.mapper,
      ...(selected === undefined
        ? {}
        : {
            speed:
              ((rom.readByte(selected.headerOffset + 0x15) ?? 0) & 0x10) === 0 ? "slow" : "fast",
          }),
      headerOffset: selected?.headerOffset,
      ...(parsed ? { header: parsed } : {}),
      candidates,
      ...(selected
        ? {}
        : { message: `Mapper '${options.mapper}' has no standard in-range header candidate.` }),
    };
  }

  const first = candidates[0];
  const second = candidates[1];
  if (first && first.score >= 8 && (!second || first.score - second.score >= 3)) {
    const mapper = first.mapper as SnesMapper;
    return {
      status: "detected",
      mapper,
      speed: ((rom.readByte(first.headerOffset + 0x15) ?? 0) & 0x10) === 0 ? "slow" : "fast",
      headerOffset: first.headerOffset,
      header: parseSnesInternalRomHeader(rom, mapper),
      candidates,
    };
  }
  return {
    status: "ambiguous",
    candidates,
    message:
      "SNES mapper/header detection is ambiguous; provide an explicit --mapper override before creating the project.",
  };
};
