import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";

import { snesRomAddressSpace, type AddressSpaceContext } from "../target/address-space.js";
import type { SnesMapper } from "./rom-header.js";

/** Address space id for headerless ROM file offsets (`RomImage` content bytes). */
export const SNES_FILE_ADDRESS_SPACE = "rom.file";
/** Address space id for the 24-bit SNES CPU bus. */
export const SNES_CPU_ADDRESS_SPACE = "snes.cpu";
/** Address space id for Mesen-compatible physical 128 KiB SNES work RAM offsets. */
export const SNES_WRAM_ADDRESS_SPACE = "snes.wram";
/** Address space id for physical cartridge save-RAM offsets. */
export const SNES_SRAM_ADDRESS_SPACE = "snes.sram";

/** Native-project descriptor for the physical SNES work-RAM image. */
export const SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor = Object.freeze({
  id: SNES_WRAM_ADDRESS_SPACE,
  name: "SNES work RAM",
  addressBits: 17,
  kind: "memory",
});

/** Native-project descriptor for physical cartridge save-RAM offsets. */
export const SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor = Object.freeze({
  id: SNES_SRAM_ADDRESS_SPACE,
  name: "SNES save RAM",
  addressBits: 24,
  kind: "memory",
});

/**
 * Bidirectional identity of one ROM byte on the SNES CPU bus.
 * `address` is the queried CPU address. `canonicalCpuAddress` is the mapper's
 * preferred encoding of the same file offset. LoROM `$00:8000` / `$80:8000`
 * style mirrors are listed in `mirrors`.
 */
export interface SnesAddressIdentity {
  /** Always `snes.cpu`. */
  readonly addressSpace: typeof SNES_CPU_ADDRESS_SPACE;
  /** CPU address that was queried (or the canonical address for a file-offset query). */
  readonly address: number;
  /** Always `rom.file`. */
  readonly fileAddressSpace: typeof SNES_FILE_ADDRESS_SPACE;
  /** Headerless file offset into the loaded ROM. */
  readonly fileOffset: number;
  /** Mapper-preferred CPU encoding of `fileOffset`. */
  readonly canonicalCpuAddress: number;
  /** True when `address !== canonicalCpuAddress`. */
  readonly mirrored: boolean;
  /** All CPU addresses that map to the same file offset, including the canonical one. */
  readonly mirrors: readonly number[];
}

/**
 * Builds the mapper context used by `snesRomAddressSpace`.
 * Default `sa1banks` are 1 MiB slots `$000000`–`$700000` for SA-1 / Super FX.
 * @param {SnesMapper} mapper Detected or user-selected cartridge mapper.
 * @param {readonly number[]} [sa1banks] Optional SA-1 bank bases. Ignored by LoROM/HiROM.
 * @returns {AddressSpaceContext} Context consumed by file↔CPU translation.
 */
export const createSnesAddressContext = (
  mapper: SnesMapper,
  sa1banks: readonly number[] = [
    0x000000, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000,
  ],
): AddressSpaceContext => ({ mapper, sa1banks });

const mirrorsForOffset = (
  fileOffset: number,
  context: AddressSpaceContext,
  canonical: number,
): readonly number[] => {
  const lowWords = new Set([
    canonical & 0xffff,
    fileOffset & 0xffff,
    (fileOffset & 0x7fff) | 0x8000,
  ]);
  const mirrors = new Set<number>();
  for (let bank = 0; bank <= 0xff; bank++) {
    for (const lowWord of lowWords) {
      const candidate = (bank << 16) | lowWord;
      if (snesRomAddressSpace.toOutputOffset(candidate, context) === fileOffset) {
        mirrors.add(candidate);
      }
    }
  }
  mirrors.add(canonical);
  return [...mirrors].sort((left, right) => left - right);
};

/**
 * Maps a headerless ROM file offset to its CPU identity.
 * @param {number} fileOffset Byte offset into `RomImage` content (no copier header).
 * @param {AddressSpaceContext} context Mapper context from `createSnesAddressContext`.
 * @param {number} romSize Headerless ROM length. Offsets outside it return `undefined`.
 * @returns {SnesAddressIdentity | undefined} Identity, or `undefined` if unmapped.
 */
export const identifySnesFileOffset = (
  fileOffset: number,
  context: AddressSpaceContext,
  romSize: number,
): SnesAddressIdentity | undefined => {
  if (!Number.isInteger(fileOffset) || fileOffset < 0 || fileOffset >= romSize) {
    return undefined;
  }
  const canonicalCpuAddress = snesRomAddressSpace.fromOutputOffset(fileOffset, context);
  if (canonicalCpuAddress < 0) {
    return undefined;
  }
  return {
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address: canonicalCpuAddress,
    fileAddressSpace: SNES_FILE_ADDRESS_SPACE,
    fileOffset,
    canonicalCpuAddress,
    mirrored: false,
    mirrors: mirrorsForOffset(fileOffset, context, canonicalCpuAddress),
  };
};

/**
 * Maps a 24-bit CPU address to a ROM file offset when that address is in the image.
 * WRAM, SRAM, and I/O return `undefined`.
 * @param {number} address 24-bit SNES CPU bus address.
 * @param {AddressSpaceContext} context Mapper context from `createSnesAddressContext`.
 * @param {number} romSize Headerless ROM length.
 * @returns {SnesAddressIdentity | undefined} Identity, or `undefined` if not in the ROM.
 */
export const identifySnesCpuAddress = (
  address: number,
  context: AddressSpaceContext,
  romSize: number,
): SnesAddressIdentity | undefined => {
  const fileOffset = snesRomAddressSpace.toOutputOffset(address, context);
  if (fileOffset < 0 || fileOffset >= romSize) {
    return undefined;
  }
  const canonicalCpuAddress = snesRomAddressSpace.fromOutputOffset(fileOffset, context);
  if (canonicalCpuAddress < 0) {
    return undefined;
  }
  return {
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address,
    fileAddressSpace: SNES_FILE_ADDRESS_SPACE,
    fileOffset,
    canonicalCpuAddress,
    mirrored: address !== canonicalCpuAddress,
    mirrors: mirrorsForOffset(fileOffset, context, canonicalCpuAddress),
  };
};
