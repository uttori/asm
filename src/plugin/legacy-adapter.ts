import { Arch6502 } from "../Arch6502.js";
import { Arch65816 } from "../Arch65816.js";
import { ArchSPC700 } from "../ArchSPC700.js";
import { ArchSuperFX } from "../ArchSuperFX.js";
import type { ArchitectureExtension } from "../architecture-registry.js";
import type { OperandResolver } from "../operand-resolver.js";
import {
  ASAR_COMPAT_NO_OP_DIRECTIVES,
  calculateHeaderChecksum,
  getChecksumHeaderOffset,
  shouldEndifCloseInnermostWhile,
} from "../compatibility/asar-compatibility-profile.js";
import {
  classify6502Operand,
  classify65816Operand,
  classifySpc700Operand,
  classifySuperFxOperand,
} from "../operand-classifiers.js";
import { cpu65816Catalog, spc700Catalog, superFxCatalog } from "../lsp/instruction-catalog.js";
import { directiveCatalog } from "../lsp/directive-catalog.js";
import {
  LEGACY_SNES_MAPPER_DIRECTIVE_SET,
  LEGACY_SNES_MEMORY_DIRECTIVE_SET,
  LEGACY_SNES_POLICY_DIRECTIVE_SET,
  LEGACY_SPC_DIRECTIVE_SET,
} from "../directives/directive-set-ids.js";
import {
  mos6502StubTargetProfile,
  snesTargetProfile,
  type TargetProfile,
} from "../target-profile.js";
import {
  PLUGIN_API_VERSION,
  type ArchitectureContribution,
  type ExpressionSetContribution,
  type LifecycleContribution,
  type TargetFactoryContext,
} from "./contracts.js";
import { AssemblerEnvironment, type EnvironmentContributions } from "./environment.js";
import {
  cloneLegacyTargetSessionState,
  LEGACY_TARGET_SESSION_STATE_ID,
  legacyTargetSessionStateKey,
  type LegacyTargetSessionState,
} from "./legacy-session-state.js";

export const SNES_TARGET_ID = "snes.sfc";
export const MOS6502_STUB_TARGET_ID = "mos.6502-stub";

const legacyProfiles = new WeakMap<AssemblerEnvironment, Map<string, TargetProfile>>();

const splitSingleOperand = (text: string): string[] => (text ? [text] : []);
const splitCommaOperands = (text: string): string[] =>
  text ? text.split(",").map((operand) => operand.trim()) : [];
const splitTopLevelCommaOperands = (text: string): string[] => {
  const operands: string[] = [];
  let level = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") level++;
    if (character === ")") level--;
    if (character === "," && level === 0) {
      operands.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) operands.push(current.trim());
  return operands;
};

const builtInArchitectures: readonly ArchitectureContribution[] = [
  {
    id: "snes.65816",
    aliases: ["65816"],
    displayName: "WDC 65C816",
    unknownInstructionBehavior: "throw",
    splitOperands: splitSingleOperand,
    classifyOperand: ({ operands }, operand) => classify65816Operand(operands, operand),
    createEncoder: (context) => new Arch65816(context),
    instructions: cpu65816Catalog,
  },
  {
    id: "snes.spc700",
    aliases: ["spc700", "spc700-raw", "spc700-inline"],
    displayName: "Sony SPC700",
    unknownInstructionBehavior: "throw",
    splitOperands: splitTopLevelCommaOperands,
    classifyOperand: ({ operands }, operand) => classifySpc700Operand(operands, operand),
    createEncoder: (context) => new ArchSPC700(context),
    instructions: spc700Catalog,
  },
  {
    id: "snes.superfx",
    aliases: ["superfx"],
    displayName: "Super FX",
    unknownInstructionBehavior: "returnFalse",
    splitOperands: splitCommaOperands,
    classifyOperand: ({ operands }, operand) => classifySuperFxOperand(operands, operand),
    createEncoder: (context) => new ArchSuperFX(context),
    instructions: superFxCatalog,
  },
  {
    id: "mos.6502-stub",
    aliases: ["6502", "mos6502"],
    displayName: "MOS 6502 (stub)",
    unknownInstructionBehavior: "throw",
    splitOperands: splitSingleOperand,
    classifyOperand: ({ operands }, operand) => classify6502Operand(operands, operand),
    createEncoder: (context) => new Arch6502(context),
    instructions: [],
  },
];

const builtInIds = new Map<string, string>(
  builtInArchitectures.flatMap((architecture) =>
    [architecture.id, ...(architecture.aliases ?? [])].map((alias) => [alias, architecture.id]),
  ),
);

