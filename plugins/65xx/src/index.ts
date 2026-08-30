import {
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
  handleAlign,
  handleAddr,
  handleByte,
  handleCa65Assert,
  handleCa65Incbin,
  handleCpuShorthand,
  handleDbyt,
  handleDword,
  handleEndScope,
  handleExport,
  handleFlatSegment,
  handleHibytes,
  handleImport,
  handleLobytes,
  handlePopcpu,
  handlePopseg,
  handlePushcpu,
  handlePushseg,
  handleRes,
  handleScope,
  handleSegment,
  handleSetcpu,
  handleUnsupportedCa65,
} from "./directives/ca65.js";
import {
  CA65_65XX_SESSION_STATE_ID,
  CA65_65XX_SYNTAX_PROFILE,
  ca65CpuPredicateByArchitecture,
  ca65CpuShorthands,
  ca65SessionStateKey,
  cloneCa65SessionState,
  createCa65SessionState,
  resetCa65StageState,
} from "./ca65-profile.js";
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
/** Headerless raw target using the ca65 source profile. */
export const CA65_RAW_65XX_TARGET_ID = "65xx.ca65-raw";
/** ca65 directive set used by ca65-profile targets. */
export const CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";
export const CA65_65XX_EXPRESSION_SET_ID = "65xx.ca65-expressions";
export const CA65_65XX_LIFECYCLE_ID = "65xx.ca65-lifecycle";

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
  descriptor("setcpu", "Select a 65xx CPU.", '.setcpu "CPU"', "architecture"),
  descriptor("cpu", "Alias for .setcpu.", '.cpu "CPU"', "architecture"),
  descriptor("pushcpu", "Push the current CPU.", ".pushcpu", "architecture"),
  descriptor("popcpu", "Restore the pushed CPU.", ".popcpu", "architecture"),
  descriptor("segment", "Switch to an ld65 segment.", '.segment "NAME"', "layout"),
  descriptor("pushseg", "Push the current flat segment.", ".pushseg", "layout"),
  descriptor("popseg", "Restore the pushed flat segment.", ".popseg", "layout"),
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
  descriptor("dword", "Emit 32-bit little-endian values.", ".dword value[, value...]", "data"),
  descriptor(
    "faraddr",
    "Emit 24-bit little-endian addresses.",
    ".faraddr value[, value...]",
    "data",
  ),
  descriptor("res", "Reserve bytes with an optional fill value.", ".res count[, fill]", "data"),
  descriptor("align", "Align the location counter.", ".align boundary[, fill]", "layout"),
  descriptor("incbin", "Include a binary range.", '.incbin "file"[, offset[, size]]', "include"),
  descriptor(
    "assert",
    "Require an expression to be true.",
    '.assert expr[, error[, "message"]]',
    "diagnostic",
  ),
  descriptor("scope", "Enter a lexical scope.", ".scope [name]", "label"),
  descriptor("endscope", "Leave a lexical scope.", ".endscope", "label"),
  descriptor("proc", "Define and enter a procedure scope.", ".proc name", "label"),
  descriptor("endproc", "Leave a procedure scope.", ".endproc", "label"),
];

