import {
  ASAR_SYNTAX_PROFILE,
  definePlugin,
  PluginManager,
  PLUGIN_API_VERSION,
  type AssemblerEnvironment,
} from "@uttori/asm-core";
import { syntaxExpression, syntaxRecord, syntaxString } from "@uttori/asm-core/plugin";
import type {
  AssemblerPlugin,
  DirectiveContribution,
  ExpressionSetContribution,
  TargetFactoryContext,
} from "@uttori/asm-core/plugin";
import { type DirectiveDescriptor } from "@uttori/asm-core/tooling";

import { Cpu65816Decoder } from "./architectures/65816-decoder.js";
import { cpu65816Specifications } from "./architectures/65816-spec.js";
import { parse65816Operands } from "./architectures/65816-syntax.js";
import { cachedOperandGrammar } from "./architectures/operand-plans.js";
import { Spc700Decoder } from "./architectures/spc700-decoder.js";
import { spc700Specifications } from "./architectures/spc700-spec.js";
import { parseSpcOperands } from "./architectures/spc700-syntax.js";
import { SuperFxDecoder } from "./architectures/superfx-decoder.js";
import { superFxSpecifications } from "./architectures/superfx-spec.js";
import { parseSuperFxOperands } from "./architectures/superfx-syntax.js";
import { Typed65816 } from "./architectures/typed-65816.js";
import { TypedSpc700 } from "./architectures/typed-spc700.js";
import { TypedSuperFx } from "./architectures/typed-superfx.js";
import {
  ASAR_COMPAT_NO_OP_DIRECTIVES,
  applyMapperSelection,
  calculateHeaderChecksum,
  getChecksumHeaderOffset,
  shouldEnableSpcInlineCompat,
  shouldEndifCloseInnermostWhile,
  shouldRedirectOrgToSpcblock,
  shouldUseNoromAddressing,
} from "./asar/compatibility.js";
import { snesAssetFormats } from "./assets/assembly-formats.js";
import { checkDirectiveSyntax, MAPPER_KEYWORDS } from "./directives/layout.js";
import { createSpcRuntime } from "./directives/spc.js";
import { snesDirectiveSyntax } from "./directives/syntax.js";
import {
  cloneSnesSessionState,
  SNES_SESSION_STATE_ID,
  snesSessionStateKey,
  type SnesSessionState,
} from "./session-state.js";
import { snesRomAddressSpace } from "./target/address-space.js";
import { createSnesLinkTarget, createSnesSourceLinkRecipe } from "./target/link-target.js";
import { directiveCatalog } from "./tooling/directive-catalog.js";
import { cpu65816Catalog, spc700Catalog, superFxCatalog } from "./tooling/instruction-catalog.js";

/** Canonical SNES cartridge target id (`snes`, `sfc`, `snes-65816` are aliases). */
export const SNES_TARGET_ID = "snes.sfc";

/**
 * Target options accepted by `validateOptions` / `createOptions`.
 * Unknown keys are ignored. `checksumMode` is the only enum that throws.
 */
export interface SnesTargetOptions extends Record<string, unknown> {
  readonly checksumMode: "asar" | "simple";
  readonly checksumEnabled: boolean;
  /** When true, Super FX auto-MOVE short RAM uses Asar's raw byte, not `addr >> 1`. */
  readonly asarSuperFxMoveShortAddress: boolean;
  /** Optional diagnostic sink for unpublished layout measurement. Without it, a bank crossing throws.
   * The caller must reject or reassemble the measured image before publishing; PC wrap rules are unchanged.
   */
  readonly onBankCrossing?: (address: number, width: number) => void;
}

/**
 * Selects catalog entries whose keyword is in `keywords`.
 * @param {readonly string[]} keywords Directive keywords to document.
 * @returns {DirectiveDescriptor[]} Matching catalog descriptors.
 */
const toolingFor = (keywords: readonly string[]): DirectiveDescriptor[] => {
  const wanted = new Set(keywords);
  return directiveCatalog.filter((descriptor) => wanted.has(descriptor.keyword));
};

