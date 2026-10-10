import type { SessionLifecycle, TargetAddressSpace, TargetFactoryContext, TargetOutputFormat } from "@uttori/asm-core/plugin";
import { type Ld65Config } from "../linker-config.js";
import { cloneNes65xxSessionState, type Nes65xxSessionState } from "../session-state.js";
/** iNES / NES 2.0 cartridge target (`nes`, `ines`, `6502-nes` aliases). */
export declare const NES_65XX_TARGET_ID = "65xx.nes";
export declare const NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
export declare const NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
export declare const NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";
/**
 * NES target options. Plugin activation stays origin-only for the raw target.
 * These fields are per-session `targetOptions`.
 */
export interface Nes65xxTargetOptions extends Readonly<Record<string, unknown>> {
    /** Asar uses headerless physical org offsets and logical CPU/PPU base addresses; ca65 retains MEMORY segments. */
    readonly sourceStyle: "asar" | "ca65";
    readonly header: readonly number[];
    readonly linkerConfig: string;
    readonly fillByte: number;
    readonly linker: Ld65Config;
}
/**
 * Coerces NES target options. Omitted `linkerConfig` uses a 32 KiB `$8000` ROM.
 * Omitted `header` synthesizes a 16-byte iNES header from PRG size.
 * @param {unknown} configured Assembler `targetOptions`.
 * @returns {Nes65xxTargetOptions} Normalized options including a parsed linker.
 */
export declare function createNes65xxTargetOptions(configured: unknown): Nes65xxTargetOptions;
/**
 * Builds the initial NES session state from target options.
 * @param {object} context Session creation context.
 * @param {Readonly<Record<string, unknown>>} context.targetOptions Normalized NES options.
 * @returns {Nes65xxSessionState} Fresh session state.
 */
export declare function createInitialNesState(context: {
    targetOptions: Readonly<Record<string, unknown>>;
}): Nes65xxSessionState;
/**
 * Maps load addresses into the iNES image using physical Asar offsets or ca65 MEMORY regions.
 * Logical CPU/PPU addresses stay independent of the load cursor through core `base` support.
 * @param {TargetFactoryContext} context Target factory context.
 * @returns {TargetAddressSpace} The NES address space.
 */
export declare function createNesAddressSpace({ state, options, }: TargetFactoryContext): TargetAddressSpace;
/**
 * Header plus filled PRG image. Checksum is not an iNES concept.
 * @returns {TargetOutputFormat} The NES output format.
 */
export declare function createNesOutputFormat(): TargetOutputFormat;
/**
 * Prefills header + `$FF` PRG, reseeds linker symbols, and closes the last segment.
 * @param {TargetFactoryContext} context Target factory context.
 * @returns {SessionLifecycle} NES session lifecycle hooks.
 */
export declare function createNesLifecycle({ state }: TargetFactoryContext): SessionLifecycle;
export { cloneNes65xxSessionState };
//# sourceMappingURL=nes.d.ts.map