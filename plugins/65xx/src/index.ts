import {
  CA65_SYNTAX_PROFILE,
  definePlugin,
  NATIVE_SYNTAX_PROFILE,
  PLUGIN_API_VERSION,
  PluginManager,
} from "@uttori/asm-core";
import type {
  AssemblerPlugin,
  DirectiveContribution,
  PluginActivationContext,
  TargetAddressSpace,
  TargetFactoryContext,
  TargetOutputFormat,
} from "@uttori/asm-core/plugin";
import type { DirectiveDescriptor } from "@uttori/asm-core";

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
import {
  handleAddr,
  handleByte,
  handleDbyt,
  handleExport,
  handleHibytes,
  handleImport,
  handleLobytes,
  handleSegment,
} from "./directives/ca65.js";
import {
  NES_65XX_SESSION_STATE_ID,
  cloneNes65xxSessionState,
  nes65xxSessionStateKey,
  resetNes65xxStageState,
} from "./session-state.js";
import {
  NES_65XX_ADDRESS_SPACE_ID,
  NES_65XX_LIFECYCLE_ID,
  NES_65XX_OUTPUT_FORMAT_ID,
  NES_65XX_TARGET_ID,
  createInitialNesState,
  createNes65xxTargetOptions,
  createNesAddressSpace,
  createNesLifecycle,
  createNesOutputFormat,
} from "./target/nes.js";

/** Flat 16-bit raw binary target (`65xx`, `6502-raw` aliases). */
export const RAW_65XX_TARGET_ID = "65xx.raw";
/** Identity map: logical address − origin = file offset. */
export const FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
export const RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
/** Resets PC to `origin` at the start of each assembly stage. */
export const RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
/** ca65 directive set used by the NES iNES target. */
export const CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";

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

const descriptor = (
  keyword: string,
  summary: string,
  syntax: string,
  group: string,
): DirectiveDescriptor => ({ keyword, summary, syntax, group });

const ca65Tooling: readonly DirectiveDescriptor[] = [
  descriptor("segment", "Switch to an ld65 segment.", '.segment "NAME"', "layout"),
  descriptor("export", "Export a symbol to other files.", ".export ident[, ident...]", "label"),
  descriptor(
    "import",
    "Import a symbol defined in another file.",
    ".import ident[, ident...]",
    "label",
  ),
  descriptor("byte", "Emit one or more bytes.", ".byte value[, value...]", "data"),
  descriptor("byt", "Alias for .byte.", ".byt value[, value...]", "data"),
  descriptor("addr", "Emit 16-bit little-endian addresses.", ".addr value[, value...]", "data"),
  descriptor("word", "Alias for .addr.", ".word value[, value...]", "data"),
  descriptor(
    "lobytes",
    "Emit the low byte of each expression.",
    ".lobytes expr[, expr...]",
    "data",
  ),
  descriptor(
    "hibytes",
    "Emit the high byte of each expression.",
    ".hibytes expr[, expr...]",
    "data",
  ),
  descriptor("dbyt", "Emit 16-bit big-endian words.", ".dbyt value[, value...]", "data"),
];

const toolingFor = (keywords: readonly string[]): DirectiveDescriptor[] => {
  const wanted = new Set(keywords);
  return ca65Tooling.filter((entry) => wanted.has(entry.keyword));
};

/**
 * Registers a lowered-phase 65xx directive and attaches hover/completion copy.
 * @param {string} id The directive id.
 * @param {readonly string[]} keywords The directive keywords.
 * @param {DirectiveContribution["createHandler"]} handler The directive handler.
 * @returns {DirectiveContribution} The directive contribution.
 */
const directive = (
  id: string,
  keywords: readonly string[],
  handler: DirectiveContribution["createHandler"],
): DirectiveContribution => ({
  id,
  keywords,
  phase: "lowered",
  createHandler: handler,
  tooling: toolingFor(keywords),
});

/**
 * 16-bit address space with no bank wrap; writes below `origin` are rejected.
 * @param {TargetFactoryContext} options The target factory context.
 * @returns {TargetAddressSpace} The address space.
 */
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

/**
 * Headerless dump of the output buffer - no checksum or padding.
 * @returns {TargetOutputFormat} The output format.
 */
function createRaw65xxOutputFormat(): TargetOutputFormat {
  return {
    finalize: () => undefined,
    getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
  };
}