/**
 * Registers a lowered-phase SNES directive and attaches matching hover/completion copy.
 * @param {string} id The directive id.
 * @param {readonly string[]} keywords The directive keywords.
 * @returns {DirectiveContribution} The directive contribution.
 */
const directive = (id: string, keywords: readonly string[]): DirectiveContribution => ({
  id,
  keywords,
  phase: "lowered",
  syntax: snesDirectiveSyntax(id),
  tooling: toolingFor(keywords),
});

/**
 * Reads a numeric expression-function argument.
 * @param {string} functionName Built-in name used in the error message.
 * @param {readonly (number | string)[]} args Evaluated arguments.
 * @param {number} index Argument index.
 * @returns {number} The numeric argument.
 * @throws {Error} If the argument is not a number.
 */
const numericArgument = (
  functionName: string,
  args: readonly (number | string)[],
  index: number,
): number => {
  const value = args[index];
  if (typeof value !== "number") {
    throw new Error(`${functionName}() argument ${index + 1} must be numeric.`);
  }
  return value;
};

/** `snestopc` / `pctosnes` - mapper-aware CPU ↔ file offset conversion. */
const addressExpressions: ExpressionSetContribution = {
  id: "snes.address-functions",
  functions: [
    {
      name: "snestopc",
      signature: { parameters: ["address"] },
      summary: "Convert a SNES address to an output offset.",
      evaluate: ({ addresses }, args) =>
        addresses.toOutputOffset(numericArgument("snestopc", args, 0)),
    },
    {
      name: "pctosnes",
      signature: { parameters: ["offset"] },
      summary: "Convert an output offset to a SNES address.",
      evaluate: ({ addresses }, args) =>
        addresses.fromOutputOffset(numericArgument("pctosnes", args, 0)),
    },
  ],
};

/**
 * Asar `readN` / `canreadN` against the base image.
 * `readN` without a default throws until `check title` sets `readFunctionsEnabled`.
 */
const readExpressions: ExpressionSetContribution = {
  id: "snes.read-functions",
  functions: [
    ...[1, 2, 3, 4].map((size) => ({
      name: `canread${size}`,
      signature: { parameters: ["position"] },
      summary: `Return whether ${size} byte(s) can be read from the base image.`,
      evaluate: (
        context: Parameters<ExpressionSetContribution["functions"][number]["evaluate"]>[0],
        args: readonly (number | string)[],
      ) => context.output.canRead(numericArgument(`canread${size}`, args, 0), size),
    })),
    {
      name: "canread",
      signature: { parameters: ["position", "size"] },
      summary: "Return whether a range can be read from the base image.",
      evaluate: ({ output }, args) =>
        output.canRead(numericArgument("canread", args, 0), numericArgument("canread", args, 1)),
    },
    ...[1, 2, 3, 4].map((size) => ({
      name: `read${size}`,
      signature: {
        parameters: ["position", "defaultValue"],
        minimumArguments: 1,
        maximumArguments: 2,
      },
      summary: `Read ${size} byte(s) from the base image.`,
      evaluate: (
        context: Parameters<ExpressionSetContribution["functions"][number]["evaluate"]>[0],
        args: readonly (number | string)[],
      ) => {
        const position = numericArgument(`read${size}`, args, 0);
        const defaultValue = args.length > 1 ? numericArgument(`read${size}`, args, 1) : undefined;
        const state = context.state.get(snesSessionStateKey);
        if (!state.readFunctionsEnabled && defaultValue === undefined) {
          throw new Error(
            `Esnes_address_out_of_bounds: SNES address ${position.toString(16).toUpperCase().padStart(6, "0")} in read function out of bounds.`,
          );
        }
        return context.output.read(position, size, defaultValue);
      },
    })),
  ],
};

/**
 * Coerces plugin/target options. Missing object → defaults.
 * `checksumEnabled` defaults true. Only an explicit `false` disables it.
 * @param {unknown} configured The configured options.
 * @returns {SnesTargetOptions} The target options.
 */
