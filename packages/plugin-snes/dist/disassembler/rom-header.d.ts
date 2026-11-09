import type { MappingCandidate } from "@uttori/asm-disassembler";
import { RomImage } from "@uttori/asm-disassembler";
/** Supported SNES cartridge mappers, including `norom` for unmapped linear dumps. */
export declare const SNES_MAPPERS: readonly ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "sa1rom", "bigsa1rom", "norom"];
/** Cartridge mapper id matching `SNES_MAPPERS`. */
export type SnesMapper = (typeof SNES_MAPPERS)[number];
/**
 * Accepts a supported cartridge mapper id.
 * @param value Candidate mapper name.
 * @returns True when `value` is one of `SNES_MAPPERS`.
 */
export declare function isSnesMapper(value: string): value is SnesMapper;
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
    /** Headerless ROM offset of the 16-byte expansion block. */
    readonly offset: number;
    /** Two-character maker id when developer id is `$33`. */
    readonly makerCode: string;
    /** Four-character product code from the expansion header. */
    readonly gameCode: string;
    /** Six reserved bytes preserved verbatim from the cartridge. */
    readonly reserved: Uint8Array;
    /** Expansion flash size exponent code from `$FFB0+$0C`. */
    readonly expansionFlashSizeCode: number;
    /** Expansion RAM size exponent code from `$FFB0+$0D`. */
    readonly expansionRamSizeCode: number;
    /** Special-version byte from the expansion header. */
    readonly specialVersion: number;
    /** Coprocessor subtype when the standard chipset byte is insufficient. */
    readonly chipsetSubtype: number;
}
/** One parsed vector word and its optional executable target in bank `$00`. */
export interface SnesCpuVector extends SnesCpuVectorDefinition {
    /** Headerless ROM offset of the little-endian vector word. */
    readonly fileOffset: number;
    /** Raw 16-bit vector word read from the cartridge. */
    readonly value: number;
    /** Bank-zero target when the vector is non-sentinel and the definition expects a target. */
    readonly targetAddress?: number;
}
/** Fully decoded SNES internal cartridge header and vector table. */
export interface SnesInternalRomHeader {
    /** Headerless ROM offset of the 64-byte internal header. */
    readonly offset: number;
    /** Printable title with non-ASCII bytes escaped. */
    readonly title: string;
    /** Raw 21-byte title field including padding. */
    readonly titleBytes: Uint8Array;
    /** Map-mode byte at `$FFC5` / `$7FC5`. */
    readonly mapMode: number;
    /** Human-readable map mode derived from the low nibble. */
    readonly mapModeName: string;
    /** FastROM vs SlowROM from bit 4 of the map-mode byte. */
    readonly speed: "slow" | "fast";
    /** Raw chipset byte describing RAM and coprocessor presence. */
    readonly chipset: number;
    /** Decoded chipset contents and coprocessor name. */
    readonly chipsetDescription: string;
    /** ROM size exponent code from the header. */
    readonly romSizeCode: number;
    /** Decoded ROM byte capacity when the code is in range. */
    readonly romSizeBytes?: number;
    /** RAM size exponent code from the header. */
    readonly ramSizeCode: number;
    /** Decoded save RAM bytes; zero code means none. */
    readonly ramSizeBytes?: number;
    /** Region code byte from the header. */
    readonly regionCode: number;
    /** Marketing region name for the region code. */
    readonly region: string;
    /** Developer/manufacturer id byte. `$33` selects the expanded header. */
    readonly developerId: number;
    /** Sub-version byte following the developer id. */
    readonly version: number;
    /** Checksum complement word stored in the header. */
    readonly checksumComplement: number;
    /** Checksum word stored in the header. */
    readonly checksum: number;
    /** True when complement/checksum pair validates over the full ROM. */
    readonly checksumValid: boolean;
    /** Optional 16-byte expansion header when developer id is `$33`. */
    readonly expanded?: SnesExpandedRomHeader;
    /** Parsed native and emulation vector table entries. */
    readonly vectors: readonly SnesCpuVector[];
}
/**
 * Returns the standard headerless-ROM offset for one mapper.
 * @param mapper Cartridge mapping family.
 * @returns Header offset, or undefined for an unmapped image.
 */
export declare const snesInternalHeaderOffset: (mapper: SnesMapper) => number | undefined;
/**
 * Parses the mapper-selected internal header, optional expanded header, and all
 * 16 vector words. The ROM view must already exclude a 512-byte copier header.
 * @param rom Immutable headerless ROM view.
 * @param mapper Selected cartridge mapping family.
 * @returns Parsed structure when in range.
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
 * @param rom Headerless immutable ROM view.
 * @param [options] Explicit mapper and header-size check.
 * @returns `detected`, `override`, or `ambiguous` with candidates.
 */
export declare const detectSnesRom: (rom: RomImage, options?: SnesRomDetectionOptions) => SnesRomDetection;
//# sourceMappingURL=rom-header.d.ts.map