const ca65ExpressionFunctions: readonly [string, string, (value: number) => number][] = [
  ["lobyte", "Low byte of a value.", (value) => value & 0xff],
  ["hibyte", "High byte of a value.", (value) => (value >>> 8) & 0xff],
  ["bankbyte", "Bank byte of a value.", (value) => (value >>> 16) & 0xff],
  ["loword", "Low word of a value.", (value) => value & 0xffff],
  ["hiword", "High word of a value.", (value) => (value >>> 16) & 0xffff],
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
 * Registers NMOS/CMOS/Commodore/MEGA65/Hudson/Mitsubishi architectures plus the flat raw target.
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
    id: CA65_65XX_SESSION_STATE_ID,
    create: createCa65SessionState,
    clone: cloneCa65SessionState,
    resetForStage: resetCa65StageState,
  });
  context.registerExpressionSet({
    id: CA65_65XX_EXPRESSION_SET_ID,
    functions: ca65ExpressionFunctions.map(([name, summary, transform]) => ({
      name,
      signature: { parameters: ["value"], minimumArguments: 1, maximumArguments: 1 },
      summary,
      evaluate: (_expressionContext, args) => {
        const value = args[0];
        if (typeof value !== "number") throw new Error(`${name}() expects a numeric argument.`);
        return transform(value);
      },
    })),
  });
  context.registerLifecycle({
    id: CA65_65XX_LIFECYCLE_ID,
    create: () => {
      const updatePredicates = (
        session: import("@uttori/asm-core").Assembler,
        architecture: string,
      ) => {
        for (const [cpu, symbol] of Object.entries(ca65CpuPredicateByArchitecture)) {
          session.globalSymbols.add(symbol);
          session.labelTable.set(symbol, { value: cpu === architecture ? 1 : 0, isStatic: true });
        }
      };
      return {
        onSessionCreated: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.defaultArchitecture = session.resolveActiveArchitecture().name;
          profile.currentArchitecture = profile.defaultArchitecture;
          updatePredicates(session, profile.defaultArchitecture);
        },
        onStageStart: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          session.selectArchitecture(profile.defaultArchitecture, profile.defaultArchitecture);
        },
        onArchitectureSelected: ({ session, state, architecture }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.currentArchitecture = architecture;
          updatePredicates(session, architecture);
        },
      };
    },
  });

  context.registerTarget({
    id: CA65_RAW_65XX_TARGET_ID,
    aliases: ["ca65-raw"],
    displayName: "65xx ca65-compatible flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [nmos6502Cpu.id, nmos6502xCpu.id, ...variantCpus.map((cpu) => cpu.id)],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [RAW_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
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
        ({ targetId, session, state }) =>
          (_ctx, words) => {
            if (targetId === NES_65XX_TARGET_ID) {
              handleSegment(session, state.get(nes65xxSessionStateKey), words);
            } else {
              handleFlatSegment(state.get(ca65SessionStateKey), words);
            }
          },
      ),
      directive(
        "65xx.directive.setcpu",
        ["setcpu", "cpu"],
        ({ session, state }) =>
          (_ctx, words) =>
            handleSetcpu(session, state.get(ca65SessionStateKey), words),
      ),
      directive(
        "65xx.directive.pushcpu",
        ["pushcpu"],
        ({ session, state }) =>
          () =>
            handlePushcpu(session, state.get(ca65SessionStateKey)),
      ),
      directive(
        "65xx.directive.popcpu",
        ["popcpu"],
        ({ session, state }) =>
          () =>
            handlePopcpu(session, state.get(ca65SessionStateKey)),
      ),
      directive(
        "65xx.directive.cpu-shorthand",
        Object.keys(ca65CpuShorthands),
        ({ session, state }) =>
          (_ctx, words) =>
            handleCpuShorthand(session, state.get(ca65SessionStateKey), words),
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
      directive(
        "65xx.directive.dword",
        ["dword"],
        ({ session }) =>
          (_ctx, words) =>
            handleDword(session, words),
      ),
      directive(
        "65xx.directive.faraddr",
        ["faraddr"],
        ({ session }) =>
          (_ctx, words) =>
            handleDword(session, words, 3),
      ),
      directive(
        "65xx.directive.res",
        ["res"],
        ({ session }) =>
          (_ctx, words) =>
            handleRes(session, words),
      ),
      directive(
        "65xx.directive.align",
        ["align"],
        ({ session }) =>
          (_ctx, words) =>
            handleAlign(session, words),
      ),
      directive(
        "65xx.directive.incbin",
        ["incbin"],
        ({ session }) =>
          (_ctx, words) =>
            handleCa65Incbin(session, words),
      ),
      directive(
        "65xx.directive.assert",
        ["assert"],
        ({ session }) =>
          (_ctx, words) =>
            handleCa65Assert(session, words),
      ),
      directive(
        "65xx.directive.scope",
        ["scope", "proc"],
        ({ session, state }) =>
          (_ctx, words) =>
            handleScope(
              session,
              state.get(ca65SessionStateKey),
              words,
              (words[0] ?? "").replace(/^\./, "").toLowerCase() === "proc",
            ),
      ),
      directive(
        "65xx.directive.endscope",
        ["endscope", "endproc"],
        ({ session, state }) =>
          () =>
            handleEndScope(session, state.get(ca65SessionStateKey)),
      ),
      directive(
        "65xx.directive.pushseg",
        ["pushseg"],
        ({ state }) =>
          () =>
            handlePushseg(state.get(ca65SessionStateKey)),
      ),
      directive(
        "65xx.directive.popseg",
        ["popseg"],
        ({ state }) =>
          () =>
            handlePopseg(state.get(ca65SessionStateKey)),
      ),
      directive(
        "65xx.directive.unsupported-object",
        [
          "autoimport",
          "constructor",
          "debuginfo",
          "destructor",
          "exportzp",
          "forceimport",
          "globalzp",
          "importzp",
          "interruptor",
          "reloc",
        ],
        () => (_ctx, words) => handleUnsupportedCa65(words),
      ),
      directive("65xx.directive.unsupported-macro", ["exitmacro", "local"], () => (_ctx, words) => {
        throw new Error(
          `.${(words[0] ?? "").replace(/^\./, "")} is not yet supported by the ca65 macro compatibility slice.`,
        );
      }),
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
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [NES_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
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
      "65xx NMOS, CMOS, Commodore, MEGA65, Hudson, and Mitsubishi architectures with raw and NES iNES targets.",
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
  hudsonHuC6280Cpu,
  hudsonHuC6280Forms,
  mitsubishiM740Cpu,
  mitsubishiM740Forms,
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
export {
  CA65_65XX_SESSION_STATE_ID,
  CA65_65XX_SYNTAX_PROFILE,
  ca65CpuNames,
  ca65CpuShorthands,
  ca65SessionStateKey,
  resolve65xxCpuName,
  rewriteCa65Command,
} from "./ca65-profile.js";
