import { snesRomAddressSpace } from "../target/address-space.js";
/** Address space id for headerless ROM file offsets (`RomImage` content bytes). */
export const SNES_FILE_ADDRESS_SPACE = "rom.file";
/** Address space id for the 24-bit SNES CPU bus. */
export const SNES_CPU_ADDRESS_SPACE = "snes.cpu";
/** Address space id for physical 128 KiB SNES work RAM offsets. */
export const SNES_WRAM_ADDRESS_SPACE = "snes.wram";
/** Address space id for physical cartridge save-RAM offsets. */
export const SNES_SRAM_ADDRESS_SPACE = "snes.sram";
/** Native-project descriptor for the physical SNES work-RAM image. */
export const SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
    id: SNES_WRAM_ADDRESS_SPACE,
    name: "SNES work RAM",
    addressBits: 17,
    kind: "memory",
});
/** Native-project descriptor for physical cartridge save-RAM offsets. */
export const SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
    id: SNES_SRAM_ADDRESS_SPACE,
    name: "SNES save RAM",
    addressBits: 24,
    kind: "memory",
});
/**
 * Builds the mapper context used by `snesRomAddressSpace`.
 * Default `sa1banks` are 1 MiB slots `$000000`–`$700000` for SA-1 / Super FX.
 * @param mapper Detected or user-selected cartridge mapper.
 * @param [sa1banks] Optional SA-1 bank bases. Ignored by LoROM/HiROM.
 * @returns Context consumed by file↔CPU translation.
 */
export const createSnesAddressContext = (mapper, sa1banks = [
    0x000000, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000,
]) => ({ mapper, sa1banks });
/**
 * List every CPU address that maps to the same headerless ROM offset.
 * @param fileOffset Byte index in the cartridge image.
 * @param context Mapper and optional SA-1 bank bases.
 * @param canonical Preferred address when several mirrors exist.
 */
const mirrorsForOffset = (fileOffset, context, canonical) => {
    const lowWords = new Set([
        canonical & 0xffff,
        fileOffset & 0xffff,
        (fileOffset & 0x7fff) | 0x8000,
    ]);
    const mirrors = new Set();
    for (let bank = 0; bank <= 0xff; bank++) {
        for (const lowWord of lowWords) {
            const candidate = (bank << 16) | lowWord;
            if (snesRomAddressSpace.toOutputOffset(candidate, context) === fileOffset) {
                mirrors.add(candidate);
            }
        }
    }
    mirrors.add(canonical);
    return [...mirrors].toSorted((left, right) => left - right);
};
/**
 * Maps a headerless ROM file offset to its CPU identity.
 * @param fileOffset Byte offset into `RomImage` content (no copier header).
 * @param context Mapper context from `createSnesAddressContext`.
 * @param romSize Headerless ROM length. Offsets outside it return `undefined`.
 * @returns Identity, or `undefined` if unmapped.
 */
export const identifySnesFileOffset = (fileOffset, context, romSize) => {
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
 * @param address 24-bit SNES CPU bus address.
 * @param context Mapper context from `createSnesAddressContext`.
 * @param romSize Headerless ROM length.
 * @returns Identity, or `undefined` if not in the ROM.
 */
export const identifySnesCpuAddress = (address, context, romSize) => {
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
//# sourceMappingURL=address-identities.js.map