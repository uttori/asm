import {
  definePlugin,
  NATIVE_SYNTAX_PROFILE,
  PLUGIN_API_VERSION,
  PluginManager,
} from "@uttori/asm-core";
import type {
  AssemblerPlugin,
  PluginActivationContext,
  TargetAddressSpace,
  TargetFactoryContext,
  TargetOutputFormat,
} from "@uttori/asm-core/plugin";

import { Arch65xx } from "./architecture.js";
import { buildInstructionCatalog } from "./instructions/catalog.js";
import {
  nmos6502Cpu,
  nmos6502Forms,
  nmos6502xCpu,
  nmos6502xForms,
} from "./instructions/opcodes.js";
import { variantCpus, variantFormsByCpuId } from "./instructions/variants.js";
import { classify65xxOperand } from "./operands/classifier.js";

export const RAW_65XX_TARGET_ID = "65xx.raw";
export const FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
export const RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
export const RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";

export interface Raw65xxTargetOptions extends Readonly<Record<string, unknown>> {
  readonly origin: number;
}

export function createRaw65xxTargetOptions(configured: unknown): Raw65xxTargetOptions {
  if (configured === undefined) return { origin: 0 };
  if (typeof configured !== "object" || configured === null || Array.isArray(configured)) {
    throw new Error("65xx raw target options must be an object with an optional numeric 'origin'.");
  }
  const keys = Object.keys(configured);
  const unknown = keys.filter((key) => key !== "origin");
  if (unknown.length > 0)
    throw new Error(`Unknown 65xx raw target option(s): ${unknown.join(", ")}.`);
  const value = "origin" in configured ? configured.origin : 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error("65xx raw target origin must be an integer from 0 through 65535.");
  }
  return { origin: value };
}

function createFlat65xxAddressSpace({ options }: TargetFactoryContext): TargetAddressSpace {
  const { origin } = createRaw65xxTargetOptions(options);
  const validate = (address: number): number => {
    if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
      throw new Error(`Address $${address.toString(16).toUpperCase()} is outside flat16.`);
    }
    return address;
  };
  return {
    addressWidth: 16,
    defaultOrigin: origin,
    normalizeForWrite: validate,
    advance(address, amount) {
      return validate(address + amount);
    },
    toOutputOffset(address) {
      return Number.isInteger(address) && address >= origin && address <= 0xffff
        ? address - origin
        : -1;
    },
    fromOutputOffset(offset) {
      const address = origin + offset;
      return Number.isInteger(offset) && offset >= 0 && address <= 0xffff ? address : -1;
    },
    validateWrite(address, width) {
      validate(address);
      validate(address + width - 1);
      if (address < origin) {
        throw new Error(
          `Address $${address.toString(16).toUpperCase()} precedes raw origin $${origin.toString(16).toUpperCase()}.`,
        );
      }
    },
  };
}

function createRaw65xxOutputFormat(): TargetOutputFormat {
  return {
    finalize: () => undefined,
    getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
  };
}

export function register65xxContributions(context: PluginActivationContext): void {
  for (const [cpu, forms] of [
    [nmos6502Cpu, nmos6502Forms],
    [nmos6502xCpu, nmos6502xForms],
    ...variantCpus.map((cpu) => [cpu, variantFormsByCpuId[cpu.id] ?? []] as const),
  ] as const) {
    const catalog = buildInstructionCatalog(forms);
    context.registerArchitecture({
      id: cpu.id,
      aliases: cpu.aliases,
      displayName: cpu.displayName,
      unknownInstructionBehavior: "throw",
      splitOperands: (text) => (text.trim() ? [text.trim()] : []),
      classifyOperand: ({ operands }, operand) => classify65xxOperand(operands, operand),
      createEncoder: (encoderContext) => new Arch65xx(encoderContext, cpu),
      instructions: catalog,
    });
  }

  context.registerAddressSpace({
    id: FLAT_65XX_ADDRESS_SPACE_ID,
    create: createFlat65xxAddressSpace,
  });
  context.registerOutputFormat({
    id: RAW_65XX_OUTPUT_FORMAT_ID,
    create: createRaw65xxOutputFormat,
  });
  context.registerLifecycle({
    id: RAW_65XX_LIFECYCLE_ID,
    create: ({ options }) => {
      const { origin } = createRaw65xxTargetOptions(options);
      return {
        onStageStart: ({ session }) => {
          session.setWritePosition(origin);
          session.bytes = 0;
        },
      };
    },
  });

  context.registerTarget({
    id: RAW_65XX_TARGET_ID,
    aliases: ["65xx", "6502-raw"],
    displayName: "65xx flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [nmos6502Cpu.id, nmos6502xCpu.id, ...variantCpus.map((cpu) => cpu.id)],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [],
    expressionSets: [],
    lifecycle: [RAW_65XX_LIFECYCLE_ID],
    syntaxProfile: NATIVE_SYNTAX_PROFILE,
    defaultOutputExtension: ".bin",
    createOptions: createRaw65xxTargetOptions,
  });
}

const plugin: AssemblerPlugin<Raw65xxTargetOptions> = definePlugin<Raw65xxTargetOptions>({
  manifest: {
    id: "uttori.asm-plugin-65xx",
    name: "Uttori ASM 65xx",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "65xx NMOS, CMOS, Commodore, and MEGA65 architectures with a flat raw target.",
  },
  validateOptions: createRaw65xxTargetOptions,
  activate: register65xxContributions,
});

export async function create65xxAssemblerEnvironment(options: unknown = {}) {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin, options }]);
  return manager.freeze();
}

export default plugin;
export { Arch65xx, materializeOpcodeForm } from "./architecture.js";
export { buildInstructionCatalog } from "./instructions/catalog.js";
export {
  getCpuAssemblyForms,
  getOpcodeForm,
  getCpuDecodeTable,
  nmos6502Cpu,
  nmos6502DecodeTable,
  nmos6502Forms,
  nmos6502xCpu,
  nmos6502xForms,
} from "./instructions/opcodes.js";
export {
  cmos65c02Cpu,
  cmos65c02Forms,
  cmos65sc02Cpu,
  cmos65sc02Forms,
  commodore4510Cpu,
  commodore4510Forms,
  csg65ce02Cpu,
  csg65ce02Forms,
  mega65Gs02Cpu,
  mega65Gs02Forms,
  mos6502DtvCpu,
  mos6502DtvForms,
  variantCpus,
  variantFormsByCpuId,
  wdc65c02Cpu,
  wdc65c02Forms,
} from "./instructions/variants.js";
export type {
  AddressingMode,
  CpuDefinition,
  CpuFeature,
  FeatureExpression,
  InstructionForm,
  OperandCodecId,
  OperandField,
} from "./instructions/schema.js";
export { matchesFeatures } from "./instructions/schema.js";
export { classify65xxOperand } from "./operands/classifier.js";
