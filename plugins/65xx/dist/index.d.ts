import type { AssemblerPlugin, PluginActivationContext } from "@uttori/asm-core/plugin";
/** Flat 16-bit raw binary target (`65xx`, `6502-raw` aliases). */
export declare const RAW_65XX_TARGET_ID = "65xx.raw";
/** Identity map: logical address − origin = file offset. */
export declare const FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
export declare const RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
/** Resets PC to `origin` at the start of each assembly stage. */
export declare const RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
/** Headerless raw target using the ca65 source profile. */
export declare const CA65_RAW_65XX_TARGET_ID = "65xx.ca65-raw";
/** ca65 directive set used by ca65-profile targets. */
export declare const CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";
export declare const CA65_65XX_EXPRESSION_SET_ID = "65xx.ca65-expressions";
export declare const CA65_65XX_LIFECYCLE_ID = "65xx.ca65-lifecycle";
/**
 * Raw-target options. `origin` is both the initial PC and file offset 0
 * (`{ origin: 32768 }` → `org $8000` with no 32 KiB prefix).
 */
export interface Raw65xxTargetOptions extends Readonly<Record<string, unknown>> {
    readonly origin: number;
}
/**
 * Validates target options. Unknown keys throw; omitted object → `{ origin: 0 }`.
 *
 * @param {unknown} configured Plugin/target options object.
 * @returns {Raw65xxTargetOptions} Normalized options.
 */
export declare function createRaw65xxTargetOptions(configured: unknown): Raw65xxTargetOptions;
/**
 * Registers NMOS/CMOS/Commodore/MEGA65/Hudson/Mitsubishi architectures plus the flat raw target.
 * Used by the plugin `activate` hook and by tests that want contributions
 * without constructing a full plugin object.
 *
 * @param {PluginActivationContext} context Plugin activation context.
 */
export declare function register65xxContributions(context: PluginActivationContext): void;
declare const plugin: AssemblerPlugin<Raw65xxTargetOptions>;
/**
 * Activates this plugin and freezes a reusable host environment.
 *
 * @param {unknown} options Raw-target options (`origin`, …).
 * @returns {Promise<AssemblerEnvironment>} Frozen assembler environment.
 */
export declare function create65xxAssemblerEnvironment(options?: unknown): Promise<import("@uttori/asm-core").AssemblerEnvironment>;
export default plugin;
export { Arch65xx, materializeOpcodeForm } from "./architecture.js";
export { buildInstructionCatalog } from "./instructions/catalog.js";
export { getCpuAssemblyForms, getOpcodeForm, getCpuDecodeTable, nmos6502Cpu, nmos6502DecodeTable, nmos6502Forms, nmos6502xCpu, nmos6502xForms, } from "./instructions/opcodes.js";
export { cmos65c02Cpu, cmos65c02Forms, cmos65sc02Cpu, cmos65sc02Forms, commodore4510Cpu, commodore4510Forms, csg65ce02Cpu, csg65ce02Forms, mega65Gs02Cpu, mega65Gs02Forms, hudsonHuC6280Cpu, hudsonHuC6280Forms, mitsubishiM740Cpu, mitsubishiM740Forms, mos6502DtvCpu, mos6502DtvForms, variantCpus, variantFormsByCpuId, wdc65c02Cpu, wdc65c02Forms, } from "./instructions/variants.js";
export type { AddressingMode, CpuDefinition, CpuFeature, FeatureExpression, InstructionForm, OperandCodecId, OperandField, } from "./instructions/schema.js";
export { matchesFeatures } from "./instructions/schema.js";
export { NES_65XX_ADDRESS_SPACE_ID, NES_65XX_LIFECYCLE_ID, NES_65XX_OUTPUT_FORMAT_ID, NES_65XX_TARGET_ID, createNes65xxTargetOptions, } from "./target/nes.js";
export { NES_65XX_SESSION_STATE_ID, nes65xxSessionStateKey } from "./session-state.js";
export { parseLd65Config, defaultLd65ConfigText } from "./linker-config.js";
export { CA65_65XX_SESSION_STATE_ID, CA65_65XX_SYNTAX_PROFILE, ca65CpuNames, ca65CpuShorthands, ca65SessionStateKey, resolve65xxCpuName, rewriteCa65Command, } from "./ca65-profile.js";
//# sourceMappingURL=index.d.ts.map