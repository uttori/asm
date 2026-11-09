import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";
import { type AddressSpaceContext } from "../target/address-space.js";
import type { SnesMapper } from "./rom-header.js";
/** Address space id for headerless ROM file offsets (`RomImage` content bytes). */
export declare const SNES_FILE_ADDRESS_SPACE = "rom.file";
/** Address space id for the 24-bit SNES CPU bus. */
export declare const SNES_CPU_ADDRESS_SPACE = "snes.cpu";
/** Address space id for physical 128 KiB SNES work RAM offsets. */
export declare const SNES_WRAM_ADDRESS_SPACE = "snes.wram";
/** Address space id for physical cartridge save-RAM offsets. */
export declare const SNES_SRAM_ADDRESS_SPACE = "snes.sram";
/** Native-project descriptor for the physical SNES work-RAM image. */
export declare const SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor;
/** Native-project descriptor for physical cartridge save-RAM offsets. */
export declare const SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor;
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
 * @param mapper Detected or user-selected cartridge mapper.
 * @param [sa1banks] Optional SA-1 bank bases. Ignored by LoROM/HiROM.
 * @returns Context consumed by file↔CPU translation.
 */
export declare const createSnesAddressContext: (mapper: SnesMapper, sa1banks?: readonly number[]) => AddressSpaceContext;
/**
 * Maps a headerless ROM file offset to its CPU identity.
 * @param fileOffset Byte offset into `RomImage` content (no copier header).
 * @param context Mapper context from `createSnesAddressContext`.
 * @param romSize Headerless ROM length. Offsets outside it return `undefined`.
 * @returns Identity, or `undefined` if unmapped.
 */
export declare const identifySnesFileOffset: (fileOffset: number, context: AddressSpaceContext, romSize: number) => SnesAddressIdentity | undefined;
/**
 * Maps a 24-bit CPU address to a ROM file offset when that address is in the image.
 * WRAM, SRAM, and I/O return `undefined`.
 * @param address 24-bit SNES CPU bus address.
 * @param context Mapper context from `createSnesAddressContext`.
 * @param romSize Headerless ROM length.
 * @returns Identity, or `undefined` if not in the ROM.
 */
export declare const identifySnesCpuAddress: (address: number, context: AddressSpaceContext, romSize: number) => SnesAddressIdentity | undefined;
//# sourceMappingURL=address-identities.d.ts.map