const slug = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .split("")
    .map((character) => (/[\da-z-]/.test(character) ? character : "-"))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "target";
};

const extensionContribution = (
  extension: ArchitectureExtension,
  index: number,
): ArchitectureContribution => ({
  id: `legacy.${slug(extension.name)}-${index}`,
  aliases: [extension.name, ...(extension.aliases ?? [])],
  displayName: extension.name,
  unknownInstructionBehavior: extension.unknownInstructionBehavior,
  splitOperands: extension.splitOperands,
  classifyOperand: ({ operands }, operand) =>
    extension.classifyOperand(operands as OperandResolver, operand),
  createEncoder: (context) => extension.createEncoder(context),
  instructions: [],
});

const numericExpressionArgument = (
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

const legacyAddressExpressionSet: ExpressionSetContribution = {
  id: "legacy.snes-address-functions",
  functions: [
    {
      name: "snestopc",
      signature: { parameters: ["address"] },
      summary: "Convert a SNES address to an output offset.",
      evaluate: ({ addresses }, args) =>
        addresses.toOutputOffset(numericExpressionArgument("snestopc", args, 0)),
    },
    {
      name: "pctosnes",
      signature: { parameters: ["offset"] },
      summary: "Convert an output offset to a SNES address.",
      evaluate: ({ addresses }, args) =>
        addresses.fromOutputOffset(numericExpressionArgument("pctosnes", args, 0)),
    },
  ],
};

const legacyRomReadExpressionSet: ExpressionSetContribution = {
  id: "legacy.rom-read-functions",
  functions: [
    ...[1, 2, 3, 4].map((size) => ({
      name: `canread${size}`,
      signature: { parameters: ["position"] },
      summary: `Return whether ${size} byte(s) can be read from the base image.`,
      evaluate: (
        context: Parameters<ExpressionSetContribution["functions"][number]["evaluate"]>[0],
        args: readonly (number | string)[],
      ) => context.output.canRead(numericExpressionArgument(`canread${size}`, args, 0), size),
    })),
    {
      name: "canread",
      signature: { parameters: ["position", "size"] },
      summary: "Return whether a range can be read from the base image.",
      evaluate: ({ output }, args) =>
        output.canRead(
          numericExpressionArgument("canread", args, 0),
          numericExpressionArgument("canread", args, 1),
        ),
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
      ) =>
        context.output.read(
          numericExpressionArgument(`read${size}`, args, 0),
          size,
          args.length > 1 ? numericExpressionArgument(`read${size}`, args, 1) : undefined,
        ),
    })),
  ],
};

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
export function createLegacyAssemblerEnvironment(
  options: LegacyEnvironmentOptions = {},
): LegacyEnvironmentResolution {
  const profile = options.targetProfile ?? snesTargetProfile;
  const extensions = (options.architectureExtensions ?? []).map(extensionContribution);
  const architectures = [...builtInArchitectures, ...extensions];
  const aliasToId = new Map(builtInIds);
  for (const extension of extensions) {
    for (const alias of [extension.id, ...(extension.aliases ?? [])]) {
      aliasToId.set(alias.toLowerCase(), extension.id);
    }
  }
  const resolveArchitecture = (name: string): string => aliasToId.get(name.toLowerCase()) ?? name;
  let targetId: string;
  if (profile === snesTargetProfile) {
    targetId = SNES_TARGET_ID;
  } else if (profile === mos6502StubTargetProfile) {
    targetId = MOS6502_STUB_TARGET_ID;
  } else {
    targetId = `legacy.${slug(profile.name)}`;
  }
  const addressSpaceId = `${targetId}.address-space`;
  const outputFormatId = `${targetId}.output-format`;

  let registrationOrder = 0;
  const own = <T extends { id: string }>(value: T) => ({
    pluginId: "uttori.legacy-adapter",
    contributionId: value.id,
    registrationOrder: registrationOrder++,
    value,
  });
  const architectureRecords = architectures.map(own);
  const sessionStateRecord = own({
    id: LEGACY_TARGET_SESSION_STATE_ID,
    create: (): LegacyTargetSessionState => ({
      mapper: profile.defaultMapper,
      sa1Banks: [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1],
      checksumEnabled: profile.checksumFixEnabled,
      checksumMode: "asar",
      bankCrossMode: "full",
      readFunctionsEnabled: false,
      optimizeDirectPage: false,
      asarSuperFxMoveShortAddress: false,
      outputFillByte: 0,
      activeFreespaceStartOffset: null,
      activeFreespaceContentStartOffset: null,
      activeFreespaceEndOffset: null,
      inSpcBlock: false,
      spcBlock: null,
      spcInlineCompatibility: false,
    }),
    clone: cloneLegacyTargetSessionState,
    resetForStage: (state: LegacyTargetSessionState) => {
      state.activeFreespaceStartOffset = null;
      state.activeFreespaceContentStartOffset = null;
      state.activeFreespaceEndOffset = null;
      state.inSpcBlock = false;
      state.spcBlock = null;
      state.spcInlineCompatibility = false;
    },
  });
  const addressSpaceRecord = own({
    id: addressSpaceId,
    create: ({ state }: TargetFactoryContext) => {
      const addressContext = () => {
        const targetState = state.get(legacyTargetSessionStateKey);
        return {
          mapper: targetState.mapper,
          sa1banks: targetState.sa1Banks,
          bankCrossCheckMode: targetState.bankCrossMode,
        };
      };
      return {
        addressWidth: profile.addressSpace.addressWidth,
        defaultOrigin: profile.addressSpace.defaultOrigin,
        normalizeForWrite: (address: number) =>
          profile.addressSpace.normalizeForWrite(address, addressContext()),
        advance: (address: number, amount: number) =>
          profile.addressSpace.advance(address, amount, addressContext()),
        toOutputOffset: (address: number) =>
          profile.addressSpace.toOutputOffset(address, addressContext()),
        fromOutputOffset: (offset: number) =>
          profile.addressSpace.fromOutputOffset(offset, addressContext()),
        validateWrite: (address: number, width: number) => {
          const targetState = state.get(legacyTargetSessionStateKey);
          const normalized = profile.addressSpace.normalizeForWrite(address, addressContext());
          if (
            profile.addressSpace.toOutputOffset(normalized, addressContext()) < 0 &&
            profile.addressSpace.unmappedWriteBehavior === "throw"
          ) {
            throw new Error(
              `Logical address $${normalized.toString(16).toUpperCase()} does not map to output.`,
            );
          }
          if (targetState.bankCrossMode === "off" || width <= 1) return;
          const addressMask = 2 ** profile.addressSpace.addressWidth - 1;
          const start = address & addressMask;
          const end = (start + width - 1) & addressMask;
          const bankMask = targetState.bankCrossMode === "half" ? 0x7fff8000 : 0x7fff0000;
          if (((start ^ end) & bankMask) !== 0) {
            const errorAddress = (start + width) & addressMask;
            throw new Error(
              `Ebank_border_crossed: A bank border was crossed, logical address $${errorAddress.toString(16).toUpperCase().padStart(6, "0")}.`,
            );
          }
        },
      };
    },
  });
  const outputFormatRecord = own({
    id: outputFormatId,
    create: ({ state }: TargetFactoryContext) => ({
      finalize: ({ outputBytes }: { outputBytes: number[] | Uint8Array }) => {
        const targetState = state.get(legacyTargetSessionStateKey);
        profile.outputFormat.finalize({
          canFinalize: true,
          checksumFixEnabled: targetState.checksumEnabled,
          bytes: outputBytes,
          updateChecksum: () => {
            const headerOffset = getChecksumHeaderOffset(targetState.mapper);
            if (outputBytes.length < headerOffset + 0x20) return;
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
        });
      },
      getOutput: ({ outputBytes }: { outputBytes: number[] | Uint8Array }) =>
        profile.outputFormat.getBinaryOutput(outputBytes),
    }),
  });
  const expressionSetsById = new Map(
    [legacyAddressExpressionSet, legacyRomReadExpressionSet].map((set) => [set.id, set]),
  );
  const expressionSets = [...profile.expressionSetIds].flatMap((id) => {
    const set = expressionSetsById.get(id);
    return set ? [set] : [];
  });
  const expressionSetRecords = expressionSets.map(own);
  const knownDirectiveSetIds = new Set([
    LEGACY_SNES_MAPPER_DIRECTIVE_SET,
    LEGACY_SNES_MEMORY_DIRECTIVE_SET,
    LEGACY_SNES_POLICY_DIRECTIVE_SET,
    LEGACY_SPC_DIRECTIVE_SET,
  ]);
  const directiveSetIds = [...profile.directiveSetIds].filter((id) => knownDirectiveSetIds.has(id));
  const directiveKeywordsBySet = new Map<string, ReadonlySet<string>>([
    [
      LEGACY_SNES_MAPPER_DIRECTIVE_SET,
      new Set(["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "norom", "fullsa1rom", "sa1rom"]),
    ],
    [
      LEGACY_SNES_MEMORY_DIRECTIVE_SET,
      new Set(["freecode", "freespace", "freedata", "freespacebyte", "prot"]),
    ],
    [
      LEGACY_SNES_POLICY_DIRECTIVE_SET,
      new Set(["check", "optimize", ...ASAR_COMPAT_NO_OP_DIRECTIVES]),
    ],
    [LEGACY_SPC_DIRECTIVE_SET, new Set(["spcblock", "endspcblock", "startpos"])],
  ]);
  const directiveSetRecords = directiveSetIds.map((id) => {
    const keywords = directiveKeywordsBySet.get(id) ?? new Set<string>();
    return own({
      id,
      directives: [],
      tooling: directiveCatalog.filter((descriptor) => keywords.has(descriptor.keyword)),
    });
  });
  const lifecycleIds = ["legacy.target-lifecycle"];
  const lifecycleRecords = lifecycleIds.map((id) =>
    own<LifecycleContribution>({
      id,
      create: ({ state }: TargetFactoryContext) => {
        return {
          shouldEndifCloseInnermostWhile: ({ loopType, loopStartLine, ifStartLine }) =>
            profile.directiveSetIds.has(LEGACY_SNES_POLICY_DIRECTIVE_SET)
              ? shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine)
              : undefined,
          beforeWrite: ({ logicalAddress, width }) => {
            const targetState = state.get(legacyTargetSessionStateKey);
            if (targetState.activeFreespaceStartOffset === null) return;
            const outputOffset = profile.addressSpace.toOutputOffset(logicalAddress, {
              mapper: targetState.mapper,
              sa1banks: targetState.sa1Banks,
            });
            if (outputOffset < 0) return;
            const endOffset = outputOffset + width - 1;
            targetState.activeFreespaceEndOffset = Math.max(
              targetState.activeFreespaceEndOffset ?? endOffset,
              endOffset,
            );
          },
          beforeOutputFinalize: ({ outputBytes }) => {
            const targetState = state.get(legacyTargetSessionStateKey);
            const start = targetState.activeFreespaceStartOffset;
            const contentStart = targetState.activeFreespaceContentStartOffset;
            const end = targetState.activeFreespaceEndOffset;
            if (start === null || contentStart === null || end === null || end < contentStart)
              return;
            const lengthMinusOne = Math.max(0, end - contentStart) & 0xffff;
            const complement = ~lengthMinusOne & 0xffff;
            outputBytes[start + 4] = lengthMinusOne & 0xff;
            outputBytes[start + 5] = (lengthMinusOne >> 8) & 0xff;
            outputBytes[start + 6] = complement & 0xff;
            outputBytes[start + 7] = (complement >> 8) & 0xff;
          },
        };
      },
    }),
  );
  const targetRecord = own({
    id: targetId,
    aliases: [profile.name],
    displayName: profile.name,
    defaultArchitecture: resolveArchitecture(profile.defaultArchitecture),
    architectures: [...profile.architectures].map(resolveArchitecture),
    addressSpace: addressSpaceId,
    outputFormat: outputFormatId,
    directiveSets: directiveSetIds,
    expressionSets: expressionSets.map((set) => set.id),
    lifecycle: lifecycleIds,
    defaultOutputExtension: profile.outputFormat.defaultExtension,
  });
  const contributions: EnvironmentContributions = {
    manifests: [
      {
        id: "uttori.legacy-adapter",
        name: "Temporary built-in target adapter",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
      },
    ],
    sessionStates: [sessionStateRecord],
    architectures: architectureRecords,
    addressSpaces: [addressSpaceRecord],
    outputFormats: [outputFormatRecord],
    directiveSets: directiveSetRecords,
    expressionSets: expressionSetRecords,
    lifecycles: lifecycleRecords,
    targets: [targetRecord],
  };
  const environment = new AssemblerEnvironment(contributions);
  legacyProfiles.set(environment, new Map([[targetId, profile]]));
  return { environment, target: targetId };
}

export function getLegacyTargetProfile(
  environment: AssemblerEnvironment,
  targetId: string,
): TargetProfile | undefined {
  return legacyProfiles.get(environment)?.get(targetId);
}

export const snesAssemblerHost = createLegacyAssemblerEnvironment({
  targetProfile: snesTargetProfile,
});
export const mos6502StubAssemblerHost = createLegacyAssemblerEnvironment({
  targetProfile: mos6502StubTargetProfile,
});