/**
 * Registers NMOS/CMOS/Commodore/MEGA65 architectures plus the flat raw target.
 * Used by the plugin `activate` hook and by tests that want contributions
 * without constructing a full plugin object.
 *
 * @param {PluginActivationContext} context Plugin activation context.
 */
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
      // Same as 65816: `LDA $12,x` is one operand, not two.
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

  context.registerSessionState({
    id: NES_65XX_SESSION_STATE_ID,
    create: createInitialNesState,
    clone: cloneNes65xxSessionState,
    resetForStage: resetNes65xxStageState,
  });
  context.registerAddressSpace({
    id: NES_65XX_ADDRESS_SPACE_ID,
    create: createNesAddressSpace,
  });
  context.registerOutputFormat({
    id: NES_65XX_OUTPUT_FORMAT_ID,
    create: createNesOutputFormat,
  });
  context.registerLifecycle({
    id: NES_65XX_LIFECYCLE_ID,
    create: createNesLifecycle,
  });
  context.registerDirectiveSet({
    id: CA65_65XX_DIRECTIVE_SET_ID,
    directives: [
      directive(
        "65xx.directive.segment",
        ["segment"],
        ({ session, state }) =>
          (_ctx, words) =>
            handleSegment(session, state.get(nes65xxSessionStateKey), words),
      ),
      directive(
        "65xx.directive.export",
        ["export"],
        ({ session }) =>
          (_ctx, words) =>
            handleExport(session, words),
      ),
      directive(
        "65xx.directive.import",
        ["import"],
        ({ session }) =>
          (_ctx, words) =>
            handleImport(session, words),
      ),
      directive(
        "65xx.directive.byte",
        ["byte", "byt"],
        ({ session }) =>
          (_ctx, words) =>
            handleByte(session, words),
      ),
      directive(
        "65xx.directive.addr",
        ["addr", "word"],
        ({ session }) =>
          (_ctx, words) =>
            handleAddr(session, words),
      ),
      directive(
        "65xx.directive.lobytes",
        ["lobytes"],
        ({ session }) =>
          (_ctx, words) =>
            handleLobytes(session, words),
      ),
      directive(
        "65xx.directive.hibytes",
        ["hibytes"],
        ({ session }) =>
          (_ctx, words) =>
            handleHibytes(session, words),
      ),
      directive(
        "65xx.directive.dbyt",
        ["dbyt"],
        ({ session }) =>
          (_ctx, words) =>
            handleDbyt(session, words),
      ),
    ],
    tooling: ca65Tooling,
  });
  context.registerTarget({
    id: NES_65XX_TARGET_ID,
    aliases: ["nes", "ines", "6502-nes"],
    displayName: "NES iNES (ca65 / ld65 layout)",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [nmos6502Cpu.id, nmos6502xCpu.id, ...variantCpus.map((cpu) => cpu.id)],
    addressSpace: NES_65XX_ADDRESS_SPACE_ID,
    outputFormat: NES_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [],
    lifecycle: [NES_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_SYNTAX_PROFILE,
    defaultOutputExtension: ".nes",
    createOptions: createNes65xxTargetOptions,
  });
}

const plugin: AssemblerPlugin<Raw65xxTargetOptions> = definePlugin<Raw65xxTargetOptions>({
  manifest: {
    id: "uttori.asm-plugin-65xx",
    name: "Uttori ASM 65xx",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description:
      "65xx NMOS, CMOS, Commodore, and MEGA65 architectures with raw and NES iNES targets.",
  },
  validateOptions: createRaw65xxTargetOptions,
  activate: register65xxContributions,
});

/**
 * Activates this plugin and freezes a reusable host environment.
 *
 * @param {unknown} options Raw-target options (`origin`, …).
 * @returns {Promise<AssemblerEnvironment>} Frozen assembler environment.
 */
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
export {
  NES_65XX_ADDRESS_SPACE_ID,
  NES_65XX_LIFECYCLE_ID,
  NES_65XX_OUTPUT_FORMAT_ID,
  NES_65XX_TARGET_ID,
  createNes65xxTargetOptions,
} from "./target/nes.js";
export { NES_65XX_SESSION_STATE_ID, nes65xxSessionStateKey } from "./session-state.js";
export { parseLd65Config, defaultLd65ConfigText } from "./linker-config.js";
