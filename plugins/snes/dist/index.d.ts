import { type AssemblerEnvironment } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
export declare const SNES_TARGET_ID = "snes.sfc";
export interface SnesTargetOptions extends Record<string, unknown> {
    readonly checksumMode: "asar" | "simple";
    readonly checksumEnabled: boolean;
    readonly asarSuperFxMoveShortAddress: boolean;
}
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
export * from "./session-state.js";
export * from "./directives/spc.js";
export * from "./target/address-space.js";
export * from "./tooling/instruction-catalog.js";
//# sourceMappingURL=index.d.ts.map