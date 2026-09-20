import type { MappingCandidate } from "@uttori/asm-disassembler";
import { RomImage } from "@uttori/asm-disassembler";
/** Supported SNES cartridge mappers, including `norom` for unmapped linear dumps. */
export declare const SNES_MAPPERS: readonly ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "sa1rom", "bigsa1rom", "norom"];
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
export declare const SNES_CPU_VECTOR_DEFINITIONS: readonly SnesCpuVectorDefinition[];
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
/**
 * Returns the standard headerless-ROM offset for one mapper.
 * @param {SnesMapper} mapper Cartridge mapping family.
 * @returns {number | undefined} Header offset, or undefined for an unmapped image.
 */
export declare const snesInternalHeaderOffset: (mapper: SnesMapper) => number | undefined;
/**
 * Parses the mapper-selected internal header, optional expanded header, and all
 * 16 vector words. The ROM view must already exclude a 512-byte copier header.
 * @param {RomImage} rom Immutable headerless ROM view.
 * @param {SnesMapper} mapper Selected cartridge mapping family.
 * @returns {SnesInternalRomHeader | undefined} Parsed structure when in range.
 */
export declare const parseSnesInternalRomHeader: (rom: RomImage, mapper: SnesMapper) => SnesInternalRomHeader | undefined;
/** Optional detection overrides. `headerSize` must already match the loaded `RomImage`. */
export interface SnesRomDetectionOptions {
    /** Force this mapper instead of scoring internal headers. */
    readonly mapper?: SnesMapper;
    /** Must equal `rom.identity.headerSize` when set. Used as a consistency check. */
    readonly headerSize?: 0 | 512;
}
/**
 * Result of scoring LoROM/HiROM/ExLoROM/ExHiROM/SFX/SA-1 header candidates.
 * `ambiguous` means the caller must pass `--mapper` before creating a project.
 */
export interface SnesRomDetection {
    /** `detected` when one candidate wins. `override` when `options.mapper` is set. Else `ambiguous`. */
    readonly status: "detected" | "override" | "ambiguous";
    /** Winning or forced mapper. Omitted when `status` is `ambiguous`. */
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
/**
 * Scores standard internal-header locations and either picks a mapper or asks
 * for an override. Map-mode nibble, checksum complement, printable title, and
 * RESET vector plausibility are the main signals. `bigsa1rom` and `norom` are
 * never auto-detected.
 * @param {RomImage} rom Headerless immutable ROM view.
 * @param {SnesRomDetectionOptions} [options] Explicit mapper and header-size check.
 * @returns {SnesRomDetection} `detected`, `override`, or `ambiguous` with candidates.
 */
export declare const detectSnesRom: (rom: RomImage, options?: SnesRomDetectionOptions) => SnesRomDetection;
//# sourceMappingURL=rom-header.d.ts.map