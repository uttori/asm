import { type AssemblerEnvironment } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
/** Canonical SNES cartridge target id (`snes`, `sfc`, `snes-65816` are aliases). */
export declare const SNES_TARGET_ID = "snes.sfc";
/**
 * Target options accepted by `validateOptions` / `createOptions`.
 * Unknown keys are ignored; `checksumMode` is the only enum that throws.
 */
export interface SnesTargetOptions extends Record<string, unknown> {
    readonly checksumMode: "asar" | "simple";
    readonly checksumEnabled: boolean;
    /** When true, Super FX auto-MOVE short RAM uses Asar's raw byte, not `addr >> 1`. */
    readonly asarSuperFxMoveShortAddress: boolean;
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
 * @returns {Promise<AssemblerEnvironment>} Frozen SNES environment.
 */
export declare function createSnesAssemblerEnvironment(): Promise<AssemblerEnvironment>;
export { Arch65816 } from "./architectures/65816.js";
export { ArchSPC700 } from "./architectures/spc700.js";
export { ArchSuperFX } from "./architectures/superfx.js";
export * from "./asar/compatibility.js";
export * from "./directives/ca65-compat.js";
export * from "./session-state.js";
export * from "./directives/spc.js";
export * from "./target/address-space.js";
export * from "./tooling/instruction-catalog.js";
//# sourceMappingURL=index.d.ts.map