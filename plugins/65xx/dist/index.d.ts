import type { AssemblerPlugin, PluginActivationContext } from "@uttori/asm-core/plugin";
export declare const RAW_65XX_TARGET_ID = "65xx.raw";
export declare const FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
export declare const RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
export declare const RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
export interface Raw65xxTargetOptions extends Readonly<Record<string, unknown>> {
    readonly origin: number;
}
export declare function createRaw65xxTargetOptions(configured: unknown): Raw65xxTargetOptions;
export declare function register65xxContributions(context: PluginActivationContext): void;
declare const plugin: AssemblerPlugin<Raw65xxTargetOptions>;
export declare function create65xxAssemblerEnvironment(options?: unknown): Promise<import("@uttori/asm-core").AssemblerEnvironment>;
export default plugin;
export { Arch65xx, materializeOpcodeForm } from "./architecture.js";
export { buildInstructionCatalog } from "./instructions/catalog.js";
export { getCpuAssemblyForms, getOpcodeForm, getCpuDecodeTable, nmos6502Cpu, nmos6502DecodeTable, nmos6502Forms, nmos6502xCpu, nmos6502xForms, } from "./instructions/opcodes.js";
export { cmos65c02Cpu, cmos65c02Forms, cmos65sc02Cpu, cmos65sc02Forms, commodore4510Cpu, commodore4510Forms, csg65ce02Cpu, csg65ce02Forms, mega65Gs02Cpu, mega65Gs02Forms, mos6502DtvCpu, mos6502DtvForms, variantCpus, variantFormsByCpuId, wdc65c02Cpu, wdc65c02Forms, } from "./instructions/variants.js";
export type { AddressingMode, CpuDefinition, CpuFeature, FeatureExpression, InstructionForm, OperandCodecId, OperandField, } from "./instructions/schema.js";
export { matchesFeatures } from "./instructions/schema.js";
export { classify65xxOperand } from "./operands/classifier.js";
//# sourceMappingURL=index.d.ts.map