/**
 * Accepts a JSON object. Arrays and null are not option maps.
 * @param {unknown} value Candidate target options.
 * @returns {boolean} True when `value` is a non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Accepts the checksum mode enum.
 * @param {unknown} value Candidate mode.
 * @returns {boolean} True for `asar` or `simple`.
 */
const isChecksumMode = (value: unknown): value is "asar" | "simple" =>
  value === "asar" || value === "simple";

/**
 * Accepts the optional bank-crossing diagnostic. Any function is kept; the caller supplies the signature.
 * @param {unknown} value Candidate callback.
 * @returns {boolean} True when `value` is a function.
 */
const isBankCrossingHandler = (value: unknown): value is (address: number, width: number) => void =>
  typeof value === "function";

const targetOptions = (configured: unknown): SnesTargetOptions => {
  const value = isRecord(configured) ? configured : {};
  const checksumMode = value.checksumMode ?? "asar";
  if (!isChecksumMode(checksumMode)) {
    throw new Error("checksumMode must be 'asar' or 'simple'.");
  }
  return {
    checksumMode,
    checksumEnabled: value.checksumEnabled === undefined ? true : value.checksumEnabled === true,
    asarSuperFxMoveShortAddress: value.asarSuperFxMoveShortAddress === true,
    onBankCrossing: isBankCrossingHandler(value.onBankCrossing) ? value.onBankCrossing : undefined,
  };
};

/**
 * Default session: LoROM, SA-1 banks 0/1/2/3 in slots 0/1/4/5, bankcross full,
 * DP optimize off, checksum from target options.
 * @param {Readonly<Record<string, unknown>>} context The context.
 * @param {Readonly<Record<string, unknown>>} context.targetOptions The target options.
 * @returns {SnesSessionState} The initial state.
 */
const createInitialState = (context: {
  targetOptions: Readonly<Record<string, unknown>>;
}): SnesSessionState => {
  const options = targetOptions(context.targetOptions);
  return {
    mapper: "lorom",
    sa1Banks: [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1],
    checksumEnabled: options.checksumEnabled,
    checksumMode: options.checksumMode,
    bankCrossMode: "full",
    onBankCrossing: options.onBankCrossing,
    readFunctionsEnabled: false,
    optimizeDirectPage: false,
    asarSuperFxMoveShortAddress: options.asarSuperFxMoveShortAddress,
    outputFillByte: 0,
    activeFreespaceStartOffset: null,
    activeFreespaceContentStartOffset: null,
    activeFreespaceEndOffset: null,
    inSpcBlock: false,
    spcBlock: null,
    spcPreviousArchitecture: null,
    spcInlineCompatibility: false,
    cpuStack: [],
  };
};

/**
 * SNES plugin: 65816 / SPC700 / Super FX, mapper address space, `.sfc` checksum
 * output, Asar-flavored directives, and lifecycle hooks (inline SPC, freespace
 * STAR patch, bank-cross writes).
 */
