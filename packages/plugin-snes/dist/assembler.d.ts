import { type AssemblerEnvironment } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
/** Canonical SNES cartridge target id (`snes`, `sfc`, `snes-65816` are aliases). */
export declare const SNES_TARGET_ID = "snes.sfc";
/**
 * Target options accepted by `validateOptions` / `createOptions`.
 * Unknown keys are ignored. `checksumMode` is the only enum that throws.
 */
export interface SnesTargetOptions extends Record<string, unknown> {
    /** Header checksum algorithm when the ROM size is not a power of two. */
    readonly checksumMode: "asar" | "simple";
    /** When false, finalization leaves the checksum word untouched. */
    readonly checksumEnabled: boolean;
    /** When true, Super FX auto-MOVE short RAM uses Asar's raw byte, not `addr >> 1`. */
    readonly asarSuperFxMoveShortAddress: boolean;
    /**
     * Optional diagnostic sink for unpublished layout measurement. Without it, a bank crossing throws.
     * The caller must reject or reassemble the measured image before publishing; PC wrap rules are unchanged.
     */
    readonly onBankCrossing?: (address: number, width: number) => void;
}
/**
 * SNES plugin: 65816 / SPC700 / Super FX, mapper address space, `.sfc` checksum
 * output, Asar-flavored directives, and lifecycle hooks (inline SPC, freespace
 * STAR patch, bank-cross writes).
 */
declare const plugin: AssemblerPlugin<SnesTargetOptions>;
export default plugin;
/**
 * Activates the SNES plugin and freezes a reusable host environment.
 * @returns Frozen SNES environment.
 */
export declare function createSnesAssemblerEnvironment(): Promise<AssemblerEnvironment>;
//# sourceMappingURL=assembler.d.ts.map