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
      candidates,
      ...(selected
        ? {}
        : { message: `Mapper '${options.mapper}' has no standard in-range header candidate.` }),
    };
  }

  const first = candidates[0];
  const second = candidates[1];
  if (first && first.score >= 8 && (!second || first.score - second.score >= 3)) {
    return {
      status: "detected",
      mapper: first.mapper as SnesMapper,
      speed: ((rom.readByte(first.headerOffset + 0x15) ?? 0) & 0x10) === 0 ? "slow" : "fast",
      headerOffset: first.headerOffset,
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
