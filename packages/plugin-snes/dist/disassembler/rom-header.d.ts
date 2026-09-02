import type { MappingCandidate } from "@uttori/asm-disassembler";
import { RomImage } from "@uttori/asm-disassembler";
/** Supported SNES cartridge mappers, including `norom` for unmapped linear dumps. */
export declare const SNES_MAPPERS: readonly ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "sa1rom", "bigsa1rom", "norom"];
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