import type { ArchitectureExtension } from "../architecture-registry.js";
import { type TargetProfile } from "../target-profile.js";
import { AssemblerEnvironment } from "./environment.js";
export declare const SNES_TARGET_ID = "snes.sfc";
export declare const MOS6502_STUB_TARGET_ID = "mos.6502-stub";
export interface LegacyEnvironmentOptions {
    readonly targetProfile?: TargetProfile;
    readonly architectureExtensions?: readonly ArchitectureExtension[];
}
export interface LegacyEnvironmentResolution {
    readonly environment: AssemblerEnvironment;
    readonly target: string;
}
/**
 * Creates the temporary environment bridge used until first-party plugins are extracted.
 * @param {LegacyEnvironmentOptions} options Legacy composition options.
 * @returns {LegacyEnvironmentResolution} The frozen environment and selected target.
 */
export declare function createLegacyAssemblerEnvironment(options?: LegacyEnvironmentOptions): LegacyEnvironmentResolution;
export declare function getLegacyTargetProfile(environment: AssemblerEnvironment, targetId: string): TargetProfile | undefined;
export declare const snesAssemblerHost: LegacyEnvironmentResolution;
export declare const mos6502StubAssemblerHost: LegacyEnvironmentResolution;
//# sourceMappingURL=legacy-adapter.d.ts.map