import type { SessionLifecycle, TargetAddressSpace, TargetFactoryContext, TargetOutputFormat } from "@uttori/asm-core/plugin";
import { type Ld65Config } from "../linker-config.js";
import { cloneNes65xxSessionState, type Nes65xxSessionState } from "../session-state.js";
/** iNES / NES 2.0 cartridge target (`nes`, `ines`, `6502-nes` aliases). */
export declare const NES_65XX_TARGET_ID = "65xx.nes";
/** Address-space contribution id for iNES CPU/PPU mapping. */
export declare const NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
/** Output-format contribution id for headered iNES images. */
export declare const NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
/** Lifecycle contribution id that prefills NES header and PRG. */
export declare const NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";
/**
 * NES target options. Plugin activation stays origin-only for the raw target.
 * These fields are per-session `targetOptions`.
 */
export interface Nes65xxTargetOptions extends Readonly<Record<string, unknown>> {
    /** Asar uses headerless physical org offsets and logical CPU/PPU base addresses; ca65 retains MEMORY segments. */
    readonly sourceStyle: "asar" | "ca65";
    /** Parsed or declared header bytes. */
    readonly header: readonly number[];
    /** ld65 MEMORY/SEGMENTS text used for this cartridge layout. */
    readonly linkerConfig: string;
    /** Byte used to prefill unused PRG and header gaps. */
    readonly fillByte: number;
    /** Parsed ld65 configuration driving NES section placement. */
    readonly linker: Ld65Config;
}
/**
 * Coerces NES target options. Omitted `linkerConfig` uses a 32 KiB `$8000` ROM.
 * Omitted `header` synthesizes a 16-byte iNES header from PRG size.
 * @param configured Assembler `targetOptions`.
 * @returns Normalized options including a parsed linker.
 */
export declare function createNes65xxTargetOptions(configured: unknown): Nes65xxTargetOptions;
/**
 * Builds the initial NES session state from target options.
 * @param context Session creation context.
 * @param context.targetOptions Normalized NES options.
 * @returns Fresh session state.
 */
export declare function createInitialNesState(context: {
    targetOptions: Readonly<Record<string, unknown>>;
}): Nes65xxSessionState;
/**
 * Maps load addresses into the iNES image using physical Asar offsets or ca65 MEMORY regions.
 * Logical CPU/PPU addresses stay independent of the load cursor through core `base` support.
 * @param context Target factory context.
 * @returns The NES address space.
 */
export declare function createNesAddressSpace({ state, options, }: TargetFactoryContext): TargetAddressSpace;
/**
 * Header plus filled PRG image. Checksum is not an iNES concept.
 * @returns The NES output format.
 */
export declare function createNesOutputFormat(): TargetOutputFormat;
/**
 * Prefills header + `$FF` PRG, reseeds linker symbols, and closes the last segment.
 * @param context Target factory context.
 * @returns NES session lifecycle hooks.
 */
export declare function createNesLifecycle({ state }: TargetFactoryContext): SessionLifecycle;
export { cloneNes65xxSessionState };
//# sourceMappingURL=nes.d.ts.map