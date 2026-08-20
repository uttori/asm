import { Arch6502 } from "../Arch6502.js";
import { Arch65816 } from "../Arch65816.js";
import { ArchSPC700 } from "../ArchSPC700.js";
import { ArchSuperFX } from "../ArchSuperFX.js";
import type { ArchitectureExtension } from "../architecture-registry.js";
import type { OperandResolver } from "../operand-resolver.js";
import {
  classify6502Operand,
  classify65816Operand,
  classifySpc700Operand,
  classifySuperFxOperand,
} from "../operand-classifiers.js";
import { cpu65816Catalog, spc700Catalog, superFxCatalog } from "../lsp/instruction-catalog.js";
import {
  mos6502StubTargetProfile,
  snesTargetProfile,
  type TargetProfile,
} from "../target-profile.js";
import { PLUGIN_API_VERSION, type ArchitectureContribution } from "./contracts.js";
import { AssemblerEnvironment, type EnvironmentContributions } from "./environment.js";

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
  const addressSpaceRecord = own({
    id: addressSpaceId,
    create: () => ({
      addressWidth: profile.addressSpace.addressWidth,
      defaultOrigin: profile.addressSpace.defaultOrigin,
      normalizeForWrite: (address: number) =>
        profile.addressSpace.normalizeForWrite(address, {
          mapper: profile.defaultMapper,
          sa1banks: [],
        }),
      advance: (address: number, amount: number) =>
        profile.addressSpace.advance(address, amount, {
          mapper: profile.defaultMapper,
          sa1banks: [],
        }),
      toOutputOffset: (address: number) =>
        profile.addressSpace.toOutputOffset(address, {
          mapper: profile.defaultMapper,
          sa1banks: [],
        }),
      fromOutputOffset: (offset: number) =>
        profile.addressSpace.fromOutputOffset(offset, {
          mapper: profile.defaultMapper,
          sa1banks: [],
        }),
    }),
  });
  const outputFormatRecord = own({
    id: outputFormatId,
    create: () => ({
      finalize: () => undefined,
      getOutput: ({ outputBytes }: { outputBytes: number[] | Uint8Array }) =>
        profile.outputFormat.getBinaryOutput(outputBytes),
    }),
  });
  const targetRecord = own({
    id: targetId,
    aliases: [profile.name],
    displayName: profile.name,
    defaultArchitecture: resolveArchitecture(profile.defaultArchitecture),
    architectures: [...profile.architectures].map(resolveArchitecture),
    addressSpace: addressSpaceId,
    outputFormat: outputFormatId,
    directiveSets: [],
    expressionSets: [],
    lifecycle: [],
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
    sessionStates: [],
    architectures: architectureRecords,
    addressSpaces: [addressSpaceRecord],
    outputFormats: [outputFormatRecord],
    directiveSets: [],
    expressionSets: [],
    lifecycles: [],
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