const plugin: AssemblerPlugin<SnesTargetOptions> = definePlugin({
  manifest: {
    id: "uttori.asm-plugin-snes",
    name: "Uttori ASM SNES Plugin",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "SNES targets, architectures, directives, expressions, and Asar compatibility.",
  },
  validateOptions: targetOptions,
  activate(context) {
    for (const format of snesAssetFormats) {
      context.registerAssetFormat(format);
    }
    context.registerSessionState({
      id: SNES_SESSION_STATE_ID,
      create: createInitialState,
      clone: cloneSnesSessionState,
      resetForStage: (state) => {
        // Mapper/checksum/optimize persist across stages. Open blocks do not.
        state.activeFreespaceStartOffset = null;
        state.activeFreespaceContentStartOffset = null;
        state.activeFreespaceEndOffset = null;
        state.inSpcBlock = false;
        state.spcBlock = null;
        state.spcPreviousArchitecture = null;
        state.spcInlineCompatibility = false;
      },
    });

    context.registerArchitecture({
      id: "snes.65816",
      operandGrammar: { version: "2", parse: cachedOperandGrammar(parse65816Operands) },
      aliases: ["65816", "65c816", "65802"],
      displayName: "WDC 65C816",
      unknownInstructionBehavior: "throw",

      createTypedEncoder: (factory) =>
        new Typed65816(() => factory.state.get(snesSessionStateKey).optimizeDirectPage),
      createDecoder: () => new Cpu65816Decoder(),
      instructionSpecifications: cpu65816Specifications,
      instructions: cpu65816Catalog,
    });
    context.registerArchitecture({
      id: "snes.spc700",
      operandGrammar: { version: "2", parse: cachedOperandGrammar(parseSpcOperands) },
      aliases: ["spc700", "spc700-raw", "spc700-inline"],
      displayName: "Sony SPC700",
      unknownInstructionBehavior: "throw",

      createTypedEncoder: () => new TypedSpc700(),
      createDecoder: () => new Spc700Decoder(),
      instructionSpecifications: spc700Specifications,
      instructions: spc700Catalog,
    });
    context.registerArchitecture({
      id: "snes.superfx",
      operandGrammar: { version: "2", parse: cachedOperandGrammar(parseSuperFxOperands) },
      aliases: ["superfx"],
      displayName: "Super FX",
      unknownInstructionBehavior: "returnFalse",

      createTypedEncoder: (factory) =>
        new TypedSuperFx(() => factory.state.get(snesSessionStateKey).asarSuperFxMoveShortAddress),
      createDecoder: () => new SuperFxDecoder(),
      instructionSpecifications: superFxSpecifications,
      instructions: superFxCatalog,
    });

    context.registerAddressSpace({
      id: "snes.cpu",
      create: ({ state }: TargetFactoryContext) => {
        const mappingContext = () => {
          const targetState = state.get(snesSessionStateKey);
          return {
            mapper: targetState.mapper,
            sa1banks: targetState.sa1Banks,
            bankCrossCheckMode: targetState.bankCrossMode,
          };
        };
        return {
          addressWidth: snesRomAddressSpace.addressWidth,
          defaultOrigin: snesRomAddressSpace.defaultOrigin,
          normalizeForWrite: (address) =>
            snesRomAddressSpace.normalizeForWrite(address, mappingContext()),
          advance: (address, amount) =>
            snesRomAddressSpace.advance(address, amount, mappingContext()),
          toOutputOffset: (address) =>
            snesRomAddressSpace.toOutputOffset(address, mappingContext()),
          fromOutputOffset: (offset) =>
            snesRomAddressSpace.fromOutputOffset(offset, mappingContext()),
          validateWrite: (address, width) => {
            const targetState = state.get(snesSessionStateKey);
            const normalized = snesRomAddressSpace.normalizeForWrite(address, mappingContext());
            // Unmapped writes are allowed (Asar). Only mapped multi-byte stores check borders.
            if (snesRomAddressSpace.toOutputOffset(normalized, mappingContext()) < 0) {
              return;
            }
            if (targetState.bankCrossMode === "off" || width <= 1) {
              return;
            }
            const start = address & 0xffffff;
            const end = (start + width - 1) & 0xffffff;
            // `half` = 32 KiB ($8000) border. `full` = 64 KiB bank. Bit 23 is ignored
            // so $7Fxxxx and $FFxxxx are the same bank for this check.
            const bankMask = targetState.bankCrossMode === "half" ? 0x7fff8000 : 0x7fff0000;
            if (((start ^ end) & bankMask) !== 0) {
              if (targetState.onBankCrossing) {
                targetState.onBankCrossing(start, width);
                return;
              }
              const errorAddress = (start + width) & 0xffffff;
              throw new Error(
                `Ebank_border_crossed: A bank border was crossed, logical address $${errorAddress.toString(16).toUpperCase().padStart(6, "0")}.`,
              );
            }
          },
        };
      },
    });

    context.registerOutputFormat({
      id: "snes.sfc-output",
      create: ({ state }) => ({
        finalize: ({ outputBytes }) => {
          const targetState = state.get(snesSessionStateKey);
          if (!targetState.checksumEnabled) {
            return;
          }
          const headerOffset = getChecksumHeaderOffset(targetState.mapper);
          if (outputBytes.length < headerOffset + 0x20) {
            return;
          }
          // Zero the checksum fields first so they do not contribute to the sum
          // (complement starts as $FFFF, checksum as $0000 - SNES header convention).
          outputBytes[headerOffset + 0x1c] = 0xff;
          outputBytes[headerOffset + 0x1d] = 0xff;
          outputBytes[headerOffset + 0x1e] = 0;
          outputBytes[headerOffset + 0x1f] = 0;
          const checksum = calculateHeaderChecksum(outputBytes, targetState.checksumMode);
          const complement = ~checksum & 0xffff;
          outputBytes[headerOffset + 0x1c] = complement & 0xff;
          outputBytes[headerOffset + 0x1d] = (complement >> 8) & 0xff;
          outputBytes[headerOffset + 0x1e] = checksum & 0xff;
          outputBytes[headerOffset + 0x1f] = (checksum >> 8) & 0xff;
        },
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });

    context.registerDirectiveSet({
      id: "snes.mapper-directives",
      directives: [directive("snes.directive.mapper", MAPPER_KEYWORDS)],
    });
    context.registerDirectiveSet({
      id: "snes.policy-directives",
      tooling: toolingFor(["arch"]),
      directives: [
        {
          id: "snes.directive.check",
          keywords: ["check"],
          phase: "lowered",
          syntax: checkDirectiveSyntax,
          tooling: toolingFor(["check"]),
        },
        directive("snes.directive.optimize", ["optimize"]),
        directive("snes.directive.asar-noops", ASAR_COMPAT_NO_OP_DIRECTIVES),
      ],
    });
    context.registerDirectiveSet({
      id: "snes.ca65-compat-directives",
      directives: [
        directive("snes.directive.ca65.a8", [".a8"]),
        directive("snes.directive.ca65.a16", [".a16"]),
        directive("snes.directive.ca65.i8", [".i8"]),
        directive("snes.directive.ca65.i16", [".i16"]),
        directive("snes.directive.ca65.accu", [".accu"]),
        directive("snes.directive.ca65.index", [".index"]),
        directive("snes.directive.ca65.smart", [".smart"]),
        directive("snes.directive.ca65.setcpu", [".setcpu"]),
        directive("snes.directive.ca65.pushcpu", [".pushcpu"]),
        directive("snes.directive.ca65.popcpu", [".popcpu"]),
      ],
    });
    context.registerDirectiveSet({
      id: "snes.memory-directives",
      directives: [
        directive("snes.directive.freespace", ["freecode", "freespace", "freedata"]),
        directive("snes.directive.freespacebyte", ["freespacebyte"]),
        directive("snes.directive.prot", ["prot"]),
      ],
    });
    context.registerDirectiveSet({
      id: "snes.spc-directives",
      directives: [
        directive("snes.directive.spcblock", ["spcblock"]),
        directive("snes.directive.endspcblock", ["endspcblock"]),
        directive("snes.directive.startpos", ["startpos"]),
      ],
    });

    context.registerExpressionSet(addressExpressions);
    context.registerExpressionSet(readExpressions);
    context.registerLifecycle({
      id: "snes.lifecycle",
      beforeDirectiveKeywords: ["arch", "org", "namespace"],
      create: ({ state }) => ({
        onSessionCreated: ({ session }) => {
          session.outputFillByte = state.get(snesSessionStateKey).outputFillByte;
        },
        beforeDirective: ({ session, keyword, syntax }) => {
          const targetState = state.get(snesSessionStateKey);
          if (targetState.inSpcBlock && ["arch", "org", "namespace"].includes(keyword)) {
            throw new Error(`${keyword.toUpperCase()} is unavailable inside spcblock.`);
          }
          if (
            keyword === "org" &&
            shouldRedirectOrgToSpcblock(targetState.spcInlineCompatibility)
          ) {
            const payload = syntax?.kind === "plugin" ? syntax.payload : undefined;
            if (syntaxRecord({ address: syntaxExpression, text: syntaxString })(payload)) {
              createSpcRuntime(session, targetState).executeSpcblock({
                destination: payload.address,
                destinationText: payload.text,
              });
            } else {
              // Malformed or stale syntax must retain its parser diagnostic, never retry as words.
              if (syntax?.kind === "plugin" && syntax.error) {
                throw new Error(syntax.error);
              }
              throw new Error("SPC inline ORG requires its parsed address payload.");
            }
            return "handled";
          }
          return "continue";
        },
        onArchitectureSelected: ({ sourceAlias }) => {
          const targetState = state.get(snesSessionStateKey);
          targetState.spcInlineCompatibility = shouldEnableSpcInlineCompat(sourceAlias);
          if (shouldUseNoromAddressing(sourceAlias)) {
            applyMapperSelection(targetState, "norom");
          }
        },
        shouldEndifCloseInnermostWhile: ({ loopType, loopStartLine, ifStartLine }) =>
          shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
        beforeWrite: ({ session, logicalAddress, width }) => {
          const targetState = state.get(snesSessionStateKey);
          if (targetState.activeFreespaceStartOffset === null) {
            return;
          }
          const outputOffset = session.outputWriter.toOutputOffset(logicalAddress);
          if (outputOffset < 0) {
            return;
          }
          const endOffset = outputOffset + width - 1;
          targetState.activeFreespaceEndOffset = Math.max(
            targetState.activeFreespaceEndOffset ?? endOffset,
            endOffset,
          );
        },
        onStageEnd: ({ session }) => {
          createSpcRuntime(session, state.get(snesSessionStateKey)).finishPass();
        },
        beforeOutputFinalize: ({ outputBytes }) => {
          const targetState = state.get(snesSessionStateKey);
          const start = targetState.activeFreespaceStartOffset;
          const contentStart = targetState.activeFreespaceContentStartOffset;
          const end = targetState.activeFreespaceEndOffset;
          if (start === null || contentStart === null || end === null || end < contentStart) {
            return;
          }
          // Asar STAR: bytes 4–5 = size-1, 6–7 = ~size-1. Empty payload → $0000 / $FFFF.
          const lengthMinusOne = Math.max(0, end - contentStart) & 0xffff;
          const complement = ~lengthMinusOne & 0xffff;
          outputBytes[start + 4] = lengthMinusOne & 0xff;
          outputBytes[start + 5] = (lengthMinusOne >> 8) & 0xff;
          outputBytes[start + 6] = complement & 0xff;
          outputBytes[start + 7] = (complement >> 8) & 0xff;
        },
      }),
    });
    context.registerTarget({
      id: SNES_TARGET_ID,
      aliases: ["snes", "sfc", "snes-65816"],
      displayName: "SNES",
      defaultArchitecture: "snes.65816",
      architectures: ["snes.65816", "snes.spc700", "snes.superfx"],
      addressSpace: "snes.cpu",
      outputFormat: "snes.sfc-output",
      directiveSets: [
        "snes.mapper-directives",
        "snes.memory-directives",
        "snes.policy-directives",
        "snes.spc-directives",
        "snes.ca65-compat-directives",
      ],
      expressionSets: ["snes.address-functions", "snes.read-functions"],
      lifecycle: ["snes.lifecycle"],
      syntaxProfile: ASAR_SYNTAX_PROFILE,
      defaultOutputExtension: ".sfc",
      createOptions: targetOptions,
      createLinkTarget: createSnesLinkTarget,
      createSourceLinkRecipe: createSnesSourceLinkRecipe,
    });
  },
});

export default plugin;

/**
 * Activates the SNES plugin and freezes a reusable host environment.
 * @returns {Promise<AssemblerEnvironment>} Frozen SNES environment.
 */
export async function createSnesAssemblerEnvironment(): Promise<AssemblerEnvironment> {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin }]);
  return manager.freeze();
}
